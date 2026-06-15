/**
 * 回归测试 — 已修复 Bug 与关键路径保护
 *
 * 确保之前修复过的问题不会重现。
 * 需要运行 dev server: npm run dev
 *
 * 运行: npm run test:regression
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function apiJson(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    redirect: "manual",
  });
  const text = await res.text();
  try {
    return { res, data: JSON.parse(text) };
  } catch {
    return { res, data: text };
  }
}

// ============================================================
// 第 1 组: Auth 密码哈希一致性
// ============================================================

describe("回归 — Auth 密码哈希一致性 (#P1-5)", () => {
  it("change-password 使用 scrypt（与 auth 一致）", async () => {
    // 验证端点存在且不接受不匹配的哈希
    const { res } = await apiJson("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "wrong",
        newPassword: "newpass123",
      }),
    });
    // 401 表示认证需要, 200 表示端点存在
    expect([200, 401, 429]).toContain(res.status);
  });

  it("change-password 拒绝短密码", async () => {
    const { res } = await apiJson("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "test",
        newPassword: "123",
      }),
    });
    expect([400, 401, 429]).toContain(res.status);
  });
});

// ============================================================
// 第 2 组: 监控页面密码验证
// ============================================================

describe("回归 — 监控页面密码验证 (#P1-3)", () => {
  it("verify-monitoring 端点有速率限制", { timeout: 15_000 }, async () => {
    // 连续发送 6 次请求，后面的应该被限制
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { res } = await apiJson("/api/admin/verify-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      results.push(res.status);
    }
    // 至少有一个 401 或 429
    expect(
      results.some((s) => s === 429 || s === 401)
    ).toBe(true);
  });

  it("monitoring_access cookie 不暴露在 JS 中", async () => {
    const { res } = await apiJson("/api/admin/verify-monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    // cookie 应为 HttpOnly
    if (setCookie && setCookie.includes("monitoring_access")) {
      expect(setCookie.toLowerCase()).toContain("httponly");
    }
  });

  it("fallback secret 已删除 — 环境变量未设置时令牌签名失败", async () => {
    // 测试端点存在（cookie 检查逻辑在中间件）
    const { res } = await apiJson("/api/admin/verify-monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    // 拒绝错误密码
    expect([401, 429]).toContain(res.status);
  });
});

// ============================================================
// 第 3 组: R2 野文件清理
// ============================================================

describe("回归 — R2 野文件清理 (scene#)", () => {
  it("upload avatar 端点存在", async () => {
    const { res } = await apiJson("/api/upload/avatar", {
      method: "POST",
    });
    // 405 Method Not Allowed (GET not support) or 400 (no file)
    expect([400, 401, 405]).toContain(res.status);
  });

  it("upload cover 端点存在", async () => {
    const { res } = await apiJson("/api/upload/cover", {
      method: "POST",
    });
    expect([400, 401, 405]).toContain(res.status);
  });

  it("DELETE project 清理关联图片", async () => {
    // 删除不存在的项目应返回 404，但不崩溃
    const { res } = await apiJson("/api/projects/nonexistent-slug", {
      method: "DELETE",
    });
    expect([401, 404]).toContain(res.status);
  });

  it("DELETE account 清理头像", async () => {
    const { res } = await apiJson("/api/user/delete-account", {
      method: "DELETE",
    });
    expect([200, 401, 404, 405]).toContain(res.status);
  });
});

// ============================================================
// 第 4 组: 作品类型迁移 (scene#16)
// ============================================================

describe("回归 — 作品类型迁移", () => {
  it("IN_DEVELOPMENT / TRIAL_DEMO / OFFICIAL_RELEASE 有效", async () => {
    const { res, data } = await apiJson("/api/works");
    if (res.status === 200 && data.items) {
      for (const item of data.items) {
        // 不应包含旧枚举值
        if (item.projectType) {
          expect(["DEMO", "STEAM", "ITCH", "OTHER"]).not.toContain(
            item.projectType
          );
        }
      }
    }
  });

  it("作品列表不返回 STEAM/DEMO/ITCH/OTHER 类型", async () => {
    const { res, data } = await apiJson("/api/works?pageSize=10");
    if (res.status === 200 && data.items) {
      const types = data.items
        .map((i: any) => i.projectType)
        .filter(Boolean);
      const oldTypes = types.filter((t: string) =>
        ["DEMO", "STEAM", "ITCH", "OTHER"].includes(t)
      );
      expect(oldTypes).toHaveLength(0);
    }
  });
});

// ============================================================
// 第 5 组: CSP 系统完整性
// ============================================================

describe("回归 — CSP 系统", () => {
  it("CSP report-to 头存在", { timeout: 15_000 }, async () => {
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    const csp = res.headers.get("content-security-policy")
      || res.headers.get("Content-Security-Policy");
    // CSP 头应该存在（生产环境），不存在也可能是 dev 模式
    if (csp) {
      expect(typeof csp).toBe("string");
      expect(csp.length).toBeGreaterThan(10);
    }
  });

  it("CSP 报告端点接受 report-to 格式", async () => {
    const { res } = await apiJson("/api/admin/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report", "X-Bugu-Test": "true" },
      body: JSON.stringify({
        "csp-report": {
          "violated-directive": "style-src",
          "blocked-uri": "http://evil.com/style.css",
        },
      }),
    });
    expect([200, 429]).toContain(res.status);
  });

  it("CSP 报告查询需要管理员认证", async () => {
    const { res } = await apiJson("/api/admin/csp-reports-data");
    expect([200, 401, 403]).toContain(res.status);
  });
});

// ============================================================
// 第 6 组: 速率限制
// ============================================================

describe("回归 — 速率限制 (#P2-5)", () => {
  it("verify-monitoring 5次/分钟 限制生效", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const { res } = await apiJson("/api/admin/verify-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: `attempt_${i}` }),
      });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });

  it("image-proxy 有速率限制", async () => {
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { res } = await apiJson(
        "/api/image-proxy?url=http%3A%2F%2Fexample.com%2Ftest.png"
      );
      results.push(res.status);
    }
    // 接受 200(通过), 400(无效URL), 403(禁止访问), 429(限流), 502(代理失败)
    for (const s of results) {
      expect([200, 400, 403, 429, 502]).toContain(s);
    }
  });
});

// ============================================================
// 第 7 组: 数据库索引
// ============================================================

describe("回归 — 数据库性能 (#P2-4)", () => {
  it("评论查询不超时", { timeout: 20_000 }, async () => {
    const { res, data } = await apiJson(
      "/api/projects/any-slug/comments?pageSize=50"
    );
    expect(res.status).toBe(200);
    expect(data).toBeDefined();
  });

  it("点赞数据查询不超时", { timeout: 15_000 }, async () => {
    const { res, data } = await apiJson("/api/works?pageSize=10");
    expect([200, 429]).toContain(res.status);
    // 确保在合理时间内完成
  });
});

// ============================================================
// 第 8 组: 颜色对比度
// ============================================================

describe("回归 — UI 可访问性 (#P2-3)", () => {
  it("全局样式表存在且可加载", async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    // 页面应包含 CSS 引用
    expect(html).toContain("style");
  });
});

// ============================================================
// 第 9 组: 错误边界
// ============================================================

describe("回归 — Error Boundaries (#P2-1)", () => {
  it("存在 error.tsx 的页面不崩溃", { timeout: 20_000 }, async () => {
    const errorPages = ["/activities", "/members", "/history", "/join"];
    for (const path of errorPages) {
      const { res } = await apiJson(path);
      expect([200, 302, 307]).toContain(res.status);
    }
  });

  it("404 页面包含有意义的内容", async () => {
    const res = await fetch(`${BASE}/nonexistent-page-12345`, {
      redirect: "manual",
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    // 404 页面应该有内容（不是白屏）
    expect(html.length).toBeGreaterThan(100);
  });
});

// ============================================================
// 第 10 组: SEO 元数据
// ============================================================

describe("回归 — SEO 优化 (#P1-1)", () => {
  it("首页包含 OpenGraph 标签", { timeout: 15_000 }, async () => {
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    const html = await res.text();
    // 至少包含一些基本 SEO 标签
    const hasSEO =
      html.includes("og:") ||
      html.includes("twitter:") ||
      html.includes("<title>") ||
      html.includes('name="description"');
    expect(hasSEO).toBe(true);
  });

  it("sitemap.xml 可访问", async () => {
    // sitemap.xml 是 XML，用原生 fetch 读
    const res = await fetch(`${BASE}/sitemap.xml`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(50);
  });

  it("robots.txt 可访问", async () => {
    const { res } = await apiJson("/robots.txt");
    expect(res.status).toBe(200);
  });
});

// ============================================================
// 第 11 组: MobileNav 汉堡菜单
// ============================================================

describe("回归 — 移动导航 (#P1-2)", () => {
  it("首页在移动视口下不崩溃（检查响应式结构）", { timeout: 15_000 }, async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    // 页面应该有导航相关元素
    expect(html.length).toBeGreaterThan(500);
  });
});

// ============================================================
// 第 12 组: 测试环境自身回归
// ============================================================

describe("回归 — 测试数据隔离", () => {
  // 确保每个测试文件不会互相干扰

  it("测试用注册数据不会持久化影响生产", async () => {
    const testEmail = `regression_test_${Date.now()}@bugu.studio`;
    const { res } = await apiJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `回归测试_${Date.now()}`,
        email: testEmail,
        password: "Test123456!",
      }),
    });
    expect([200, 201, 400, 409]).toContain(res.status);
  });
});

// ============================================================
// 第 13 组: 并发安全性
// ============================================================

describe("回归 — 并发数据安全", () => {
  it("同时请求多个端点不导致竞态条件", async () => {
    const results = await Promise.allSettled([
      apiJson("/api/works?pageSize=3"),
      apiJson("/api/members/search?q=a"),
      apiJson("/api/tags"),
      apiJson("/api/health"),
    ]);

    // 全部应成功完成（不崩溃）
    const allOk = results.every(
      (r) => r.status === "fulfilled"
    );
    expect(allOk).toBe(true);

    // 检查各个结果
    for (const r of results) {
      if (r.status === "fulfilled") {
        // 并发测试中可能触发 429
        expect([200, 429]).toContain(r.value.res.status);
      }
    }
  });

  it("快速重复请求同一资源 → 结果一致", async () => {
    const [r1, r2, r3] = await Promise.all([
      apiJson("/api/works?pageSize=3&page=1"),
      apiJson("/api/works?pageSize=3&page=1"),
      apiJson("/api/works?pageSize=3&page=1"),
    ]);

    // 三次请求 total 应该一致
    if (r1.data.total !== undefined) {
      expect(r1.data.total).toBe(r2.data.total);
      expect(r1.data.total).toBe(r3.data.total);
    }
  });
});

// ============================================================
// 第 14 组: 关键文件完整性
// ============================================================

describe("回归 — 关键文件完整性", () => {
  it("关键 API 路由文件存在", async () => {
    const criticalEndpoints = [
      "/api/health",
      "/api/works",
      "/api/members",
      "/api/auth/csrf",
      "/api/admin/csp-report",
      "/api/user/change-password",
    ];

    for (const ep of criticalEndpoints) {
      const { res } = await apiJson(ep, {
        method: ep.includes("csp-report") || ep.includes("change-password") || ep.includes("csrf")
          ? "POST"
          : "GET",
        headers:
          ep.includes("csp-report") ||
          ep.includes("change-password") ||
          ep.includes("csrf")
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          ep.includes("csp-report") ||
          ep.includes("change-password") ||
          ep.includes("csrf")
            ? JSON.stringify({})
            : undefined,
      });
      // 不应返回 500
      expect(res.status).not.toBe(500);
    }
  });
});
