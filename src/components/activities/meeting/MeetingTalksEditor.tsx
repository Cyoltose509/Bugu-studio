"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveMeetingTalks } from "@/app/admin/activities/actions";
import { parseBvId, bilibiliWatchUrl } from "@/lib/activities/constants";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

export type TalkDraft = {
  id?: string;
  speaker: string;
  title: string;
  talkType?: "SHARE" | "SHOWCASE";
  bvId: string;
  userId?: string | null;
  linkedLabel?: string | null;
  clientKey?: string;
};

type UserHit = {
  id: string;
  name: string | null;
  image: string | null;
  member?: { id: string; displayName: string } | null;
};

type Props = {
  activityId: string;
  initialTalks?: TalkDraft[];
  /** 嵌在活动编辑总表单里：不自带保存，写入 talksJson */
  embedded?: boolean;
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `talk-${keySeq}`;
}

function emptyTalk(): TalkDraft {
  return { clientKey: nextKey(), speaker: "", title: "", talkType: "SHARE", bvId: "", userId: null, linkedLabel: null };
}

function withKey(talk: TalkDraft): TalkDraft {
  return { ...talk, clientKey: talk.clientKey || talk.id || nextKey() };
}

function displayNameOf(u: UserHit, fallback: string): string {
  return u.member?.displayName || u.name || fallback;
}

function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden fill="currentColor">
      <circle cx="3.5" cy="3" r="1.25" />
      <circle cx="8.5" cy="3" r="1.25" />
      <circle cx="3.5" cy="8" r="1.25" />
      <circle cx="8.5" cy="8" r="1.25" />
      <circle cx="3.5" cy="13" r="1.25" />
      <circle cx="8.5" cy="13" r="1.25" />
    </svg>
  );
}

