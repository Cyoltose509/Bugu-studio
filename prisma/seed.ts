/**
 * Prisma 数据库种子数据
 * 运行: npm run db:seed
 */

import { PrismaClient, UserRole, ProjectType, ProjectStatus, AnnouncementType } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始播种数据...");

  // 创建默认标签
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: "unity" }, update: {}, create: { name: "Unity", slug: "unity", color: "#22c55e" } }),
    prisma.tag.upsert({ where: { slug: "unreal" }, update: {}, create: { name: "Unreal Engine", slug: "unreal", color: "#0ea5e9" } }),
    prisma.tag.upsert({ where: { slug: "godot" }, update: {}, create: { name: "Godot", slug: "godot", color: "#a78bfa" } }),
    prisma.tag.upsert({ where: { slug: "rpg" }, update: {}, create: { name: "RPG", slug: "rpg", color: "#f59e0b" } }),
    prisma.tag.upsert({ where: { slug: "action" }, update: {}, create: { name: "动作", slug: "action", color: "#ef4444" } }),
    prisma.tag.upsert({ where: { slug: "puzzle" }, update: {}, create: { name: "解谜", slug: "puzzle", color: "#6366f1" } }),
    prisma.tag.upsert({ where: { slug: "platformer" }, update: {}, create: { name: "平台跳跃", slug: "platformer", color: "#ec4899" } }),
    prisma.tag.upsert({ where: { slug: "2d" }, update: {}, create: { name: "2D", slug: "2d", color: "#14b8a6" } }),
    prisma.tag.upsert({ where: { slug: "3d" }, update: {}, create: { name: "3D", slug: "3d", color: "#f97316" } }),
    prisma.tag.upsert({ where: { slug: "pixel-art" }, update: {}, create: { name: "像素风", slug: "pixel-art", color: "#84cc16" } }),
    prisma.tag.upsert({ where: { slug: "horror" }, update: {}, create: { name: "恐怖", slug: "horror", color: "#7c3aed" } }),
    prisma.tag.upsert({ where: { slug: "simulation" }, update: {}, create: { name: "模拟经营", slug: "simulation", color: "#06b6d4" } }),
  ]);

  console.log(`✅ 创建了 ${tags.length} 个标签`);

  // 创建管理员账户（密码需在首次部署后通过管理面板修改）
  // 注意：生产环境中应通过环境变量或安全渠道设置管理员密码
  const adminEmail = process.env.ADMIN_EMAIL || "admin@bugu.local";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    // 临时密码占位符 - 部署后立即通过管理面板修改
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "管理员",
        role: UserRole.ADMIN,
        emailVerified: new Date(),
        passwordHash: "CHANGE_IMMEDIATELY", // 必须在首次登录后修改
      },
    });
    console.log(`✅ 创建管理员账户: ${adminEmail}`);
    console.log("⚠️  请立即修改管理员密码！");
  } else {
    console.log(`ℹ️  管理员账户已存在: ${adminEmail}`);
  }

  // 创建默认站点设置
  const defaultSettings = [
    { key: "site_name", value: "布谷工作室" },
    { key: "site_description", value: "我们是一群热爱游戏开发的同学，一起创造有趣的游戏世界。" },
    { key: "club_founded_year", value: "2018" },
    { key: "allow_registration", value: "true" },
    { key: "require_email_verification", value: "true" },
    { key: "maintenance_mode", value: "false" },
  ];

  for (const setting of defaultSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✅ 创建了 ${defaultSettings.length} 条默认站点设置`);

  // 创建欢迎公告
  await prisma.announcement.upsert({
    where: { id: "welcome-announcement" },
    update: {},
    create: {
      id: "welcome-announcement",
      title: "欢迎来到游戏开发社团官网",
      content: "这里是我们社团作品的展示与归档平台，记录着每一届成员的创造力与热情。",
      type: AnnouncementType.INFO,
      isActive: true,
    },
  });
  console.log("✅ 创建欢迎公告");

  console.log("🎉 数据播种完成！");
}

main()
  .catch((e) => {
    console.error("❌ 播种失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
