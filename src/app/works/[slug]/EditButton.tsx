"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { canEditProject } from "@/lib/auth/rbac";

export default function EditButton({ slug, submitterId }: { slug: string; submitterId: string }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as string | undefined;
  const userId = session?.user?.id;

  if (!userId) return null;

  const editable = canEditProject(userRole as any, userId, submitterId);
  if (!editable) return null;

  return (
    <div className="flex gap-2 mb-6">
      <Link
        href={`/works/${slug}/edit`}
        className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        style={{ background: "#25547A", color: "#fff" }}
      >
        ✏️ 编辑作品
      </Link>
    </div>
  );
}
