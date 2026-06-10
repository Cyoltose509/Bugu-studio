"use client";

import { useFormStatus } from "react-dom";
import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 加载时显示的文字，默认 "处理中..." */
  pendingText?: string;
};

/**
 * 带加载反馈的提交按钮
 * 必须在 <form> 内部使用（依赖 useFormStatus）
 */
export function SubmitButton({
  children,
  pendingText = "处理中...",
  className = "",
  disabled,
  ...props
}: Props) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      disabled={isDisabled}
      className={`transition-all duration-150 hover:opacity-90 active:scale-[0.98] ${className} ${isDisabled ? "opacity-60 cursor-not-allowed !scale-100" : ""}`}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="animate-spin h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
