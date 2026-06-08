"use client";
import { deleteMember } from "./actions";

export default function DeleteMemberButton({ memberId }: { memberId: string }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm("确认删除此成员？关联用户不会被删除。")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteMember.bind(null, memberId)} className="inline">
      <button type="submit" onClick={handleClick}
        className="text-xs hover:underline cursor-pointer" style={{ color: "#C62828" }}>
        删除
      </button>
    </form>
  );
}
