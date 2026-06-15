# Bugu-Studio 测试指南

## 快速开始

```bash
# 安装依赖
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom
npm install -D @playwright/test

# 初始化 Playwright
npx playwright install
```

## 目录结构

```
e2e/                          # E2E 测试 (Playwright)
  smoke.spec.ts               # 页面冒烟测试
  auth-flow.spec.ts           # 注册/登录流程
  project-crud.spec.ts        # 作品提交→审核→发布
  role-guard.spec.ts          # 权限守卫测试
__tests__/                    # 单元/组件测试 (Vitest)
  components/
    ProjectCard.test.tsx
    RichContent.test.tsx
  api/
    projects.test.ts
    auth.test.ts
  utils/
    rich-content.test.ts
```

---

## 1. 冒烟测试 (5 分钟可以写完，最先补的)

```typescript
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = [
  { path: "/", name: "首页" },
  { path: "/works", name: "作品库" },
  { path: "/members", name: "成员档案" },
  { path: "/activities", name: "活动" },
];

for (const page of PUBLIC_PAGES) {
  test(`公开页面 ${page.name} 正常加载`, { tag: "@smoke" }, async ({ page }) => {
    const response = await page.goto(page.path);
    expect(response?.status()).toBeLessThan(400);
    // 确保关键内容渲染了
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });
}

test("作品详情页正常加载", { tag: "@smoke" }, async ({ page }) => {
  const response = await page.goto("/works");
  // 点击第一个作品卡片
  const firstCard = page.locator("a[href^='/works/']").first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
});
```

---

## 2. 注册→登录→提交→审核 全流程 E2E

```typescript
// e2e/project-crud.spec.ts
import { test, expect } from "@playwright/test";

test.describe("作品提交与审核流程", () => {
  const TEST_MEMBER = {
    name: "测试社员",
    email: `test-${Date.now()}@bugu.studio`,
    password: "test123456",
    inviteCode: process.env.TEST_INVITE_CODE!,
  };

  test("完整流程：成员注册→登录→提交→管理员审核", async ({ browser }) => {
    // 成员端
    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();

    // Step 1: 注册
    await memberPage.goto("/auth/register");
    await memberPage.fill("input[name='name']", TEST_MEMBER.name);
    await memberPage.fill("input[name='email']", TEST_MEMBER.email);
    await memberPage.fill("input[name='password']", TEST_MEMBER.password);
    await memberPage.fill("input[name='inviteCode']", TEST_MEMBER.inviteCode);
    await memberPage.click("button[type='submit']");
    await memberPage.waitForURL("/auth/verify");
    // 验证邮箱（API 端）
    // ... 获取验证 token

    // Step 2: 登录
    await memberPage.goto("/auth/login");
    await memberPage.fill("input[name='email']", TEST_MEMBER.email);
    await memberPage.fill("input[name='password']", TEST_MEMBER.password);
    await memberPage.click("button[type='submit']");
    await expect(memberPage).toHaveURL("/");

    // Step 3: 提交作品（成员）
    await memberPage.goto("/submit");
    await memberPage.fill("input[name='title']", "测试作品");
    await memberPage.fill("textarea[name='description']", "这是测试描述");
    await memberPage.selectOption("select[name='type']", "IN_DEVELOPMENT");
    await memberPage.click("button[type='submit']");
    // 普通成员提交后应该跳回作品库
    await expect(memberPage).toHaveURL("/works", { timeout: 15000 });

    // Step 4: 管理员审核
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await adminPage.goto("/admin/projects");
    // 找到待审核作品并点击"通过"
    const pendingRow = adminPage.locator("tr:has-text('测试作品')");
    await pendingRow.locator("button:has-text('通过审核')").click();
    await expect(adminPage.locator("text=审核通过")).toBeVisible();
  });
});

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.fill("input[name='email']", process.env.ADMIN_EMAIL!);
  await page.fill("input[name='password']", process.env.ADMIN_PASSWORD!);
  await page.click("button[type='submit']");
  await expect(page).toHaveURL("/");
}
```

