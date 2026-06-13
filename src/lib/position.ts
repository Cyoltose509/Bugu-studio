/**
 * 社团身份（Position）标签 & 颜色 统一映射
 * 所有展示 position 的地方都应该 import 这两个映射，不要手写三元判断。
 */

export const POSITION_LABEL: Record<string, string> = {
  MEMBER:              "普通成员",
  VICE_PRESIDENT:      "副社长",
  PRESIDENT:           "社长",
  PAST_PRESIDENT:      "往届社长",
  PAST_VICE_PRESIDENT: "往届副社长",
  FOUNDER:             "创始人",
};

export const POSITION_COLOR: Record<string, { bg: string; text: string }> = {
  MEMBER:              { bg: "#25547A",  text: "#fff" },
  VICE_PRESIDENT:      { bg: "#25547A",  text: "#fff" },
  PRESIDENT:           { bg: "#25547A",  text: "#fff" },
  PAST_PRESIDENT:      { bg: "#999999",  text: "#fff" },
  PAST_VICE_PRESIDENT: { bg: "#999999",  text: "#fff" },
  FOUNDER:             { bg: "#FFE384",  text: "#5C4B00" },
};

/** 报纸展示用的职位标签（去"往届"前缀，创始人→社长） */
export function newspaperPositionLabel(position: string | null): string {
  if (!position) return "";
  if (position === "FOUNDER") return "社长";
  const label = POSITION_LABEL[position] || "";
  return label.replace(/^往届/, "");
}

/** 获取中文标签，未知值原样返回 */
export function positionLabel(p: string | null | undefined): string {
  if (!p || p === "MEMBER") return "";
  return POSITION_LABEL[p] ?? p;
}

/** 获取颜色，未知值返回默认蓝 */
export function positionColor(p: string | null | undefined): { bg: string; text: string } {
  if (!p) return POSITION_COLOR.MEMBER;
  return POSITION_COLOR[p] ?? POSITION_COLOR.MEMBER;
}
