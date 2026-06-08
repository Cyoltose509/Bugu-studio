"use client";
import { toggleUserActive } from "./actions";

export default function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm(`确认${isActive ? "停用" : "激活"}该用户？`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={toggleUserActive.bind(null, userId, !isActive)} className="inline">
      <button
        type="submit"
        onClick={handleClick}
        className="text-xs hover:underline cursor-pointer"
        style={{ color: isActive ? "#C62828" : "#88C232" }}
      >
        {isActive ? "停用" : "激活"}
      </button>
    </form>
  );
}
