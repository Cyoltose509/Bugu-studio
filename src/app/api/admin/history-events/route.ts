/**
 * GET  /api/admin/history-events — 列出所有历史事件
 * POST /api/admin/history-events — 创建事件 (Admin)
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const events = await prisma.yearEvent.findMany({
    orderBy: [{ year: "desc" }, { sortOrder: "asc" }],
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  return apiResponse(events);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const body = await request.json().catch(() => null);
  if (!body || !body.title || !body.eventDate) {
    return apiError("标题和日期为必填", 400);
  }

  const { title, body: content, eventDate, images } = body as {
    title: string;
    body?: string;
    year?: number;
    eventDate: string;
    images?: { url: string; altText?: string }[];
  };

  const year = body.year || new Date(eventDate).getFullYear();

  const maxSort = await prisma.yearEvent.findFirst({
    where: { year },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const event = await prisma.yearEvent.create({
    data: {
      title,
      body: content || null,
      year,
      eventDate: eventDate ? new Date(eventDate) : null,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      images: images?.length
        ? { create: images.slice(0, 5).map((img, i) => ({ url: img.url, altText: img.altText, sortOrder: i })) }
        : undefined,
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  revalidatePath("/history");
  await invalidateCache("history:events");
  return apiResponse(event, 201);
}
