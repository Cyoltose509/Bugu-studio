"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { invalidateCache } from "@/lib/db/cache";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const onboardingSchema = z.object({
  grade: z.coerce.number().int().min(2000).max(2100).optional(),
  graduated: z.boolean().optional(),
  skills: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
  bio: z.string().trim().max(500).optional(),
});

export async function completeOnboarding(input: {
  grade?: number | null;
  graduated?: boolean;
  skills?: string[];
  bio?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "请先登录" };
  }

  const parsed = onboardingSchema.safeParse({
    grade: input.grade ?? undefined,
    graduated: input.graduated,
    skills: input.skills,
    bio: input.bio,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "提交信息格式有误" };
  }

  const { grade, graduated, skills, bio } = parsed.data;
  const userId = session.user.id;

  const member = await prisma.clubMember.findUnique({
    where: { userId },
    select: { id: true },
  });

  const cleanBio = bio !== undefined ? (bio.trim() || null) : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(cleanBio !== undefined ? { bio: cleanBio } : {}),
    },
  });

  if (member) {
    await prisma.clubMember.update({
      where: { id: member.id },
      data: {
        ...(grade !== undefined ? { grade } : {}),
        ...(graduated !== undefined ? { graduated } : {}),
        ...(skills !== undefined ? { skills } : {}),
        ...(cleanBio !== undefined ? { bio: cleanBio } : {}),
      },
    });
  }

  const cacheTasks = [
    invalidateCache(`profile:user:${userId}`),
    invalidateCache(`profile:member:${userId}`),
    invalidateCache("members:all"),
    invalidateCache("api:members:"),
  ];
  if (member) {
    cacheTasks.push(
      invalidateCache(`member:meta:${member.id}`),
      invalidateCache(`member:detail:${member.id}`),
    );
  }
  await Promise.all(cacheTasks);

  revalidatePath("/profile");
  revalidatePath("/members");
  revalidatePath("/");

  return { success: true };
}
