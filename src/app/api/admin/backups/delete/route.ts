/**
 * POST /api/admin/backups/delete — 删除指定大版本备份
 * 删除数据库 BackupVersion 记录 + 对应的文件目录
 */
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  try {
    const body = await req.json().catch(() => ({}));
    const versionId = body.versionId as string;

    if (!versionId) return apiError("缺少 versionId", 400);

    // 1. 查找版本记录
    const version = await prisma.backupVersion.findUnique({ where: { id: versionId } });
    if (!version) return apiError("大版本不存在", 404);

    // 2. 找到对应的备份日期目录
    const dateStr = new Date(version.createdAt).toISOString().slice(0, 10);
    const backupDir = path.join(process.cwd(), "backups", dateStr);

    // 3. 检查是否有其他版本在同一天（防止误删别的版本的备份文件）
    const sameDayVersions = await prisma.backupVersion.count({
      where: {
        id: { not: versionId },
        createdAt: {
          gte: new Date(`${dateStr}T00:00:00.000Z`),
          lt:  new Date(`${dateStr}T23:59:59.999Z`),
        },
      },
    });

    // 4. 删除数据库记录
    await prisma.backupVersion.delete({ where: { id: versionId } });

    // 5. 删除文件目录（只有当天没有其他版本时才删）
    if (sameDayVersions === 0 && fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }

    return apiResponse({
      deleted: true,
      version: version.version,
      date: dateStr,
      filesDeleted: sameDayVersions === 0,
    });
  } catch (e: any) {
    console.error("[Backup delete] failed:", e);
    return apiError("删除失败: " + (e.message ?? "未知错误"), 500);
  }
}
