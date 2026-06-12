/**
 * RBAC 权限控制
 * 权限层级：GUEST < USER < MEMBER < ADMIN
 */

import { UserRole } from "@prisma/client";

// 权限层级数值
const ROLE_HIERARCHY: Record<UserRole, number> = {
  GUEST: 0,
  USER: 1,
  MEMBER: 2,
  ADMIN: 4,
};

/**
 * 检查角色是否满足最低要求
 */
export function hasMinimumRole(
  userRole: UserRole | undefined | null,
  requiredRole: UserRole
): boolean {
  if (!userRole) return requiredRole === "GUEST";
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 检查是否为管理员
 */
export function isAdmin(role?: UserRole | null): boolean {
  return role === "ADMIN";
}

/**
 * 检查是否为社团成员及以上
 */
export function isMemberOrAbove(role?: UserRole | null): boolean {
  return hasMinimumRole(role, "MEMBER");
}

/**
 * 检查是否可以编辑指定作品
 * - ADMIN 可以编辑所有作品
 * - MEMBER 只能编辑自己提交的作品
 */
export function canEditProject(
  userRole: UserRole | undefined | null,
  userId: string,
  projectSubmitterId: string
): boolean {
  if (!userRole) return false;
  if (isAdmin(userRole)) return true;
  if (userRole === "MEMBER") return userId === projectSubmitterId;
  return false;
}

/**
 * 权限检查装饰器（用于 API Route）
 */
export class PermissionDeniedError extends Error {
  constructor(message = "权限不足") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "请先登录") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}
