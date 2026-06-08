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

  const [user, member] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, image: true },
    }),
    prisma.clubMember.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        grade: true,
        skills: true,
        githubUrl: true,
        itchUrl: true,
        website: true,
      },
    }),
  ]);

  // user 不可能为 null（session 中的 id 一定存在），但做防御性检查
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#25547A" }}>编辑个人资料</h1>
      <EditForm user={user} member={member} isAdmin={isAdmin} />
    </div>
  );
}
