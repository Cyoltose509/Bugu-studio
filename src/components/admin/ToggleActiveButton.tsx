"use client";
import { useState, useTransition } from "react";
import { toggleUserActive } from "@/app/admin/users/actions";

export default function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(formData: FormData) {
    if (submitted) return;
    setSubmitted(true);
    startTransition(async () => {
      await toggleUserActive(userId, !isActive);
    });
  }

  return (
    <form action={handleSubmit} className="inline">
      <button
        type="submit"
        disabled={pending || submitted}
        className={`text-xs hover:underline cursor-pointer transition-opacity ${(pending || submitted) ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ color: isActive ? "#C62828" : "#88C232" }}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            处理中
          </span>
        ) : isActive ? "停用" : "激活"}
      </button>
    </form>
  );
}
