import { describe, expect, it } from "vitest";
import { activityShareData } from "@/lib/share";
import { canSubmitActivityTalk, hasActivityTalkSection } from "@/lib/activities/capabilities";
import { productionMeeting, productionRecruitment } from "@/app/dev/share-preview/production-samples";

describe("activity sharing capabilities", () => {
  it("keeps the published meeting's real talk and speaker together", () => {
    const card = activityShareData(productionMeeting, "cn", new Date("2026-10-15T08:00:00.000Z"));
    expect(card.path).toBe(`/activities/${productionMeeting.id}`);
    expect(card.agenda).toEqual([{ title: "了解游戏的制作与上线", speaker: "吃药图书" }]);
    expect(card.talkSubmissionOpen).toBe(true);
  });

  it("lets a general event accept talks independently of ordinary registration", () => {
    const event = {
      ...productionRecruitment,
      status: "PUBLISHED",
      endTime: "2099-10-11T09:00:00.000Z",
      registrationOpen: false,
      talkSubmissionOpen: true,
      talks: [{ title: "试玩分享", speaker: "小布" }],
    };
    expect(canSubmitActivityTalk(event)).toBe(true);
    expect(hasActivityTalkSection(event)).toBe(true);
    expect(activityShareData(event, "cn").agenda).toEqual([{ title: "试玩分享", speaker: "小布" }]);
    expect(canSubmitActivityTalk({ ...event, talkSubmissionOpen: false })).toBe(false);
    expect(canSubmitActivityTalk({ ...event, status: "DRAFT" })).toBe(false);
    expect(canSubmitActivityTalk({ ...event, endTime: "2020-01-01T00:00:00.000Z" })).toBe(false);
  });
});
