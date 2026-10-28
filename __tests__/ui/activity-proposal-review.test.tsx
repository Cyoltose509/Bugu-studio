// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/lib/i18n/dict";

const mocks = vi.hoisted(() => ({ review: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/activities/actions", () => ({ reviewProposal: mocks.review }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/i18n/LangProvider", () => ({ useLang: () => ({ t: (key: Parameters<typeof t>[1]) => t("cn", key) }) }));
import ReviewProposalForm from "@/components/activities/meeting/ReviewProposalForm";

function showForm() {
  return render(<ReviewProposalForm proposalId="proposal-1" title="布谷GameJam2026 启动与主题公布" userName="guzi" createdAt="2026/10/26" />);
}

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("agenda review interaction", () => {
  it("shows only approve/reject initially and supports opening and cancelling rejection", () => {
    showForm();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    const note = screen.getByRole("textbox", { name: "审核意见（可选）" });
    fireEvent.change(note, { target: { value: "说明理由" } });
    expect(mocks.review).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("only shows processing on approval and prevents a second action", async () => {
    let finish!: (result: { success: true }) => void;
    mocks.review.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    showForm();
    fireEvent.click(screen.getByRole("button", { name: "通过" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "处理中..." })).toHaveLength(1));
    expect(screen.getByRole("button", { name: "拒绝" })).toBeDisabled();
    await act(async () => finish({ success: true }));
    expect(mocks.review).toHaveBeenCalledWith("proposal-1", "APPROVED", undefined);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("submits the rejection note, retains it after failure and permits retry", async () => {
    mocks.review.mockResolvedValue({ error: "审核未完成，请稍后重试" });
    showForm();
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "请补充内容" } });
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("审核未完成，请稍后重试"));
    expect(mocks.review).toHaveBeenCalledWith("proposal-1", "REJECTED", "请补充内容");
    expect(screen.getByRole("textbox")).toHaveValue("请补充内容");
    expect(screen.getByRole("button", { name: "拒绝" })).toBeEnabled();
  });

  it("does not expose raw server exceptions", async () => {
    mocks.review.mockRejectedValue(new Error("An error occurred in the Server Components render"));
    showForm();
    fireEvent.click(screen.getByRole("button", { name: "通过" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("操作失败"));
    expect(screen.queryByText(/Server Components/)).toBeNull();
  });
});
