import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/config";
import { toPlainCardText } from "@/lib/rich-content";
import { DEFAULT_ACTIVITY_COVER } from "@/lib/activities/constants";
import { canSubmitActivityTalk } from "@/lib/activities/capabilities";
import { formatActivitySchedule } from "@/lib/activities/datetime";

export type ShareHeader =
  | { kind: "color"; color: "blue" | "orange" | "green" | "navy" }
  | { kind: "image"; url: string };

export const SHARE_HEADER_COLORS = {
  blue: "#3388BB",
  orange: "#D96F3E",
  green: "#88C232",
  navy: "#25547A",
} as const;

export const SHARE_HEADER_COLOR_LABELS: Record<keyof typeof SHARE_HEADER_COLORS, { cn: string; en: string }> = {
  blue: { cn: "蓝色", en: "Blue" },
  orange: { cn: "橙色", en: "Orange" },
  green: { cn: "绿色", en: "Green" },
  navy: { cn: "深蓝色", en: "Navy" },
};

/** 卡头第二排：活动图或成员已上传作品封面，按 URL 去重。 */
export function shareHeaderImages(data: ShareCardData): { title: string; url: string }[] {
  const fromData = (data.headerImages || []).filter(item => item.url);
  if (fromData.length) {
    return fromData.filter((item, index, all) => all.findIndex(candidate => candidate.url === item.url) === index);
  }
  return (data.works || [])
    .filter((work): work is typeof work & { image: string } => Boolean(work.image))
    .filter((work, index, all) => all.findIndex(item => item.image === work.image) === index)
    .map(work => ({ title: work.title, url: work.image }));
}

export type ShareCardData = {
  kind: "activity" | "member";
  title: string;
  path: string;
  summary: string;
  image?: string | null;
  headerImages?: { title: string; url: string }[];
  date?: string;
  time?: string;
  location?: string;
  status?: string;
  talkSubmissionOpen?: boolean;
  agenda?: { title: string; speaker?: string }[];
  tags?: string[];
  works?: {
    slug: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    image: string | null;
    type?: string;
    year?: number | null;
    tags?: { slug: string; name: string; color?: string | null; group?: string | null }[];
  }[];
};

export function publicShareUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL || "https://bugoostudio.com").href;
}

export function shareDescription(text: string | null | undefined, limit = 140): string {
  const plain = toPlainCardText(text).replace(/<[^>]*>/g, "");
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

export function activityShareData(activity: {
  id: string; title: string; summary?: string | null; description?: string | null; coverImage?: string | null;
  relatedImages?: { title: string; url: string }[];
  startTime?: Date | string | null; endTime?: Date | string | null; location: string | null;
  status: string; timePending?: boolean | null; courseHasClock?: boolean | null; talkSubmissionOpen?: boolean | null;
  talks?: { title: string; speaker?: string | null; user?: { name?: string | null; member?: { displayName?: string | null } | null } | null }[];
  proposals?: { title: string; user?: { name?: string | null; member?: { displayName?: string | null } | null } | null }[];
}, lang: Lang, asOf = new Date()): ShareCardData {
  const pending = !!activity.timePending || !activity.startTime || !activity.endTime;
  const start = activity.startTime ? new Date(activity.startTime) : null;
  const end = activity.endTime ? new Date(activity.endTime) : null;
  const ended = !pending && (activity.status === "ARCHIVED" || (!!end && asOf.getTime() > end.getTime()));
  const ongoing = !pending && !ended && !!start && asOf.getTime() >= start.getTime();
  const headerImages = [
    ...(activity.coverImage ? [{ title: lang === "en" ? "Activity cover" : "活动封面", url: activity.coverImage }] : []),
    ...(activity.relatedImages || []),
  ].filter((item, index, all) => item.url && all.findIndex(candidate => candidate.url === item.url) === index);
  const talks = (activity.talks || []).map(item => ({
    title: item.title.trim(),
    speaker: item.speaker?.trim() || item.user?.member?.displayName || item.user?.name || undefined,
  })).filter(item => item.title);
  const talkTitles = new Set(talks.map(item => item.title.toLocaleLowerCase()));
  const approvedProposals = (activity.proposals || []).map(item => ({
    title: item.title.trim(),
    speaker: item.user?.member?.displayName || item.user?.name || undefined,
  })).filter(item => item.title && !talkTitles.has(item.title.toLocaleLowerCase()));
  return {
    kind: "activity", title: activity.title, path: `/activities/${encodeURIComponent(activity.id)}`,
    summary: shareDescription(activity.summary || activity.description), image: activity.coverImage || DEFAULT_ACTIVITY_COVER,
    headerImages,
    date: formatActivitySchedule(start, end, lang, pending, !!activity.courseHasClock),
    location: activity.location || (lang === "en" ? "Location to be confirmed" : "地点待定"),
    status: lang === "en" ? (ended ? "Ended" : ongoing ? "In progress" : "Upcoming") : (ended ? "已结束" : ongoing ? "进行中" : "即将开始"),
    talkSubmissionOpen: canSubmitActivityTalk(activity, asOf),
    agenda: [...talks, ...approvedProposals],
  };
}

/** 分享元数据里的 URL 必须是绝对地址：OG / canonical 不接受站内相对路径。 */
function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return publicShareUrl(value);
  return value; // 无协议的 CDN 域名（如 cdn.bugoostudio.com/…）原样返回
}

export function shareMetadata(data: Pick<ShareCardData, "title" | "summary" | "path" | "image" | "kind">): Metadata {
  const image = data.image || "/images/logo.png";
  const pageUrl = absoluteUrl(data.path);
  return {
    title: data.title,
    description: data.summary || data.title,
    alternates: { canonical: data.path },
    openGraph: { type: "website", title: data.title, description: data.summary || data.title, url: pageUrl, images: [{ url: absoluteUrl(image), alt: data.title }] },
    twitter: { card: data.kind === "activity" ? "summary_large_image" : "summary", title: data.title, description: data.summary || data.title, images: [absoluteUrl(image)] },
  };
}
