"use client";
import { useState } from "react";
import { deleteMember } from "@/app/admin/members/actions";

export default function DeleteMemberButton({ memberId }: { memberId: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!confirm("确认删除此成员？关联用户不会被删除。")) return;
    setDeleting(true);
    try {
      await deleteMember(memberId);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={deleting}
      className={`text-xs hover:underline transition-all ${deleting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ color: deleting ? "#999" : "#C62828" }}
    >
      {deleting ? "删除中..." : "删除"}
    </button>
  );
}
