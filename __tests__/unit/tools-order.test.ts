/**
 * 实用工具站 —— 拖动排序纯逻辑测试。
 *
 * 存储形态是「分栏数组 + 扁平条目数组」，栏内顺序由条目数组的相对顺序决定。
 * 这些用例锁住两件事：跨栏移动后 category 与数组位置同时生效；分栏重排不动条目。
 */
import { describe, expect, it } from "vitest";
import { moveToolSection, moveToolSite, type ToolsData } from "@/lib/tools/shared";

function site(id: string, category: string) {
  return { id, name: id, url: `https://${id}.com`, iconUrl: "", color: "#25547A", letter: "X", category, description: "" };
}

const DATA: ToolsData = {
  sections: [
    { id: "s1", name: "甲栏" },
    { id: "s2", name: "乙栏" },
  ],
  sites: [site("a", "甲栏"), site("b", "甲栏"), site("c", "乙栏")],
};

describe("moveToolSite", () => {
  it("同栏内前移：插到目标条目之前", () => {
    const next = moveToolSite(DATA, "b", { sectionName: "甲栏", beforeId: "a" });
    expect(next.sites.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("同栏内追加到末尾（beforeId=null）", () => {
    const next = moveToolSite(DATA, "a", { sectionName: "甲栏", beforeId: null });
    expect(next.sites.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("跨栏移动：category 跟着改，条目落到目标栏的指定位置", () => {
    const next = moveToolSite(DATA, "a", { sectionName: "乙栏", beforeId: "c" });
    const moved = next.sites.find((s) => s.id === "a")!;
    expect(moved.category).toBe("乙栏");
    // 按分栏顺序铺平：甲栏只剩 b，乙栏是 a、c
    expect(next.sites.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("拖到自己身上是空操作，不产生新顺序", () => {
    const next = moveToolSite(DATA, "a", { sectionName: "甲栏", beforeId: "a" });
    expect(next.sites.map((s) => s.id)).toEqual(DATA.sites.map((s) => s.id));
  });

  it("目标分栏不存在时原样返回", () => {
    const next = moveToolSite(DATA, "a", { sectionName: "不存在的栏", beforeId: null });
    expect(next.sites.map((s) => s.id)).toEqual(DATA.sites.map((s) => s.id));
  });

  it("条目总数守恒（不会在搬动中丢失或复制）", () => {
    const next = moveToolSite(DATA, "c", { sectionName: "甲栏", beforeId: "a" });
    expect(next.sites).toHaveLength(DATA.sites.length);
    expect(new Set(next.sites.map((s) => s.id)).size).toBe(DATA.sites.length);
  });
});

describe("moveToolSection", () => {
  it("把后面的分栏提到前面", () => {
    const next = moveToolSection(DATA, "s2", "s1");
    expect(next.sections.map((s) => s.id)).toEqual(["s2", "s1"]);
    // 条目归属不受影响
    expect(next.sites.map((s) => s.category)).toEqual(["甲栏", "甲栏", "乙栏"]);
  });

  it("beforeId=null 表示移到末尾", () => {
    const next = moveToolSection(DATA, "s1", null);
    expect(next.sections.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("拖到自己身上是空操作", () => {
    const next = moveToolSection(DATA, "s1", "s1");
    expect(next.sections.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});
