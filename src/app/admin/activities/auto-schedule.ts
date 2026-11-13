"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { formatActivityDateTime } from "@/lib/activities/datetime";

/** 例会默认时间：最近一场例会 + 2 周的 14:30–17:30（北京时间） */
const AUTO_CLOCK_START = "14:30";
const AUTO_CLOCK_END = "17:30";
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * 推算下一场例会时间。
 * 以数据库中开始时间最晚的一场例会为基准（已排期的未来场次也算），往后推 14 天。
 * 没有历史例会时返回 null，由前端提示手动指定。
 */
export async function getAutoMeetingSchedule(): Promise<{ start: string; end: string } | null> {
  await requireAdmin();

  const last = await prisma.activity.findFirst({
    where: { type: "MEETING", startTime: { not: null } },
    orderBy: { startTime: "desc" },
    select: { startTime: true },
  });
  if (!last?.startTime) return null;

  const base = new Date(last.startTime.getTime() + TWO_WEEKS_MS);
  const date = formatActivityDateTime(base);
  return { start: `${date}T${AUTO_CLOCK_START}`, end: `${date}T${AUTO_CLOCK_END}` };
}
