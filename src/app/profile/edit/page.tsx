/**
 * 编辑个人资料
 */

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import EditForm from "./EditForm";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const isAdmin = session.user.role === "ADMIN";

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
        bio: true,
        grade: true,
        skills: true,
        location: true,
        phone: true,
        wechat: true,
        qq: true,
        graduated: true,
        realName: true,
        joinYear: true,
        college: true,
        major: true,
        workLocation: true,
        workPosition: true,
        socialLinks: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  if (!dbUser) redirect("/auth/login");

  // 计算冷却倒计时
  const now = Date.now();
  const COOLDOWN_DAYS = 7;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 3600 * 1000;

  function getCooldown(from: Date | null): { canEdit: boolean; remainingDays: number } {
    if (!from) return { canEdit: true, remainingDays: 0 };
    const elapsed = now - from.getTime();
    if (elapsed >= COOLDOWN_MS) return { canEdit: true, remainingDays: 0 };
    const remaining = COOLDOWN_MS - elapsed;
    return { canEdit: false, remainingDays: Math.ceil(remaining / 86400000) };
  }

  const avatarCooldown = getCooldown(dbUser.avatarChangedAt);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#25547A" }}>编辑个人资料</h1>
      <EditForm
        user={{ id: dbUser.id, name: dbUser.name, bio: dbUser.bio, image: dbUser.image }}
        member={member}
        isAdmin={isAdmin}
        avatarCooldown={avatarCooldown}
      />
    </div>
  );
}
