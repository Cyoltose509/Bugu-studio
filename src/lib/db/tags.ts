/**
 * 标签自动初始化 — 当数据库 Tag 表为空时自动填充默认游戏标签
 * 避免首次部署后需要手动运行 seed
 *
 * 引擎标签会每次校正 group / color / sortOrder，保证展示一致。
 */

import { prisma } from "@/lib/db/prisma";
import { ENGINE_TAG_COLORS } from "@/lib/tags/engine-tags";

const DEFAULT_TAGS: {
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  group?: string;
}[] = [
  // 游戏引擎（组：引擎，始终前置）
  { name: "Godot", slug: "godot", color: ENGINE_TAG_COLORS.godot, sortOrder: 0, group: "引擎" },
  { name: "Unity", slug: "unity", color: ENGINE_TAG_COLORS.unity, sortOrder: 1, group: "引擎" },
  { name: "GameMaker", slug: "gamemaker", color: ENGINE_TAG_COLORS.gamemaker, sortOrder: 2, group: "引擎" },
  { name: "Unreal Engine", slug: "unreal", color: ENGINE_TAG_COLORS.unreal, sortOrder: 3, group: "引擎" },
  // 游戏类型
  { name: "RPG", slug: "rpg", color: "#e11d48", sortOrder: 10, group: "大类" },
  { name: "动作", slug: "act", color: "#f43f5e", sortOrder: 11, group: "大类" },
  { name: "冒险", slug: "adv", color: "#d946ef", sortOrder: 12, group: "大类" },
  { name: "文字冒险", slug: "visual-novel", color: "#8b5cf6", sortOrder: 13, group: "大类" },
  { name: "模拟", slug: "sim", color: "#06b6d4", sortOrder: 14, group: "大类" },
  { name: "策略", slug: "slg", color: "#3b82f6", sortOrder: 15, group: "大类" },
  { name: "射击", slug: "stg", color: "#f97316", sortOrder: 16, group: "大类" },
  { name: "FPS", slug: "fps", color: "#ea580c", sortOrder: 17, group: "大类" },
  { name: "格斗", slug: "ftg", color: "#dc2626", sortOrder: 18, group: "大类" },
  { name: "竞速", slug: "rcg", color: "#65a30d", sortOrder: 19, group: "大类" },
  { name: "音乐节奏", slug: "mug", color: "#eab308", sortOrder: 20, group: "大类" },
  { name: "平台跳跃", slug: "platformer", color: "#84cc16", sortOrder: 21, group: "大类" },
  { name: "沙盒", slug: "sandbox", color: "#14b8a6", sortOrder: 22, group: "大类" },
  { name: "恐怖", slug: "horror", color: "#292524", sortOrder: 23, group: "大类" },
  // 画面风格 / 玩法
  { name: "像素风", slug: "pixel", color: "#84cc16", sortOrder: 30, group: "要素" },
  { name: "2D", slug: "2d", color: "#14b8a6", sortOrder: 31, group: "要素" },
  { name: "3D", slug: "3d", color: "#f97316", sortOrder: 32, group: "要素" },
  { name: "低多边形", slug: "lowpoly", color: "#a3e635", sortOrder: 33, group: "要素" },
  { name: "二次元", slug: "anime", color: "#f472b6", sortOrder: 34, group: "要素" },
  { name: "Roguelike", slug: "roguelike", color: "#f59e0b", sortOrder: 40, group: "要素" },
  { name: "解谜", slug: "puzzle", color: "#6366f1", sortOrder: 41, group: "要素" },
  { name: "多人联机", slug: "multiplayer", color: "#ec4899", sortOrder: 42, group: "要素" },
  { name: "休闲", slug: "casual", color: "#10b981", sortOrder: 43, group: "要素" },
  { name: "Game Jam", slug: "gamejam", color: "#ef4444", sortOrder: 44, group: "要素" },
];

const ENGINE_SLUGS = ["godot", "unity", "gamemaker", "unreal"] as const;

let synced = false;

/**
 * 确保数据库中存在所有默认标签。
 * 每次调用都会检查缺失的标签并补全；引擎标签会强制校正颜色/分组。
 */
export async function ensureDefaultTags(): Promise<void> {
  if (synced) return;
  try {
    const existing = await prisma.tag.findMany({
      select: { id: true, slug: true, color: true, group: true, sortOrder: true },
    });
    const existingSlugs = new Set(existing.map((t) => t.slug));
    const missing = DEFAULT_TAGS.filter((t) => !existingSlugs.has(t.slug));

    if (missing.length > 0) {
      await prisma.tag.createMany({ data: missing, skipDuplicates: true });
      console.log(`[tags] 补全了 ${missing.length} 个缺失的默认标签`);
    }

    // 引擎标签：校正品牌色 / 分组 / 排序（已有库也跟上）
    await Promise.all(
      ENGINE_SLUGS.map(async (slug) => {
        const def = DEFAULT_TAGS.find((t) => t.slug === slug);
        if (!def) return;
        const row = existing.find((t) => t.slug === slug);
        if (!row) return;
        if (
          row.color === def.color &&
          row.group === def.group &&
          row.sortOrder === def.sortOrder
        ) {
          return;
        }
        await prisma.tag.update({
          where: { slug },
          data: {
            color: def.color,
            group: def.group,
            sortOrder: def.sortOrder,
            name: def.name,
          },
        });
      }),
    );

    // 若库里还有旧 slug `ue` / `game-maker`，也归到引擎组并套对应色
    const ue = existing.find((t) => t.slug === "ue");
    if (ue) {
      await prisma.tag.update({
        where: { slug: "ue" },
        data: {
          color: ENGINE_TAG_COLORS.ue,
          group: "引擎",
          sortOrder: 3,
        },
      });
    }
    const gameMakerAlias = existing.find((t) => t.slug === "game-maker");
    if (gameMakerAlias) {
      await prisma.tag.update({
        where: { slug: "game-maker" },
        data: {
          color: ENGINE_TAG_COLORS.gamemaker,
          group: "引擎",
          sortOrder: 2,
          name: "GameMaker",
        },
      });
    }

    synced = true;
  } catch (err) {
    console.error("[tags] 标签同步失败:", err);
  }
}
