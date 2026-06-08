/**
 * 种子数据 - Supabase
 * 运行: npx ts-node prisma/seed.ts
 */
import { PrismaClient, UserRole, ProjectStatus, AnnouncementType } from "@prisma/client";
import { scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = require("crypto").randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${key}`;
}

async function main() {
  console.log("🌱 开始播种数据...");

  // 创建默认标签
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: "unity" }, update: {}, create: { name: "Unity", slug: "unity", color: "#22c55e" } }),
    prisma.tag.upsert({ where: { slug: "unreal" }, update: {}, create: { name: "Unreal Engine", slug: "unreal", color: "#0ea5e9" } }),
    prisma.tag.upsert({ where: { slug: "godot" }, update: {}, create: { name: "Godot", slug: "godot", color: "#a78bfa" } }),
    prisma.tag.upsert({ where: { slug: "2d" }, update: {}, create: { name: "2D", slug: "2d", color: "#14b8a6" } }),
    prisma.tag.upsert({ where: { slug: "3d" }, update: {}, create: { name: "3D", slug: "3d", color: "#f97316" } }),
    prisma.tag.upsert({ where: { slug: "pixel" }, update: {}, create: { name: "像素风", slug: "pixel", color: "#84cc16" } }),
    prisma.tag.upsert({ where: { slug: "roguelike" }, update: {}, create: { name: "Roguelike", slug: "roguelike", color: "#f59e0b" } }),
    prisma.tag.upsert({ where: { slug: "puzzle" }, update: {}, create: { name: "解谜", slug: "puzzle", color: "#6366f1" } }),
    prisma.tag.upsert({ where: { slug: "multiplayer" }, update: {}, create: { name: "多人联机", slug: "multiplayer", color: "#ec4899" } }),
    prisma.tag.upsert({ where: { slug: "gamejam" }, update: {}, create: { name: "Game Jam", slug: "gamejam", color: "#ef4444" } }),
  ]);
  console.log(`✅ 创建了 ${tags.length} 个标签`);

  // 创建管理员账户
  const adminEmail = "admin@bugu.cn";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "布谷管理员",
        role: UserRole.ADMIN,
        emailVerified: new Date(),
        passwordHash: hashPassword("bugu2024!"),
      },
    });
    console.log(`✅ 创建管理员账户: ${adminEmail}  / 密码: bugu2024!`);
  } else {
    console.log(`ℹ️  管理员账户已存在: ${adminEmail}`);
  }

  // 创建默认站点设置
  const defaultSettings = [
    { key: "site_name", value: "布谷工作室" },
    { key: "site_description", value: "我们是一群热爱游戏开发的同学，一起创造有趣的游戏世界。" },
    { key: "club_founded_year", value: "2018" },
    { key: "allow_registration", value: "true" },
    { key: "require_email_verification", value: "false" },
  ];
  for (const setting of defaultSettings) {
    await prisma.siteSetting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  }
  console.log(`✅ 创建了 ${defaultSettings.length} 条站点设置`);

  // 创建欢迎公告
  await prisma.announcement.upsert({
    where: { id: "welcome" },
    update: {},
    create: {
      id: "welcome",
      title: "欢迎来到布谷工作室！",
      content: "这里是我们社团作品的展示与归档平台，记录着每一届成员的创造力与热情。",
      type: AnnouncementType.INFO,
      isActive: true,
    },
  });
  console.log("✅ 创建欢迎公告");

  console.log("🎉 播种完成！");
}

main()
  .catch((e) => { console.error("❌ 失败:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
