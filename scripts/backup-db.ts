/**
 * 数据库备份脚本
 * 导出所有表数据到 JSON 文件，保存最近 N 天的备份
 * 运行: npx tsx scripts/backup-db.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = path.resolve(__dirname, "..", "backups");
const KEEP_DAYS = 7;
const p = new PrismaClient();

/** 按依赖顺序排列的模型名列表 */
const MODELS = [
  "siteSetting",
  "tag",
  "user",
  "account",
  "session",
  "clubMember",
  "memberLink",
  "project",
  "projectImage",
  "projectMember",
  "projectLike",
  "projectLink",
  "projectTag",
  "comment",
  "notification",
  "review",
  "announcement",
  "yearEvent",
  "eventImage",
  "inviteCode",
  "auditLog",
  "loginAttempt",
  "rateLimit",
  "verificationToken",
] as const;

async function backup() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const backupPath = path.join(BACKUP_DIR, dateStr);
  fs.mkdirSync(backupPath, { recursive: true });

  console.log(`📦 备份到 ${backupPath}`);

  let totalRecords = 0;

  for (const modelName of MODELS) {
    try {
      const model = (p as any)[modelName];
      if (!model) { console.log(`  ⚠️ 跳过 ${modelName}: 模型不存在`); continue; }
      const rows = await model.findMany();
      const file = path.join(backupPath, `${modelName}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      console.log(`  ✅ ${modelName}: ${rows.length} 条`);
      totalRecords += rows.length;
    } catch (e: any) {
      console.log(`  ❌ ${modelName}: ${e.message?.slice(0, 100)}`);
    }
  }

  // 写入元信息
  fs.writeFileSync(
    path.join(backupPath, "_meta.json"),
    JSON.stringify({ backupTime: now.toISOString(), totalRecords }, null, 2)
  );

  console.log(`\n📊 共备份 ${totalRecords} 条记录`);

  // 清理旧备份
  const dirs = fs.readdirSync(BACKUP_DIR).filter((d) => {
    const dpath = path.join(BACKUP_DIR, d);
    return fs.statSync(dpath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
  });

  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  for (const dir of dirs) {
    if (new Date(dir) < cutoff) {
      const dpath = path.join(BACKUP_DIR, dir);
      fs.rmSync(dpath, { recursive: true });
      console.log(`  🗑️  清理旧备份: ${dir}`);
    }
  }

  console.log("🎉 备份完成");
}

backup()
  .catch((e) => { console.error("❌ 备份失败:", e); process.exit(1); })
  .finally(async () => { await p.$disconnect(); });
