/**
 * R2 诊断 API — 排查应用与 Cloudflare Dashboard 文件数／大小差异
 * GET — 返回 R2 对象统计 + 未完成分片上传详情
 */
import { NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  ListMultipartUploadsCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth/auth";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // 1. 扫描所有正常对象
    let totalObjects = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;
    let isTruncated = false;
    let pages = 0;

    do {
      pages++;
      const cmd = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const res = await client.send(cmd);

      isTruncated = res.IsTruncated ?? false;
      const keyCount = res.KeyCount ?? 0;

      for (const obj of res.Contents || []) {
        if (obj.Key) {
          totalObjects++;
          totalSize += obj.Size || 0;
        }
      }

      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    // 2. 扫描未完成的分片上传（Multipart Uploads）
    let uploads: {
      uploadId: string;
      key: string;
      initiated: string;
      parts: number;
      partsSize: number;
      partsSizeFormatted: string;
    }[] = [];
    let totalUploadParts = 0;
    let totalUploadSize = 0;
    let uploadPages = 0;

    do {
      uploadPages++;
      try {
        const mpCmd = new ListMultipartUploadsCommand({
          Bucket: bucketName,
          MaxUploads: 1000,
          // 分页：第一次不带 Marker，后续用上次最后一项的 Key + UploadId
          ...(uploadPages > 1 && uploads.length > 0
            ? {
                KeyMarker: uploads[uploads.length - 1].key,
                UploadIdMarker: uploads[uploads.length - 1].uploadId,
              }
            : {}),
        });
        const mpRes = await client.send(mpCmd);

        for (const upload of mpRes.Uploads || []) {
          if (!upload.UploadId || !upload.Key) continue;

          // 获取每个上传的所有分片（处理 Parts 分页）
          let partsSize = 0;
          let partCount = 0;
          let partMarker: string | undefined;
          do {
            const partsCmd = new ListPartsCommand({
              Bucket: bucketName,
              Key: upload.Key,
              UploadId: upload.UploadId,
              PartNumberMarker: partMarker || undefined,
              MaxParts: 1000,
            });
            const partsRes = await client.send(partsCmd);

            for (const part of partsRes.Parts || []) {
              partsSize += part.Size || 0;
              partCount++;
            }

            partMarker = partsRes.NextPartNumberMarker
              ? String(partsRes.NextPartNumberMarker)
              : undefined;
          } while (partMarker);

          uploads.push({
            uploadId: upload.UploadId,
            key: upload.Key,
            initiated: upload.Initiated?.toISOString() || "unknown",
            parts: partCount,
            partsSize,
            partsSizeFormatted: formatBytes(partsSize),
          });

          totalUploadParts += partCount;
          totalUploadSize += partsSize;
        }

        // 超过 1000 条则继续
        if (!mpRes.IsTruncated || (mpRes.Uploads || []).length < 1000) break;
      } catch {
        // 某些 R2 token 可能不支持 ListMultipartUploads
        break;
      }
    } while (uploadPages < 100); // safety cap

    const combinedSize = totalSize + totalUploadSize;

    return NextResponse.json({
      objects: {
        count: totalObjects,
        size: totalSize,
        sizeFormatted: formatBytes(totalSize),
        listPages: pages,
        isTruncated,
      },
      multipartUploads: {
        count: uploads.length,
        totalParts: totalUploadParts,
        totalSize: totalUploadSize,
        totalSizeFormatted: formatBytes(totalUploadSize),
        listPages: uploadPages,
        uploads: uploads.slice(0, 100), // 最多返回 100 条详情
      },
      combined: {
        totalObjects: totalObjects + uploads.length,
        totalSize: combinedSize,
        totalSizeFormatted: formatBytes(combinedSize),
      },
      note: totalUploadSize > 0
        ? `⚠️ 发现 ${uploads.length} 个未完成的分片上传，占用 ${formatBytes(totalUploadSize)}。这些碎片在 Cloudflare Dashboard 中计入总大小，但不在 ListObjectsV2 中显示。`
        : "✅ 没有未完成的分片上传，与 Cloudflare Dashboard 的差异可能来自其他原因（版本控制、生命周期延迟等）。",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
