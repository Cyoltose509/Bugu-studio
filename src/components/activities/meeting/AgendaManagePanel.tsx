"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import MeetingTalksEditor, {
  type TalkDraft,
} from "@/components/activities/meeting/MeetingTalksEditor";
import AgendaTimeline, {
  type AgendaTimelineItem,
} from "@/components/activities/meeting/AgendaTimeline";
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

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="mx-auto block">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
  canAddAgenda = false,
  addLabel,
  addMode = "panel",
  addPanel,
  timelineItems,
  title,
}: {
  activityId: string;
  initialTalks: TalkDraft[];
  unlistedProposals?: UnlistedProposal[];
  isAdmin?: boolean;
  /** 报名/新增窗口开启时，所有角色都能看到 ＋ */
  canAddAgenda?: boolean;
  addLabel?: string;
  /**
   * "form"：点 ＋ 先弹下拉选 分享/展示，选完在议程序列尾部追加填写卡；
   * "panel"：点 ＋ 直接展开 addPanel（登录引导 / 已提交状态卡）。
   */
  addMode?: "form" | "panel";
  addPanel?: ReactNode;
  /** 议程时间轴数据；缺省且无草稿时不渲染时间轴 */
  timelineItems?: AgendaTimelineItem[];
  title: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<"SHARE" | "SHOWCASE" | null>(null);
  const editorKey = initialTalks.map((tk) => tk.id || "").join(",");
  const manageLabel = open ? t("activityDetail.exitManage") : t("activityDetail.enterManage");
  const plusLabel = addLabel ?? t("meeting.addAgenda");

  // 下拉菜单点外部关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest("[data-add-menu]")) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  function chooseDraftType(type: "SHARE" | "SHOWCASE") {
    setDraft(type);
    setMenuOpen(false);
  }

  const showTimeline = Boolean(timelineItems?.length || draft);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-brand-navy">{title}</h2>
        <span className="relative flex shrink-0 items-center gap-2" data-add-menu>
          {canAddAgenda && (
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setMenuOpen((v) => !v);
              }}
              title={plusLabel}
              aria-label={plusLabel}
              aria-expanded={menuOpen}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors ${
                menuOpen || draft ? "bg-brand-orange" : "bg-brand-blue hover:bg-brand-blue/90"
              }`}
            >
              <PlusIcon />
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setOpen((v) => !v);
              }}
              title={manageLabel}
              aria-label={manageLabel}
              aria-pressed={open}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors ${
                open ? "bg-brand-orange" : "bg-brand-navy hover:bg-brand-navy/90"
              }`}
            >
              <PencilIcon />
            </button>
          )}

          {menuOpen && canAddAgenda && addMode === "form" ? (
            <div
              role="menu"
              aria-label={plusLabel}
              className="absolute right-0 top-full z-30 mt-1.5 w-40 rounded-xl border border-brand-border-subtle bg-card p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => chooseDraftType("SHARE")}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-text-heading transition-colors hover:bg-brand-surface"
              >
                <AgendaTypeTag type="SHARE" label={t("activityDetail.proposalShare")} />
                <span className="min-w-0 flex-1 truncate">{t("activityDetail.proposalShare")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => chooseDraftType("SHOWCASE")}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-text-heading transition-colors hover:bg-brand-surface"
              >
                <AgendaTypeTag type="SHOWCASE" label={t("activityDetail.proposalShowcase")} />
                <span className="min-w-0 flex-1 truncate">{t("activityDetail.proposalShowcase")}</span>
              </button>
            </div>
          ) : null}
        </span>
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
      {addOpen && canAddAgenda && addMode === "panel" && addPanel ? (
        <div className="mb-3 rounded-xl border border-brand-border-subtle bg-card px-3.5 py-3">
          {addPanel}
        </div>
      ) : null}
      {open ? null : showTimeline ? (
        <AgendaTimeline
          items={timelineItems ?? []}
          activityId={activityId}
          isAdmin={isAdmin}
          draft={draft}
          onDraftDone={() => setDraft(null)}
        />
      ) : null}
    </section>
  );
}
