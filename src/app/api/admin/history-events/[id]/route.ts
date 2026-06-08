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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return apiError("无效的请求体", 400);

  const { title, body: content, year, eventDate, sortOrder, images } = body as Record<string, any>;

  // 如果传了 images，先删旧图再创建新图
  if (images !== undefined) {
    await prisma.eventImage.deleteMany({ where: { eventId: id } });
  }

  const event = await prisma.yearEvent.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { body: content || null }),
      ...(year !== undefined && { year }),
      ...(eventDate !== undefined && { eventDate: eventDate ? new Date(eventDate) : null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(images !== undefined && images.length > 0
        ? { images: { create: images.slice(0, 5).map((img: any, i: number) => ({ url: img.url, altText: img.altText, sortOrder: i })) } }
        : {}),
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  revalidatePath("/history");
  await invalidateCache("history:events");
  return apiResponse(event);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("权限不足", 403);

  const { id } = await params;
  await prisma.yearEvent.delete({ where: { id } });

  revalidatePath("/history");
  await invalidateCache("history:events");
  return apiResponse({ deleted: true });
}
