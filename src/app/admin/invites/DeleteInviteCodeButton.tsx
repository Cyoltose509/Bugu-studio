"use client";
import { deleteInviteCode } from "./actions";

export default function DeleteInviteCodeButton({ codeId }: { codeId: string }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm("确认删除此邀请码？")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteInviteCode.bind(null, codeId)} className="inline">
      <button type="submit" onClick={handleClick}
        className="text-xs hover:underline cursor-pointer" style={{ color: "#C62828" }}>
        删除
      </button>
    </form>
  );
}
