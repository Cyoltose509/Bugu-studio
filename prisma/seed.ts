/**
 * 种子数据 - Supabase
 * 运行: npx ts-node prisma/seed.ts
 */
import { PrismaClient, AnnouncementType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始播种数据...");

  // 创建默认标签
  const tags = await Promise.all([
    // 游戏引擎
    prisma.tag.upsert({ where: { slug: "unity" }, update: {}, create: { name: "Unity", slug: "unity", color: "#22c55e" } }),
    prisma.tag.upsert({ where: { slug: "unreal" }, update: {}, create: { name: "Unreal Engine", slug: "unreal", color: "#0ea5e9" } }),
    prisma.tag.upsert({ where: { slug: "godot" }, update: {}, create: { name: "Godot", slug: "godot", color: "#a78bfa" } }),
    // 游戏类型
    prisma.tag.upsert({ where: { slug: "rpg" }, update: {}, create: { name: "RPG", slug: "rpg", color: "#e11d48" } }),
    prisma.tag.upsert({ where: { slug: "act" }, update: {}, create: { name: "动作", slug: "act", color: "#f43f5e" } }),
    prisma.tag.upsert({ where: { slug: "adv" }, update: {}, create: { name: "冒险", slug: "adv", color: "#d946ef" } }),
    prisma.tag.upsert({ where: { slug: "avg" }, update: {}, create: { name: "文字冒险", slug: "avg", color: "#8b5cf6" } }),
    prisma.tag.upsert({ where: { slug: "sim" }, update: {}, create: { name: "模拟", slug: "sim", color: "#06b6d4" } }),
    prisma.tag.upsert({ where: { slug: "slg" }, update: {}, create: { name: "策略", slug: "slg", color: "#3b82f6" } }),
    prisma.tag.upsert({ where: { slug: "stg" }, update: {}, create: { name: "射击", slug: "stg", color: "#f97316" } }),
    prisma.tag.upsert({ where: { slug: "fps" }, update: {}, create: { name: "FPS", slug: "fps", color: "#ea580c" } }),
    prisma.tag.upsert({ where: { slug: "ftg" }, update: {}, create: { name: "格斗", slug: "ftg", color: "#dc2626" } }),
    prisma.tag.upsert({ where: { slug: "rcg" }, update: {}, create: { name: "竞速", slug: "rcg", color: "#65a30d" } }),
    prisma.tag.upsert({ where: { slug: "mug" }, update: {}, create: { name: "音乐节奏", slug: "mug", color: "#eab308" } }),
    prisma.tag.upsert({ where: { slug: "platformer" }, update: {}, create: { name: "平台跳跃", slug: "platformer", color: "#84cc16" } }),
    prisma.tag.upsert({ where: { slug: "sandbox" }, update: {}, create: { name: "沙盒", slug: "sandbox", color: "#14b8a6" } }),
    prisma.tag.upsert({ where: { slug: "visual-novel" }, update: {}, create: { name: "视觉小说", slug: "visual-novel", color: "#c084fc" } }),
    prisma.tag.upsert({ where: { slug: "horror" }, update: {}, create: { name: "恐怖", slug: "horror", color: "#292524" } }),
    // 画面风格
    prisma.tag.upsert({ where: { slug: "pixel" }, update: {}, create: { name: "像素风", slug: "pixel", color: "#84cc16" } }),
    prisma.tag.upsert({ where: { slug: "2d" }, update: {}, create: { name: "2D", slug: "2d", color: "#14b8a6" } }),
    prisma.tag.upsert({ where: { slug: "3d" }, update: {}, create: { name: "3D", slug: "3d", color: "#f97316" } }),
    prisma.tag.upsert({ where: { slug: "lowpoly" }, update: {}, create: { name: "低多边形", slug: "lowpoly", color: "#a3e635" } }),
    prisma.tag.upsert({ where: { slug: "anime" }, update: {}, create: { name: "二次元", slug: "anime", color: "#f472b6" } }),
    // 玩法特征
    prisma.tag.upsert({ where: { slug: "roguelike" }, update: {}, create: { name: "Roguelike", slug: "roguelike", color: "#f59e0b" } }),
    prisma.tag.upsert({ where: { slug: "puzzle" }, update: {}, create: { name: "解谜", slug: "puzzle", color: "#6366f1" } }),
    prisma.tag.upsert({ where: { slug: "multiplayer" }, update: {}, create: { name: "多人联机", slug: "multiplayer", color: "#ec4899" } }),
    prisma.tag.upsert({ where: { slug: "casual" }, update: {}, create: { name: "休闲", slug: "casual", color: "#10b981" } }),
    prisma.tag.upsert({ where: { slug: "gamejam" }, update: {}, create: { name: "Game Jam", slug: "gamejam", color: "#ef4444" } }),
  ]);
  console.log(`✅ 创建了 ${tags.length} 个标签`);

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
