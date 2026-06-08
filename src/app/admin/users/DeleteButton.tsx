"use client";
import { deleteUser } from "./actions";

export default function DeleteButton({ userId, userName }: { userId: string; userName: string }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm(`确认删除用户「${userName}」？此操作不可撤销。`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteUser.bind(null, userId)} className="inline">
      <button
        type="submit"
        onClick={handleClick}
        className="text-xs hover:underline cursor-pointer"
        style={{ color: "#C62828" }}
      >
        删除
      </button>
    </form>
  );
}
