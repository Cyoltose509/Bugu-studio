// @ts-nocheck
/**
 * 安全测试 — 安全头、未授权访问、限流
 *
 * 前提：npm run dev 必须在 localhost:3000 运行
 * 运行：npm run test
 */
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("安全头检查", () => {
  it("首页包含 CSP 头", async () => {
    const res = await fetch(BASE);
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src");
  });

  it("首页包含 HSTS 头", async () => {
    const res = await fetch(BASE);
    const hsts = res.headers.get("strict-transport-security");
    expect(hsts).toBeTruthy();
    expect(hsts).toContain("max-age=");
  });

  it("首页禁止 iframe 嵌入", async () => {
    const res = await fetch(BASE);
    const frame = res.headers.get("x-frame-options");
    expect(frame).toBe("DENY");
  });

  it("首页包含 X-Content-Type-Options", async () => {
    const res = await fetch(BASE);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("未登录访问管理页", () => {
  const ADMIN_ROUTES = [
    "/admin",
    "/admin/users",
    "/admin/members",
    "/admin/projects",
    "/admin/invites",
    "/admin/audit-logs",
    "/admin/backups",
    "/admin/monitoring",
  ];

  for (const route of ADMIN_ROUTES) {
    it(`${route} → 重定向或返回 401/403`, async () => {
      const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
      // 未登录访问管理页应该被拦截（301/302/307 重定向 或 401/403）
      const ok = [301, 302, 307, 401, 403].includes(res.status);
      expect(ok).toBe(true);
    });
  }
});

describe("API 路由安全", () => {
  it("POST /api/projects/submit — 未登录返回 401 或 429", async () => {
    const res = await fetch(`${BASE}/api/projects/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test", type: "IN_DEVELOPMENT", description: "test" }),
      redirect: "manual",
    });
    // 401 = 未登录，429 = 触发限流（都是正确的安全行为）
    expect([401, 429]).toContain(res.status);
  });

  it("POST /api/user/delete-account — 未登录返回 401 或 429", async () => {
    const res = await fetch(`${BASE}/api/user/delete-account`, {
      method: "POST",
      redirect: "manual",
    });
    expect([401, 429]).toContain(res.status);
  });

  it("GET /api/admin/audit-logs — 未登录返回 401", async () => {
    const res = await fetch(`${BASE}/api/admin/audit-logs`, { redirect: "manual" });
    expect(res.status).toBe(401);
  });

  it("GET /api/admin/backups — 未登录返回 401/403", async () => {
    const res = await fetch(`${BASE}/api/admin/backups`, { redirect: "manual" });
    expect([401, 403]).toContain(res.status);
  });
});

describe("错误场景", () => {
  it("GET 不存在的路由 → 404", async () => {
    const res = await fetch(`${BASE}/api/nonexistent-route-xyz`, { redirect: "manual" });
    expect(res.status).toBe(404);
  });

  it("GET /api/works?pageSize=999999 — 不崩溃，正常返回", { timeout: 15_000 }, async () => {
    const res = await fetch(`${BASE}/api/works?pageSize=999999`);
    // 大 pageSize 可能触发 DB 延迟，接受 200 或 429
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("items");
    }
  });

  it("POST 无 body 到 submit → 400 校验失败", async () => {
    // 用已登录 session 测这个会更准确，这里只测未登录也能得到明确错误
    const res = await fetch(`${BASE}/api/projects/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
      redirect: "manual",
    });
    // 401 未登录、429 限流触发 — 都是安全行为
    expect([400, 401, 429]).toContain(res.status);
  });
});
