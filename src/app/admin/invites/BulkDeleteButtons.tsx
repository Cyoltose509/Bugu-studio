"use client";

import { useTransition } from "react";

interface Props {
  invalidCount: number;
  totalCount: number;
  deleteInvalidAction: () => Promise<number>;
  deleteAllAction: () => Promise<number>;
}

export default function BulkDeleteButtons({ invalidCount, totalCount, deleteInvalidAction, deleteAllAction }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleDeleteInvalid = () => {
    if (!confirm(`确定要删除 ${invalidCount} 个无效邀请码吗？此操作不可撤销。`)) return;
    startTransition(async () => {
      const n = await deleteInvalidAction();
      alert(`已删除 ${n} 个无效邀请码`);
    });
  };

  const handleDeleteAll = () => {
    if (!confirm(`⚠️ 确定要删除全部 ${totalCount} 个邀请码吗？此操作不可撤销！`)) return;
    if (!confirm("请再次确认：真的要删除全部邀请码吗？")) return;
    startTransition(async () => {
      const n = await deleteAllAction();
      alert(`已删除全部 ${n} 个邀请码`);
    });
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border-subtle bg-[#FFF9F0]">
      <span className="text-xs text-brand-text-secondary">
        共 {totalCount} 个邀请码，其中 {invalidCount} 个无效
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDeleteInvalid}
          disabled={isPending || invalidCount === 0}
          className="px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-brand-orange text-brand-orange bg-transparent"
        >
          删除无效
        </button>
        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={isPending || totalCount === 0}
          className="px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-[var(--ui-text-red)] text-[var(--ui-text-red)] bg-transparent"
        >
          全部删除
        </button>
      </div>
    </div>
  );
}