---

## 3. API 契约测试

```typescript
// __tests__/api/works.test.ts
import { describe, it, expect } from "vitest";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

describe("GET /api/works", () => {
  it("返回分页作品列表，总数为正", async () => {
    const res = await fetch(`${BASE}/api/works`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("total");
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.total).toBeGreaterThan(0);
  });

  it("type 筛选有效枚举值正常工作", async () => {
    for (const type of ["IN_DEVELOPMENT", "TRIAL_DEMO", "OFFICIAL_RELEASE"]) {
      const res = await fetch(`${BASE}/api/works?type=${type}`);
      expect(res.status).toBe(200);
    }
  });

  it("cursor 分页正常", async () => {
    const firstPage = await fetch(`${BASE}/api/works`).then(r => r.json());
    if (firstPage.hasMore) {
      const secondPage = await fetch(
        `${BASE}/api/works?cursor=${firstPage.nextCursor}`
      ).then(r => r.json());
      expect(secondPage.items.length).toBeGreaterThan(0);
      expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
    }
  });

  it("非法 type 值被拒绝", async () => {
    const res = await fetch(`${BASE}/api/works?type=INVALID`);
    expect(res.status).toBe(400);
  });
});
```

---

## 4. 权限守卫测试

```typescript
// e2e/role-guard.spec.ts
import { test, expect } from "@playwright/test";

test.describe("权限边界", () => {
  test("未登录用户无法访问管理页面", async ({ page }) => {
    const response = await page.goto("/admin");
    // 应该被重定向到登录页
    expect(page.url()).toContain("/auth/login");
  });

  test("USER 角色无法访问管理页面", async ({ page }) => {
    // 先用普通用户登录
    await page.goto("/auth/login");
    await page.fill("input[name='email']", process.env.NORMAL_USER_EMAIL!);
    await page.fill("input[name='password']", process.env.NORMAL_USER_PASSWORD!);
    await page.click("button[type='submit']");
    await page.waitForURL("/");

    const response = await page.goto("/admin");
    expect(page.url()).not.toContain("/admin");
  });

  test("普通成员提交作品进入 PENDING 状态", async ({ page }) => {
    // ...
  });
});
```

---

## 5. 组件测试示例

```typescript
// __tests__/components/RichContent.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichContentClient } from "@/components/RichContentClient";

describe("RichContentClient", () => {
  it("渲染普通文本", () => {
    render(<RichContentClient html="<p>Hello World</p>" />);
    expect(screen.getByText("Hello World")).toBeDefined();
  });

  it("安全处理空内容", () => {
    const { container } = render(<RichContentClient html="" />);
    expect(container.querySelector(".rich-content")).toBeDefined();
  });

  it("渲染 @mention 链接", () => {
    const html = '<a href="/members/123" class="mention">@张三</a>';
    render(<RichContentClient html={html} />);
    expect(screen.getByText("@张三")).toBeDefined();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/members/123");
  });
});
```

---

## CI 集成

```yaml
# .github/workflows/test.yml
name: 测试
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx vitest run
      - run: npx playwright test --project=chromium
        env:
          ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```

---

## 优先级路线图

| 阶段 | 内容 | 工作量 | 完成后价值 |
|------|------|--------|-----------|
| **Phase 1 — 保底** | 8 条冒烟测试 + 5 条关键流程 E2E | 半天 | 部署前有人工可控的安全网 |
| **Phase 2 — API 契约** | 20 条 API 测试，覆盖所有写操作 + 异常路径 | 1 天 | 任何重构不会悄悄破坏 API |
| **Phase 3 — 权限** | 10 条角色边界测试 | 半天 | 永远不会出现越权漏洞 |
| **Phase 4 — 组件** | 15 条组件测试 | 1 天 | 关键 UI 组件有回归保护 |
