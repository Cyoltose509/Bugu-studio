/**
 * 冒烟测试 — 确保所有公开页面正常返回 2xx/3xx
 *
 * 前提：需先启动 npm run dev
 * 运行：npm run test:e2e
 */

import { test, expect } from "@playwright/test";

// 数据量大的页面需要更长的超时
const HEAVY_PAGES = new Set(["/works"]);

const PUBLIC_PAGES = [
  { path: "/", name: "首页" },
  { path: "/works", name: "作品库" },
  { path: "/members", name: "成员" },
  { path: "/activities", name: "活动" },
  { path: "/history", name: "历史" },
];

for (const page of PUBLIC_PAGES) {
  const isHeavy = HEAVY_PAGES.has(page.path);
  test(`公开页面：${page.name}`, { tag: "@smoke" }, async ({ page: p }) => {
    test.setTimeout(isHeavy ? 60_000 : 30_000);

    // 只验证页面能正常打开（非 4xx/5xx），不要求具体元素
    const response = await p.goto(page.path, {
      waitUntil: "domcontentloaded", // 不等所有资源加载完
      timeout: isHeavy ? 50_000 : 20_000,
    });
    expect(response?.status()).toBeLessThan(400);

    // 确认 body 有内容（非白屏）
    await expect(p.locator("body")).not.toBeEmpty({ timeout: 10_000 });
  });
}

test("作品详情页", { tag: "@smoke" }, async ({ page }) => {
  test.setTimeout(60_000);

  // 直接用 API 拿第一个已发布作品的 slug，避免走列表页
  const worksRes = await page.request.get("/api/works", {
    params: { status: "PUBLISHED", pageSize: "1" },
  });
  const { items } = await worksRes.json();
  if (!items?.length) {
    test.skip(true, "没有已发布的作品，跳过详情页测试");
    return;
  }

  await page.goto(`/works/${items[0].slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
});

test("成员详情页", { tag: "@smoke" }, async ({ page }) => {
  test.setTimeout(30_000);

  // 直接用 API 拿第一个成员 ID
  const membersRes = await page.request.get("/api/members");
  const { data } = await membersRes.json();
  if (!data?.items?.length) {
    test.skip(true, "没有成员数据，跳过详情页测试");
    return;
  }

  await page.goto(`/members/${data.items[0].id}`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
});
