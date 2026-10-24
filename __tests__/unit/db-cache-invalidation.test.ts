import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  del: vi.fn(),
  scan: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    del = redisMocks.del;
    scan = redisMocks.scan;
  },
}));

describe("distributed cache invalidation", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = "https://cache.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    redisMocks.del.mockResolvedValue(1);
    redisMocks.scan.mockResolvedValue(["0", [
      "activity:detail:activity-1:en",
      "activity:detail:activity-1:cn",
    ]]);
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("discovers and deletes keys written by another Vercel instance", async () => {
    const { invalidateCache } = await import("@/lib/db/cache");

    await invalidateCache("activity:detail:activity-1");

    expect(redisMocks.del).toHaveBeenNthCalledWith(1, "activity:detail:activity-1");
    expect(redisMocks.scan).toHaveBeenCalledWith("0", {
      match: "activity:detail:activity-1*",
      count: 100,
    });
    expect(redisMocks.del).toHaveBeenNthCalledWith(
      2,
      "activity:detail:activity-1:en",
      "activity:detail:activity-1:cn",
    );
  });
});
