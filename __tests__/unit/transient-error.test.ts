import { describe, expect, it, vi } from "vitest";
import {
  attemptTransientRecovery,
  isChunkLoadError,
  isRecoverableTransientError,
  isTransientNetworkError,
  type RecoveryStorage,
} from "@/lib/utils/transient-error";

/** 内存版 storage —— 不依赖真实 sessionStorage，单测环境是 node */
function createMemoryStorage(): RecoveryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

/** 通用注入项：可控时钟 + reload 桩 + 在线 */
function createHarness(initialNow = 1_000_000) {
  const storage = createMemoryStorage();
  const reload = vi.fn();
  let clock = initialNow;

  return {
    storage,
    reload,
    options: {
      storage,
      reload,
      now: () => clock,
      isOnline: () => true,
    },
    advance(ms: number) {
      clock += ms;
    },
    setClock(ms: number) {
      clock = ms;
    },
  };
}

describe("isChunkLoadError", () => {
  it("识别 Webpack ChunkLoadError 的 name 与 message", () => {
    const err = new Error("Loading chunk 123 failed");
    err.name = "ChunkLoadError";
    expect(isChunkLoadError(err)).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 42 failed"))).toBe(true);
  });

  it("识别 CSS chunk / 动态 import / module script 失败", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk 7 failed"))).toBe(true);
    expect(
      isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/pages/_app-abc123.js")),
    ).toBe(true);
    expect(
      isChunkLoadError(new Error("error loading dynamically imported module: https://x/y.js")),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    // 字符串形式的错误（部分运行时只给 message）
    expect(isChunkLoadError("ChunkLoadError: Loading chunk 9 failed.")).toBe(true);
  });

  it("普通业务错误与空值不误判", () => {
    expect(isChunkLoadError(new Error("用户名或密码错误"))).toBe(false);
    expect(isChunkLoadError(new Error("Failed to save work"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("isTransientNetworkError", () => {
  it("识别 RSC 流中断 Connection closed", () => {
    expect(isTransientNetworkError(new Error("Connection closed."))).toBe(true);
    expect(isTransientNetworkError(new Error("Connection closed"))).toBe(true);
    // 前后空白不影响判断
    expect(isTransientNetworkError(new Error("  Connection closed.  "))).toBe(true);
  });

  it("识别浏览器网络错误文案", () => {
    expect(isTransientNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientNetworkError(new Error("Load failed"))).toBe(true);
    expect(isTransientNetworkError(new Error("network error"))).toBe(true);
    expect(
      isTransientNetworkError(new Error("NetworkError when attempting to fetch resource.")),
    ).toBe(true);
    expect(isTransientNetworkError(new Error("network connection was lost"))).toBe(true);
  });

  it("业务错误与空值不误判", () => {
    expect(isTransientNetworkError(new Error("Request failed with status code 500"))).toBe(false);
    expect(isTransientNetworkError(new Error("Loading chunk 1 failed"))).toBe(false);
    expect(isTransientNetworkError(null)).toBe(false);
  });
});

describe("isRecoverableTransientError", () => {
  it("chunk 丢失与 RSC/网络中断都算可自愈", () => {
    expect(isRecoverableTransientError(new Error("Loading chunk 3 failed"))).toBe(true);
    expect(isRecoverableTransientError(new Error("Connection closed."))).toBe(true);
    expect(isRecoverableTransientError(new Error("Failed to fetch"))).toBe(true);
  });

  it("普通业务错误不算可自愈", () => {
    expect(isRecoverableTransientError(new Error("Prisma unique constraint failed"))).toBe(false);
    expect(isRecoverableTransientError(new Error("Unauthorized"))).toBe(false);
  });
});

describe("attemptTransientRecovery", () => {
  it("在线时首次立即触发刷新并返回 true", () => {
    const h = createHarness();
    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("20s 冷却期内不重复刷新", () => {
    const h = createHarness();

    expect(attemptTransientRecovery(h.options)).toBe(true);

    h.advance(5_000);
    expect(attemptTransientRecovery(h.options)).toBe(false);

    h.advance(14_000); // 距上次刷新 19s，仍在冷却期
    expect(attemptTransientRecovery(h.options)).toBe(false);
    expect(h.reload).toHaveBeenCalledTimes(1);

    h.advance(1_000); // 恰好 20s，冷却结束
    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(2);
  });

  it("离线时直接返回 false 且不刷新", () => {
    const storage = createMemoryStorage();
    const reload = vi.fn();

    const ok = attemptTransientRecovery({
      storage,
      reload,
      now: () => 1_000_000,
      isOnline: () => false,
    });

    expect(ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("10 分钟窗口内最多刷新 3 次，超限后不再刷新", () => {
    const h = createHarness();

    // 每次间隔 20s 以避开冷却
    expect(attemptTransientRecovery(h.options)).toBe(true);
    h.advance(20_000);
    expect(attemptTransientRecovery(h.options)).toBe(true);
    h.advance(20_000);
    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(3);

    // 第 4 次仍在 10 分钟窗口内 → 拒绝
    h.advance(20_000);
    expect(attemptTransientRecovery(h.options)).toBe(false);
    expect(h.reload).toHaveBeenCalledTimes(3);
  });

  it("超出 10 分钟窗口后重新允许刷新", () => {
    const h = createHarness();

    expect(attemptTransientRecovery(h.options)).toBe(true);
    h.advance(20_000);
    expect(attemptTransientRecovery(h.options)).toBe(true);
    h.advance(20_000);
    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(3);

    // 窗口滑过：最早一条记录已超过 10 分钟，计数从头开始
    h.setClock(1_000_000 + 10 * 60_000 + 1);
    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(4);
  });

  it("无 window（SSR / 纯 Node）时返回 false 且不刷新", () => {
    // 单测默认 node 环境，没有 window
    expect(typeof window).toBe("undefined");
    expect(attemptTransientRecovery()).toBe(false);
  });

  it("storage 写入失败时放弃刷新（无法保证不循环）", () => {
    const reload = vi.fn();
    const storage: RecoveryStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(
      attemptTransientRecovery({ storage, reload, now: () => 1_000_000, isOnline: () => true }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("storage 数据损坏时按空记录处理，仍可刷新", () => {
    const h = createHarness();
    h.storage.setItem("bugu:transient-recovery:state", "{not-json");

    expect(attemptTransientRecovery(h.options)).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("reload 抛错时返回 false（交由调用方保留手动入口）", () => {
    const storage = createMemoryStorage();
    const reload = vi.fn(() => {
      throw new Error("reload blocked");
    });

    expect(
      attemptTransientRecovery({ storage, reload, now: () => 1_000_000, isOnline: () => true }),
    ).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("不同 keyPrefix 的计数互不影响", () => {
    const storage = createMemoryStorage();
    const reloadA = vi.fn();
    const reloadB = vi.fn();
    const base = { storage, now: () => 1_000_000, isOnline: () => true };

    expect(attemptTransientRecovery({ ...base, reload: reloadA, keyPrefix: "a" })).toBe(true);
    // 同一时刻、不同前缀：不受 a 的冷却影响
    expect(attemptTransientRecovery({ ...base, reload: reloadB, keyPrefix: "b" })).toBe(true);
    expect(reloadA).toHaveBeenCalledTimes(1);
    expect(reloadB).toHaveBeenCalledTimes(1);
  });
});
