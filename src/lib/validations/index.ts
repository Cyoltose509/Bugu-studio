/**
 * Zod 验证 Schema
 */

import { z } from "zod";

// ============================================================
// 认证相关
// ============================================================

export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(255),
  password: z.string().min(8, "密码至少 8 位").max(128),
});

export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(255),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .max(128),
  name: z.string().min(1, "昵称不能为空").max(50),
  inviteCode: z.string().max(50).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "密码至少 8 位")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

// ============================================================
// 作品相关
// ============================================================

export const linkEntrySchema = z.object({
  label: z.string().min(1, "链接标签不能为空").max(50),
  url: z.string().url("请输入有效的 URL"),
});

export const projectCreateSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().min(10, "简介至少 10 字").max(10000),
  type: z.enum(["DEMO", "STEAM", "ITCH", "OTHER"]),
  developYear: z
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1),
  links: z.array(linkEntrySchema).max(20).default([]),
  coverImage: z.string().max(2048).optional(),
  devlog: z.string().max(50000).optional(),
  techStack: z.array(z.string().max(50)).max(20).default([]),
  tagIds: z.array(z.string()).max(10).default([]),
  customTags: z.array(z.string().min(1).max(30)).max(10).default([]),
  memberRoles: z
    .array(
      z
        .object({
          memberId: z.string().optional(),
          externalName: z.string().max(100).optional(),
          roles: z.array(z.string().max(30)).min(1).default(["制作"]),
        })
        .refine((d) => d.memberId || d.externalName, {
          message: "必须提供 memberId（社团成员）或 externalName（外部成员）",
        })
    )
    .max(50)
    .default([]),
  images: z
    .array(
      z.object({
        url: z.string().max(2048),
        altText: z.string().max(200).optional(),
      })
    )
    .max(20)
    .optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const reviewSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(2000).optional(),
});

// ============================================================
// 成员相关
// ============================================================

export const memberUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  grade: z.string().max(20).optional(),
  joinYear: z.number().int().min(2000).max(2100).optional(),
  graduateYear: z.number().int().min(2000).max(2100).nullable().optional(),
  skills: z.array(z.string().max(30)).max(20).optional(),
});

// ============================================================
// 分页查询
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const projectQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  type: z
    .enum(["DEMO", "STEAM", "ITCH", "OTHER"])
    .optional(),
  tag: z.string().optional(),
  year: z.coerce.number().int().optional(),
  featured: z.coerce.boolean().optional(),
});
