import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * recordErrorReport 单测：
 * - 数据库与通知全部 mock，不发真实请求、不写真实数据库
 * - 覆盖：新错误取 max+1、reportId 撞车重试、10 分钟去重、不同 URL 视为新错误、stack 截断
 *
 * 注：实现已从 prisma.$transaction 改为「独立两条语句 + P2002 重取号」——
 * pgbouncer 下交互式事务会偶发 "Transaction not found"，把错误上报本身搞挂。
 */
const mocks = vi.hoisted(() => ({
  errorReportFindFirst: vi.fn(),
  errorReportCreate: vi.fn(),
  errorReportUpdate: vi.fn(),
  notificationFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  createNotifications: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    errorReport: {
      findFirst: mocks.errorReportFindFirst,
      create: mocks.errorReportCreate,
      update: mocks.errorReportUpdate,
    },
    notification: { findFirst: mocks.notificationFindFirst },
    user: { findMany: mocks.userFindMany },
  },
}));

vi.mock("@/lib/services/notification", () => ({
  createNotifications: mocks.createNotifications,
}));

import { recordErrorReport } from "@/lib/errors/report-store";

/** 记录 dedupe 查询（带 lastSeenAt 条件）与新编号查询（orderBy reportId desc）分开返回 */
function queueIds(...ids: number[]) {
  mocks.errorReportFindFirst.mockImplementation(async (args: { where?: unknown; orderBy?: unknown }) => {
    if (args?.orderBy && !args?.where) {
      const next = ids.shift();
      return next === undefined ? null : { reportId: next };
    }
    return null;
  });
}

