import type { Lang } from "./config";

/**
 * 作品显示名（英文模式优先显示英文名）。
 *
 * 规则：
 * - 中文模式：主显示标题，副标题保持 subtitle。
 * - 英文模式：
 *   · 若 subtitle 是「纯拉丁字母串」（视作英文名），则主显示英文、中文 title 退为副标题；
 *   · 否则（仅中文名 / subtitle 非英文）保持中文名，不改动。
 *
 * 注意：本函数绝不触碰 description（成员提交的游戏简介）、成员昵称、
 * 以及「仅中文名的游戏名」——只决定主/副标题的展示顺序与取舍。
 */

// 仅含 ASCII 可打印字符（含空格、标点），即视为「英文名候选」
const LATIN_RE = /^[ -~]+$/;

function isAllEnglish(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && LATIN_RE.test(t) && /[A-Za-z]/.test(t);
}

export function workDisplayNames(
  title: string,
  subtitle: string | null,
  lang: Lang,
): { main: string; sub: string | null } {
  if (lang === "cn") {
    return { main: title, sub: subtitle };
  }

  const sub = subtitle?.trim() ?? "";
  // EN 模式：仅当「副标题全英文 且 主标题非全英文」时，交换主副位置。
  // 主标题本身就是英文时（如 "Star Voyager"）不交换，避免把副标题（如 "Season 2"）误当主标题。
  if (isAllEnglish(sub) && !isAllEnglish(title)) {
    return { main: sub, sub: title };
  }

  // 否则原样保留（仅中文名 / 主标题已为英文 / 副标题非英文）
  return { main: title, sub: subtitle };
}
