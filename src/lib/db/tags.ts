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
  { name: "Game Maker", slug: "gamemaker", color: ENGINE_TAG_COLORS.gamemaker, sortOrder: 2, group: "引擎" },
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
  // 活动 & 赛事
  { name: "GGJ", slug: "ggj", color: "#3388BB", sortOrder: 50, group: "活动&赛事" },
  { name: "CiGA", slug: "ciga", color: "#E38043", sortOrder: 51, group: "活动&赛事" },
  { name: "CUSGA", slug: "cusga", color: "#88C232", sortOrder: 52, group: "活动&赛事" },
  { name: "萌芽杯", slug: "mengyabei", color: "#25547A", sortOrder: 53, group: "活动&赛事" },
];

const ENGINE_SLUGS = ["godot", "unity", "gamemaker", "unreal"] as const;
const EVENT_SLUGS = ["ggj", "ciga", "cusga", "mengyabei"] as const;

let synced = false;

/**
 * 确保数据库中存在所有默认标签。
 * 每次调用都会检查缺失的标签并补全；引擎标签会强制校正颜色/分组。
 */
export async function ensureDefaultTags(): Promise<void> {
  if (synced) return;
  try {
    let existing = await prisma.tag.findMany({
      select: { id: true, name: true, slug: true, color: true, group: true, sortOrder: true },
    });
    const existingSlugs = new Set(existing.map((t) => t.slug));
    const missing = DEFAULT_TAGS.filter((t) => !existingSlugs.has(t.slug));

    if (missing.length > 0) {
      await prisma.tag.createMany({ data: missing, skipDuplicates: true });
      console.log(`[tags] 补全了 ${missing.length} 个缺失的默认标签`);
      // 重新拉取，包含刚创建的默认标签；后续归并/同步需要它们的 id
      existing = await prisma.tag.findMany({
        select: { id: true, name: true, slug: true, color: true, group: true, sortOrder: true },
      });
    }

    // 归并旧的 `game-maker` 歧义标签到规范 slug `gamemaker`，确保只有一个 "Game Maker" 选项
    // 必须在引擎同步前执行，否则 `gamemaker` 改名成 "Game Maker" 会与 `game-maker` 的 name 唯一约束冲突
    const gameMakerAlias = existing.find((t) => t.slug === "game-maker");
    const gameMakerCanonical = existing.find((t) => t.slug === "gamemaker");
    if (gameMakerAlias && gameMakerCanonical) {
      const aliasRelations = await prisma.projectTag.findMany({
        where: { tagId: gameMakerAlias.id },
        select: { projectId: true },
      });
      if (aliasRelations.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const r of aliasRelations) {
            const existingRel = await tx.projectTag.findUnique({
              where: {
                projectId_tagId: {
                  projectId: r.projectId,
                  tagId: gameMakerCanonical.id,
                },
              },
            });
            if (!existingRel) {
              await tx.projectTag.create({
                data: {
                  projectId: r.projectId,
                  tagId: gameMakerCanonical.id,
                },
              });
            }
          }
          await tx.projectTag.deleteMany({ where: { tagId: gameMakerAlias.id } });
          await tx.tag.delete({ where: { id: gameMakerAlias.id } });
        });
        console.log(
          `[tags] 已归并 ${aliasRelations.length} 个 'game-maker' 项目标签到 'gamemaker' 并删除歧义选项`,
        );
      } else {
        await prisma.tag.delete({ where: { id: gameMakerAlias.id } });
        console.log("[tags] 已删除空 'game-maker' 歧义标签");
      }
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
          row.sortOrder === def.sortOrder &&
          row.name === def.name
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

    // 活动 & 赛事标签：校正分组 / 颜色 / 排序 / 名称
    await Promise.all(
      EVENT_SLUGS.map(async (slug) => {
        const def = DEFAULT_TAGS.find((t) => t.slug === slug);
        if (!def) return;
        const row = existing.find((t) => t.slug === slug);
        if (!row) return;
        if (
          row.color === def.color &&
          row.group === def.group &&
          row.sortOrder === def.sortOrder &&
          row.name === def.name
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

    // 若库里还有旧 slug `ue`，归到引擎组并套对应色
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

    synced = true;
  } catch (err) {
    console.error("[tags] 标签同步失败:", err);
  }
}