describe("recordErrorReport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.errorReportFindFirst.mockResolvedValue(null);
    mocks.errorReportCreate.mockResolvedValue({});
    mocks.errorReportUpdate.mockResolvedValue({});
    mocks.notificationFindFirst.mockResolvedValue(null);
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mocks.createNotifications.mockResolvedValue(undefined);
  });

  it("新错误：取 max(reportId)+1 创建，并通知所有管理员", async () => {
    queueIds(7);

    const result = await recordErrorReport({
      message: "Cannot read properties of undefined (reading 'id')",
      url: "https://bugoostudio.com/works",
      userAgent: "UA/1.0",
      userId: "user-1",
      kind: "client",
      notifyAdmins: true,
    });

    expect(result).toEqual({ reportId: 8, duplicate: false });
    expect(mocks.errorReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportId: 8,
        message: "Cannot read properties of undefined (reading 'id')",
        url: "https://bugoostudio.com/works",
        userAgent: "UA/1.0",
        userId: "user-1",
      }),
    });
    expect(mocks.createNotifications).toHaveBeenCalledTimes(1);

    const items = mocks.createNotifications.mock.calls[0][0];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      userId: "admin-1",
      type: "ERROR_REPORT",
      title: "⚠️ 前端错误 #8",
      relatedId: "8",
      relatedType: "ErrorReport",
    });
    expect(items[0].content).toContain("https://bugoostudio.com/works");
    expect(items[0].content).toContain("Cannot read properties of undefined");
  });

  it("reportId 撞车（P2002）：重新取号再创建", async () => {
    queueIds(4, 5);
    mocks.errorReportCreate
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))
      .mockResolvedValueOnce({});

    const result = await recordErrorReport({ message: "boom" });

    expect(result).toEqual({ reportId: 6, duplicate: false });
    expect(mocks.errorReportCreate).toHaveBeenCalledTimes(2);
    expect(mocks.errorReportCreate.mock.calls[1][0].data.reportId).toBe(6);
  });

  it("服务端错误：通知标题使用「服务端错误」文案", async () => {
    queueIds(3);

    const result = await recordErrorReport({
      message: "RSC render failed",
      stack: "Error: RSC render failed\n  at layout",
      url: "/admin/monitoring",
      kind: "server",
      notifyAdmins: true,
    });

    expect(result).toEqual({ reportId: 4, duplicate: false });
    expect(mocks.createNotifications.mock.calls[0][0][0].title).toBe("⚠️ 服务端错误 #4");
  });

  it("10 分钟内相同 message + url：仅 count+1，不创建新报告、不重复通知", async () => {
    mocks.errorReportFindFirst.mockResolvedValueOnce({ id: "report-row-1", reportId: 5 });

    const result = await recordErrorReport({
      message: "Failed to fetch",
      url: "https://bugoostudio.com/activities",
      userAgent: "UA/2.0",
      kind: "client",
      notifyAdmins: true,
    });

    expect(result).toEqual({ reportId: 5, duplicate: true });
    expect(mocks.errorReportFindFirst).toHaveBeenCalledWith({
      where: {
        message: "Failed to fetch",
        url: "https://bugoostudio.com/activities",
        lastSeenAt: { gte: expect.any(Date) },
      },
      orderBy: { lastSeenAt: "desc" },
    });
    expect(mocks.errorReportUpdate).toHaveBeenCalledWith({
      where: { id: "report-row-1" },
      data: expect.objectContaining({
        count: { increment: 1 },
        lastSeenAt: expect.any(Date),
        userAgent: "UA/2.0",
      }),
    });
    expect(mocks.errorReportCreate).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("相同 message 但 url 不同：视为新错误，各自创建新报告", async () => {
    queueIds(1, 2);

    const first = await recordErrorReport({ message: "Load failed", url: "https://a.example/1" });
    const second = await recordErrorReport({ message: "Load failed", url: "https://a.example/2" });

    expect(first).toEqual({ reportId: 2, duplicate: false });
    expect(second).toEqual({ reportId: 3, duplicate: false });
    expect(mocks.errorReportCreate).toHaveBeenCalledTimes(2);
    expect(mocks.errorReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ url: "https://a.example/1" }) })
    );
    expect(mocks.errorReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ url: "https://a.example/2" }) })
    );
  });

  it("url 缺省时按 null 查询去重，并按 null 落库", async () => {
    queueIds(9);

    await recordErrorReport({ message: "An error occurred in the Server Components render" });

    expect(mocks.errorReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ url: null }) })
    );
    expect(mocks.errorReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ url: null, userId: null, userAgent: null, stack: null }),
    });
  });

  it("stack 落库前截断到 5000 字符", async () => {
    const longStack = `Error: boom\n${"  at frame\n".repeat(900)}`;

    await recordErrorReport({ message: "boom", stack: longStack });

    const data = mocks.errorReportCreate.mock.calls[0][0].data;
    expect(longStack.length).toBeGreaterThan(5000);
    expect(data.stack).toHaveLength(5000);
    expect(data.stack).toBe(longStack.slice(0, 5000));
  });

  it("30 分钟内已有相同 ERROR_REPORT 通知：不再重复通知", async () => {
    queueIds(1);
    mocks.notificationFindFirst.mockResolvedValue({ id: "notif-1" });

    const result = await recordErrorReport({
      message: "boom",
      url: "https://bugoostudio.com/",
      notifyAdmins: true,
    });

    expect(result).toEqual({ reportId: 2, duplicate: false });
    expect(mocks.notificationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "ERROR_REPORT",
          createdAt: { gte: expect.any(Date) },
        }),
      })
    );
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("notifyAdmins 为 false 时不查询管理员、不发通知", async () => {
    queueIds(1);

    await recordErrorReport({ message: "boom", kind: "server" });

    expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("通知失败静默：通知抛错不影响落库结果", async () => {
    queueIds(1);
    mocks.createNotifications.mockRejectedValue(new Error("notification down"));

    await expect(recordErrorReport({ message: "boom", notifyAdmins: true })).resolves.toEqual({
      reportId: 2,
      duplicate: false,
    });
    expect(mocks.createNotifications).toHaveBeenCalledTimes(1);
  });

  it("数据库写库失败时向上抛出，由调用方决定错误响应", async () => {
    mocks.errorReportCreate.mockRejectedValue(new Error("db down"));

    await expect(recordErrorReport({ message: "boom" })).rejects.toThrow("db down");
  });
});
