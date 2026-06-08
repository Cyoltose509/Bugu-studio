"use client";
import { deleteProject } from "./actions";

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm("确认删除此作品？此操作不可撤销。")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteProject.bind(null, projectId)} className="inline">
      <button type="submit" onClick={handleClick}
        className="text-xs hover:underline cursor-pointer" style={{ color: "#C62828" }}>
        删除
      </button>
    </form>
  );
}
