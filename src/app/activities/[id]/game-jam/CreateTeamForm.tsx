"use client";

import { useRef, useState, useTransition } from "react";
import { createTeam } from "./actions";

export function CreateTeamForm({ activityId }: { activityId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await createTeam(activityId, formData);
      if (result.error) {
        setFeedback({ type: "error", msg: result.error });
      } else {
        setFeedback({ type: "success", msg: "队伍创建成功！" });
        formRef.current?.reset();
        // 延迟关闭，让用户看到成功提示
        setTimeout(() => {
          if (detailsRef.current) detailsRef.current.open = false;
          setFeedback(null);
        }, 1500);
      }
    });
  }

  return (
    <details className="group" ref={detailsRef}>
      <summary className="text-sm px-4 py-2 rounded-lg border cursor-pointer list-none" style={{ borderColor: "#D0DEE8", color: "#555" }}>
        创建队伍
      </summary>
      <form ref={formRef} action={handleSubmit} className="mt-3 space-y-2">
        <input name="name" placeholder="队伍名称（1-30字）" maxLength={30} required
          disabled={isPending}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "#D0DEE8" }} />
        {feedback && (
          <p className={`text-xs ${feedback.type === "success" ? "text-green-600" : "text-red-500"}`}
            style={{ color: feedback.type === "success" ? "#16a34a" : "#EF4444" }}>
            {feedback.msg}
          </p>
        )}
        <button type="submit" disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "#E38043" }}>
          {isPending ? "创建中…" : "创建"}
        </button>
      </form>
    </details>
  );
}
