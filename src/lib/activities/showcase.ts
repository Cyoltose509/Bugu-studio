import { z } from "zod";

export const BAITUAN_SLUG = "baituan-2026";
export const showcaseKey = (activityId: string) => `activity-showcase:${activityId}`;

// Only same-origin assets and the site's existing image hosts may be displayed.
export function isShowcaseImageUrl(value: string) {
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.hostname === "cdn.bugoostudio.com" ||
        /\.(r2\.dev|r2\.cloudflarestorage\.com)$/.test(url.hostname));
  } catch { return false; }
}

export const showcaseSchema = z.object({
  enabled: z.boolean(),
  projectIds: z.array(z.string().min(1).max(100)).max(50)
    .refine(ids => new Set(ids).size === ids.length, "请勿重复添加作品"),
  posters: z.array(z.object({
    title: z.string().trim().min(1, "请填写海报标题").max(80),
    url: z.string().trim().refine(isShowcaseImageUrl, "请选择站内图片或上传海报"),
  })).max(10),
});
export type ActivityShowcase = z.infer<typeof showcaseSchema>;

export const BAITUAN_PROJECT_SLUGS = [
  "project-i3lij3", "2", "step-or-sink-2", "saga-of-deadwood", "active",
];
export const BAITUAN_POSTERS = [
  { title: "百团大战 · B20 摊位与活动地图", url: "/images/activities/baituan-2026/event.webp" },
  { title: "认识珞珈技术俱乐部", url: "/images/activities/baituan-2026/club.webp" },
  { title: "新手村 Project · 往期介绍（2024）", url: "/images/activities/baituan-2026/beginner-2024.webp" },
];

export function baituanShowcase(projects: { id: string; slug: string }[]): ActivityShowcase {
  return {
    enabled: true,
    projectIds: BAITUAN_PROJECT_SLUGS.flatMap(slug => {
      const project = projects.find(p => p.slug === slug);
      return project ? [project.id] : [];
    }),
    posters: BAITUAN_POSTERS,
  };
}

export function parseShowcase(value: string | null | undefined): ActivityShowcase | null {
  if (!value) return null;
  try {
    const result = showcaseSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch { return null; }
}
