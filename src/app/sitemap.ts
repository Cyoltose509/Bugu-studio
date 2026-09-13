import { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bugoostudio.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/works`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/members`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/activities`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/history`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/join`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  // 动态路由：已发布作品
  const projects = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE_URL}/works/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // 动态路由：成员
  const members = await prisma.clubMember.findMany({
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const memberRoutes: MetadataRoute.Sitemap = members.map((m) => ({
    url: `${BASE_URL}/members/${m.id}`,
    lastModified: m.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // 动态路由：活动
  const activities = await prisma.activity.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  // 与前台链接一致：活动详情用 id（同时详情页也兼容 slug）
  const activityRoutes: MetadataRoute.Sitemap = activities.map((a) => ({
    url: `${BASE_URL}/activities/${a.id}`,
    lastModified: a.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...projectRoutes, ...memberRoutes, ...activityRoutes];
}
