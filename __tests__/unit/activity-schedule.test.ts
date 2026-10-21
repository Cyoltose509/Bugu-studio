import { describe, expect, it } from "vitest";
import {
  activityPhase,
  compareActivitiesNewestFirst,
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
