/**
 * 实用工具列表 — 集成测试
 * 形态说明：本文件刻意保持与已验证稳定的探针完全一致的结构
 * （单 it、无第二连接实例、无 afterAll 清理钩子，清理在 it 尾部内联执行）。
 * 运行：DATABASE_URL=... npx vitest run 本文件
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: async () => ({ user: { id: "dbg" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveToolSites } from "@/app/tools/actions";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TOOL_SITES, TOOLS_SETTING_KEY, normalizeToolSites } from "@/lib/tools/tools";

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

    // 1) 管理员保存：返回值含自动 favicon（缺省时按域名取）
    const saved = await saveToolSites([...DEFAULT_TOOL_SITES, TEST_ENTRY]);
    const savedIds = saved.sites!.map((s) => s.id);
    expect(savedIds).toEqual(["godot", "blender", "zcode-test-tool"]);
    expect(saved.sites!.find((s) => s.id === "zcode-test-tool")!.iconUrl).toContain("example.org");

    // 2) 落库读回
    const row = await prisma.siteSetting.findUnique({ where: { key: TOOLS_SETTING_KEY } });
    expect(row && JSON.parse(row.value).map((s: any) => s.id)).toEqual(["godot", "blender", "zcode-test-tool"]);

    // 3) 清空配置后回退默认条目
    await prisma.siteSetting.deleteMany({ where: { key: TOOLS_SETTING_KEY } });
    const fallback = await import("@/lib/tools/tools").then((m) => m.getToolSites());
    expect(fallback).toEqual(DEFAULT_TOOL_SITES);

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
  }, 120_000);
});
