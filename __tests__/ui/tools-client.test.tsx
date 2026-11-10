/**
 * 实用工具页客户端组件（ToolsClient）渲染测试 —— jsdom。
 * 覆盖：分栏渲染、展示态跳过空分栏、管理模式的分栏操作入口、
 * 编辑器无取色器（代表色环节已取消）、favicon 联动与分栏选择。
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/tools/actions", () => ({ saveToolsData: vi.fn(async () => ({})) }));

import ToolsClient from "@/components/tools/ToolsClient";
import { DEFAULT_TOOLS_DATA, type ToolsData } from "@/lib/tools/shared";

const DATA: ToolsData = {
  sections: [
    { id: "s1", name: "游戏引擎" },
    { id: "s2", name: "三维创作" },
    { id: "s3", name: "空栏" },
  ],
  sites: [
    { id: "a", name: "Godot Engine", url: "https://godotengine.org", iconUrl: "/images/tools/godot.png", color: "#478CBF", letter: "G", category: "游戏引擎", description: "开源引擎" },
    { id: "b", name: "Blender", url: "https://www.blender.org", iconUrl: "", color: "#EA7600", letter: "B", category: "三维创作", description: "" },
  ],
};

function renderClient({ data = DATA, isAdmin = true }: { data?: ToolsData; isAdmin?: boolean } = {}) {
  return render(React.createElement(ToolsClient, { initialData: data, isAdmin }));
}

describe("ToolsClient", () => {
  it("展示态按分栏分组渲染，空分栏不出现在展示态", () => {
    renderClient({ isAdmin: false });
    expect(screen.getByText("游戏引擎")).toBeTruthy();
    expect(screen.getByText("三维创作")).toBeTruthy();
    expect(screen.queryByText("空栏")).toBeNull();
    expect(screen.getByText("Godot Engine")).toBeTruthy();
    expect(screen.getByText("Blender")).toBeTruthy();
  });

  it("管理模式显示空分栏与新增分栏入口，非空分栏删除按钮禁用", () => {
    renderClient();
    fireEvent.click(screen.getByLabelText("管理工具"));
    // 空栏出现，且有"暂无条目"占位
    expect(screen.getByText("空栏")).toBeTruthy();
    expect(screen.getByText("暂无条目")).toBeTruthy();
    // 新增分栏入口
    expect(screen.getByText("新增分栏")).toBeTruthy();
    // 删除分栏按钮：空栏可用、非空栏禁用
    const delButtons = screen.getAllByLabelText("删除分栏");
    expect(delButtons).toHaveLength(3);
    expect((delButtons[0] as HTMLButtonElement).disabled).toBe(true); // 游戏引擎（有条目）
    expect((delButtons[2] as HTMLButtonElement).disabled).toBe(false); // 空栏
  });

  it("编辑器不含取色器（代表色环节已取消），提供上传图标与分栏选择", () => {
    renderClient();
    fireEvent.click(screen.getByLabelText("管理工具"));
    fireEvent.click(screen.getAllByText("编辑")[0]);
    // 无 color 输入
    expect(document.querySelector('input[type="color"]')).toBeNull();
    // 有上传图标入口与重新获取 favicon 入口
    expect(screen.getByText("上传图标")).toBeTruthy();
    expect(screen.getByLabelText("从网址重新获取网站图标")).toBeTruthy();
    // 分栏选择默认指向条目当前分栏
    const select = screen.getByLabelText("所属分栏") as HTMLSelectElement;
    expect(select.value).toBe("s1");
    // 名称输入框带出现有名称
    expect((screen.getByLabelText("名称") as HTMLInputElement).value).toBe("Godot Engine");
  });

  it("新增条目时不再预填 Google s2 热链，图标留空由服务端现抓", () => {
    renderClient();
    fireEvent.click(screen.getByLabelText("添加工具"));
    const urlInput = screen.getByLabelText("网址（https:// 开头）") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/docs" } });
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    expect(imgs.some((i) => i.src.includes("google.com/s2/favicons"))).toBe(false);
  });

  it("分栏改名原位输入并可确认（改名同步到栏内条目）", () => {
    renderClient();
    fireEvent.click(screen.getByLabelText("管理工具"));
    fireEvent.click(screen.getAllByLabelText("重命名分栏")[0]);
    const input = screen.getByLabelText("分栏名称") as HTMLInputElement;
    expect(input.value).toBe("游戏引擎");
    fireEvent.change(input, { target: { value: "引擎工具" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("引擎工具")).toBeTruthy();
  });

  it("顶部 + 打开独立新增横幅，按所选分栏归类（不再固定落在第一栏）", async () => {
    const { saveToolsData } = await import("@/app/tools/actions");
    renderClient();
    fireEvent.click(screen.getByLabelText("添加工具"));
    // 独立横幅有自己的标题，不再伪装成第一栏的追加行
    expect(screen.getByText("新增工具")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "新站点" } });
    fireEvent.change(screen.getByLabelText("网址（https:// 开头）"), {
      target: { value: "https://new.example.com" },
    });
    // 显式改分栏到第二栏
    fireEvent.change(screen.getByLabelText("所属分栏"), { target: { value: "s2" } });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => expect(saveToolsData).toHaveBeenCalled());
    const last = (saveToolsData as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![0] as ToolsData;
    expect(last.sites.at(-1)?.category).toBe("三维创作");
    expect(last.sites.at(-1)?.name).toBe("新站点");
  });

  it("管理模式给条目和分栏都挂上拖动把手", () => {
    renderClient();
    fireEvent.click(screen.getByLabelText("管理工具"));
    // 两个条目 → 两个条目把手
    expect(screen.getAllByLabelText("拖动排序（可拖到其它分栏）")).toHaveLength(2);
    // 三个分栏 → 三个分栏把手
    expect(screen.getAllByLabelText("拖动调整分栏顺序")).toHaveLength(3);
  });
});
