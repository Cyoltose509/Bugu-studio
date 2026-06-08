import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";
import { Metadata } from "next";

export const metadata: Metadata = { title: "通知设置 | 布谷工作室" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const member = await prisma.clubMember.findFirst({
    where: { userId: session.user.id },
    select: { id: true, notifyNewProjects: true },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold mb-8" style={{ color: "#25547A" }}>通知设置</h1>

      <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
        <h2 className="font-semibold mb-1" style={{ color: "#333" }}>作品上新通知</h2>
        <p className="text-xs mb-4" style={{ color: "#777" }}>
          开启后，社团有新作品发布时将收到通知
        </p>
        <SettingsForm
          notifyNewProjects={member?.notifyNewProjects ?? false}
        />
      </div>
    </div>
  );
}
