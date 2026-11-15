/**
 * 前端错误列表 hover 详情弹层自适应边界翻转测试。
 * @vitest-environment happy-dom
 */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import ErrorReportsClient from "@/components/admin/ErrorReportsClient";

const mockReports = [
  {
    id: "rep-1",
    reportId: 23,
    message: "ChunkLoadError: Loading chunk 1063 failed.",
    stack: "ChunkLoadError at https://...",
    url: "https://www.bugoostudio.com/activities",
    userAgent: "Mozilla/5.0",
    status: "RESOLVED",
    count: 1,
    createdAt: new Date().toISOString(),
    user: null,
  },
];

describe("ErrorReportsClient hover popover boundary awareness", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          reports: mockReports,
          pagination: { page: 1, totalPages: 1 },
        }),
      })
    );
  });

  it("当靠近视口底部时，hover 弹层自动向上翻转 (bottom-full) 且带有 overflowAnchor: none", async () => {
    render(<ErrorReportsClient />);

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText("#23")).toBeDefined();
    });

    const row = screen.getByText("#23").closest(".grid")?.parentElement;
    expect(row).toBeDefined();

    // 模拟视口底部：row 位于 750px，视口高度 800px (spaceBelow = 50px < 380px, spaceAbove = 710px)
    vi.spyOn(row!, "getBoundingClientRect").mockReturnValue({
      top: 710,
      bottom: 750,
      left: 0,
      right: 1000,
      width: 1000,
      height: 40,
      x: 0,
      y: 710,
      toJSON: () => {},
    });

    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    fireEvent.mouseEnter(row!);

    // 错误堆栈应该出现
    await waitFor(() => {
      expect(screen.getByText("错误堆栈")).toBeDefined();
    });

    const popover = screen.getByText("错误堆栈").closest("div[style*='overflow-anchor']") as HTMLElement;
    expect(popover).toBeDefined();
    // 应该向上翻转
    expect(popover.className).toContain("bottom-full");
    expect(popover.className).not.toContain("top-full");
    expect(popover.style.overflowAnchor).toBe("none");

    // 鼠标移出后弹层消失
    fireEvent.mouseLeave(row!);
    expect(screen.queryByText("错误堆栈")).toBeNull();
  });

  it("当下方空间充足时，hover 弹层默认向下弹出 (top-full)", async () => {
    render(<ErrorReportsClient />);

    await waitFor(() => {
      expect(screen.getByText("#23")).toBeDefined();
    });

    const row = screen.getByText("#23").closest(".grid")?.parentElement;
    expect(row).toBeDefined();

    // 模拟视口顶部：row 位于 100px，视口高度 900px (spaceBelow = 760px >= 380px)
    vi.spyOn(row!, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 140,
      left: 0,
      right: 1000,
      width: 1000,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    Object.defineProperty(window, "innerHeight", { value: 900, writable: true, configurable: true });

    fireEvent.mouseEnter(row!);

    await waitFor(() => {
      expect(screen.getByText("错误堆栈")).toBeDefined();
    });

    const popover = screen.getByText("错误堆栈").closest("div[style*='overflow-anchor']") as HTMLElement;
    expect(popover).toBeDefined();
    // 应该向下弹出
    expect(popover.className).toContain("top-full");
    expect(popover.className).not.toContain("bottom-full");
  });
});
