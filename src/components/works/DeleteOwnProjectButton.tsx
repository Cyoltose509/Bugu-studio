"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteOwnProject } from "@/app/works/actions";

export default function DeleteOwnProjectButton({
  projectId,
  submitterId,
}: {
  projectId: string;
  submitterId: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === "ADMIN";

  // 只有制作者本人或管理员可以看到删除按钮
  if (!userId || (userId !== submitterId && !isAdmin)) return null;

  async function handleDelete() {
    if (!confirm("确认删除此作品？此操作不可撤销，作品的图片、评论等数据将被永久删除。")) return;

    setDeleting(true);
    try {
      await deleteOwnProject(projectId);
      router.push("/works");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "删除失败");
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--ui-text-red)] text-white"
    >
      {deleting ? "删除中..." : "🗑️ 删除作品"}
    </button>
  );
}
