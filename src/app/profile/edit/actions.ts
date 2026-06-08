"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "名称不能为空").max(50),
  bio: z.string().max(2000).optional().or(z.literal("")),
  grade: z.string().max(20).optional().or(z.literal("")),
  skills: z.string().max(500).optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  itchUrl: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

export async function saveProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const isAdmin = session.user.role === "ADMIN";

  const raw = {
    name: (formData.get("name") as string) || "",
    bio: (formData.get("bio") as string) || "",
    grade: (formData.get("grade") as string) || "",
    skills: (formData.get("skills") as string) || "",
    githubUrl: (formData.get("githubUrl") as string) || "",
    itchUrl: (formData.get("itchUrl") as string) || "",
    website: (formData.get("website") as string) || "",
  };

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { name, bio, grade, skills, githubUrl, itchUrl, website } = result.data;

  // 更新 User.name
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  // 更新 ClubMember（如果存在）
  const member = await prisma.clubMember.findUnique({
    where: { userId: session.user.id },
  });

  if (member) {
    await prisma.clubMember.update({
      where: { id: member.id },
      data: {
        ...(bio !== undefined && { bio: bio || null }),
        // 仅管理员可修改年级
        ...(isAdmin && grade !== undefined && { grade: grade || null }),
        ...(skills !== undefined && {
          skills: skills
            ? skills.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        }),
        githubUrl: githubUrl || null,
        itchUrl: itchUrl || null,
        website: website || null,
      },
    });
  }

  revalidatePath("/profile");
  redirect("/profile");
}
