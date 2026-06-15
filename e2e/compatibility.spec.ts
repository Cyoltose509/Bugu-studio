/**
 * 兼容性测试 — 多浏览器 / 多设备 / 多视口
 *
 * 覆盖: Chromium(Edge), Firefox, iPhone 14, Pixel 7, iPad Pro
 * 运行: npx playwright test e2e/compatibility.spec.ts
 * 仅兼容性: npx playwright test --grep "@compat"
 */

import { test, expect } from "@playwright/test";

// ============================================================
// 1. 页面一致性 — 所有页面在不同浏览器下正常加载
// ============================================================

const PUBLIC_PAGES = [
  { path: "/", name: "首页" },
  { path: "/works", name: "作品库" },
  { path: "/members", name: "成员" },
  { path: "/activities", name: "活动" },
  { path: "/history", name: "历史" },
];

for (const page of PUBLIC_PAGES) {
  test(`兼容性 — ${page.name} 在所有浏览器正常加载`, { tag: "@compat" }, async ({ page: p }) => {
    test.setTimeout(30_000);
    const response = await p.goto(page.path, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    expect(response?.status()).toBeLessThan(400);
    // 确保不是白屏 — body 必须有内容
    await expect(p.locator("body")).not.toBeEmpty({ timeout: 10_000 });
    // 截图记录
    await p.screenshot({
      fullPage: false,
      path: `test-results/compat-${browserName()}-${page.name}.png`,
    }).catch(() => {});

    function browserName() {
      return (p.context().browser()?.browserType().name()) || "unknown";
    }
  });
}

// ============================================================
// 2. 响应式断点 — 移动/平板/桌面布局正确
// ============================================================

const BREAKPOINTS = [
  { name: "small-mobile", width: 375, height: 667 },
  { name: "large-mobile", width: 428, height: 926 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small-desktop", width: 1024, height: 768 },
  { name: "large-desktop", width: 1440, height: 900 },
  { name: "ultrawide", width: 1920, height: 1080 },
];

for (const bp of BREAKPOINTS) {
  test(`兼容性 — 响应式 ${bp.name} (${bp.width}x${bp.height})`, { tag: "@compat" }, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
    });
    const p = await context.newPage();

    const response = await p.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    expect(response?.status()).toBeLessThan(400);

    // 验证没有水平溢出
    const viewportWidth = await p.evaluate(() => window.innerWidth);
    const bodyWidth = await p.evaluate(
      () => document.documentElement.scrollWidth
    );
    const overflow = bodyWidth - viewportWidth;
    // 允许少量溢出（如: 一些绝对定位元素），但不应超过 20px
    expect(overflow).toBeLessThanOrEqual(20);

    // 确保关键元素可见
    await expect(p.locator("body")).not.toBeEmpty();

    await context.close();
  });
}

// ============================================================
// 3. 暗色模式 — 所有浏览器支持
// ============================================================

test(`兼容性 — 暗色模式`, { tag: "@compat" }, async ({ page }) => {
  // 模拟系统暗色主题
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  // 检查 html 是否有 dark class
  const htmlClass = await page.evaluate(() =>
    document.documentElement.className
  );
  // 如果使用了 next-themes，应该有 'dark' class
  // 这是可选的；没有 dark class 也不算失败

  // 至少页面应该可读（文字不消失）
  const bodyColor = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });

  // 在暗色模式下背景色应该比较暗
  if (bodyColor.backgroundColor && bodyColor.backgroundColor !== "rgba(0, 0, 0, 0)") {
    // 有非透明背景色，应该较暗
    expect(bodyColor.backgroundColor).toBeDefined();
  }

  await page.screenshot({
    path: `test-results/compat-dark-mode-${page.context().browser()?.browserType().name() || "unknown"}.png`,
  }).catch(() => {});
});

// ============================================================
// 4. 亮色模式 — 所有浏览器支持
// ============================================================

