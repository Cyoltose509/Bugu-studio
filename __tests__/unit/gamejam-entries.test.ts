import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  JAM_ADMIN_ENTRY_TOPIC,
  normalizeJamScreenshots,
  parseJamSubmissionMeta,
  sortJamSubmissionsForDisplay,
  splitJamEntriesByRank,
} from "@/lib/activities/jam-entries";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  submissionDelete: vi.fn(),
  teamCreate: vi.fn(),
  teamDelete: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  revalidatePath: vi.fn(),
  invalidateCache: vi.fn(),
  deleteManyFromR2: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/i18n/getLang", () => ({ getLang: async () => "cn" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock("@/lib/utils/upload", () => ({
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
  deleteManyFromR2: mocks.deleteManyFromR2,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    jamSubmission: {
      findFirst: mocks.submissionFindFirst,
      findMany: mocks.submissionFindMany,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
      delete: mocks.submissionDelete,
    },
    jamTeam: {
      create: mocks.teamCreate,
      delete: mocks.teamDelete,
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findMany: mocks.projectFindMany,
    },
  },
}));

import {
  adminDeleteJamEntry,
  adminLinkJamSubmissionProject,
  adminSaveJamEntry,
  adminSetJamEntryTrophy,
  adminUpdateJamRankings,
} from "@/lib/actions/submissions";

