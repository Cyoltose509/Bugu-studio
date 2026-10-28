import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  transaction: vi.fn(),
  proposalFind: vi.fn(),
  proposalUpdate: vi.fn(),
  talkFind: vi.fn(),
  talkAggregate: vi.fn(),
  talkCreate: vi.fn(),
  talkDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  notify: vi.fn(),
  invalidate: vi.fn(),
  revalidate: vi.fn(),
  auth: vi.fn(),
  proposalCreate: vi.fn(),
  activityFind: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/i18n/getLang", () => ({ getLang: async () => "cn" }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: mocks.invalidate }));
vi.mock("@/lib/services/notification", () => ({
  createNotification: mocks.notify,
  notifyMentions: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/utils/upload", () => ({ deleteFromR2: vi.fn(), deleteManyFromR2: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    auditLog: { create: mocks.auditCreate },
    activity: { findUnique: mocks.activityFind },
    user: { findMany: mocks.userFindMany },
  },
}));

import { reviewProposal, submitProposal } from "@/app/admin/activities/actions";

const proposal = {
  id: "proposal-1",
  activityId: "activity-1",
  userId: "user-1",
  title: "同名主题也必须独立入议程",
  proposalType: "SHARE",
  status: "PENDING",
  user: { name: "Alice", member: { displayName: "小明" } },
};

describe("activity proposal approval consistency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.proposalFind.mockResolvedValue(proposal);
    mocks.talkFind.mockResolvedValue(null);
    mocks.talkAggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    mocks.talkCreate.mockResolvedValue({ id: "talk-1" });
    mocks.talkDeleteMany.mockResolvedValue({ count: 0 });
    mocks.proposalUpdate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.notify.mockResolvedValue({});
    mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.activityFind.mockResolvedValue({ talkSubmissionOpen: true, status: "PUBLISHED", timePending: true });
    mocks.proposalCreate.mockResolvedValue({ id: "proposal-1" });
    mocks.userFindMany.mockResolvedValue([]);
    const tx = {
      meetingProposal: { findUnique: mocks.proposalFind, update: mocks.proposalUpdate, create: mocks.proposalCreate },
      meetingTalk: {
        findUnique: mocks.talkFind,
        aggregate: mocks.talkAggregate,
        create: mocks.talkCreate,
        deleteMany: mocks.talkDeleteMany,
      },
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("creates the formal agenda item before committing approved status", async () => {
    await expect(reviewProposal("proposal-1", ProposalStatus.APPROVED)).resolves.toEqual({ success: true });
    expect(mocks.talkFind).toHaveBeenCalledWith(expect.objectContaining({ where: { sourceProposalId: "proposal-1" } }));
    expect(mocks.talkCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceProposalId: "proposal-1",
        activityId: "activity-1",
        userId: "user-1",
      }),
    }));
    expect(mocks.talkCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.proposalUpdate.mock.invocationCallOrder[0]);
    expect(mocks.invalidate).toHaveBeenCalledWith("activity:detail:activity-1");
  });

  it("does not mark the proposal approved when agenda creation fails", async () => {
    mocks.talkCreate.mockRejectedValue(new Error("agenda write failed"));
    await expect(reviewProposal("proposal-1", ProposalStatus.APPROVED)).resolves.toEqual({ error: "审核未完成，请稍后重试" });
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("rejects invalid review status without changing any data", async () => {
    await expect(reviewProposal("proposal-1", ProposalStatus.PENDING)).resolves.toEqual({ error: "请选择通过或拒绝" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("publishes admin submissions and creates the agenda in the same transaction", async () => {
    mocks.proposalFind.mockResolvedValue({ ...proposal, status: "APPROVED" });
    const data = new FormData();
    data.set("activityId", "activity-1");
    data.set("title", "Admin agenda");
    await expect(submitProposal(data)).resolves.toEqual({ success: true, published: true });
    expect(mocks.proposalCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }));
    expect(mocks.talkCreate).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("activity:detail:activity-1");
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("keeps member submissions pending and out of the agenda", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "member-1", role: "MEMBER" } });
    const data = new FormData();
    data.set("activityId", "activity-1");
    data.set("title", "Member proposal");
    await expect(submitProposal(data)).resolves.toEqual({ success: true, published: false });
    expect(mocks.proposalCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }));
    expect(mocks.talkCreate).not.toHaveBeenCalled();
  });

  it("returns a safe error if admin agenda creation fails", async () => {
    mocks.proposalFind.mockResolvedValue({ ...proposal, status: "APPROVED" });
    mocks.talkCreate.mockRejectedValue(new Error("private database error"));
    const data = new FormData();
    data.set("activityId", "activity-1");
    data.set("title", "Admin agenda");
    await expect(submitProposal(data)).resolves.toEqual({ error: "提交失败，请稍后重试" });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("is idempotent by proposal id instead of title", async () => {
    mocks.talkFind.mockResolvedValue({ id: "existing-talk" });
    await reviewProposal("proposal-1", ProposalStatus.APPROVED);
    expect(mocks.talkCreate).not.toHaveBeenCalled();
    expect(mocks.proposalUpdate).toHaveBeenCalled();
  });

  it("removes only the agenda row owned by a rejected proposal", async () => {
    await reviewProposal("proposal-1", ProposalStatus.REJECTED);
    expect(mocks.talkDeleteMany).toHaveBeenCalledWith({ where: { sourceProposalId: "proposal-1" } });
    expect(mocks.talkCreate).not.toHaveBeenCalled();
    expect(mocks.proposalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ProposalStatus.REJECTED }),
    }));
  });
});