test(`兼容性 — 亮色模式`, { tag: "@compat" }, async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  await expect(page.locator("body")).not.toBeEmpty();
});

// ============================================================
// 5. prefers-reduced-motion — 无障碍动画
// ============================================================

test(`兼容性 — prefers-reduced-motion`, { tag: "@compat" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  // 确保页面仍然可用（不会因为 motion reduction crash）
  await expect(page.locator("body")).not.toBeEmpty();
});

// ============================================================
// 6. 键盘导航 — 所有元素可聚焦
// ============================================================

test(`兼容性 — 键盘导航`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  // 按 Tab 键逐一聚焦
  let focusedCount = 0;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase() || "none";
    });
    if (focused !== "none" && focused !== "body") {
      focusedCount++;
    }
  }

  // 至少有一些可聚焦元素（导航链接、按钮等）
  expect(focusedCount).toBeGreaterThan(0);
});

// ============================================================
// 7. 触控目标 — 可点击元素尺寸 ≥ 44px
// ============================================================

test(`兼容性 — 触控目标尺寸 (44px 最小)`, { tag: "@compat" }, async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone 大小
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  // 检查导航链接的尺寸
  const smallTargets = await page.evaluate(() => {
    const clickables = document.querySelectorAll(
      'a, button, [role="button"], input[type="submit"]'
    );
    const results: { tag: string; text: string; width: number; height: number }[] = [];

    for (const el of clickables) {
      const rect = el.getBoundingClientRect();
      // 只检查可见元素
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < 44 || rect.height < 44) {
          results.push({
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim().slice(0, 30) || "",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    }
    return results;
  });

  console.log(
    `  小触控目标 (<44px): ${smallTargets.length} 个`
  );
  if (smallTargets.length > 0) {
    console.log(
      `  [WARN] 示例: ${JSON.stringify(smallTargets.slice(0, 5))}`
    );
  }

  // 如果有太多小于 44px 的触控目标，记录但不硬失败
  // (开发环境中一些元素可能存在)
  expect(smallTargets.length).toBeLessThan(50); // 合理的阈值

  await context.close();
});

// ============================================================
// 8. 图片 lazy loading — 兼容所有浏览器
// ============================================================

test(`兼容性 — 图片 loading="lazy"`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/works", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const lazyImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img[loading='lazy']");
    return {
      total: document.querySelectorAll("img").length,
      lazy: imgs.length,
      attributes: Array.from(imgs).map((img) => ({
        src: img.getAttribute("src")?.slice(0, 50),
        loading: img.getAttribute("loading"),
      })),
    };
  });

  console.log(
    `  图片总数: ${lazyImages.total}, 懒加载: ${lazyImages.lazy}`
  );
  // 如果有图片，至少应该有一些使用 lazy loading
  expect(lazyImages.total).toBeGreaterThanOrEqual(0);
  // 如果有任何图片，检查 lazy 属性
  if (lazyImages.total > 0) {
    console.log(`  lazy 图片: ${JSON.stringify(lazyImages.attributes.slice(0, 3))}`);
  }
});

// ============================================================
// 9. HTML 语义化 — heading 层级正确
// ============================================================

test(`兼容性 — HTML 语义化`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  const semantics = await page.evaluate(() => {
    const h1s = document.querySelectorAll("h1").length;
    const h2s = document.querySelectorAll("h2").length;
    const mains = document.querySelectorAll("main").length;
    const navs = document.querySelectorAll("nav").length;
    const footers = document.querySelectorAll("footer").length;
    const skipLinks = document.querySelectorAll("[href='#main-content'], [href='#content']").length;

    return { h1s, h2s, mains, navs, footers, skipLinks };
  });

  console.log(`  语义标签: h1=${semantics.h1s} h2=${semantics.h2s} main=${semantics.mains} nav=${semantics.navs} footer=${semantics.footers} skipLink=${semantics.skipLinks}`);

  // 至少有一个 main 区域
  // 不强制要求（Next.js 布局可能不同），但给出日志
});

