"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const linkEntrySchema = z.object({
  label: z.string().min(1, "链接标签不能为空").max(50),
  url: z.string().url("请输入有效的 URL"),
});

const schema = z.object({
  name: z.string().min(1, "名称不能为空").max(50),
  bio: z.string().max(2000).optional().or(z.literal("")),
  grade: z.string().max(20).optional().or(z.literal("")),
  skills: z.string().max(500).optional().or(z.literal("")),
  socialLinks: z.string().optional().or(z.literal("")),
});

const NAME_CHANGE_DAYS = 7;

export async function saveProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const isAdmin = session.user.role === "ADMIN";

  const raw = {
    name: (formData.get("name") as string) || "",
    bio: (formData.get("bio") as string) || "",
    grade: (formData.get("grade") as string) || "",
    skills: (formData.get("skills") as string) || "",
    socialLinks: (formData.get("socialLinks") as string) || "",
  };

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { name, bio, grade, skills, socialLinks: socialLinksJson } = result.data;

  // 解析链接 JSON
  let socialLinks: { label: string; url: string }[] = [];
  if (socialLinksJson) {
    try {
      const parsed = JSON.parse(socialLinksJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const parsedItem = linkEntrySchema.safeParse(item);
          if (parsedItem.success) socialLinks.push(parsedItem.data);
        }
      }
    } catch { /* ignore malformed JSON */ }
  }

  // ═══ 名称修改速率限制（7 天一次）═══
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, nameChangedAt: true },
  });

  if (name !== dbUser?.name && dbUser?.nameChangedAt) {
    const cooldownEnd = new Date(
      dbUser.nameChangedAt.getTime() + NAME_CHANGE_DAYS * 24 * 3600 * 1000
    );
    if (cooldownEnd > new Date()) {
      const remainingDays = Math.ceil(
        (cooldownEnd.getTime() - Date.now()) / (1000 * 86400)
      );
      return {
        error: `显示名称每 ${NAME_CHANGE_DAYS} 天只能修改一次，还需等待 ${remainingDays} 天`,
      };
    }
  }

  // 更新 User.name
  const userUpdateData: any = { name };
  if (name !== dbUser?.name) {
    userUpdateData.nameChangedAt = new Date();
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: userUpdateData,
  });

  // 更新 ClubMember（如果存在）
  const member = await prisma.clubMember.findUnique({
    where: { userId: session.user.id },
  });

  if (member) {
    // 删除旧链接，重建新链接
    await prisma.memberLink.deleteMany({ where: { memberId: member.id } });

    await prisma.clubMember.update({
      where: { id: member.id },
      data: {
        ...(bio !== undefined && { bio: bio || null }),
        ...(isAdmin && grade !== undefined && { grade: grade || null }),
        ...(skills !== undefined && {
          skills: skills
            ? skills.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        }),
        socialLinks: {
          create: socialLinks.map((l, i) => ({
            label: l.label,
            url: l.url,
            sortOrder: i,
          })),
        },
      },
    });
  }

  revalidatePath("/profile");
  redirect("/profile");
}

/**
 * 兑换邀请码升级身份（独立 Server Action）
 */
export async function redeemInviteCode(inviteCode: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "请先登录" };
  }

  if (!inviteCode?.trim()) {
    return { error: "请输入邀请码" };
  }

  const code = await prisma.inviteCode.findUnique({
    where: { code: inviteCode.trim().toUpperCase() },
  });

  if (!code || !code.isActive) {
    return { error: "邀请码无效" };
  }

  if (code.expiresAt && code.expiresAt < new Date()) {
    return { error: "邀请码已过期" };
  }

  if (code.maxUses && code.usedCount >= code.maxUses) {
    return { error: "邀请码已达使用上限" };
  }

  const targetRole = code.role as "USER" | "MEMBER" | "ADMIN";
  const roleHierarchy: Record<string, number> = { USER: 0, MEMBER: 1, ADMIN: 2 };

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (roleHierarchy[currentUser!.role] >= roleHierarchy[targetRole]) {
    const roleLabels: Record<string, string> = {
      ADMIN: "管理员",
      MEMBER: "社团成员",
      USER: "普通用户",
    };
    return {
      error: `你当前的「${roleLabels[currentUser!.role]}」身份已等于或高于邀请码等级`,
    };
  }

  // 使用邀请码
  await prisma.inviteCode.update({
    where: { id: code.id },
    data: { usedCount: { increment: 1 } },
  });

  // 更新角色
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: targetRole },
  });

  // 同步 ClubMember
  if (targetRole === "MEMBER" || targetRole === "ADMIN") {
    const existing = await prisma.clubMember.findUnique({
      where: { userId: session.user.id },
    });
    if (!existing) {
      await prisma.clubMember.create({
        data: {
          userId: session.user.id,
          displayName: session.user.name ?? "新成员",
          joinYear: new Date().getFullYear(),
        },
      });
    }
  }

  const messages: Record<string, string> = {
    ADMIN: "已升级为管理员",
    MEMBER: "已升级为社团成员",
  };

  return { success: true, role: targetRole, message: messages[targetRole] };
}
