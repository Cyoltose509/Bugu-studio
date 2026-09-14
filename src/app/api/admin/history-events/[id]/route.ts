/**
 * PATCH  /api/admin/history-events/[id] — 更新事件
 * DELETE /api/admin/history-events/[id] — 删除事件
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { notifyMentions } from "@/lib/services/notification";
import { deleteManyFromR2 } from "@/lib/utils/upload";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return apiError("无效的请求体", 400);

  const { title, body: content, year: bodyYear, eventDate, eventEndDate, sortOrder, images } = body as Record<string, any>;

  const year = bodyYear || (eventDate ? new Date(eventDate).getFullYear() : undefined);

  // 过滤掉 url 为空的图片
  const validImages: { url: string; altText?: string }[] = images
    ? (images as any[]).filter((img: any) => img.url)
    : [];

  try {
    // 如果传了 images，先捕获旧图片 URL 再删 DB 记录
    let oldImageUrls: string[] = [];
    if (images !== undefined) {
      const oldImages = await prisma.eventImage.findMany({
        where: { eventId: id },
        select: { url: true },
      });
      oldImageUrls = oldImages.map((img) => img.url).filter(Boolean);
      await prisma.eventImage.deleteMany({ where: { eventId: id } });
    }

    const event = await prisma.yearEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { body: content || null }),
        ...(year !== undefined && { year }),
        ...(eventDate !== undefined && { eventDate: eventDate ? new Date(eventDate) : null }),
        ...(eventEndDate !== undefined && { eventEndDate: eventEndDate ? new Date(eventEndDate) : null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(images !== undefined && validImages.length > 0
          ? { images: { create: validImages.slice(0, 5).map((img, i) => ({ url: img.url, altText: img.altText, sortOrder: i })) } }
          : {}),
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    // @mention 通知
    if (content) {
      await notifyMentions(content, session.user.name || "未知用户", session.user.id, {
        type: "HistoryEvent",
        id: event.id,
        title: title || event.title,
      });
    }

    revalidatePath("/history");
    invalidateCache("history:"); // 覆盖 history:allEvents / eventYears 等

    // ── 清理 R2 旧图片（best-effort）──
    if (oldImageUrls.length > 0) {
      deleteManyFromR2(oldImageUrls).catch(() => {});
    }

    return apiResponse(event);
  } catch (err: any) {
    console.error("更新历史事件失败:", err);
    return apiError(err.message || "更新失败", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const { id } = await params;

  // 捕获旧图片 URL 再删除
  const oldImages = await prisma.eventImage.findMany({
    where: { eventId: id },
    select: { url: true },
  });
  const oldImageUrls = oldImages.map((img) => img.url).filter(Boolean);

  await prisma.yearEvent.delete({ where: { id } });

  revalidatePath("/history");
  await invalidateCache("history:");

  // ── 清理 R2 旧图片（best-effort）──
  if (oldImageUrls.length > 0) {
    deleteManyFromR2(oldImageUrls).catch(() => {});
  }

  return apiResponse({ deleted: true });
}
