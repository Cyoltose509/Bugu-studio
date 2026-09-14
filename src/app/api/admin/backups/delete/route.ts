/**
 * POST /api/admin/backups/delete — 删除大版本记录（及 R2 备份文件，尽力删除）
 */
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { backupObjectKey } from "@/lib/backup/storage";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  try {
    const body = await req.json().catch(() => ({}));
    const versionId = body.versionId as string;
    if (!versionId) return apiError("缺少 versionId", 400);

    const version = await prisma.backupVersion.findUnique({ where: { id: versionId } });
    if (!version) return apiError("大版本不存在", 404);

    await prisma.backupVersion.delete({ where: { id: versionId } });

    let cloudDeleted = false;
    try {
      const accountId = process.env.R2_ACCOUNT_ID;
      const bucket = process.env.R2_BUCKET_NAME;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      if (accountId && bucket && accessKeyId && secretAccessKey) {
        const client = new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: true,
        });
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: backupObjectKey(version.version),
          })
        );
        cloudDeleted = true;
      }
    } catch (e) {
      console.warn("[Backup delete] R2 delete failed:", e);
    }

    return apiResponse({
      deleted: true,
      version: version.version,
      cloudDeleted,
    });
  } catch (e: any) {
    console.error("[Backup delete] failed:", e);
    return apiError("删除失败: " + (e.message ?? "未知错误"), 500);
  }
}
