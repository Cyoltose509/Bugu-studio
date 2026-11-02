/**
 * 实用工具列表 — 集成测试
 * 形态说明：本文件刻意保持与已验证稳定的探针完全一致的结构
 * （单 it、无第二连接实例、无 afterAll 清理钩子，清理在 it 尾部内联执行）。
 * 运行：DATABASE_URL=... npx vitest run 本文件
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: async () => ({ user: { id: "dbg" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveToolsData } from "@/app/tools/actions";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_TOOL_SITES,
  DEFAULT_TOOLS_DATA,
  TOOLS_SETTING_KEY,
  normalizeToolsData,
  normalizeToolSites,
} from "@/lib/tools/tools";

describe("tools sites", () => {
  it("保存→落库→读回→回退默认→normalize（全流程）", async () => {
    const TEST_ENTRY = {
      id: "zcode-test-tool",
      name: "ZCode验证工具",
      url: "https://example.org",
      iconUrl: "",
      color: "#3388BB",
      letter: "Z",
      category: "测试",
      description: "集成测试条目",
    };

    // 1) 管理员保存（分栏 + 条目）：返回值含自动 favicon（缺省时按域名取），未声明的分栏被补建
    const saved = await saveToolsData({
      sections: DEFAULT_TOOLS_DATA.sections,
      sites: [...DEFAULT_TOOL_SITES, TEST_ENTRY],
    });
    const savedIds = saved.data!.sites.map((s) => s.id);
    expect(savedIds).toEqual(["godot", "blender", "tripo-3d", "zcode-test-tool"]);
    expect(saved.data!.sites.find((s) => s.id === "zcode-test-tool")!.iconUrl).toContain("example.org");
    expect(saved.data!.sections.map((s) => s.name)).toEqual(["游戏引擎", "三维创作", "测试"]);

    // 2) 落库读回（v2 形态：{ sections, sites }）
    const row = await prisma.siteSetting.findUnique({ where: { key: TOOLS_SETTING_KEY } });
    const stored = JSON.parse(row!.value);
    expect(stored.sites.map((s: any) => s.id)).toEqual(["godot", "blender", "tripo-3d", "zcode-test-tool"]);
    expect(stored.sections.map((s: any) => s.name)).toEqual(["游戏引擎", "三维创作", "测试"]);

    // 3) 清空配置后回退默认数据
    await prisma.siteSetting.deleteMany({ where: { key: TOOLS_SETTING_KEY } });
    const fallback = await import("@/lib/tools/tools").then((m) => m.getToolsData());
    expect(fallback).toEqual(DEFAULT_TOOLS_DATA);

    // 4) normalize：非法 url/空名被丢弃，letter 回退首字母，iconUrl 按域名补全
    const cleaned = normalizeToolSites([
      { name: "好条目", url: "https://ok.example.com" },
      { name: "坏URL", url: "javascript:alert(1)" },
      { name: "", url: "https://no-name.com" },
      "garbage",
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].letter).toBe("好");
    expect(cleaned[0].iconUrl).toContain("ok.example.com");

    // 5) 旧版裸数组存储自动升级为 v2（分栏按 category 首次出现顺序还原）
    const upgraded = normalizeToolsData([
      { id: "a", name: "甲", url: "https://a.example.com", category: "引擎" },
      { id: "b", name: "乙", url: "https://b.example.com", category: "设计" },
      { id: "c", name: "丙", url: "https://c.example.com", category: "引擎" },
    ]);
    expect(upgraded.sections.map((s) => s.name)).toEqual(["引擎", "设计"]);
    expect(upgraded.sites.map((s) => s.id)).toEqual(["a", "b", "c"]);
  }, 120_000);
});
