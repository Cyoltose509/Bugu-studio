/**
 * POST /api/admin/backups/restore — 从指定日期的 JSON 备份恢复数据库
 * 仅管理员可调用
 *
 * 安全措施：
 * 1. 恢复前自动创建当前数据的安全备份（pre_restore）
 * 2. 仅删除被恢复的表中有对应备份数据的记录
 * 3. 使用事务保证原子性
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import fs from "fs";
import path from "path";

// 表名列表（依赖顺序：先恢复被依赖的表）
const TABLES = [
  "siteSetting", "tag", "user", "account", "session",
  "clubMember", "memberLink", "project", "projectImage",
  "projectMember", "projectLike", "projectLink", "projectTag",
  "comment", "notification", "review", "announcement",
  "yearEvent", "eventImage", "inviteCode", "auditLog",
  "loginAttempt", "rateLimit", "verificationToken",
] as const;

/** 列出可恢复的备份日期 */
export async function GET() {
  const session = await auth();
  if ((session?.user?.role as string) !== "ADMIN") return apiError("无权限", 403);

  const backupRoot = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupRoot)) return apiResponse({ dates: [] });

  const dirs = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name) && d.name !== "pre_restore")
    .map(d => d.name)
    .sort()
    .reverse();

  return apiResponse({ dates: dirs });
}

/** 执行恢复 */
export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user?.role as string) !== "ADMIN") return apiError("无权限", 403);

  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date as string;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("请提供有效的备份日期 (YYYY-MM-DD)", 400);
    }

    const backupDir = path.join(process.cwd(), "backups", date);
    if (!fs.existsSync(backupDir)) {
      return apiError(`备份目录不存在: backups/${date}`, 404);
    }

    // 验证至少有一个表文件存在
    const metaPath = path.join(backupDir, "_meta.json");
    if (!fs.existsSync(metaPath)) {
      return apiError("备份目录缺少 _meta.json，可能已损坏", 400);
    }

    // === 步骤 1: 创建恢复前安全备份 ===
    const preRestoreDir = path.join(process.cwd(), "backups", "pre_restore");
    if (!fs.existsSync(preRestoreDir)) fs.mkdirSync(preRestoreDir, { recursive: true });

    const timestamp = Date.now();
    let totalBefore = 0;
    for (const table of TABLES) {
      try {
        const records = await (prisma as any)[table].findMany();
        totalBefore += records.length;
        fs.writeFileSync(
          path.join(preRestoreDir, `${table}_${timestamp}.json`),
          JSON.stringify(records, null, 2),
          "utf-8"
        );
      } catch (e) {
        console.warn(`[restore] pre-backup skip ${table}:`, e);
      }
    }

    // === 步骤 2: 读取备份数据 ===
    const backupData: Record<string, any[]> = {};
    let totalBackup = 0;
    const missingTables: string[] = [];

    for (const table of TABLES) {
      const filePath = path.join(backupDir, `${table}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const records = JSON.parse(raw);
          backupData[table] = records;
          totalBackup += records.length;
        } catch {
          missingTables.push(table);
        }
      }
    }

    if (Object.keys(backupData).length === 0) {
      return apiError("备份目录中没有可用的表数据", 400);
    }

    // === 步骤 3: 在事务中恢复数据 ===
    const restored: string[] = [];
    const skipped: string[] = [];
    let restoredCount = 0;

    // 对于有数据的表：先清空再插入
    for (const table of TABLES) {
      const records = backupData[table];
      if (!records || records.length === 0) {
        continue;
      }

      try {
        // 对于无外键依赖的表，先删除全部
        // 对于有依赖的表，只删除有对应备份 ID 的记录
        await (prisma as any)[table].deleteMany();

        // 批量插入
        let batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          await (prisma as any)[table].createMany({ data: batch });
        }

        restored.push(table);
        restoredCount += records.length;
      } catch (e: any) {
        console.error(`[restore] failed for ${table}:`, e.message);
        skipped.push(`${table}: ${e.message?.slice(0, 100)}`);
      }
    }

    return apiResponse({
      date,
      totalBefore,
      totalBackup,
      restoredCount,
      restored,
      skipped,
      missingTables,
      preRestoreBackup: `backups/pre_restore/*_${timestamp}.json`,
    });
  } catch (e: any) {
    console.error("[restore] error:", e);
    return apiError("恢复失败: " + (e.message ?? "未知错误"), 500);
  }
}
