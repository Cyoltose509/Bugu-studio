/**
 * 议程栏 ＋ 类型下拉 —— 防回归测试。
 * 背景：侧栏 aside 带 overflow-y-auto，旧实现 absolute 菜单会被底部截断并骤现滚动条；
 * 现为 fixed 定位脱离裁剪，滚动/缩放即关闭。
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/admin/activities/actions", () => ({ promoteProposalToAgenda: vi.fn(async () => ({})) }));
vi.mock("@/components/activities/meeting/MeetingTalksEditor", () => ({ default: () => null }));
vi.mock("@/components/activities/meeting/AgendaTimeline", () => ({
  default: ({ draft }: { draft?: string | null }) =>
    React.createElement("div", { "data-testid": "timeline", "data-draft": draft ?? "" }),
}));

import AgendaManagePanel from "@/components/activities/meeting/AgendaManagePanel";

const TIMELINE = [
  {
    key: "t1",
    type: "SHARE" as const,
    typeLabel: "分享",
    title: "示例分享",
    speakers: [],
    description: "",
    imageUrl: "",
    bvId: "",
  },
];

function renderPanel() {
  return render(
    React.createElement(AgendaManagePanel, {
      activityId: "a1",
      initialTalks: [],
      isAdmin: true,
      canAddAgenda: true,
      addMode: "form",
      timelineItems: TIMELINE,
      title: "议程",
    }),
  );
}

describe("AgendaManagePanel ＋ 类型下拉", () => {
  it("点 ＋ 弹出菜单：fixed 定位（脱离侧栏 overflow 裁剪）、含 分享/展示 两项", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("添加议程"));
    const menu = screen.getByRole("menu");
    // fixed 定位 + 内联坐标（right 必有；top/bottom 视空间取其一）
    expect(menu.className).toContain("fixed");
    expect(menu.style.right).toBeTruthy();
    expect(menu.style.top || menu.style.bottom).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /分享/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /展示/ })).toBeTruthy();
  });

  it("选择类型后菜单关闭，时间轴收到草稿", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("添加议程"));
    fireEvent.click(screen.getByRole("menuitem", { name: /展示/ }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("timeline").getAttribute("data-draft")).toBe("SHOWCASE");
  });

  it("菜单打开时滚动即关闭（避免与按钮错位）", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("添加议程"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("点菜单外部关闭", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("添加议程"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
