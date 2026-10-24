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
}));

vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }));
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
  },
}));

import { reviewProposal } from "@/app/admin/activities/actions";

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
    const tx = {
      meetingProposal: { findUnique: mocks.proposalFind, update: mocks.proposalUpdate },
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
    await expect(reviewProposal("proposal-1", ProposalStatus.APPROVED)).rejects.toThrow("agenda write failed");
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
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
