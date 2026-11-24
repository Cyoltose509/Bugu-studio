import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import OnboardingWizard from "@/components/profile/OnboardingWizard";

export const metadata: Metadata = {
  title: "完善社团名片",
  description: "快速设置本科入学年份、职能方向、头像与简介",
};

export const dynamic = "force-dynamic";

const COOLDOWN_MS = 7 * 24 * 3600 * 1000;

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Fonboarding");
  }

  const [dbUser, member] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        bio: true,
        image: true,
        avatarChangedAt: true,
      },
    }),
    prisma.clubMember.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        displayName: true,
        grade: true,
        graduated: true,
        skills: true,
        bio: true,
      },
    }),
  ]);

  if (!dbUser) {
    redirect("/auth/login?callbackUrl=%2Fonboarding");
  }

  let canChangeAvatar = true;
  let avatarCooldownDays = 0;
  if (dbUser.avatarChangedAt) {
    const elapsed = Date.now() - dbUser.avatarChangedAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      canChangeAvatar = false;
      avatarCooldownDays = Math.ceil((COOLDOWN_MS - elapsed) / 86400000);
    }
  }

  return (
    <OnboardingWizard
      user={{
        id: dbUser.id,
        name: dbUser.name || session.user.name || "新成员",
        image: dbUser.image,
        bio: dbUser.bio,
      }}
      member={member}
      canChangeAvatar={canChangeAvatar}
      avatarCooldownDays={avatarCooldownDays}
    />
  );
}
