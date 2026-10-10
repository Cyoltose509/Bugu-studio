"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBaituanActivity } from "@/app/admin/activities/showcase-actions";

export default function CreateBaituanButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <div>
    <button type="button" disabled={pending} className="btn-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
      onClick={() => startTransition(async () => {
        setError("");
        try {
          const result = await createBaituanActivity();
          if (result.error) setError(result.error);
          else router.push(`/admin/activities/${result.id}/edit`);
        } catch { setError("创建失败，请稍后重试"); }
      })}>{pending ? "准备中…" : "10.11 百团招新专页"}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>;
}
