/**
 * 权限守卫 E2E 测试 — 未登录用户不能访问管理后台
 *
 * 前提：npm run dev
 * 运行：npm run test:e2e
 */
import { test, expect } from "@playwright/test";

test.describe("未登录权限守卫", () => {
  for (const [route, name] of [
    ["/admin", "管理后台"],
    ["/admin/users", "用户管理"],
    ["/admin/projects", "作品审核"],
    ["/admin/invites", "邀请码管理"],
    ["/admin/audit-logs", "审计日志"],
    ["/admin/backups", "备份管理"],
  ] as const) {
    test(`${name} → 重定向到登录页`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15_000 });

      // 必须被重定向 —— pathname 不再是原始 admin 路由
      // （注意：不能用 RegExp 匹配整个 URL，因为 callbackUrl 参数里会包含 /admin）
      await expect.poll(() => new URL(page.url()).pathname).not.toBe(route);
    });
  }
});

test.describe("公开页面无障碍", () => {
  test("首页标题正确", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(page).toHaveTitle("布谷工作室");
  });

  test("作品库标题正确", async ({ page }) => {
    await page.goto("/works", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page).toHaveTitle(/作品库/);
  });
});

test("API 直接访问 /api/admin/audit-logs 返回 401", async ({ request }) => {
  const res = await request.get("/api/admin/audit-logs");
  expect(res.status()).toBe(401);
});
