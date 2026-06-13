"use client";
import { useState } from "react";
import { deleteProject } from "@/app/admin/projects/actions";

export default function DeleteProjectButton({
  projectId,
  disabled = false,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleClick() {
    if (!confirm("确认删除此作品？此操作不可撤销。")) return;
    setDeleting(true);
    try {
      await deleteProject(projectId);
    } catch {
      setDeleting(false);
    }
  }

  const isDisabled = disabled || deleting;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`text-xs hover:underline cursor-pointer ${
        isDisabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
      style={{ color: "#C62828" }}
    >
      {deleting ? "删除中..." : "删除"}
    </button>
  );
}
