import { describe, expect, it, vi } from "vitest";
import { isTransientDbError, withDbRetry } from "@/lib/db/transient";

/** 构造一个带 Prisma error code 的错误 */
function prismaError(code: string, message = "Prisma error"): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("isTransientDbError", () => {
  it("识别 Prisma 连接层错误码", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017"]) {
      expect(isTransientDbError(prismaError(code))).toBe(true);
    }
  });

  it("识别 pooler / socket 消息", () => {
    const messages = [
      "Can't reach database server at `aws-1-ap-northeast-1.pooler.supabase.com:6543`",
      "Server has closed the connection.",
      "Timed out fetching a new connection from the connection pool",
      "Transaction API error: Transaction not found. Transaction ID is invalid",
      "read ECONNRESET",
    ];
    for (const message of messages) {
      expect(isTransientDbError(new Error(message))).toBe(true);
    }
  });

  it("业务类错误不重试（重试没有意义）", () => {
    expect(isTransientDbError(prismaError("P2002", "Unique constraint failed"))).toBe(false);
    expect(isTransientDbError(prismaError("P2025", "Record to update not found"))).toBe(false);
    expect(isTransientDbError(new Error("TypeError: x is not a function"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError("")).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("第一次成功就不重试", async () => {
    const query = vi.fn().mockResolvedValue("ok");
    await expect(withDbRetry(query)).resolves.toBe("ok");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("瞬时错误重试一次后成功", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(prismaError("P1017", "Server has closed the connection"))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withDbRetry(query, [200], sleep)).resolves.toBe("ok");
    expect(query).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(200);
  });

  it("业务错误立即抛出，不重试", async () => {
    const query = vi.fn().mockRejectedValue(prismaError("P2002", "Unique constraint failed"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withDbRetry(query, [200], sleep)).rejects.toThrow("Unique constraint failed");
    expect(query).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("重试用尽仍失败时抛出最后一次错误", async () => {
    const query = vi.fn().mockRejectedValue(prismaError("P1001", "Can't reach database server"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withDbRetry(query, [10, 10], sleep)).rejects.toThrow("Can't reach database server");
    expect(query).toHaveBeenCalledTimes(3); // 首次 + 两次重试
  });
});
