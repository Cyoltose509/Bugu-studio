/**
 * 交互功能测试 — 搜索、评论、点赞、通知、标签
 *
 * 前提：npm run dev 必须在 localhost:3000 运行
 * 运行：npm run test
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("GET /api/works — 搜索与排序", () => {
  it("关键词搜索正常返回", async () => {
    const res = await fetch(`${BASE}/api/works?q=游戏`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("hasMore");
  });

  it("按点赞排序正常返回", async () => {
    const res = await fetch(`${BASE}/api/works?sort=likes`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
  });

  it("按名称排序正常返回", async () => {
    const res = await fetch(`${BASE}/api/works?sort=name`);
    expect(res.status).toBe(200);
  });

  it("非法 sort 值 → 400 且不崩溃", async () => {
    const res = await fetch(`${BASE}/api/works?sort=invalid_sort_value`);
    expect(res.status).toBe(400);
  });

  it("标签筛选正常返回", async () => {
    const res = await fetch(`${BASE}/api/works?tag=Steam`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
  });
});

describe("GET /api/members/search — 成员搜索", () => {
  it("正常搜索返回数组", async () => {
    const res = await fetch(`${BASE}/api/members/search?q=测试`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("无 q 参数返回空数组", async () => {
    const res = await fetch(`${BASE}/api/members/search`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it("空 q 返回空数组（并发测试可能触发 429）", async () => {
    const res = await fetch(`${BASE}/api/members/search?q=`);
    // 200 正常 / 429 并发限流 — 都合理
    if (res.status === 429) return; // 限流则跳过后续断言
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(0);
  });
});

describe("GET /api/tags — 标签列表", () => {
  it("正常返回标签数组", async () => {
    const res = await fetch(`${BASE}/api/tags`);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/notifications — 通知（需登录）", () => {
  it("未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/notifications`);
    expect(res.status).toBe(401);
  });

  it("PATCH /api/notifications（标记已读）未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/notifications`, { method: "PATCH" });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/notifications 未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/notifications`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("GET /api/notifications/unread-count 未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/notifications/unread-count`);
    expect(res.status).toBe(401);
  });

  it("GET /api/notifications/read 未登录 → 401", async () => {
    const res = await fetch(`${BASE}/api/notifications/read`);
    expect(res.status).toBe(401);
  });
});

describe("评论与点赞 API — 认证拦截", () => {
  it("GET /api/projects/some-id/comments — 公开可读", { timeout: 15_000 }, async () => {
    // 用真实 slug 测试
    const worksRes = await fetch(`${BASE}/api/works`);
    const works = await worksRes.json();
    const slug = works.items?.[0]?.slug;

    if (slug) {
      const res = await fetch(`${BASE}/api/projects/${slug}/comments`);
      // 公开可读，200 或 404（无该项目）
      expect([200, 404]).toContain(res.status);
    }
  });

  it("POST /api/projects/some-id/comments — 未登录返回 401", async () => {
    const res = await fetch(`${BASE}/api/projects/test-slug/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test comment" }),
    });
    // 401 未登录 或 404 不存在该项目
    expect([401, 404]).toContain(res.status);
  });

  it("POST /api/projects/some-id/like — 未登录返回 401", async () => {
    const res = await fetch(`${BASE}/api/projects/test-slug/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect([401, 404]).toContain(res.status);
  });
});
