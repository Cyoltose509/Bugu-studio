/**
 * 安全数据库推送脚本
 * 在 prisma db push 之前自动备份，阻止危险操作
 *
 * 用法:
 *   npx tsx scripts/safe-db-push.ts              → 备份 → 确认 → prisma db push
 *   npx tsx scripts/safe-db-push.ts --accept-data-loss → 同上，跳过危险操作确认
 *
 * 🚫 绝对阻止: --force-reset (除非同时传 --i-know-what-i-am-doing)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const args = process.argv.slice(2);
const FORCE_RESET = args.includes("--force-reset");
const ACCEPT_DATA_LOSS = args.includes("--accept-data-loss");
const EMERGENCY_OVERRIDE = args.includes("--i-know-what-i-am-doing");

// ============================================================
// 安全检查
// ============================================================

if (FORCE_RESET && !EMERGENCY_OVERRIDE) {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  🚫 危险操作被拦截！                                      ║");
  console.log("║                                                          ║");
  console.log("║  --force-reset 会清空整个数据库的所有数据！               ║");
  console.log("║                                                          ║");
  console.log("║  如果你真的确定要这样做，请使用:                          ║");
  console.log("║    npx tsx scripts/safe-db-push.ts --force-reset \\       ║");
  console.log("║      --accept-data-loss --i-know-what-i-am-doing         ║");
  console.log("║                                                          ║");
  console.log("║  在此之前，请先手动备份:                                 ║");
  console.log("║    npx tsx scripts/backup-db.ts                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  process.exit(1);
}

// ============================================================
// 步骤 1: 自动备份
// ============================================================

console.log("📦 步骤 1/3: 自动备份数据库...\n");

const backupScript = path.resolve(__dirname, "backup-db.ts");
try {
  execSync(`npx tsx "${backupScript}"`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    timeout: 30000,
  });
} catch (e) {
  console.log("\n⚠️  备份脚本执行失败，但继续流程（可能已有最近的备份）\n");
}

// ============================================================
// 步骤 2: 确认
// ============================================================

if (FORCE_RESET) {
  console.log("⚠️  警告: --force-reset 模式！数据库将被完全清空后重建！\n");
}

if (!ACCEPT_DATA_LOSS && !FORCE_RESET) {
  // 普通 push，快速确认
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("步骤 2/3: 即将执行 prisma db push，是否继续？(y/N) ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("❌ 已取消");
    process.exit(0);
  }
} else {
  console.log("步骤 2/3: 已跳过确认（--accept-data-loss）\n");
}

if (FORCE_RESET) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("🔴 最终确认: 输入 'DELETE ALL MY DATA' 以确认清空数据库: ", resolve);
  });
  rl.close();

  if (answer !== "DELETE ALL MY DATA") {
    console.log("❌ 已取消");
    process.exit(0);
  }
}

// ============================================================
// 步骤 3: 执行 prisma db push
// ============================================================

console.log("\n🚀 步骤 3/3: 执行 prisma db push...\n");

const pushArgs = ["npx", "prisma", "db", "push"];
if (FORCE_RESET) pushArgs.push("--force-reset");
if (ACCEPT_DATA_LOSS) pushArgs.push("--accept-data-loss");

try {
  execSync(pushArgs.join(" "), {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  console.log("\n✅ prisma db push 执行成功");
} catch (e) {
  console.log("\n❌ prisma db push 执行失败");
  console.log("💡 备份文件保存在 backups/ 目录，可以用于恢复");
  process.exit(1);
}
