/**
 * 紧急恢复脚本 — 数据库重置后创建最小可用数据
 * 运行: npx tsx scripts/recovery.ts
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const p = new PrismaClient();

async function main() {
  console.log("🩹 开始紧急恢复...\n");

  // ── 1. 站点设置 ──
  const settings = [
    { key: "site_name", value: "布谷工作室" },
    { key: "site_description", value: "我们是一群热爱游戏开发的同学，一起创造有趣的游戏世界。" },
    { key: "club_founded_year", value: "2019" },
    { key: "allow_registration", value: "true" },
    { key: "require_email_verification", value: "false" },
  ];
  for (const s of settings) {
    try {
      await p.siteSetting.upsert({ where: { key: s.key }, update: {}, create: s });
    } catch (e) { console.log("  ⚠️ 设置 " + s.key + ": " + (e as any).message?.slice(0, 60)); }
  }
  console.log("✅ 站点设置\n");

  // ── 2. 公告 ──
  try {
    await p.announcement.upsert({
      where: { id: "welcome" },
      update: {},
      create: { id: "welcome", title: "欢迎回到布谷工作室！", content: "数据已重建。请通过管理后台重新添加内容。", type: "INFO", isActive: true },
    });
    console.log("✅ 公告\n");
  } catch (e) { console.log("  ⚠️ " + (e as any).message?.slice(0, 60)); }

  // ── 3. 社团成员：示例数据 ──
  // ClubMember 需要引用 User，所以先创建 user 再创建 member
  // 此处跳过，等用户有了 admin 账号后再通过 /admin/members 添加

  // ── 4. 管理员账号 ──
  try {
    const hashedPw = await hashPassword("admin123");
    // 检查是否已存在
    const existing = await p.user.findUnique({ where: { email: "admin@bugu.studio" } });
    if (existing) {
      await p.user.update({
        where: { email: "admin@bugu.studio" },
        data: { role: UserRole.ADMIN, isActive: true, passwordHash: hashedPw, emailVerified: new Date() },
      });
      console.log("✅ 管理员账号: admin@bugu.studio (已更新)\n");
    } else {
      await p.user.create({
        data: {
          email: "admin@bugu.studio",
          name: "管理员",
          role: UserRole.ADMIN,
          isActive: true,
          passwordHash: hashedPw,
          emailVerified: new Date(),
        },
      });
      console.log("✅ 管理员账号已创建\n");
    }
  } catch (e) { console.log("  ⚠️ " + (e as any).message?.slice(0, 120)); }

  console.log("📧 管理员登录: admin@bugu.studio");
  console.log("🔑 初始密码:   admin123");
  console.log("⚠️  登录后请立即修改密码！");
  console.log("\n🎉 恢复完成");
}

main()
  .catch((e) => { console.error("❌ 恢复失败:", e); process.exit(1); })
  .finally(async () => { await p.$disconnect(); });
