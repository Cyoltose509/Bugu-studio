/**
 * 实用工具列表 — 集成测试
 * 形态说明：单 it 顺序断言全流程（本机 vitest 多 it 拆分下"写后读"存在环境性
 * 不可见，见探针实验）；favicon 抓取模块 mock 掉（网络/R2 不进测试）。
 * 运行：DATABASE_URL=... npx vitest run 本文件
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: async () => ({ user: { id: "dbg" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tools/favicon", () => ({
  resolveFavicon: async (url: string) => `https://cdn.test/favicon/${new URL(url).hostname}.png`,
}));
import { saveToolsData } from "@/app/tools/actions";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_TOOLS_DATA,
  TOOLS_SETTING_KEY,
  normalizeToolSites,
  normalizeToolsData,
} from "@/lib/tools/tools";

describe("tools sites", () => {
  it("保存（分栏+条目+favicon 抓取）→ 落库读回 → 回退默认（全流程）", async () => {
    // 1) 管理员保存：分栏补建、iconUrl 空缺由 resolver 抓取
    const saved = await saveToolsData({
      sections: [],
      sites: [
        { id: "a", name: "站点A", url: "https://a.example.com", iconUrl: "", color: "#3388BB", letter: "A", category: "测试", description: "测试条目A" },
        { id: "b", name: "站点B", url: "https://b.example.com", iconUrl: "", color: "#E38043", letter: "B", category: "测试", description: "测试条目B" },
      ],
    });
    const savedSites = saved.data!.sites;
    expect(savedSites.map((s) => s.id)).toEqual(["a", "b"]);
    // iconUrl 被服务端抓取模块改写为转存地址
    expect(savedSites.map((s) => s.iconUrl)).toEqual([
      "https://cdn.test/favicon/a.example.com.png",
      "https://cdn.test/favicon/b.example.com.png",
    ]);
    // 未声明的分栏按条目 category 补建
    expect(saved.data!.sections.map((s) => s.name)).toContain("测试");

    // 2) 落库读回（v2 形态：{ sections, sites }）
    const row = await prisma.siteSetting.findUnique({ where: { key: TOOLS_SETTING_KEY } });
    const stored = JSON.parse(row!.value);
    expect(stored.sites.map((s: any) => s.id)).toEqual(["a", "b"]);
    expect(stored.sections.map((s: any) => s.name)).toContain("测试");

    // 3) 清空配置后回退默认数据（8 条目 + 3 分栏）
    await prisma.siteSetting.deleteMany({ where: { key: TOOLS_SETTING_KEY } });
    expect(await getFallback()).toEqual(DEFAULT_TOOLS_DATA.sites);
  }, 120_000);

  it("normalize：非法 url/空名被丢弃，iconUrl 缺省补热链，letter 回退首字母", () => {
    const out = normalizeToolSites([
      { name: "好条目", url: "https://ok.example.com" },
      { name: "坏URL", url: "javascript:alert(1)" },
      { name: "", url: "https://no-name.com" },
      "garbage",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].letter).toBe("好");
    expect(out[0].iconUrl).toContain("ok.example.com");
  });

  it("normalizeToolsData：v1 裸数组升级为 v2 分栏结构", () => {
    const up = normalizeToolsData([{ id: "x", name: "X", url: "https://x.com", iconUrl: "", color: "#333333", letter: "X", category: "分栏X", description: "" }]);
    expect(up.sites).toHaveLength(1);
    expect(up.sections.map((s) => s.name)).toEqual(["分栏X"]);
  });
});

async function getFallback() {
  // 独立读取路径：清空配置后 getToolSites 应回退默认
  const { getToolSites } = await import("@/lib/tools/tools");
  return getToolSites();
}
