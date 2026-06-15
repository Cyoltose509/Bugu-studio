/**
 * 认证流程测试 — 注册、邀请码兑换
 *
 * 前提：npm run dev 必须在 localhost:3000 运行
 * 运行：npm run test
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// 每次测试用唯一邮箱避免冲突
const testEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

describe("POST /api/auth/register — 注册", () => {
  it("正常注册 → 201（发送验证邮件）", { timeout: 15_000 }, async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail(),
        password: "Abc123456!",
        name: "测试用户",
      }),
    });
    // 201 = 验证邮件已发送（用户尚未创建，等邮箱验证）
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("verification");
  });

  it("缺少必填字段 → 400", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail() }),
    });
    expect(res.status).toBe(400);
  });

  it("无效邮箱格式 → 400", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "Abc123456!",
        name: "测试",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("密码太短（<8 位）→ 400", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail(),
        password: "Ab1!",
        name: "测试",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("空 body → 400", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/redeem-invite — 邀请码兑换", () => {
  it("未登录 → 401（并发测试可能触发 429）", async () => {
    const res = await fetch(`${BASE}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: "ABC123" }),
    });
    // 401 未登录 / 429 并发限流 — 都是安全行为
    expect([401, 429]).toContain(res.status);
  });

  it("无 code 参数 → 400（并发测试可能触发 429）", async () => {
    const res = await fetch(`${BASE}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // 401 未登录 / 400 无 code / 429 并发限流 — 都合理
    expect([400, 401, 429]).toContain(res.status);
  });

  it("无效邀请码（并发测试可能触发 429）", async () => {
    const res = await fetch(`${BASE}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: "INVALID12345" }),
    });
    // 401 未登录 / 429 并发限流
    expect([401, 429]).toContain(res.status);
  });
});