export default function MeetingTalksEditor({ activityId, initialTalks = [], embedded = false }: Props) {
  const { lang } = useLang();
  const router = useRouter();
  const [talks, setTalks] = useState<TalkDraft[]>(
    (initialTalks.length > 0 ? initialTalks : [emptyTalk()]).map(withKey),
  );
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [results, setResults] = useState<UserHit[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bvOpen, setBvOpen] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(i: number, patch: Partial<TalkDraft>) {
    setTalks((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function moveTo(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setTalks((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setBvOpen(null);
    setShowDropdown(false);
    setActiveSearch(null);
  }

  const searchUsers = useCallback(async (q: string) => {
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}&includeGraduated=1`,
      );
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      const list: UserHit[] = Array.isArray(data) ? data : data.data || [];
      setResults(list);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveSearch(null);
        setBvOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function onSpeakerChange(i: number, value: string) {
    update(i, {
      speaker: value,
      userId: null,
      linkedLabel: null,
    });
    setActiveSearch(i);
    setShowDropdown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchUsers(value.trim()), 200);
  }

  function linkUser(i: number, user: UserHit) {
    const name = displayNameOf(user, t(lang, "meetingTalks.unnamedUser"));
    update(i, {
      speaker: name,
      userId: user.id,
      linkedLabel: user.member
        ? t(lang, "meetingTalks.linkedMember", { name: user.member.displayName })
        : t(lang, "meetingTalks.linkedUser", { name: user.name || user.id.slice(0, 8) }),
    });
    setShowDropdown(false);
    setActiveSearch(null);
    setResults([]);
  }

  function clearLink(i: number) {
    update(i, { userId: null, linkedLabel: null });
  }

  function talksPayload() {
    return talks.map((row) => ({
      speaker: row.speaker.trim(),
      title: row.title.trim(),
      talkType: row.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
      bvId: row.bvId,
      userId: row.userId || null,
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (embedded) return;
    setMessage(null);
    startTransition(async () => {
      const payload = talksPayload().filter((row) => row.speaker || row.title);

      const result = await saveMeetingTalks(activityId, payload);
      if (result?.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      setMessage({ type: "ok", text: t(lang, "meetingTalks.saved") });
      router.refresh();
      if (result?.talks) {
        setTalks(
          result.talks.length > 0
            ? result.talks.map((tk) =>
                withKey({
                  id: tk.id,
                  speaker: tk.speaker,
                  title: tk.title,
                  talkType: tk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
                  bvId: tk.bvId || "",
                  userId: tk.userId || null,
                  linkedLabel: tk.userId
                    ? tk.user?.member
                      ? t(lang, "meetingTalks.linkedMember", { name: tk.user.member.displayName })
                      : t(lang, "meetingTalks.linkedUser", { name: tk.user?.name || tk.userId })
                    : null,
                }),
              )
            : [emptyTalk()],
        );
      }
    });
  }

  const field =
    "w-full rounded-lg border px-3 py-2 text-sm border-brand-border-subtle text-brand-text-heading bg-card placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

  const body = (
    <>
      {embedded && (
        <input type="hidden" name="talksJson" value={JSON.stringify(talksPayload())} />
      )}
      <h2 className="text-lg font-semibold text-brand-navy">{t(lang, "meetingTalks.title")}</h2>

      <div className="space-y-2" ref={searchBoxRef}>
        {talks.map((talk, i) => {
          const type = talk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE";
          const parsedBv = parseBvId(talk.bvId);
          const hasBv = !!parsedBv;
          const draggingOver = dragOver === i;

          return (
            <div
              key={talk.clientKey}
              onDragOver={(e) => {
                if (dragFrom.current == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== i) setDragOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                dragFrom.current = null;
                setDragOver(null);
                if (from == null) return;
                moveTo(from, i);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragOver(null);
              }}
              className={`rounded-xl px-2.5 py-2.5 sm:px-3 sm:py-3 transition-colors ${
                draggingOver
                  ? "bg-brand-blue/10 ring-1 ring-brand-blue/40"
                  : "bg-black/[0.035] dark:bg-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.09]"
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    dragFrom.current = i;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                    setBvOpen(null);
                    setShowDropdown(false);
                  }}
                  title={t(lang, "meetingTalks.dragHandle")}
                  aria-label={t(lang, "meetingTalks.dragHandle")}
                  className="mt-1.5 shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-text-heading hover:bg-card cursor-grab active:cursor-grabbing"
                >
                  <GripIcon />
                </button>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="inline-flex rounded-lg p-0.5 border border-brand-border-subtle bg-card"
                      role="group"
                      aria-label={t(lang, "meetingTalks.type")}
                    >
                      <button
                        type="button"
                        onClick={() => update(i, { talkType: "SHARE" })}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          type === "SHARE"
                            ? "bg-brand-blue/12 text-brand-blue"
                            : "text-brand-text-muted hover:text-brand-text-heading"
                        }`}
                      >
                        {t(lang, "activityDetail.proposalShare")}
                      </button>
                      <button
                        type="button"
                        onClick={() => update(i, { talkType: "SHOWCASE" })}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          type === "SHOWCASE"
                            ? "bg-brand-orange/12 text-brand-orange"
                            : "text-brand-text-muted hover:text-brand-text-heading"
                        }`}
                      >
                        {t(lang, "activityDetail.proposalShowcase")}
                      </button>
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setBvOpen(bvOpen === i ? null : i)}
                          title={t(lang, "meetingTalks.bvToggle")}
                          aria-label={t(lang, "meetingTalks.bvToggle")}
                          aria-expanded={bvOpen === i}
                          className={`relative w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${
                            hasBv
                              ? "border-[#00A1D6]/35 bg-[#00A1D6]/10"
                              : "border-brand-border-subtle hover:bg-card"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/links/bilibili.png"
                            alt=""
                            width={16}
                            height={16}
                            className={`object-contain ${hasBv ? "opacity-100" : "opacity-70"}`}
                          />
                          {hasBv && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00A1D6]" />
                          )}
                        </button>
                        {bvOpen === i && (
                          <div className="absolute right-0 top-full mt-1.5 z-30 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-brand-border-subtle bg-card p-2 shadow-lg">
                            <div className="flex items-center gap-1.5">
                              <input
                                autoFocus
                                value={talk.bvId}
                                onChange={(e) => update(i, { bvId: e.target.value })}
                                placeholder={t(lang, "meetingTalks.bvPlaceholder")}
                                className={field}
                              />
                              {hasBv && (
                                <a
                                  href={bilibiliWatchUrl(parsedBv)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={t(lang, "meetingTalks.bvOpen")}
                                  aria-label={t(lang, "meetingTalks.bvOpen")}
                                  className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/10"
                                >
                                  ↗
                                </a>
                              )}
                              {talk.bvId && (
                                <button
                                  type="button"
                                  onClick={() => update(i, { bvId: "" })}
                                  title={t(lang, "meetingTalks.bvClear")}
                                  className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-brand-text-muted hover:text-brand-text-heading hover:bg-brand-surface"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTalks((prev) =>
                            prev.length <= 1 ? [emptyTalk()] : prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-brand-text-muted hover:text-red-500 hover:bg-red-500/8 transition-colors"
                        aria-label={t(lang, "meetingTalks.remove")}
                        title={t(lang, "meetingTalks.remove")}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <input
                        value={talk.speaker}
                        onChange={(e) => onSpeakerChange(i, e.target.value)}
                        onFocus={() => {
                          setActiveSearch(i);
                          setShowDropdown(true);
                          searchUsers(talk.speaker.trim());
                        }}
                        placeholder={t(lang, "meetingTalks.speakerPlaceholder")}
                        className={field}
                        autoComplete="off"
                      />
                      {showDropdown && activeSearch === i && results.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto border-brand-border-subtle">
                          {results.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => linkUser(i, u)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-surface flex items-center gap-2 transition-colors"
                            >
                              {u.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.image}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0 bg-brand-orange">
                                  {displayNameOf(u, t(lang, "meetingTalks.unnamedUser"))[0]}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block text-brand-text-heading truncate">
                                  {displayNameOf(u, t(lang, "meetingTalks.unnamedUser"))}
                                </span>
                                {u.member ? (
                                  <span className="text-[10px] text-brand-text-muted">{t(lang, "role.member")}</span>
                                ) : (
                                  <span className="text-[10px] text-brand-text-muted">{t(lang, "meetingTalks.siteUser")}</span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      value={talk.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                      placeholder={t(lang, "meetingTalks.topicPlaceholder")}
                      className={`${field} sm:col-span-2`}
                    />
                  </div>

                  {(talk.userId || talk.linkedLabel) && (
                    <div className="flex items-center gap-2 text-xs text-brand-blue">
                      <span>{talk.linkedLabel || t(lang, "meetingTalks.linkedSiteUser")}</span>
                      <button
                        type="button"
                        onClick={() => clearLink(i)}
                        className="underline text-brand-text-muted"
                      >
                        {t(lang, "meetingTalks.unlink")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTalks((prev) => [...prev, emptyTalk()])}
          className="btn-secondary px-4 py-2 rounded-lg text-sm"
        >
          {t(lang, "meetingTalks.addRow")}
        </button>
        {!embedded && (
          <SubmitButton
            type="submit"
            disabled={pending}
            className="btn-primary px-5 py-2 rounded-lg text-sm font-medium"
            pendingText={t(lang, "common.saving")}
          >
            {t(lang, "meetingTalks.save")}
          </SubmitButton>
        )}
        {message && (
          <span
            className={`text-sm ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600"}`}
          >
            {message.text}
          </span>
        )}
      </div>
    </>
  );

  const shell = "bg-card rounded-xl border p-5 sm:p-6 space-y-4 shadow-sm border-brand-border-subtle";
  if (embedded) return <section className={shell}>{body}</section>;
  return <form onSubmit={onSubmit} className={shell}>{body}</form>;
}
