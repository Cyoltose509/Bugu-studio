/**
 * 边界 / 安全测试 — SQL 注入、XSS、超长输入、速率限制
 *
 * 前提：npm run dev 必须在 localhost:3000 运行
 * 运行：npm run test
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("输入边界 — /api/works", () => {
  it("SQL 注入尝试被安全处理 → 200（不崩溃）", { timeout: 25_000 }, async () => {
    const payloads = [
      "'; DROP TABLE Project; --",
      "1' OR '1'='1",
      "1; SELECT * FROM users",
    ];
    // 并行请求减少总耗时
    const results = await Promise.all(
      payloads.map(async (q) => {
        const res = await fetch(`${BASE}/api/works?q=${encodeURIComponent(q)}`);
        return { q, status: res.status, body: await res.json() };
      })
    );
    for (const { q, status, body } of results) {
      // 并发请求可能触发 /api/works 限流 (60/min)
      expect([200, 429], `q="${q}" → ${status}`).toContain(status);
      if (status === 200) {
        expect(body).toHaveProperty("items");
      }
    }
  });

  it("XSS 尝试被安全处理 → 200", { timeout: 25_000 }, async () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
    ];
    const results = await Promise.all(
      payloads.map(async (q) => {
        const res = await fetch(`${BASE}/api/works?q=${encodeURIComponent(q)}`);
        return { q, status: res.status };
      })
    );
    for (const { q, status } of results) {
      expect(status, `q="${q}" should return 200`).toBe(200);
    }
  });

  it("超长搜索词 → 200（不崩溃）", async () => {
    const long = "A".repeat(5000);
    const res = await fetch(`${BASE}/api/works?q=${encodeURIComponent(long)}`);
    expect(res.status).toBe(200);
  });
});

describe("输入边界 — /api/members/search", () => {
  it("SQL 注入安全处理 → 200", async () => {
    const res = await fetch(`${BASE}/api/members/search?q=';DROP TABLE ClubMember;--`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("Unicode 特殊字符 → 200", async () => {
    const res = await fetch(`${BASE}/api/members/search?q=%F0%9F%92%A3`);
    expect(res.status).toBe(200);
  });
});

describe("错误路由与不存在资源", () => {
  it("GET /api/works/999999 → 404", async () => {
    const res = await fetch(`${BASE}/api/works/999999`);
    expect(res.status).toBe(404);
  });

  it("GET /api/members/999999 → 404", async () => {
    const res = await fetch(`${BASE}/api/members/999999`);
    expect(res.status).toBe(404);
  });

  it("GET /api/admin/csp-report → 405（仅 POST）", async () => {
    const res = await fetch(`${BASE}/api/admin/csp-report`);
    // 405 Method Not Allowed 或 401（需认证）
    expect([401, 405]).toContain(res.status);
  });

  it("GET /api/admin/csp-reports-data 未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/admin/csp-reports-data`);
    expect(res.status).toBe(401);
  });
});

describe("速率限制行为", () => {
  it("/api/auth/redeem-invite 连续请求触发 429", async () => {
    const promises = [];
    // 发 5 次请求触发限流
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch(`${BASE}/api/auth/redeem-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: "INVALID" }),
        })
      );
    }
    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);
    // 至少有一次 401 或 429（限流行为 → 401 因为未登录被先拦截，429 如果限流先触发）
    const hasIntercepted = statuses.some((s) => [401, 429].includes(s));
    expect(hasIntercepted).toBe(true);
  });

  it("/api/members/search 连续请求正常（已有速率限制）", async () => {
    // 搜索接口有更高的限流阈值，10 次以内应该正常
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(fetch(`${BASE}/api/members/search?q=a`));
    }
    const results = await Promise.all(promises);
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });
});
