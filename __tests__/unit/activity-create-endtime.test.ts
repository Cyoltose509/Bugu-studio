import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin", name: "admin" } })),
  activityFindUnique: vi.fn(async () => null),
  activityCreate: vi.fn(async () => ({ id: "act-1", slug: "slug-1" })),
  invalidateCache: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock("@/lib/services/notification", () => ({
  createNotification: vi.fn(),
  notifyMentions: vi.fn(),
}));
vi.mock("@/lib/utils/upload", () => ({
  deleteFromR2: vi.fn(),
  deleteManyFromR2: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    activity: {
      findUnique: mocks.activityFindUnique,
      create: mocks.activityCreate,
    },
  },
}));

import { createActivity } from "@/app/admin/activities/actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const created = () =>
  (mocks.activityCreate.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;

describe("createActivity 结束日期可选", () => {
  beforeEach(() => {
    mocks.activityCreate.mockClear();
    mocks.activityFindUnique.mockClear();
  });

  it("只填开始日期时，结束日期默认为开始当天 23:59:59", async () => {
    const res = await createActivity(
      form({ type: "GENERAL", title: "单日活动", startTime: "2026-11-25", endTime: "", status: "PUBLISHED" }),
    );

    expect(res).toEqual({ success: true, id: "act-1", slug: "slug-1" });
    expect(created().startTime).toEqual(new Date("2026-11-25T00:00:00+08:00"));
    expect(created().endTime).toEqual(new Date("2026-11-25T23:59:59+08:00"));
  });

  it("开始时间带时分时，默认结束取当天末尾而不是同一时刻", async () => {
    await createActivity(
      form({
        type: "COURSE",
        title: "公开课",
        startTime: "2026-11-25",
        endTime: "",
        courseHasClock: "on",
        startClock: "14:30",
        status: "PUBLISHED",
      }),
    );

    expect(created().startTime).toEqual(new Date("2026-11-25T14:30:00+08:00"));
    expect(created().endTime).toEqual(new Date("2026-11-25T23:59:59+08:00"));
  });

  it("明确填写结束日期时按填写的值走", async () => {
    await createActivity(
      form({ type: "GENERAL", title: "多日活动", startTime: "2026-11-25", endTime: "2026-11-27", status: "PUBLISHED" }),
    );

    expect(created().endTime).toEqual(new Date("2026-11-27T23:59:59+08:00"));
  });

  it("连开始日期都没填时仍然报错", async () => {
    const res = await createActivity(
      form({ type: "GENERAL", title: "无日期", startTime: "", endTime: "", status: "PUBLISHED" }),
    );

    expect(res).toEqual({ error: "请选择开始日期，或改为待定" });
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });
});
