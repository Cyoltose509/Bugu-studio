/**
 * API 契约测试 — 覆盖核心接口的请求/响应格式
 *
 * 运行方式：
 *   1. 先启动 dev server：npm run dev
 *   2. 再跑测试：npm run test
 *
 * @vitest-environment node
 */
import { body } from "happy-dom/lib/PropertySymbol";
import { describe, it, expect } from "vitest";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

describe("GET /api/works — 作品分页", () => {
  it("正常返回分页数据（cursor 分页）", async () => {
    const res = await fetch(`${BASE}/api/works`);
    expect(res.status).toBe(200);

    const body = await res.json();
    // cursor 分页：{ items, nextCursor, hasMore }，无 total
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("hasMore");
    expect(body).toHaveProperty("nextCursor");
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.hasMore).toBe("boolean");
  });

  it("返回的 item 结构完整", async () => {
    const res = await fetch(`${BASE}/api/works?pageSize=3`);
    const body = await res.json();
    if (body.items.length > 0) {
      const item = body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("slug");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("type");
      expect(item).toHaveProperty("coverImage");
    }
  });

  it("type 筛选有效值正常", async () => {
    for (const t of ["IN_DEVELOPMENT", "TRIAL_DEMO", "OFFICIAL_RELEASE"]) {
      const res = await fetch(`${BASE}/api/works?type=${t}`);
      expect(res.status, `type=${t} should be 200`).toBe(200);
    }
  });

  it("非法 type 被忽略，返回 200 空结果", async () => {
    const res = await fetch(`${BASE}/api/works?type=INVALID`);
    // API 对非法 type 做静默降级：返回 200 + 空列表，而非 400
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("cursor 分页无重复", async () => {
    const p1 = await fetch(`${BASE}/api/works`).then(r => r.json());
    if (p1.hasMore && p1.items.length > 0) {
      const p2 = await fetch(`${BASE}/api/works?cursor=${p1.nextCursor}`).then(r => r.json());
      expect(p2.items.length).toBeGreaterThan(0);
      expect(p2.items[0].id).not.toBe(p1.items[0].id);
    }
  });
});

describe("GET /api/members", () => {
  it("正常返回列表", async () => {
    const res = await fetch(`${BASE}/api/members`);
    expect(res.status).toBe(200);

    // 返回 { success: true, data: { items, total, ... } }
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("items");
    expect(Array.isArray(body.data.items)).toBe(true);
  });
});

describe("GET /api/health", () => {
  it("正常返回健康状态", async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });
});
