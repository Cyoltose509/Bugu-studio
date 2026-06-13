"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTeamTopic } from "@/lib/actions/teams";

export default function EditTopicForm({
  teamId,
  activityId,
  currentTopic,
}: {
  teamId: string;
  activityId: string;
  currentTopic: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [topic, setTopic] = useState(currentTopic || "");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // 当父组件传下新值时同步
  useEffect(() => {
    setTopic(currentTopic || "");
  }, [currentTopic]);

  return (
    <form
      ref={ref}
      action={async (formData) => {
        setFeedback(null);
        startTransition(async () => {
          const result = await setTeamTopic(teamId, activityId, formData);
          if (result.error) {
            setFeedback({ type: "error", msg: result.error });
          } else {
            // 立即更新本地状态 + 触发页面刷新
            if (result.topic) setTopic(result.topic);
            router.refresh();
            setFeedback({ type: "success", msg: "讲题已更新" });
            setTimeout(() => setFeedback(null), 2000);
          }
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        name="topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="输入讲题…"
        maxLength={200}
        className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: "#D0DEE8", color: "#333" }}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg text-white shrink-0 disabled:opacity-50"
        style={{ background: "#3388BB" }}
      >
        {pending ? "保存中…" : "保存"}
      </button>
      {feedback && (
        <span className={`text-xs shrink-0 ${feedback.type === "success" ? "text-green-600" : "text-red-500"}`}
          style={{ color: feedback.type === "success" ? "#16a34a" : "#EF4444" }}>
          {feedback.msg}
        </span>
      )}
    </form>
  );
}
