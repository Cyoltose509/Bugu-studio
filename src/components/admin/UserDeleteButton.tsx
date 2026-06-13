"use client";
import { useState } from "react";
import { deleteUser } from "@/app/admin/users/actions";

export default function DeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!confirm(`确认删除用户「${userName}」？此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      await deleteUser(userId);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={deleting}
      className={`text-xs hover:underline transition-all ${deleting ? "opacity-50 cursor-not-allowed text-brand-text-muted" : "cursor-pointer text-[var(--ui-text-red)]"}`}
    >
      {deleting ? "删除中..." : "删除"}
    </button>
  );
}
