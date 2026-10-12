import type { Prisma } from "@prisma/client";
import { BAITUAN_SLUG, BAITUAN_PROJECT_SLUGS, BAITUAN_POSTERS, baituanShowcase, showcaseKey } from "./showcase";

/** Idempotent setup: an existing event and its edited catalogue are preserved. */
export async function prepareBaituanDraft(tx: Prisma.TransactionClient) {
  const existing = await tx.activity.findUnique({ where: { slug: BAITUAN_SLUG } });
  if (existing) return existing;
  const projects = await tx.project.findMany({
    where: { slug: { in: BAITUAN_PROJECT_SLUGS }, status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
  if (projects.length !== BAITUAN_PROJECT_SLUGS.length) {
    throw new Error("五款试玩作品尚未全部发布，请先检查作品库");
  }
  const activity = await tx.activity.upsert({
    where: { slug: BAITUAN_SLUG }, update: {},
    create: {
      slug: BAITUAN_SLUG, title: "2026 百团大战 · 珞珈技术俱乐部招新",
      type: "GENERAL", status: "DRAFT",
      summary: "游戏 × 创作，一起玩出更多可能！来拓新14摊位体验社团原创游戏，和创作者面对面交流。",
      location: "桂园操场 · 拓新14摊位",
      startTime: new Date("2026-10-11T09:00:00+08:00"),
      endTime: new Date("2026-10-11T17:00:00+08:00"),
      coverImage: BAITUAN_POSTERS[0].url,
    },
  });
  await tx.siteSetting.upsert({
    where: { key: showcaseKey(activity.id) }, update: {},
    create: { key: showcaseKey(activity.id), value: JSON.stringify(baituanShowcase(projects)) },
  });
  return activity;
}
