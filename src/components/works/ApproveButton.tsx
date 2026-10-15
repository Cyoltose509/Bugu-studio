"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { approveProject } from "@/lib/actions/works";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

export default function ApproveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);

  const handleApprove = useCallback(async () => {
    setLoading(true);
    try {
      await approveProject(projectId);
      router.refresh();
    } catch (e: any) {
      alert(e.message || t(lang, "works.approve.failed"));
    } finally {
      setLoading(false);
    }
  }, [projectId, router, lang]);

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 bg-brand-green text-white"
    >
      {loading ? t(lang, "common.processing") : `✅ ${t(lang, "works.approve.button")}`}
    </button>
  );
}
