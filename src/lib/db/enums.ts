/**
 * 数据库枚举字段的运行时白名单。
 *
 * Prisma 的枚举类型只在编译期生效。Server Action 和 Route Handler 拿到的是
 * formData / URL 参数，全是 string，一个 `as any` 就能绕过全部检查；数据库那边
 * 是强类型枚举，值对不上就抛错，整个请求 500。
 *
 * 2026-11-25 的 `/works?types=MINI_GAME` 事故就是这么来的：数据库枚举已经收缩，
 * 旧链接还在传旧值，`findMany` 直接撞 `22P02`，页面 500（而且因为错误发生在
 * Suspense 流式渲染阶段，HTTP 状态还是 200）。
 *
 * 规矩：凡是能从外部输入进来的枚举值，先在这里过一道。查筛选认不得就丢掉
 * 退化成「不筛」；写数据认不得就报错，不静默改写用户的选择。
 *
 * 常量一律手写，不要用 `Object.values(ActivityType)`：schema.prisma 本身可能
 * 与数据库漂移（ProjectType 现在就是多 5 个旧值的状态），用生成的对象会让
 * 白名单跟着一起漂。
 */

/** 与数据库 ActivityType 保持一致 */
export const ACTIVITY_TYPE_VALUES = [
  "MEETING",
  "COURSE",
  "ENGINE_COURSE",
  "COMPETITION",
  "GENERAL",
  "RECOMMENDATION",
] as const;

/** 与数据库 ActivityStatus 保持一致 */
export const ACTIVITY_STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** 与数据库 UserRole 保持一致 */
export const USER_ROLE_VALUES = ["GUEST", "USER", "MEMBER", "ADMIN"] as const;

/** 与数据库 AuditAction 保持一致 */
export const AUDIT_ACTION_VALUES = [
  "USER_REGISTER",
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_ROLE_CHANGE",
  "PROJECT_CREATE",
  "PROJECT_UPDATE",
  "PROJECT_DELETE",
  "PROJECT_SUBMIT",
  "PROJECT_APPROVE",
  "PROJECT_REJECT",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "ADMIN_ACTION",
  "RATE_LIMIT_HIT",
  "SUSPICIOUS_REQUEST",
  "CREATE",
  "UPDATE",
  "DELETE",
  "OTHER",
] as const;

export type ActivityTypeValue = (typeof ACTIVITY_TYPE_VALUES)[number];
export type ActivityStatusValue = (typeof ACTIVITY_STATUS_VALUES)[number];
export type UserRoleValue = (typeof USER_ROLE_VALUES)[number];
export type AuditActionValue = (typeof AUDIT_ACTION_VALUES)[number];

const ACTIVITY_TYPES = new Set<string>(ACTIVITY_TYPE_VALUES);
const ACTIVITY_STATUSES = new Set<string>(ACTIVITY_STATUS_VALUES);
const USER_ROLES = new Set<string>(USER_ROLE_VALUES);
const AUDIT_ACTIONS = new Set<string>(AUDIT_ACTION_VALUES);

export function isActivityType(value: unknown): value is ActivityTypeValue {
  return typeof value === "string" && ACTIVITY_TYPES.has(value);
}

export function isActivityStatus(value: unknown): value is ActivityStatusValue {
  return typeof value === "string" && ACTIVITY_STATUSES.has(value);
}

export function isUserRole(value: unknown): value is UserRoleValue {
  return typeof value === "string" && USER_ROLES.has(value);
}

export function isAuditAction(value: unknown): value is AuditActionValue {
  return typeof value === "string" && AUDIT_ACTIONS.has(value);
}
