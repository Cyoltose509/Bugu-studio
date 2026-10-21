"use client";

import { useState, useTransition, type ReactNode } from "react";
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

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  isAdmin = false,
  title,
  children,
}: {
  activityId: string;
  initialTalks: TalkDraft[];
  unlistedProposals?: UnlistedProposal[];
  isAdmin?: boolean;
  title: string;
  children?: ReactNode;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const editorKey = initialTalks.map((tk) => tk.id || "").join(",");
  const manageLabel = open ? t("activityDetail.exitManage") : t("activityDetail.enterManage");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-brand-navy">{title}</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title={manageLabel}
            aria-label={manageLabel}
            aria-pressed={open}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors ${
              open ? "bg-brand-orange" : "bg-brand-navy hover:bg-brand-navy/90"
            }`}
          >
            <PencilIcon />
          </button>
        )}
      </div>
      {open && isAdmin && (
        <div className="mb-3 space-y-3">
          {unlistedProposals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-brand-text-secondary">
                {t("meeting.promotePending")}
              </p>
              <ul className="rounded-xl border border-brand-border-subtle bg-card divide-y divide-brand-border-subtle">
                {unlistedProposals.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <AgendaTypeTag
                      type={p.proposalType}
                      label={agendaTypeLabel(
                        p.proposalType,
                        t("activityDetail.proposalShare"),
                        t("activityDetail.proposalShowcase"),
                      )}
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-brand-navy truncate">
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
            framed={false}
          />
        </div>
      )}
      {open ? null : children}
    </section>
  );
}
