/**
 * 备份恢复 API
 *
 * GET  /api/admin/backups/restore — 列出版本，并标记云端文件是否存在
 * POST /api/admin/backups/restore — body: { version: number }
 *
 * 安全与数据约定：
 * - 仅 ADMIN
 * - 从 R2 拉取加密快照 → 解密 → 单事务整库替换
 * - 失败抛错则事务回滚，库保持恢复前状态
 * - 旧「本地 backups/日期目录」明文方案已废弃，不可再用于恢复
 */
import { auth } from "@/lib/auth/auth";
import { apiResponse, apiError } from "@/lib/utils";
import { downloadBackupPayload, backupExists } from "@/lib/backup/storage";
import { restoreBundleAtomically, type BackupBundle } from "@/lib/backup/restore";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if ((session?.user?.role as string) !== "ADMIN") return apiError("无权限", 403);

  const versions = await prisma.backupVersion.findMany({
    orderBy: { version: "desc" },
    select: { id: true, version: true, label: true, recordCount: true, createdAt: true, status: true },
  });

  const withStorage = await Promise.all(
    versions.map(async (v) => ({
      ...v,
      hasCloudFile: await backupExists(v.version),
    }))
  );

  return apiResponse({ versions: withStorage });
}

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user?.role as string) !== "ADMIN") return apiError("无权限", 403);

  try {
    const body = await req.json().catch(() => ({}));
    const version = Number(body.version);

    if (!Number.isInteger(version) || version < 1) {
      return apiError("请提供有效的备份版本号 version（正整数）", 400);
    }

    // 二次确认口令：降低误触（前端也会 prompt，这里再挡一层脚本误调）
    if (body.confirm !== "确认恢复") {
      return apiError('请在 body.confirm 中传入「确认恢复」', 400);
    }

    const meta = await prisma.backupVersion.findUnique({ where: { version } });
    if (!meta) {
      return apiError(`数据库中不存在大版本 v${version}`, 404);
    }

    let bundle: BackupBundle;
    try {
      bundle = (await downloadBackupPayload(version)) as BackupBundle;
    } catch (e: any) {
      return apiError(
        `无法读取 v${version} 备份：${e.message || "文件不存在或无法解密"}。请先用「一键备份」生成新的加密备份。`,
        404
      );
    }

    if (!bundle?.tables || typeof bundle.tables !== "object") {
      return apiError("备份文件格式无效（缺少 tables）", 400);
    }

    // 防止下错文件：密文内嵌的 version 应与请求一致
    if (bundle.version != null && Number(bundle.version) !== version) {
      return apiError(
        `备份内容版本号不匹配：请求 v${version}，文件内为 v${bundle.version}`,
        400
      );
    }

    const totalBackup = Object.values(bundle.tables).reduce(
      (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
      0
    );

    const { restored, restoredCount } = await restoreBundleAtomically({
      version,
      createdAt: bundle.createdAt || new Date().toISOString(),
      tables: bundle.tables,
    });

    return apiResponse({
      version,
      totalBackup,
      restoredCount,
      restored,
      skipped: [],
      missingTables: [],
      note: "已在单事务内完整恢复。若当前会话失效，请重新登录。",
    });
  } catch (e: any) {
    console.error("[restore] error:", e);
    return apiError("恢复失败（已回滚，数据未改坏）: " + (e.message ?? "未知错误"), 500);
  }
}
