"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MeetingTalksEditor, {
  type TalkDraft,
} from "@/components/activities/meeting/MeetingTalksEditor";
import { AgendaTypeTag, agendaTypeLabel } from "@/components/activities/meeting/AgendaRow";
import { promoteProposalToAgenda } from "@/app/admin/activities/actions";
import { useLang } from "@/lib/i18n/LangProvider";

export type UnlistedProposal = {
  id: string;
  title: string;
  speaker: string;
  proposalType: "SHARE" | "SHOWCASE";
};

function PromoteButton({ proposalId }: { proposalId: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="shrink-0 inline-flex items-center gap-2">
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await promoteProposalToAgenda(proposalId);
            if (result && "error" in result && result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className="text-xs px-2.5 py-1 rounded-lg text-white bg-brand-blue disabled:opacity-60"
      >
        {pending ? t("common.processing") : t("meeting.promoteToAgenda")}
      </button>
    </span>
  );
}

export default function AgendaManagePanel({
  activityId,
  initialTalks,
  unlistedProposals = [],
}: {
  activityId: string;
  initialTalks: TalkDraft[];
  unlistedProposals?: UnlistedProposal[];
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const editorKey = initialTalks.map((tk) => tk.id || "").join(",");

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          open
            ? "border-brand-orange text-brand-orange bg-[#FFF8F0]"
            : "border-brand-border-subtle text-brand-navy hover:border-brand-blue hover:text-brand-blue"
        }`}
      >
        {open ? t("activityDetail.exitManage") : t("activityDetail.enterManage")}
      </button>
      {open && (
        <div className="space-y-3">
          {unlistedProposals.length > 0 && (
            <div className="rounded-xl border border-brand-border-subtle bg-card p-3 space-y-2">
              <p className="text-xs font-medium text-brand-text-secondary">
                {t("meeting.promotePending")}
              </p>
              <ul className="space-y-2">
                {unlistedProposals.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <AgendaTypeTag
                      type={p.proposalType}
                      label={agendaTypeLabel(
                        p.proposalType,
                        t("activityDetail.proposalShare"),
                        t("activityDetail.proposalShowcase"),
                      )}
                    />
                    <span className="min-w-0 flex-1 text-sm text-brand-navy truncate">
                      {p.title}
                    </span>
                    <span className="text-xs text-brand-text-muted shrink-0 truncate max-w-[7rem]">
                      {p.speaker}
                    </span>
                    <PromoteButton proposalId={p.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <MeetingTalksEditor
            key={editorKey}
            activityId={activityId}
            initialTalks={initialTalks}
          />
        </div>
      )}
    </div>
  );
}
