/**
 * 标签自动初始化 — 当数据库 Tag 表为空时自动填充默认游戏标签
 * 避免首次部署后需要手动运行 seed
 */

import { prisma } from "@/lib/db/prisma";

const DEFAULT_TAGS: { name: string; slug: string; color: string; sortOrder: number }[] = [
  // 游戏引擎
  { name: "Unity", slug: "unity", color: "#22c55e", sortOrder: 0 },
  { name: "Unreal Engine", slug: "unreal", color: "#0ea5e9", sortOrder: 1 },
  { name: "Godot", slug: "godot", color: "#a78bfa", sortOrder: 2 },
  // 游戏类型
  { name: "RPG", slug: "rpg", color: "#e11d48", sortOrder: 10 },
  { name: "动作", slug: "act", color: "#f43f5e", sortOrder: 11 },
  { name: "冒险", slug: "adv", color: "#d946ef", sortOrder: 12 },
  { name: "文字冒险", slug: "visual-novel", color: "#8b5cf6", sortOrder: 13 },
  { name: "模拟", slug: "sim", color: "#06b6d4", sortOrder: 14 },
  { name: "策略", slug: "slg", color: "#3b82f6", sortOrder: 15 },
  { name: "射击", slug: "stg", color: "#f97316", sortOrder: 16 },
  { name: "FPS", slug: "fps", color: "#ea580c", sortOrder: 17 },
  { name: "格斗", slug: "ftg", color: "#dc2626", sortOrder: 18 },
  { name: "竞速", slug: "rcg", color: "#65a30d", sortOrder: 19 },
  { name: "音乐节奏", slug: "mug", color: "#eab308", sortOrder: 20 },
  { name: "平台跳跃", slug: "platformer", color: "#84cc16", sortOrder: 21 },
  { name: "沙盒", slug: "sandbox", color: "#14b8a6", sortOrder: 22 },
  { name: "恐怖", slug: "horror", color: "#292524", sortOrder: 23 },
  // 画面风格
  { name: "像素风", slug: "pixel", color: "#84cc16", sortOrder: 30 },
  { name: "2D", slug: "2d", color: "#14b8a6", sortOrder: 31 },
  { name: "3D", slug: "3d", color: "#f97316", sortOrder: 32 },
  { name: "低多边形", slug: "lowpoly", color: "#a3e635", sortOrder: 33 },
  { name: "二次元", slug: "anime", color: "#f472b6", sortOrder: 34 },
  // 玩法特征
  { name: "Roguelike", slug: "roguelike", color: "#f59e0b", sortOrder: 40 },
  { name: "解谜", slug: "puzzle", color: "#6366f1", sortOrder: 41 },
  { name: "多人联机", slug: "multiplayer", color: "#ec4899", sortOrder: 42 },
  { name: "休闲", slug: "casual", color: "#10b981", sortOrder: 43 },
  { name: "Game Jam", slug: "gamejam", color: "#ef4444", sortOrder: 44 },
];

let synced = false;

/**
 * 确保数据库中存在所有默认标签。
 * 每次调用都会检查缺失的标签并补全，避免已有旧标签时其他默认标签无法创建。
 * 可在多个页面安全并行调用。
 */
export async function ensureDefaultTags(): Promise<void> {
  if (synced) return;
  try {
    const existing = await prisma.tag.findMany({ select: { slug: true } });
    const existingSlugs = new Set(existing.map((t) => t.slug));
    const missing = DEFAULT_TAGS.filter((t) => !existingSlugs.has(t.slug));

    if (missing.length === 0) {
      synced = true;
      return;
    }

    await prisma.tag.createMany({ data: missing, skipDuplicates: true });
    console.log(`[tags] 补全了 ${missing.length} 个缺失的默认标签`);
    synced = true;
  } catch (err) {
    console.error("[tags] 标签同步失败:", err);
  }
}
