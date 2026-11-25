import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", name: "管理员" } })),
  auth: vi.fn(async () => null),
  revalidatePath: vi.fn(),
  invalidateCache: vi.fn(async () => undefined),
  userFindUnique: vi.fn(async () => ({ role: "USER", name: "某人" })),
  userUpdate: vi.fn(async () => ({})),
  clubMemberCreate: vi.fn(async () => ({})),
  clubMemberFindFirst: vi.fn(async () => null),
  clubMemberUpdate: vi.fn(async () => ({})),
  activityCreate: vi.fn(async () => ({ id: "a1", slug: "s1" })),
  activityUpdate: vi.fn(async () => ({ id: "a1", slug: "s1" })),
  activityFindUnique: vi.fn(async () => ({ id: "a1", slug: "s1", type: "GENERAL", status: "DRAFT" })),
  auditLogCreate: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
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
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    clubMember: {
      findFirst: mocks.clubMemberFindFirst,
      create: mocks.clubMemberCreate,
      update: mocks.clubMemberUpdate,
    },
    activity: {
      create: mocks.activityCreate,
      update: mocks.activityUpdate,
      findUnique: mocks.activityFindUnique,
    },
    auditLog: { create: mocks.auditLogCreate },
  },
}));

import {
  AUDIT_ACTION_VALUES,
  ACTIVITY_STATUS_VALUES,
  ACTIVITY_TYPE_VALUES,
  USER_ROLE_VALUES,
  isActivityStatus,
  isActivityType,
  isAuditAction,
  isUserRole,
} from "@/lib/db/enums";
import { updateUserRole } from "@/app/admin/users/actions";
import { createActivity, updateActivity } from "@/app/admin/activities/actions";

/**
 * 回归：外部参数（formData / URL）直接落 Prisma 的枚举字段，`as any` 绕过编译期检查，
 * 数据库抛出后整个请求 500。这里锁住「非法值进不来」和「合法值照常通过」。
 */
describe("枚举白名单本身", () => {
  it("与数据库枚举逐值对齐", () => {
    expect([...ACTIVITY_TYPE_VALUES]).toEqual([
      "MEETING",
      "COURSE",
      "ENGINE_COURSE",
      "COMPETITION",
      "GENERAL",
      "RECOMMENDATION",
    ]);
    expect([...ACTIVITY_STATUS_VALUES]).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
    expect([...USER_ROLE_VALUES]).toEqual(["GUEST", "USER", "MEMBER", "ADMIN"]);
    expect(AUDIT_ACTION_VALUES).toHaveLength(19);
  });

  it("拒掉旧值和野值", () => {
    // 活动类型：HACKATHON / TRAINING 是 recoTag 的值，不是 ActivityType
    expect(isActivityType("HACKATHON")).toBe(false);
    expect(isActivityType("TRAINING")).toBe(false);
    expect(isActivityType("GAME_JAM")).toBe(false);
    expect(isActivityType("GENERAL")).toBe(true);

    expect(isActivityStatus("LIVE")).toBe(false);
    expect(isActivityStatus("PUBLISHED")).toBe(true);

    expect(isUserRole("SUPER_ADMIN")).toBe(false);
    expect(isUserRole("ADMIN")).toBe(true);
    expect(isUserRole("admin")).toBe(false);

    expect(isAuditAction("BOGUS")).toBe(false);
    expect(isAuditAction("USER_ROLE_CHANGE")).toBe(true);
  });

  it("非字符串一律拒绝", () => {
    for (const v of [null, undefined, 0, 1, {}, [], true]) {
      expect(isActivityType(v)).toBe(false);
      expect(isActivityStatus(v)).toBe(false);
      expect(isUserRole(v)).toBe(false);
      expect(isAuditAction(v)).toBe(false);
    }
  });
});

describe("updateUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("非法角色直接抛错，不读也不写数据库", async () => {
    const fd = new FormData();
    fd.set("role", "SUPER_ADMIN");

    await expect(updateUserRole("u1", fd)).rejects.toThrow("无效的角色类型");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("合法角色照常写入", async () => {
    const fd = new FormData();
    fd.set("role", "ADMIN");

    await updateUserRole("u1", fd);
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "ADMIN" } });
  });
});

describe("createActivity / updateActivity 的枚举校验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseForm = () => {
    const fd = new FormData();
    fd.set("title", "测试活动");
    fd.set("startTime", "2026-12-01T14:00");
    return fd;
  };

  it("非法 type 返回错误，不写库", async () => {
    const fd = baseForm();
    fd.set("type", "HACKATHON");

    const res = await createActivity(fd);
    expect(res).toEqual({ error: "活动类型无效" });
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("非法 status 返回错误，不写库", async () => {
    const fd = baseForm();
    fd.set("type", "GENERAL");
    fd.set("status", "LIVE");

    const res = await updateActivity("a1", fd);
    expect(res).toEqual({ error: "活动状态无效" });
    expect(mocks.activityUpdate).not.toHaveBeenCalled();
  });

  it("合法 type 与 status 正常落库", async () => {
    const fd = baseForm();
    fd.set("type", "COMPETITION");
    fd.set("status", "PUBLISHED");

    const res = await updateActivity("a1", fd);
    expect(res).toMatchObject({ success: true });
    const data = mocks.activityUpdate.mock.calls[0][0].data;
    expect(data.type).toBe("COMPETITION");
    expect(data.status).toBe("PUBLISHED");
  });
});
