import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  projectMemberFindMany: vi.fn(),
  clubMemberFindMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    projectMember: { findMany: mocks.projectMemberFindMany },
    clubMember: { findMany: mocks.clubMemberFindMany },
    notification: { create: mocks.create, createMany: mocks.createMany },
  },
}));

const {
  notifyNewProject,
  notifyProjectEdit,
  notifyProjectReviewResult,
  notifyProjectPublished,
} = await import("@/lib/services/notification");

function sentRows() {
  const call = mocks.createMany.mock.calls.at(-1);
  return (call?.[0]?.data ?? []) as Array<{ userId: string; type: string; content: string }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindMany.mockResolvedValue([{ id: "admin-a" }, { id: "admin-b" }]);
  mocks.projectMemberFindMany.mockResolvedValue([]);
  mocks.clubMemberFindMany.mockResolvedValue([]);
  mocks.create.mockResolvedValue({});
  mocks.createMany.mockResolvedValue({ count: 0 });
});

describe("notifyNewProject 受众划分", () => {
  it("管理员自己提交时不给自己发「请审核」", async () => {
    await notifyNewProject({
      projectId: "p1",
      projectTitle: "布谷",
      submitterId: "admin-a",
      submitterName: "苏致月",
      actorId: "admin-a",
      actorName: "苏致月",
    });

    const rows = sentRows();
    expect(rows.map((r) => r.userId)).toEqual(["admin-b"]);
    expect(rows[0].type).toBe("NEW_PROJECT");
    expect(rows[0].content).toContain("苏致月 提交了新作品《布谷》");
  });

  it("成员提交时通知所有管理员，文案用提交者名字", async () => {
    await notifyNewProject({
      projectId: "p2",
      projectTitle: "别花",
      submitterId: "member-1",
      submitterName: "卡车",
      actorId: "member-1",
      actorName: "卡车",
    });

    const rows = sentRows();
    expect(rows.map((r) => r.userId)).toEqual(["admin-a", "admin-b"]);
    expect(rows[0].content).toContain("卡车 提交了新作品《别花》");
  });

  it("Game Jam 转库用「转入作品库」而不是「提交新作品」", async () => {
    await notifyNewProject(
      {
        projectId: "p3",
        projectTitle: "参赛作品",
        submitterId: "member-1",
        submitterName: "卡车",
        actorId: "member-1",
      },
      { origin: "jam" },
    );

    const rows = sentRows();
    expect(rows[0].content).toContain("Game Jam 参赛作品《参赛作品》转入了作品库");
  });

  it("被代投的作品作者收到回执，管理员不重复收", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([
      { userId: "author-1", member: null },
      { userId: null, member: { userId: "author-2" } },
      { userId: "admin-a", member: null },
    ]);

    await notifyNewProject({
      projectId: "p4",
      projectTitle: "代投作品",
      submitterId: "admin-b",
      submitterName: "苏致月",
      actorId: "admin-b",
      actorName: "苏致月",
    });

    const rows = sentRows();
    // admin-a 作为管理员收到 NEW_PROJECT，不应再收到作者回执
    expect(rows.map((r) => r.userId)).toEqual(["admin-a", "author-1", "author-2"]);
    expect(rows.filter((r) => r.type === "PROJECT_SUBMIT_ACK").map((r) => r.userId))
      .toEqual(["author-1", "author-2"]);
  });
});

describe("notifyProjectEdit 受众划分", () => {
  it("编辑者就是提交者时，不给自己发「等待重新审核」", async () => {
    await notifyProjectEdit({
      projectId: "p5",
      projectTitle: "旧作",
      submitterId: "member-1",
      submitterName: "卡车",
      actorId: "member-1",
      actorName: "卡车",
    });

    const rows = sentRows();
    expect(rows.every((r) => r.type === "PROJECT_UPDATE")).toBe(true);
    expect(rows.map((r) => r.userId)).toEqual(["admin-a", "admin-b"]);
  });

  it("管理员代编辑他人作品时，提交者收到「被谁更新」", async () => {
    await notifyProjectEdit({
      projectId: "p6",
      projectTitle: "旧作",
      submitterId: "member-1",
      submitterName: "卡车",
      actorId: "admin-a",
      actorName: "苏致月",
    });

    const rows = sentRows();
    expect(rows.map((r) => r.type)).toContain("PROJECT_RESUBMIT");
    const resubmit = rows.find((r) => r.type === "PROJECT_RESUBMIT")!;
    expect(resubmit.userId).toBe("member-1");
    expect(resubmit.content).toContain("已被 苏致月 更新");
    // 操作者本人不再收到「作品更新待审」
    expect(rows.map((r) => r.userId)).not.toContain("admin-a");
  });
});

describe("notifyProjectReviewResult 受众划分", () => {
  it("审核人就是提交者时不发通知（自审自己的作品）", async () => {
    await notifyProjectReviewResult({
      projectId: "p7",
      projectTitle: "自审作品",
      submitterId: "admin-a",
      approved: true,
      reviewerId: "admin-a",
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("他人审核时通知提交者，驳回带备注", async () => {
    await notifyProjectReviewResult({
      projectId: "p8",
      projectTitle: "别花",
      submitterId: "member-1",
      approved: false,
      note: "封面缺失",
      reviewerId: "admin-a",
    });

    const payload = mocks.create.mock.calls[0][0].data;
    expect(payload.userId).toBe("member-1");
    expect(payload.title).toContain("审核未通过");
    expect(payload.content).toContain("封面缺失");
  });
});

describe("notifyProjectPublished 受众划分", () => {
  it("排除提交者本人与自己", async () => {
    mocks.clubMemberFindMany.mockResolvedValue([
      { userId: "member-1" },
      { userId: "watcher-1" },
    ]);

    await notifyProjectPublished("p9", "布谷", "卡车", {
      excludeUserIds: ["member-1", "admin-a"],
    });

    const rows = sentRows();
    expect(rows.map((r) => r.userId)).toEqual(["watcher-1"]);
  });
});
