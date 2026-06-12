/**
 * 种子脚本：将监控页面密码的 bcrypt 哈希写入 SiteSetting
 * 密码: bugoo2026
 * 用法: npx tsx scripts/seed-monitoring-password.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const key = "monitoring_password";
  const rawPassword = "bugoo2026";

  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  if (existing) {
    console.log(`✅ "${key}" 已存在，跳过写入。`);
    console.log(`   当前哈希: ${existing.value.slice(0, 20)}...`);
    return;
  }

  const hash = await bcrypt.hash(rawPassword, 12);
  await prisma.siteSetting.create({ data: { key, value: hash } });
  console.log(`✅ 监控密码已写入 SiteSetting (key="${key}")`);
}

main()
  .catch((e) => {
    console.error("❌ 写入失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