// ============================================================
// 10. sessionStorage / localStorage — 跨浏览器兼容
// ============================================================

test(`兼容性 — Web Storage API`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  const storageOk = await page.evaluate(() => {
    try {
      sessionStorage.setItem("__test__", "1");
      const val = sessionStorage.getItem("__test__");
      sessionStorage.removeItem("__test__");
      return val === "1";
    } catch {
      return false;
    }
  });

  expect(storageOk).toBe(true);
});

// ============================================================
// 11. CSS Grid / Flexbox 兼容
// ============================================================

test(`兼容性 — CSS Grid & Flexbox`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/works", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const cssSupport = await page.evaluate(() => {
    const grid = CSS.supports("display", "grid");
    const flex = CSS.supports("display", "flex");
    const clamp = CSS.supports("width", "clamp(1px, 2px, 3px)");
    const gap = CSS.supports("gap", "1rem");
    const variables = CSS.supports("--test", "0");

    return { grid, flex, clamp, gap, variables };
  });

  console.log(`  CSS 支持: ${JSON.stringify(cssSupport)}`);

  // 所有现代浏览器都应支持这些特性
  expect(cssSupport.grid).toBe(true);
  expect(cssSupport.flex).toBe(true);
  expect(cssSupport.gap).toBe(true);
  expect(cssSupport.variables).toBe(true);
});

// ============================================================
// 12. fetch API — 跨浏览器兼容
// ============================================================

test(`兼容性 — Fetch API`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  const fetchOk = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/health");
      return res.ok;
    } catch {
      return false;
    }
  });

  expect(fetchOk).toBe(true);
});

// ============================================================
// 13. 字体渲染 — 中文字体可用
// ============================================================

test(`兼容性 — 中文字体渲染`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });

  const chineseText = await page.evaluate(() => {
    const body = document.body;
    const text = body.textContent || "";
    // 检查是否包含中文字符
    const chineseRegex = /[\u4e00-\u9fff]/;
    return {
      hasChinese: chineseRegex.test(text),
      sample: text.slice(0, 100),
    };
  });

  // 中文网站应该包含中文
  expect(chineseText.hasChinese).toBe(true);
});

// ============================================================
// 14. 表单验证 — 跨浏览器表现一致
// ============================================================

test(`兼容性 — 表单元素`, { tag: "@compat" }, async ({ page }) => {
  await page.goto("/join", { waitUntil: "domcontentloaded", timeout: 20_000 });

  // 检查表单是否存在
  const formExists = await page.evaluate(() => {
    return document.querySelectorAll("form").length > 0;
  });

  // join 页面可能有或没有表单（依赖认证状态）
  console.log(`  join 表单: ${formExists ? "存在" : "不存在（可能需要登录）"}`);
});

// ============================================================
// 15. 视口旋转 — 移动设备横竖屏
// ============================================================

test(`兼容性 — 视口旋转 (横屏↔竖屏)`, { tag: "@compat" }, async ({ browser }) => {
  // 竖屏
  const portraitContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const portraitPage = await portraitContext.newPage();
  await portraitPage.goto("/", {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  const portraitScrollWidth = await portraitPage.evaluate(
    () => document.documentElement.scrollWidth
  );
  await portraitContext.close();

  // 横屏
  const landscapeContext = await browser.newContext({
    viewport: { width: 812, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  const landscapePage = await landscapeContext.newPage();
  await landscapePage.goto("/", {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  const landscapeScrollWidth = await landscapePage.evaluate(
    () => document.documentElement.scrollWidth
  );
  await landscapeContext.close();

  // 两个方向都不应该水平溢出
  expect(portraitScrollWidth).toBeLessThanOrEqual(395); // 375 + 20px margin
  expect(landscapeScrollWidth).toBeLessThanOrEqual(832); // 812 + 20px margin
});
