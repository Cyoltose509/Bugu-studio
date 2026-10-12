/**
 * 标签英文显示名（slug → 英文名）。
 *
 * 标签是社团的固定分类法（默认标签集中在 lib/db/tags.ts），
 * 不是成员自由填写内容，所以按 slug 给出英文映射是稳的。
 * EN 模式下 TagChip / 侧栏筛选用此表覆盖中文名；
 * 映射里没有的 slug（如成员自建标签）回退到原名，不强行翻译。
 */
import type { Lang } from "@/lib/i18n/config";

export const TAG_EN_NAMES: Record<string, string> = {
  // 引擎（原名已是英文，列出仅为统一来源）
  godot: "Godot",
  unity: "Unity",
  gamemaker: "Game Maker",
  unreal: "Unreal Engine",
  ue: "Unreal Engine",
  // 游戏类型
  rpg: "RPG",
  act: "Action",
  adv: "Adventure",
  "visual-novel": "Visual Novel",
  sim: "Simulation",
  slg: "Strategy",
  stg: "Shooter",
  fps: "FPS",
  ftg: "Fighting",
  rcg: "Racing",
  mug: "Rhythm",
  platformer: "Platformer",
  sandbox: "Sandbox",
  horror: "Horror",
  // 画面风格 / 玩法
  pixel: "Pixel Art",
  "2d": "2D",
  "3d": "3D",
  lowpoly: "Low Poly",
  anime: "Anime",
  roguelike: "Roguelike",
  puzzle: "Puzzle",
  multiplayer: "Multiplayer",
  casual: "Casual",
  gamejam: "Game Jam",
  ggj: "GGJ",
  ciga: "CiGA",
  cusga: "CUSGA",
  mengyabei: "萌芽杯",
};

export const TAG_GROUP_EN: Record<string, string> = {
  引擎: "Engine",
  大类: "Genre",
  要素: "Element",
  "活动&赛事": "Event & Competition",
  其他: "Other",
};

export function tagDisplayName(slug: string, name: string, lang: Lang): string {
  if (lang === "en") return TAG_EN_NAMES[slug] ?? name;
  return name;
}

export function tagGroupDisplayName(group: string, lang: Lang): string {
  if (lang === "en") return TAG_GROUP_EN[group] ?? group;
  return group;
}
