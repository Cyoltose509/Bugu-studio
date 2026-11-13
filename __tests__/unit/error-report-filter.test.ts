import { describe, expect, it } from "vitest";
import {
  hostnameFromUrl,
  isNonProductionHostname,
  shouldSkipClientReport,
} from "@/lib/errors/report-filter";

describe("isNonProductionHostname", () => {
  it("识别本机与私有网段", () => {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0", "192.168.1.30", "10.0.0.5", "172.20.3.4"]) {
      expect(isNonProductionHostname(host)).toBe(true);
    }
  });

  it("生产域名与公网 IP 不误伤", () => {
    for (const host of ["www.bugoostudio.com", "bugoostudio.com", "8.8.8.8", "172.32.0.1"]) {
      expect(isNonProductionHostname(host)).toBe(false);
    }
  });

  it("空值不算非生产", () => {
    expect(isNonProductionHostname(null)).toBe(false);
    expect(isNonProductionHostname("")).toBe(false);
  });
});

describe("hostnameFromUrl", () => {
  it("解析完整 URL", () => {
    expect(hostnameFromUrl("https://www.bugoostudio.com/activities/abc")).toBe("www.bugoostudio.com");
  });

  it("非法 URL 返回 null（不因此过滤真实错误）", () => {
    expect(hostnameFromUrl("not-a-url")).toBeNull();
    expect(hostnameFromUrl(null)).toBeNull();
  });
});

describe("shouldSkipClientReport", () => {
  it("跳过 chunk 加载失败（刷新即恢复）", () => {
    const result = shouldSkipClientReport(
      "Loading chunk 3507 failed.\n(error: https://www.bugoostudio.com/_next/static/chunks/3507-x.js)",
      "https://www.bugoostudio.com/tools",
    );
    expect(result).toEqual({ skip: true, reason: "transient" });
  });

  it("跳过 RSC 流中断与网络抖动", () => {
    for (const message of ["Connection closed.", "network error", "Load failed", "Failed to fetch"]) {
      expect(shouldSkipClientReport(message, "https://www.bugoostudio.com/members").skip).toBe(true);
    }
  });

  it("跳过本地开发来源", () => {
    expect(shouldSkipClientReport("Cannot read properties of undefined", "http://localhost:3000/members")).toEqual({
      skip: true,
      reason: "non-production-host",
    });
    expect(shouldSkipClientReport("boom", "http://127.0.0.1:1145/members/abc").skip).toBe(true);
  });

  it("保留生产环境里的真实业务错误", () => {
    const result = shouldSkipClientReport(
      "An error occurred in the Server Components render.",
      "https://www.bugoostudio.com/activities/cmv423lyw00003yx9rry5h3t7",
    );
    expect(result).toEqual({ skip: false });
  });

  it("URL 缺失时只按 message 判断", () => {
    expect(shouldSkipClientReport("TypeError: x is not a function", null).skip).toBe(false);
    expect(shouldSkipClientReport("ChunkLoadError", null).skip).toBe(true);
  });
});
