import { describe, it, expect } from "vitest";
import {
  LINK_GROUPS,
  QUICK_SELECT_PRESETS,
  ALL_LINK_PRESETS,
  isNetdiskLink,
  extractNetdiskPassword,
  buildNetdiskUrl,
} from "@/lib/constants/links";

describe("link presets & groups", () => {
  it("contains all 5 required groups", () => {
    const groupKeys = LINK_GROUPS.map((g) => g.k);
    expect(groupKeys).toContain("form.link.group.games");
    expect(groupKeys).toContain("form.link.group.pan");
    expect(groupKeys).toContain("form.link.group.code");
    expect(groupKeys).toContain("form.link.group.video");
    expect(groupKeys).toContain("form.link.group.website");
  });

  it("contains 蓝奏云 in 网盘下载 group", () => {
    const panGroup = LINK_GROUPS.find((g) => g.k === "form.link.group.pan");
    expect(panGroup).toBeDefined();
    const items = panGroup!.items.map((i) => i.v);
    expect(items).toContain("百度网盘");
    expect(items).toContain("蓝奏云");
    expect(items).toContain("Google Drive");
  });

  it("has 游戏官方网站 in 个人网站 group instead of 官网", () => {
    const websiteGroup = LINK_GROUPS.find((g) => g.k === "form.link.group.website");
    expect(websiteGroup).toBeDefined();
    const items = websiteGroup!.items.map((i) => i.v);
    expect(items).toContain("游戏官方网站");
    expect(items).not.toContain("官网");
  });

  it("quick select includes core presets", () => {
    const quickValues = QUICK_SELECT_PRESETS.map((p) => p.v);
    expect(quickValues).toContain("Steam");
    expect(quickValues).toContain("itch.io");
    expect(quickValues).toContain("百度网盘");
    expect(quickValues).toContain("蓝奏云");
    expect(quickValues).toContain("GitHub");
    expect(quickValues).toContain("B站");
    expect(quickValues).toContain("游戏官方网站");
  });
});

describe("netdisk detection", () => {
  it("identifies netdisk by label or url", () => {
    expect(isNetdiskLink("百度网盘")).toBe(true);
    expect(isNetdiskLink("蓝奏云")).toBe(true);
    expect(isNetdiskLink("Google Drive")).toBe(true);
    expect(isNetdiskLink("夸克网盘")).toBe(true);
    expect(isNetdiskLink("自定义", "https://pan.baidu.com/s/12345")).toBe(true);
    expect(isNetdiskLink("自定义", "https://www.lanzoui.com/b12345")).toBe(true);
    expect(isNetdiskLink("Steam")).toBe(false);
    expect(isNetdiskLink("GitHub", "https://github.com/foo/bar")).toBe(false);
  });
});

describe("extractNetdiskPassword and buildNetdiskUrl", () => {
  it("extracts password from ?pwd= parameter", () => {
    const res = extractNetdiskPassword("https://pan.baidu.com/s/1mRT2HR4KpGqYZQ1nmes1-w?pwd=hrnx");
    expect(res.password).toBe("hrnx");
    expect(res.cleanUrl).toBe("https://pan.baidu.com/s/1mRT2HR4KpGqYZQ1nmes1-w");
  });

  it("extracts password from #pwd= hash", () => {
    const res = extractNetdiskPassword("https://lanzou.com/b12345#pwd=9a8b");
    expect(res.password).toBe("9a8b");
    expect(res.cleanUrl).toBe("https://lanzou.com/b12345");
  });

  it("extracts password from text like 提取码: xxxx", () => {
    const res = extractNetdiskPassword("https://pan.baidu.com/s/12345 提取码: 6666");
    expect(res.password).toBe("6666");
    expect(res.cleanUrl).toBe("https://pan.baidu.com/s/12345");
  });

  it("builds netdisk URL with query param", () => {
    expect(buildNetdiskUrl("https://pan.baidu.com/s/12345", "abcd")).toBe("https://pan.baidu.com/s/12345?pwd=abcd");
    expect(buildNetdiskUrl("https://pan.baidu.com/s/12345?foo=bar", "abcd")).toBe("https://pan.baidu.com/s/12345?foo=bar&pwd=abcd");
    // Does not duplicate existing pwd
    expect(buildNetdiskUrl("https://pan.baidu.com/s/12345?pwd=abcd", "abcd")).toBe("https://pan.baidu.com/s/12345?pwd=abcd");
  });
});
