import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  judgeFindFirst: vi.fn(),
  judgeCreate: vi.fn(),
  judgeDelete: vi.fn(),
  userFindUnique: vi.fn(),
  activityUpdate: vi.fn(),
  revalidatePath: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/i18n/getLang", () => ({ getLang: async () => "cn" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    jamJudge: {
      findFirst: mocks.judgeFindFirst,
      create: mocks.judgeCreate,
      delete: mocks.judgeDelete,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    activity: {
      update: mocks.activityUpdate,
    },
  },
}));

import {
  addJudge,
  joinAdminAsJudge,
  removeJudge,
  updateJudgingSettings,
} from "@/lib/actions/judging";

describe("Game Jam judging enhancements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("addJudge", () => {
    it("rejects unauthenticated requests", async () => {
      mocks.auth.mockResolvedValue(null);
      const fd = new FormData();
      fd.append("externalName", "Guest Judge");

      const res = await addJudge("act-1", fd);
      expect(res.error).toBeDefined();
      expect(mocks.judgeCreate).not.toHaveBeenCalled();
    });

    it("rejects non-admin users", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "MEMBER" } });
      const fd = new FormData();
      fd.append("externalName", "Guest Judge");

      const res = await addJudge("act-1", fd);
      expect(res.error).toBeDefined();
      expect(mocks.judgeCreate).not.toHaveBeenCalled();
    });

    it("allows admin to add external judge with title", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.judgeFindFirst.mockResolvedValue(null);
      mocks.judgeCreate.mockResolvedValue({ id: "judge-1" });

      const fd = new FormData();
      fd.append("externalName", "业界特邀制作人");
      fd.append("title", "某知名游戏公司主策划");

      const res = await addJudge("act-1", fd);
      expect(res.success).toBe(true);
      expect(mocks.judgeCreate).toHaveBeenCalledWith({
        data: {
          activityId: "act-1",
          externalName: "业界特邀制作人",
          title: "某知名游戏公司主策划",
        },
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/activities/act-1/game-jam/judging");
    });

    it("prevents duplicate external judge names in same activity", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.judgeFindFirst.mockResolvedValue({ id: "existing-1", externalName: "业界特邀制作人" });

      const fd = new FormData();
      fd.append("externalName", "业界特邀制作人");

      const res = await addJudge("act-1", fd);
      expect(res.error).toBeDefined();
      expect(mocks.judgeCreate).not.toHaveBeenCalled();
    });

    it("allows admin to add on-site member as judge (including graduated)", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.userFindUnique.mockResolvedValue({ id: "member-1", role: "MEMBER" });
      mocks.judgeFindFirst.mockResolvedValue(null);
      mocks.judgeCreate.mockResolvedValue({ id: "judge-2" });

      const fd = new FormData();
      fd.append("judgeUserId", "member-1");
      fd.append("title", "前社长 / 毕业生指导");

      const res = await addJudge("act-1", fd);
      expect(res.success).toBe(true);
      expect(mocks.judgeCreate).toHaveBeenCalledWith({
        data: {
          activityId: "act-1",
          userId: "member-1",
          title: "前社长 / 毕业生指导",
        },
      });
    });

    it("rejects GUEST users from being judges", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.userFindUnique.mockResolvedValue({ id: "guest-1", role: "GUEST" });

      const fd = new FormData();
      fd.append("judgeUserId", "guest-1");

      const res = await addJudge("act-1", fd);
      expect(res.error).toBeDefined();
      expect(mocks.judgeCreate).not.toHaveBeenCalled();
    });
  });

  describe("joinAdminAsJudge", () => {
    it("allows logged-in admin to voluntarily join judging panel", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.judgeFindFirst.mockResolvedValue(null);
      mocks.judgeCreate.mockResolvedValue({ id: "judge-admin" });

      const res = await joinAdminAsJudge("act-1");
      expect(res.success).toBe(true);
      expect(mocks.judgeCreate).toHaveBeenCalledWith({
        data: {
          activityId: "act-1",
          userId: "admin-1",
        },
      });
    });

    it("prevents duplicate join if already in panel", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.judgeFindFirst.mockResolvedValue({ id: "existing-admin-judge" });

      const res = await joinAdminAsJudge("act-1");
      expect(res.error).toBeDefined();
      expect(mocks.judgeCreate).not.toHaveBeenCalled();
    });
  });

  describe("removeJudge", () => {
    it("allows admin to remove any judge", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.judgeFindFirst.mockResolvedValue({ id: "judge-99", activityId: "act-1", userId: "user-88" });
      mocks.judgeDelete.mockResolvedValue({ id: "judge-99" });

      const res = await removeJudge("act-1", "judge-99");
      expect(res.success).toBe(true);
      expect(mocks.judgeDelete).toHaveBeenCalledWith({ where: { id: "judge-99" } });
    });

    it("allows judge to remove themselves", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-88", role: "MEMBER" } });
      mocks.judgeFindFirst.mockResolvedValue({ id: "judge-99", activityId: "act-1", userId: "user-88" });
      mocks.judgeDelete.mockResolvedValue({ id: "judge-99" });

      const res = await removeJudge("act-1", "judge-99");
      expect(res.success).toBe(true);
    });

    it("forbids non-admin from removing other judges", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "other-user", role: "MEMBER" } });
      mocks.judgeFindFirst.mockResolvedValue({ id: "judge-99", activityId: "act-1", userId: "user-88" });

      const res = await removeJudge("act-1", "judge-99");
      expect(res.error).toBeDefined();
      expect(mocks.judgeDelete).not.toHaveBeenCalled();
    });
  });

  describe("updateJudgingSettings", () => {
    it("updates judgingMode, judgesPublic, and externalJudgingUrl", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.activityUpdate.mockResolvedValue({ id: "act-1" });

      const fd = new FormData();
      fd.append("judgingMode", "EXTERNAL");
      fd.append("judgesPublic", "false");
      fd.append("externalJudgingUrl", "https://itch.io/jam/my-jam");

      const res = await updateJudgingSettings("act-1", fd);
      expect(res.success).toBe(true);
      expect(mocks.activityUpdate).toHaveBeenCalledWith({
        where: { id: "act-1" },
        data: {
          judgingMode: "EXTERNAL",
          judgesPublic: false,
          externalJudgingUrl: "https://itch.io/jam/my-jam",
        },
      });
      expect(mocks.invalidateCache).toHaveBeenCalledWith("activities:list");
    });

    it("supports setting judgingMode to DISABLED (showcase only)", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.activityUpdate.mockResolvedValue({ id: "act-1" });

      const fd = new FormData();
      fd.append("judgingMode", "DISABLED");
      fd.append("judgesPublic", "true");

      const res = await updateJudgingSettings("act-1", fd);
      expect(res.success).toBe(true);
      expect(mocks.activityUpdate).toHaveBeenCalledWith({
        where: { id: "act-1" },
        data: {
          judgingMode: "DISABLED",
          judgesPublic: true,
          externalJudgingUrl: null,
        },
      });
    });

    it("rejects non-admin from updating settings", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "MEMBER" } });
      const fd = new FormData();
      fd.append("judgingMode", "DISABLED");

      const res = await updateJudgingSettings("act-1", fd);
      expect(res.error).toBeDefined();
      expect(mocks.activityUpdate).not.toHaveBeenCalled();
    });
  });
});
