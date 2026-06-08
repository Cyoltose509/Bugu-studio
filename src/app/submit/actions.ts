"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { isMemberOrAbove } from "@/lib/auth/rbac";
import { projectCreateSchema, linkEntrySchema } from "@/lib/validations";
import { generateSlug } from "@/lib/utils";
import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/db/cache";
import { z } from "zod";

function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; }
  catch { return fallback; }
}

export async function submitProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "请先登录" };

  if (!isMemberOrAbove(session.user.role as any)) {
    return { success: false, error: "仅社团成员可提交作品" };
  }

  // ── 基础字段 ──
  const developYear = parseInt(formData.get("developYear") as string);

  // ── 动态链接（JSON） ──
  const links = safeJsonParse<{ label: string; url: string }[]>(
    formData.get("links") as string | null,
    []
  ).filter((l) => l.label && l.url);

  // ── 自定义标签 ──
  const customTags = safeJsonParse<string[]>(
    formData.get("customTags") as string | null,
    []
  ).filter(Boolean).slice(0, 10);

  // ── 成员-角色（JSON） ──
  const memberRoles = safeJsonParse<{ memberId: string; role: string }[]>(
    formData.get("memberRoles") as string | null,
    []
  ).filter((m) => m.memberId).slice(0, 50);

  // ── 已有标签 ID ──
  const tagIdsStr = (formData.get("tagIds") as string) || "";
  const tagIds = tagIdsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  // ── 组装数据 ──
  const data = {
    title: (formData.get("title") as string) || "",
    subtitle: (formData.get("subtitle") as string) || undefined,
    description: (formData.get("description") as string) || "",
    type: (formData.get("type") as string) || "",
    developYear: isNaN(developYear) ? new Date().getFullYear() : developYear,
    coverImage: (formData.get("coverImage") as string) || undefined,
    links,
    tagIds,
    customTags,
    memberRoles,
  };

  // ── Zod 校验 ──
  const parsed = projectCreateSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return { success: false, error: msg };
  }

  // ── 关联数据校验 ──
  // 成员必须真实存在（仅对 memberId 不为空的条目校验）
  const memberIds = parsed.data.memberRoles
    .filter((m) => m.memberId)
    .map((m) => m.memberId as string);
  if (memberIds.length > 0) {
    const existingMembers = await prisma.clubMember.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingMembers.map((m) => m.id));
    const invalid = memberIds.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      return { success: false, error: `以下成员不存在: ${invalid.join(", ")}` };
    }
  }

  // 已有标签必须存在
  if (tagIds.length > 0) {
    const existingTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });
    const existingTagIds = new Set(existingTags.map((t) => t.id));
    const invalid = tagIds.filter((id) => !existingTagIds.has(id));
    if (invalid.length > 0) {
      return { success: false, error: `以下标签不存在: ${invalid.join(", ")}` };
    }
  }

  // ── 生成唯一 slug ──
  let slug = generateSlug(parsed.data.title);
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  // ── 创建自定义标签 ──
  const customTagRecords: { id: string }[] = [];
  for (const name of parsed.data.customTags) {
    const tagSlug = generateSlug(name);
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: tagSlug, color: "#88C232" },
      select: { id: true },
    });
    customTagRecords.push(tag);
  }

  // ── 合并所有标签 ID ──
  const allTagIds = [
    ...tagIds,
    ...customTagRecords.map((t) => t.id),
  ];

  // ── 成员-角色关联 + 自动添加提交者本人 ──
  const finalMemberRoles = [...parsed.data.memberRoles];
  // 自动将提交者关联的 ClubMember 加入成员列表（如果还未包含）
  if (session.user.id) {
    const submitterMember = await prisma.clubMember.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (submitterMember && !finalMemberRoles.some((m) => m.memberId === submitterMember.id)) {
      finalMemberRoles.push({ memberId: submitterMember.id, role: "制作" });
    }
  }

  // ── 写入数据库 ──
  await prisma.project.create({
    data: {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description,
      slug,
      type: parsed.data.type as any,
      developYear: parsed.data.developYear,
      coverImage: parsed.data.coverImage || null,
      status: ProjectStatus.PENDING,
      submitterId: session.user.id,
      submittedAt: new Date(),
      // 动态链接
      links: {
        create: parsed.data.links.map((l, i) => ({
          label: l.label,
          url: l.url,
          sortOrder: i,
        })),
      },
      // 标签关联
      tags: {
        create: allTagIds.map((tagId) => ({ tagId })),
      },
      // 成员-角色关联
      members: {
        create: finalMemberRoles.map((m) => ({
          memberId: m.memberId || null,
          externalName: m.memberId ? null : (m.externalName || null),
          role: m.role,
        })),
      },
    },
  });

  // ── 清除相关缓存 & 触发页面刷新 ──
  await invalidateCache("members:all");
  for (const m of finalMemberRoles) {
    if (m.memberId) await invalidateCache(`member:detail:${m.memberId}`);
  }
  revalidatePath("/submit");
  revalidatePath("/works");
  revalidatePath("/members");
  return { success: true };
}
