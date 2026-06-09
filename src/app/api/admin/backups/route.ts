import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import fs from "fs";
import path from "path";

// 所有需要备份的表
const TABLES = [
  "siteSetting", "tag", "user", "account", "session",
  "clubMember", "memberLink", "project", "projectImage",
  "projectMember", "projectLike", "projectLink", "projectTag",
  "comment", "notification", "review", "announcement",
  "yearEvent", "eventImage", "inviteCode", "auditLog",
  "loginAttempt", "rateLimit", "verificationToken",
] as const;

async function backupAllTables(): Promise<{ count: number; dir: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const dir = path.join(process.cwd(), "backups", dateStr);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let total = 0;
  for (const table of TABLES) {
    const records = await (prisma as any)[table].findMany();
    total += records.length;
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(records, null, 2), "utf-8");
  }
  return { count: total, dir };
}

/** GET /api/admin/backups — 列出所有大版本 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  const versions = await prisma.backupVersion.findMany({
    orderBy: { version: "desc" },
  });

  // 批量计算所有版本的审计日志数量（单次 groupBy + Promise.all）
  const timeRanges = versions.map((v, i) => {
    if (i === 0) return { versionId: v.id, gte: v.createdAt };
    return { versionId: v.id, gte: v.createdAt, lt: versions[i - 1].createdAt };
  });

  const [logCounts, activeLogCount, totalLogs] = await Promise.all([
    Promise.all(
      timeRanges.map(({ versionId, gte, lt }) =>
        prisma.auditLog.count({ where: { createdAt: { gte, ...(lt ? { lt } : {}) } } })
          .then(count => ({ versionId, count }))
      )
    ),
    prisma.auditLog.count({
      where: versions[0] ? { createdAt: { gte: versions[0].createdAt } } : {},
    }),
    prisma.auditLog.count(),
  ]);

  const logCountMap = new Map(logCounts.map(lc => [lc.versionId, lc.count]));
  const result = versions.map(v => ({ ...v, logCount: logCountMap.get(v.id) ?? 0 }));

  return apiResponse({ versions: result, activeLogCount, totalLogs });
}

/** POST /api/admin/backups — 一键创建大版本备份 */
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return apiError("无权限", 403);

  try {
    // 1. 备份所有表数据
    const { count, dir } = await backupAllTables();

    // 2. 创建备份版本记录
    const lastVersion = await prisma.backupVersion.findFirst({ orderBy: { version: "desc" } });
    const newVersion = await prisma.backupVersion.create({
      data: {
        version: (lastVersion?.version ?? 0) + 1,
        recordCount: count,
        label: `自动备份 v${(lastVersion?.version ?? 0) + 1}`,
        status: "completed",
      },
    });

    return apiResponse({ version: newVersion, totalRecords: count, backupDir: dir });
  } catch (e: any) {
    console.error("[Backup] failed:", e);
    return apiError("备份失败: " + (e.message ?? "未知错误"), 500);
  }
}
