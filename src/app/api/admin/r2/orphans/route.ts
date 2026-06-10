/**
 * R2 野文件检测 + 删除 API
 * GET  — 扫描 R2 中不在数据库引用的文件（野文件）
 * POST — 删除指定的野文件
 */

import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth/auth";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 收集数据库里所有引用了 R2 URL 的集合
async function collectReferencedUrls(publicUrl: string): Promise<Set<string>> {
  const urls = new Set<string>();
  const base = publicUrl.replace(/\/+$/, "");

  function addUrl(url: string | null | undefined) {
    if (!url) return;
    if (url.startsWith("http")) {
      urls.add(url);
    } else {
      urls.add(`${base}/${url.replace(/^\//, "")}`);
    }
  }

  // User.image
  const users = await prisma.user.findMany({
    where: { image: { not: null } },
    select: { image: true },
  });
  users.forEach((u) => addUrl(u.image));

  // ClubMember.avatar
  const members = await prisma.clubMember.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true },
  });
  members.forEach((m) => addUrl(m.avatar));

  // Project.coverImage
  const projects = await prisma.project.findMany({
    where: { coverImage: { not: null } },
    select: { coverImage: true },
  });
  projects.forEach((p) => addUrl(p.coverImage));

  // ProjectImage.url
  const projectImages = await prisma.projectImage.findMany({
    select: { url: true },
  });
  projectImages.forEach((pi) => addUrl(pi.url));

  // Activity.coverImage
  const activities = await prisma.activity.findMany({
    where: { coverImage: { not: null } },
    select: { coverImage: true },
  });
  activities.forEach((a) => addUrl(a.coverImage));

  // EventImage.url
  const eventImages = await prisma.eventImage.findMany({
    select: { url: true },
  });
  eventImages.forEach((ei) => addUrl(ei.url));

  // JamSubmission.files (String[]) — Game Jam 作品提交截图
  const jamSubmissions = await prisma.jamSubmission.findMany();
  jamSubmissions.forEach((s: any) => {
    s.files?.forEach((f: string) => addUrl(f));
    // metadata.coverImage — JSON 字段中的封面图
    if (s.metadata && typeof s.metadata === "object" && !Array.isArray(s.metadata)) {
      const cover = (s.metadata as Record<string, unknown>).coverImage;
      if (typeof cover === "string") addUrl(cover);
    }
  });

  return urls;
}

// 列出所有 R2 对象（分页遍历）
async function listAllR2Objects(
  client: S3Client,
  bucketName: string
): Promise<{ key: string; size: number; lastModified?: Date }[]> {
  const objects: { key: string; size: number; lastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const res = await client.send(cmd);

    for (const obj of res.Contents || []) {
      if (obj.Key) {
        objects.push({
          key: obj.Key,
          size: obj.Size || 0,
          lastModified: obj.LastModified,
        });
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// GET — 扫描野文件
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !publicUrl || !accessKey || !secretKey) {
    return NextResponse.json({ error: "R2 未配置" }, { status: 500 });
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    const referencedUrls = await collectReferencedUrls(publicUrl);
    const allObjects = await listAllR2Objects(client, bucketName);

    const orphans = allObjects.filter((obj) => {
      const key = obj.key;
      // endsWith 匹配：容忍域名/前缀不一致（如自定义域名 vs .r2.dev 域名）
      // 同时去掉 URL 中的 query / hash 部分再比较
      return !Array.from(referencedUrls).some((url) => {
        const normalized = url.split("?")[0].split("#")[0];
        return normalized.endsWith(key);
      });
    });

    const publicBase = publicUrl!.replace(/\/+$/, "");

    return NextResponse.json({
      total: allObjects.length,
      referenced: referencedUrls.size,
      orphans: orphans.map((o) => ({
        key: o.key,
        size: o.size,
        sizeFormatted: formatBytes(o.size),
        lastModified: o.lastModified?.toISOString() || null,
        publicUrl: `${publicBase}/${o.key}`,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — 删除指定野文件  body: { keys: string[] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { keys } = body;

  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "Invalid keys" }, { status: 400 });
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !accessKey || !secretKey) {
    return NextResponse.json({ error: "R2 未配置" }, { status: 500 });
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    const results: { key: string; success: boolean; error?: string; stillExists?: boolean }[] = [];
    for (const key of keys) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: key })
        );
        // 验证删除是否真的生效：HeadObject 应该返回 404
        let stillExists = false;
        try {
          await client.send(
            new HeadObjectCommand({ Bucket: bucketName, Key: key })
          );
          stillExists = true; // 文件还在，删除没生效
        } catch (headErr: any) {
          // 404 = 文件已删除，没错；其他错误也要记录
          if (headErr.$metadata?.httpStatusCode !== 404) {
            // 不是 404，可能网络问题，记录警告但不算失败
            console.warn(`HeadObject after delete non-404:`, headErr.$metadata?.httpStatusCode);
          }
        }
        if (stillExists) {
          results.push({ key, success: false, error: "文件仍然存在，删除未生效", stillExists: true });
        } else {
          results.push({ key, success: true });
        }
      } catch (e: any) {
        results.push({ key, success: false, error: e.message });
      }
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