describe("Game Jam entries sorting, trophies, and admin actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // resetAllMocks 会把 mockResolvedValue 一起清掉，这里补回来：
    // 真实 deleteManyFromR2 返回 Promise，测试不该让它退化成 undefined
    mocks.deleteManyFromR2.mockResolvedValue({ deleted: 0, failed: 0 });
  });

  describe("normalizeJamScreenshots & parseJamSubmissionMeta", () => {
    it("allows 0 to 3 screenshots and truncates beyond 3", () => {
      expect(normalizeJamScreenshots([])).toEqual([]);
      expect(normalizeJamScreenshots(null)).toEqual([]);
      expect(
        normalizeJamScreenshots(["https://a.com/1.png", "https://a.com/2.png"])
      ).toEqual(["https://a.com/1.png", "https://a.com/2.png"]);
      expect(
        normalizeJamScreenshots([
          "https://a.com/1.png",
          "https://a.com/2.png",
          "https://a.com/3.png",
          "https://a.com/4.png",
        ])
      ).toHaveLength(3);
    });

    it("parses cover, creators, trophy, and sortOrder", () => {
      const meta = parseJamSubmissionMeta({
        coverImage: "https://cdn.example.com/cover.webp",
        trophy: "GOLD",
        sortOrder: 0,
        isAdminPlaceholder: true,
        creators: [
          { name: "Alice", roles: ["程序", "策划"], memberId: "m-1" },
          { name: "Bob", roles: ["美术"], userId: "u-2" },
        ],
      });
      expect(meta.coverImage).toBe("https://cdn.example.com/cover.webp");
      expect(meta.trophy).toBe("GOLD");
      expect(meta.sortOrder).toBe(0);
      expect(meta.isAdminPlaceholder).toBe(true);
      expect(meta.creators).toHaveLength(2);
      expect(meta.creators[0]).toMatchObject({
        name: "Alice",
        roles: ["程序", "策划"],
        memberId: "m-1",
      });
    });
  });

  describe("splitJamEntriesByRank & sortJamSubmissionsForDisplay", () => {
    it("splits ranked and unranked entries and auto-numbers ranked items (#1, #2...)", () => {
      const entries = [
        { id: "sub-u1", metadata: { sortOrder: null } },
        { id: "sub-r2", metadata: { sortOrder: 5 } },
        { id: "sub-r1", metadata: { sortOrder: 1 } },
        { id: "sub-u2", metadata: {} },
      ];

      const { ranked, unranked } = splitJamEntriesByRank(entries);
      expect(ranked.map((r) => ({ id: r.id, rank: r.rank }))).toEqual([
        { id: "sub-r1", rank: 1 },
        { id: "sub-r2", rank: 2 },
      ]);
      expect(unranked.map((u) => ({ id: u.id, rank: u.rank }))).toEqual([
        { id: "sub-u1", rank: null },
        { id: "sub-u2", rank: null },
      ]);
    });

    it("pins unlimited Gold/Silver/Bronze trophy entries to top, followed by ranked, then randomized unranked", () => {
      const entries = [
        { id: "unranked-a", metadata: { sortOrder: null, trophy: null } },
        { id: "ranked-2", metadata: { sortOrder: 1, trophy: null } },
        { id: "bronze-unranked", metadata: { sortOrder: null, trophy: "BRONZE" } },
        { id: "gold-1", metadata: { sortOrder: 0, trophy: "GOLD" } },
        { id: "gold-2", metadata: { sortOrder: null, trophy: "GOLD" } },
        { id: "silver-1", metadata: { sortOrder: 2, trophy: "SILVER" } },
        { id: "unranked-b", metadata: { sortOrder: null, trophy: null } },
      ];

      // 注入确定性伪随机函数使未排序栏逆序
      const displayed = sortJamSubmissionsForDisplay(entries, () => 0);
      expect(displayed.map((d) => d.id)).toEqual([
        "gold-1",
        "gold-2",
        "silver-1",
        "bronze-unranked",
        "ranked-2",
        "unranked-b",
        "unranked-a",
      ]);

      // 验证自动标名次
      expect(displayed.find((d) => d.id === "gold-1")?.rank).toBe(1);
      expect(displayed.find((d) => d.id === "ranked-2")?.rank).toBe(2);
      expect(displayed.find((d) => d.id === "silver-1")?.rank).toBe(3);
      expect(displayed.find((d) => d.id === "unranked-a")?.rank).toBeNull();
    });
  });

  describe("adminSaveJamEntry & adminUpdateJamRankings & adminLinkJamSubmissionProject", () => {
    it("allows admin to create a placeholder entry with cover, 0-3 screenshots, title, and developers", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.teamCreate.mockResolvedValue({
        id: "team-placeholder-1",
        topic: JAM_ADMIN_ENTRY_TOPIC,
      });
      mocks.submissionCreate.mockResolvedValue({ id: "sub-new-1" });

      const res = await adminSaveJamEntry("act-2026-jam", {
        title: "布谷回响",
        coverImage: "https://cdn.example.com/cover.webp",
        screenshots: ["https://cdn.example.com/s1.webp", "https://cdn.example.com/s2.webp"],
        creators: [
          { name: "开发者甲", roles: ["程序", "策划"], memberId: "mem-1" },
          { name: "开发者乙", roles: ["美术"] },
        ],
        trophy: "GOLD",
      });

      expect(res).toEqual({ success: true, submissionId: "sub-new-1" });
      expect(mocks.teamCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityId: "act-2026-jam",
            topic: JAM_ADMIN_ENTRY_TOPIC,
          }),
        })
      );
      expect(mocks.submissionCreate).toHaveBeenCalledWith({
        data: {
          activityId: "act-2026-jam",
          teamId: "team-placeholder-1",
          title: "布谷回响",
          files: ["https://cdn.example.com/s1.webp", "https://cdn.example.com/s2.webp"],
          projectId: null,
          metadata: {
            coverImage: "https://cdn.example.com/cover.webp",
            creators: [
              {
                name: "开发者甲",
                roles: ["程序", "策划"],
                userId: undefined,
                memberId: "mem-1",
                avatar: null,
              },
              {
                name: "开发者乙",
                roles: ["美术"],
                userId: undefined,
                memberId: undefined,
                avatar: null,
              },
            ],
            trophy: "GOLD",
            sortOrder: null,
            isAdminPlaceholder: true,
          },
        },
      });
    });

    it("rejects more than 3 screenshots", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      const res = await adminSaveJamEntry("act-2026-jam", {
        title: "过多截图测试",
        screenshots: ["1.png", "2.png", "3.png", "4.png"],
      });
      expect(res.error).toContain("3");
      expect(mocks.submissionCreate).not.toHaveBeenCalled();
    });

    it("updates ranked and unranked order in adminUpdateJamRankings", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.submissionFindMany.mockResolvedValue([
        { id: "s1", metadata: { coverImage: "c1.png", sortOrder: null } },
        { id: "s2", metadata: { coverImage: "c2.png", sortOrder: 0 } },
        { id: "s3", metadata: { coverImage: "c3.png", sortOrder: 1 } },
      ]);
      mocks.submissionUpdate.mockResolvedValue({});

      const res = await adminUpdateJamRankings("act-2026-jam", {
        rankedIds: ["s3", "s1"],
        unrankedIds: ["s2"],
      });

      expect(res.success).toBe(true);
      expect(mocks.submissionUpdate).toHaveBeenCalledWith({
        where: { id: "s3" },
        data: { metadata: { coverImage: "c3.png", sortOrder: 0 } },
      });
      expect(mocks.submissionUpdate).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { metadata: { coverImage: "c1.png", sortOrder: 1 } },
      });
      expect(mocks.submissionUpdate).toHaveBeenCalledWith({
        where: { id: "s2" },
        data: { metadata: { coverImage: "c2.png", sortOrder: null } },
      });
    });

    it("links and unlinks a submission to a Works Library project", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.submissionFindFirst.mockResolvedValue({ id: "sub-1", activityId: "act-1" });
      mocks.projectFindUnique.mockResolvedValue({
        id: "proj-99",
        slug: "bugoo-echo",
        title: "布谷回响正式版",
      });
      mocks.submissionUpdate.mockResolvedValue({});

      const res = await adminLinkJamSubmissionProject("act-1", "sub-1", "proj-99");
      expect(res.success).toBe(true);
      expect(mocks.submissionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { projectId: "proj-99" },
      });

      // 取消关联
      const unlinkRes = await adminLinkJamSubmissionProject("act-1", "sub-1", null);
      expect(unlinkRes.success).toBe(true);
      expect(mocks.submissionUpdate).toHaveBeenLastCalledWith({
        where: { id: "sub-1" },
        data: { projectId: null },
      });
    });

    it("sets trophy via adminSetJamEntryTrophy and deletes placeholder entry via adminDeleteJamEntry", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      mocks.submissionFindFirst.mockResolvedValue({
        id: "sub-1",
        activityId: "act-1",
        files: [],
        metadata: { sortOrder: 0 },
        team: { id: "t-place-1", topic: JAM_ADMIN_ENTRY_TOPIC },
      });
      mocks.submissionUpdate.mockResolvedValue({});
      mocks.teamDelete.mockResolvedValue({});

      const trophyRes = await adminSetJamEntryTrophy("act-1", "sub-1", "SILVER");
      expect(trophyRes.success).toBe(true);
      expect(mocks.submissionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { metadata: { sortOrder: 0, trophy: "SILVER" } },
      });

      const delRes = await adminDeleteJamEntry("act-1", "sub-1");
      expect(delRes.success).toBe(true);
      expect(mocks.teamDelete).toHaveBeenCalledWith({ where: { id: "t-place-1" } });
      // 回归保护：R2 清理必须在 action 返回前真的发出去
      // （曾经是浮空 Promise，Vercel 冻结实例后请求丢失，旧图永远清不掉）
      expect(mocks.deleteManyFromR2).toHaveBeenCalled();
    });
  });
});
