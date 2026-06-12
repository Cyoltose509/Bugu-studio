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
import { notifyMentions } from "@/lib/services/notification";

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

  try {
    const maxSort = await prisma.yearEvent.findFirst({
      where: { year },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    // 过滤掉 url 为空的图片
    const validImages = images?.filter((img) => img.url) ?? [];

    const event = await prisma.yearEvent.create({
      data: {
        title,
        body: content || null,
        year,
        eventDate: eventDate ? new Date(eventDate) : null,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
        images: validImages.length
          ? { create: validImages.slice(0, 5).map((img, i) => ({ url: img.url, altText: img.altText, sortOrder: i })) }
          : undefined,
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    // @mention 通知
    if (content) {
      await notifyMentions(content, session.user.name || "未知用户", session.user.id, {
        type: "HistoryEvent",
        id: event.id,
        title,
      });
    }

    revalidatePath("/history");
    invalidateCache("history:events"); // 非阻塞
    return apiResponse(event, 201);
  } catch (err: any) {
    console.error("创建历史事件失败:", err);
    return apiError(err.message || "创建失败", 500);
  }
}
