import { describe, expect, it } from "vitest";
import {
  activityNewestFirstOrder,
  activitySoonestFirstOrder,
  activityPhase,
  compareActivitiesNewestFirst,
  compareActivitiesSoonestFirst,
  formatActivitySchedule,
} from "@/lib/activities/datetime";
import { canSubmitActivityTalk } from "@/lib/activities/capabilities";
import { activityShareData } from "@/lib/share";

const now = new Date("2026-10-17T08:00:00.000Z");

describe("activity schedule", () => {
  it("treats a pending activity as a future event and the newest sort tier", () => {
    const pending = { timePending: true, startTime: null, endTime: null, status: "PUBLISHED" };
    const later = { timePending: false, startTime: "2026-12-01T00:00:00+08:00", endTime: "2026-12-02T00:00:00+08:00" };
    const sooner = { timePending: false, startTime: "2026-10-18T00:00:00+08:00", endTime: "2026-10-18T23:59:59+08:00" };

    expect(activityPhase(pending, now)).toBe("upcoming");
    expect(formatActivitySchedule(null, null, "cn", true)).toBe("待定");
    expect(formatActivitySchedule(null, null, "en", true)).toBe("TBD");
    expect([sooner, pending, later].sort(compareActivitiesNewestFirst)).toEqual([pending, later, sooner]);
  });

  it("keeps dated activities newest-first and leaves past events in the past", () => {
    const newer = { startTime: "2026-10-19T00:00:00+08:00", endTime: "2026-10-25T23:59:59+08:00", status: "PUBLISHED" };
    const older = { startTime: "2026-10-18T00:00:00+08:00", endTime: "2026-10-18T23:59:59+08:00", status: "PUBLISHED" };
    const ended = { startTime: "2026-09-13T00:00:00+08:00", endTime: "2026-09-13T23:59:59+08:00", status: "PUBLISHED" };

    expect(compareActivitiesNewestFirst(older, newer)).toBeGreaterThan(0);
    expect(activityPhase(newer, now)).toBe("upcoming");
    expect(activityPhase(ended, now)).toBe("past");
    expect(activityPhase({ ...newer, status: "ARCHIVED" }, now)).toBe("past");
  });

  it("keeps talk signup open for a pending published activity", () => {
    const pending = {
      id: "tbd",
      title: "时间待定",
      status: "PUBLISHED",
      timePending: true,
      startTime: null,
      endTime: null,
      location: null,
      talkSubmissionOpen: true,
    };
    expect(canSubmitActivityTalk(pending, now)).toBe(true);
    const card = activityShareData(pending, "cn", now);
    expect(card.date).toBe("待定");
    expect(card.status).toBe("即将开始");
    expect(card.talkSubmissionOpen).toBe(true);
  });
});

describe("activity upcoming order", () => {
  it("把最近要开的一场排在最前，待定垫底", () => {
    const pending = { timePending: true, startTime: null };
    const later = { timePending: false, startTime: "2027-02-01T00:00:00+08:00" };
    const sooner = { timePending: false, startTime: "2026-12-06T14:30:00+08:00" };

    // 主推位取第一个：必须是最近的一场，而不是最远的一场
    expect([later, pending, sooner].sort(compareActivitiesSoonestFirst)).toEqual([sooner, later, pending]);
    expect(compareActivitiesSoonestFirst(later, sooner)).toBeGreaterThan(0);
    expect(compareActivitiesSoonestFirst(pending, sooner)).toBeGreaterThan(0);
  });

  it("首页与活动页共用同一套 Prisma 排序常量", () => {
    // 常量本身没被任何函数覆盖，单独锁一下方向：待定 asc(垫底) + startTime asc(近到远)
    expect(activitySoonestFirstOrder).toEqual([
      { timePending: "asc" },
      { startTime: "asc" },
    ]);
    expect(activityNewestFirstOrder).toEqual([
      { timePending: "desc" },
      { startTime: "desc" },
    ]);
  });
});
