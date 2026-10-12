/**
 * 标签英文显示名。
 *
 * 标签分两类：
 *  1. 社团固定分类法（默认标签集中在 lib/db/tags.ts），slug 稳定 → 用 TAG_EN_NAMES 按 slug 映射；
 *  2. 成员提交作品时自建标签，slug 是随机串（如 project-av35hc），不稳定 → 用 TAG_EN_BY_NAME 按中文名映射。
 * EN 模式下 TagChip / 侧栏筛选 / 表单都用 tagDisplayName 覆盖中文名；
 * 两张表都没收录的（新出现的自建标签）回退原名，不强行翻译。
 */
import type { Lang } from "@/lib/i18n/config";

export const TAG_EN_NAMES: Record<string, string> = {
  // 引擎（原名已是英文，列出仅为统一来源）
  godot: "Godot",
  unity: "Unity",
  gamemaker: "Game Maker",
  unreal: "Unreal Engine",
  ue: "Unreal Engine",
  "rpg-maker": "RPG Maker",
  "other-engine": "Other Engine",
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
  mengyabei: "Mengya Cup",
  // 平台
  "platform-steam": "Steam",
  "platform-itch": "Itch",
};

/**
 * 成员自建标签（slug 为随机串，无法在上表固定）按「中文名 → 英文名」映射。
 * 新增自建标签时在此补一行即可；未收录的仍回退原名。
 */
export const TAG_EN_BY_NAME: Record<string, string> = {
  点击: "Clicker",
  "2.5D": "2.5D",
  双人: "2-Player",
  肉鸽: "Roguelike",
  物理: "Physics",
  解密: "Puzzle",
  折磨流: "Torture Build",
  历史: "History",
  增量: "Incremental",
  联机: "Online",
  每日挑战: "Daily Challenge",
  东方Project: "Touhou Project",
  二次创作: "Fan Work",
  三次创作: "Tertiary Fan Work",
  自走棋: "Auto Battler",
  库存管理: "Inventory Management",
  叙事: "Narrative",
  纯音频: "Audio-Only",
};

export const TAG_GROUP_EN: Record<string, string> = {
  引擎: "Engine",
  大类: "Genre",
  要素: "Element",
  "活动&赛事": "Event & Competition",
  平台: "Platform",
  其他: "Other",
};

export function tagDisplayName(slug: string, name: string, lang: Lang): string {
  if (lang === "en") return TAG_EN_NAMES[slug] ?? TAG_EN_BY_NAME[name] ?? name;
  return name;
}

export function tagGroupDisplayName(group: string, lang: Lang): string {
  if (lang === "en") return TAG_GROUP_EN[group] ?? group;
  return group;
}
