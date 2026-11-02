/**
 * 活动推荐（ActivityType.RECOMMENDATION）共享常量。
 * 用途：对外推送 Global Game Jam、各类黑客松、合作企业培训等第三方活动。
 * 语义约定：
 * - 不进入「活动档案」与首页动态，只在活动页专属横排栏展示；
 * - meetingUrl 字段复用为「官网 / 报名链接」；
 * - 细分类存 recoTag 字符串列（而非枚举），以后扩类别不需要数据库迁移。
 */
import { t, type DictKey } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

export const RECO_TAGS = ["GAME_JAM", "HACKATHON", "TRAINING", "OTHER"] as const;
export type RecoTag = (typeof RECO_TAGS)[number];

const RECO_TAG_KEYS: Record<RecoTag, DictKey> = {
  GAME_JAM: "activity.recoTag.GAME_JAM",
  HACKATHON: "activity.recoTag.HACKATHON",
  TRAINING: "activity.recoTag.TRAINING",
  OTHER: "activity.recoTag.OTHER",
};

export function isRecoTag(value: unknown): value is RecoTag {
  return typeof value === "string" && (RECO_TAGS as readonly string[]).includes(value);
}

/** recoTag → 双语标签；未识别/空值返回 null（不渲染标签） */
export function recoTagLabel(lang: Lang, tag: string | null | undefined): string | null {
  if (!tag || !isRecoTag(tag)) return null;
  return t(lang, RECO_TAG_KEYS[tag]);
}
