"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { invalidateCache } from "@/lib/db/cache";
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
  memberBio: z.string().max(2000).optional().or(z.literal("")),
  grade: z.coerce.number().int().min(2000).max(2100).optional(),
  skills: z.string().max(500).optional().or(z.literal("")),
  socialLinks: z.string().optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  wechat: z.string().max(50).optional().or(z.literal("")),
  qq: z.string().max(30).optional().or(z.literal("")),
  graduated: z.boolean().optional(),
  realName: z.string().max(50).optional().or(z.literal("")),
  joinYear: z.coerce.number().int().min(2000).max(2100).optional(),
  college: z.string().max(100).optional().or(z.literal("")),
  major: z.string().max(100).optional().or(z.literal("")),
  workLocation: z.string().max(100).optional().or(z.literal("")),
  workPosition: z.string().max(100).optional().or(z.literal("")),
});

export async function saveProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const isAdmin = session.user.role === "ADMIN";

  const raw = {
    name: (formData.get("name") as string) || "",
    bio: (formData.get("bio") as string) || "",
    memberBio: (formData.get("memberBio") as string) || "",
    grade: formData.get("grade") ? Number(formData.get("grade")) : undefined,
    skills: (formData.get("skills") as string) || "",
    socialLinks: (formData.get("socialLinks") as string) || "",
    location: (formData.get("location") as string) || "",
    phone: (formData.get("phone") as string) || "",
    wechat: (formData.get("wechat") as string) || "",
    qq: (formData.get("qq") as string) || "",
    graduated: formData.get("graduated") === "true",
    realName: (formData.get("realName") as string) || undefined,
    joinYear: formData.get("joinYear") ? Number(formData.get("joinYear")) : undefined,
    college: (formData.get("college") as string) || undefined,
    major: (formData.get("major") as string) || undefined,
    workLocation: (formData.get("workLocation") as string) || undefined,
    workPosition: (formData.get("workPosition") as string) || undefined,
  };

  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error("[saveProfile] Zod errors:", JSON.stringify(result.error.issues, null, 2));
    console.error("[saveProfile] Raw data:", JSON.stringify(raw, null, 2));
    return { error: result.error.errors[0].message };
  }

  const { name, bio, memberBio, grade, skills, socialLinks: socialLinksJson, location, phone, wechat, qq, graduated, realName, joinYear, college, major, workLocation, workPosition } = result.data;

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

  // 并行查询：User 和 ClubMember
  const [dbUser, member] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
    prisma.clubMember.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  // 更新 User（含 bio）
  const userUpdateData: any = { name };
  if (bio !== undefined) userUpdateData.bio = bio || null;
  await prisma.user.update({
    where: { id: session.user.id },
    data: userUpdateData,
  });

  // 更新 ClubMember（如果存在）
  if (member) {
    // 删除旧链接，重建新链接
    await prisma.memberLink.deleteMany({ where: { memberId: member.id } });

    await prisma.clubMember.update({
      where: { id: member.id },
      data: {
        ...(name !== dbUser?.name && { displayName: name }),
        ...(memberBio !== undefined && { bio: memberBio || null }),
        ...(grade !== undefined && { grade }),
        ...(skills !== undefined && {
          skills: skills
            ? skills.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        }),
        ...(location !== undefined && { location: location || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(wechat !== undefined && { wechat: wechat || null }),
        ...(qq !== undefined && { qq: qq || null }),
        ...(graduated !== undefined && { graduated }),
        ...(realName !== undefined && { realName: realName || null }),
        ...(joinYear !== undefined && { joinYear }),
        ...(college !== undefined && { college: college || null }),
        ...(major !== undefined && { major: major || null }),
        ...(workLocation !== undefined && { workLocation: workLocation || null }),
        ...(workPosition !== undefined && { workPosition: workPosition || null }),
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

  // 清除所有相关缓存，确保其他页面立即显示新名称（并行）
  const cacheTasks = [
    invalidateCache(`profile:user:${session.user.id}`),
    invalidateCache(`profile:member:${session.user.id}`),
    invalidateCache("members:all"),
    invalidateCache("project:detail:"),
    invalidateCache("works:"),
    invalidateCache("api:projects:"),
    invalidateCache("history:"),
    invalidateCache("api:members:"),
  ];
  if (member) {
    cacheTasks.push(
      invalidateCache(`member:meta:${member.id}`),
      invalidateCache(`member:detail:${member.id}`),
    );
  }
  await Promise.all(cacheTasks);

  // revalidatePath 非阻塞（fire-and-forget），不等待
  revalidatePath("/profile");
  revalidatePath("/members");
  revalidatePath("/works");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
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

  // 清除 session 缓存，确保 role 立即生效
  (await import("@/lib/auth/auth")).invalidateSessionCache(session.user.id);

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
        },
      });
      await invalidateCache("members:all");
    }
  }

  const messages: Record<string, string> = {
    ADMIN: "已升级为管理员",
    MEMBER: "已升级为社团成员",
  };

  return { success: true, role: targetRole, message: messages[targetRole] };
}
