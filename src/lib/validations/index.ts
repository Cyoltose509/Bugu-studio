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
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "密码必须包含大小写字母和数字"
    ),
  name: z.string().min(1, "昵称不能为空").max(50),
  inviteCode: z.string().max(50).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "密码至少 8 位")
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "密码必须包含大小写字母和数字"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

// ============================================================
// 作品相关
// ============================================================

export const projectCreateSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().min(10, "简介至少 10 字").max(10000),
  type: z.enum([
    "STEAM", "INDIE", "GAME_JAM", "DEMO", "PROTOTYPE", "GRADUATION", "OTHER"
  ]),
  developYear: z
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1),
  steamUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  itchUrl: z.string().url().optional().or(z.literal("")),
  panUrl: z.string().url().optional().or(z.literal("")),
  driveUrl: z.string().url().optional().or(z.literal("")),
  onedriveUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  devlog: z.string().max(50000).optional(),
  techStack: z.array(z.string().max(50)).max(20).default([]),
  tagIds: z.array(z.string()).max(10).default([]),
  memberRoles: z
    .array(
      z.object({
        memberId: z.string(),
        role: z.string().max(50),
      })
    )
    .max(50)
    .default([]),
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
  githubUrl: z.string().url().optional().or(z.literal("")),
  itchUrl: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
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
    .enum(["STEAM", "INDIE", "GAME_JAM", "DEMO", "PROTOTYPE", "GRADUATION", "OTHER"])
    .optional(),
  tag: z.string().optional(),
  year: z.coerce.number().int().optional(),
  featured: z.coerce.boolean().optional(),
});
