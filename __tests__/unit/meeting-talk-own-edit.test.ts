import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  talkFind: vi.fn(),
  talkUpdate: vi.fn(),
  invalidate: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/i18n/getLang", () => ({ getLang: async () => "cn" }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: mocks.invalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    meetingTalk: { findUnique: mocks.talkFind, update: mocks.talkUpdate },
  },
}));

import { updateMeetingTalkOwn } from "@/app/admin/activities/actions";
import { t } from "@/lib/i18n/dict";

const talk = {
  id: "talk-1",
  activityId: "activity-1",
  userId: "user-1",
  speakers: [{ userId: "user-2" }],
  activity: { talkSubmissionOpen: true, status: "PUBLISHED", endTime: null, timePending: true },
};

describe("updateMeetingTalkOwn — 上传者本人修改议程卡", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.talkFind.mockResolvedValue(talk);
    mocks.talkUpdate.mockResolvedValue({});
  });

  it("未登录拒绝", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await updateMeetingTalkOwn("talk-1", { title: "新标题" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(mocks.talkUpdate).not.toHaveBeenCalled();
  });

  it("非上传者且非管理员拒绝", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "stranger", role: "USER" } });
    const result = await updateMeetingTalkOwn("talk-1", { title: "新标题" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(mocks.talkUpdate).not.toHaveBeenCalled();
  });

  it("上传者本人可更新（主讲人 user-1）", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    const result = await updateMeetingTalkOwn("talk-1", { title: " 新标题 ", description: "简介" });
    expect(result).toEqual({ success: true });
    expect(mocks.talkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "talk-1" },
        data: expect.objectContaining({ title: "新标题", description: "简介" }),
      }),
    );
  });

  it("作为讲者之一（user-2）也可更新", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-2", role: "USER" } });
    const result = await updateMeetingTalkOwn("talk-1", { title: "讲者改的标题" });
    expect(result).toEqual({ success: true });
  });

  it("普通用户在报名关闭后被拒绝", async () => {
    mocks.talkFind.mockResolvedValue({
      ...talk,
      activity: { talkSubmissionOpen: false, status: "PUBLISHED", endTime: null, timePending: true },
    });
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    const result = await updateMeetingTalkOwn("talk-1", { title: "新标题" });
    expect(result).toEqual({ error: expect.any(String) });
    expect(mocks.talkUpdate).not.toHaveBeenCalled();
  });

  it("空标题拒绝；非法 BV 号拒绝", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    expect(await updateMeetingTalkOwn("talk-1", { title: "  " })).toEqual({ error: expect.any(String) });
    expect(await updateMeetingTalkOwn("talk-1", { title: "标题", bvId: "not-a-bv" })).toEqual({ error: expect.any(String) });
    expect(mocks.talkUpdate).not.toHaveBeenCalled();
  });

  it("管理员始终可更新", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-9", role: "ADMIN" } });
    const result = await updateMeetingTalkOwn("talk-1", { title: "管理员改的" });
    expect(result).toEqual({ success: true });
  });
});

describe("i18n t() 缺失 key 防御", () => {
  it("缺失 key 回退为 key 本身而不是抛 TypeError", () => {
    expect(() => t("cn", "not.a.real.key" as never)).not.toThrow();
    expect(t("cn", "not.a.real.key" as never)).toBe("not.a.real.key");
  });
});
