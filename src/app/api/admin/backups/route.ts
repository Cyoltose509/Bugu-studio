/**
 * GET  /api/admin/backups  — 列出大版本 + 审计日志计数
 * POST /api/admin/backups  — 导出全表 → 加密 → 上传 R2 → 写入 BackupVersion
 *
 * 权限：仅 ADMIN。备份含 passwordHash，云端对象已加密（见 lib/backup/crypto）。
 */
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { BACKUP_TABLES } from "@/lib/backup/tables";
import { uploadBackupPayload } from "@/lib/backup/storage";

/** GET /api/admin/backups — 列出大版本 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  const versions = await prisma.backupVersion.findMany({
    orderBy: { version: "desc" },
  });

  // 每个大版本对应「该版本创建时刻 → 下一版本创建时刻」之间的审计日志
  const timeRanges = versions.map((v, i) => {
    if (i === 0) return { versionId: v.id, gte: v.createdAt };
    return { versionId: v.id, gte: v.createdAt, lt: versions[i - 1].createdAt };
  });

  const [logCounts, activeLogCount, totalLogs] = await Promise.all([
    Promise.all(
      timeRanges.map(({ versionId, gte, lt }) =>
        prisma.auditLog
          .count({ where: { createdAt: { gte, ...(lt ? { lt } : {}) } } })
          .then((count) => ({ versionId, count }))
      )
    ),
    prisma.auditLog.count({
      where: versions[0] ? { createdAt: { gte: versions[0].createdAt } } : {},
    }),
    prisma.auditLog.count(),
  ]);

  const logCountMap = new Map(logCounts.map((lc) => [lc.versionId, lc.count]));
  const result = versions.map((v) => ({ ...v, logCount: logCountMap.get(v.id) ?? 0 }));

  return apiResponse({ versions: result, activeLogCount, totalLogs });
}

/** POST /api/admin/backups — 创建大版本备份并上传到 R2 */
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  try {
    const tables: Record<string, any[]> = {};
    let total = 0;

    for (const table of BACKUP_TABLES) {
      const model = (prisma as any)[table];
      if (!model?.findMany) {
        tables[table] = [];
        continue;
      }
      // 完整快照：必须保留 passwordHash，否则恢复后 Credentials 登录全废
      const records = await model.findMany();
      tables[table] = records;
      total += records.length;
    }

    const lastVersion = await prisma.backupVersion.findFirst({ orderBy: { version: "desc" } });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const bundle = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      tables,
    };

    // 先上传成功再写库记录，避免「库里有版本、云端没有文件」
    const { key, bytes } = await uploadBackupPayload(nextVersion, bundle);

    const newVersion = await prisma.backupVersion.create({
      data: {
        version: nextVersion,
        recordCount: total,
        fileSize: bytes,
        label: `云端加密备份 ${key}`,
        status: "completed",
      },
    });

    return apiResponse({
      version: newVersion,
      totalRecords: total,
      storageKey: key,
      note: "备份已加密写入 Cloudflare R2。即使桶可公开访问，对象也是密文。",
    });
  } catch (e: any) {
    console.error("[Backup] failed:", e);
    return apiError("备份失败: " + (e.message ?? "未知错误"), 500);
  }
}
