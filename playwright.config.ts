import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // ============================================================
    // 桌面浏览器 — 日常测试
    // ============================================================
    {
      name: "msedge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    // ============================================================
    // 兼容性测试 — 多浏览器 (仅运行 @compat 标签或全部)
    // ============================================================
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      // grep: /.*/,  // 默认运行所有
    },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    //   // WebKit on Windows 需要特殊配置; 仅在 macOS CI 启用
    // },
    // ============================================================
    // 移动设备 — 响应式验证
    // ============================================================
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "ipad-pro",
      use: { ...devices["iPad Pro"] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run build && npm start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
