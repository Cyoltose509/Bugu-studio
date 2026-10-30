"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveMeetingTalks } from "@/app/admin/activities/actions";
import { parseBvId, bilibiliWatchUrl } from "@/lib/activities/constants";
import { SubmitButton } from "@/components/ui/SubmitButton";
import UserAvatar from "@/components/ui/UserAvatar";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { ACCEPT_ATTR, uploadImage } from "@/lib/utils/clientUpload";

export type TalkDraft = {
  id?: string;
  sourceProposalId?: string | null;
  speaker: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  talkType?: "SHARE" | "SHOWCASE";
  bvId: string;
  userId?: string | null;
  linkedLabel?: string | null;
  image?: string | null;
  speakers?: Array<{
    name: string;
    userId?: string | null;
    image?: string | null;
  }>;
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
  /** false：活动详情里对照完成态议程行编辑，不要外框 */
  framed?: boolean;
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `talk-${keySeq}`;
}

function emptyTalk(): TalkDraft {
  return { clientKey: nextKey(), speaker: "", title: "", description: "", imageUrl: "", talkType: "SHARE", bvId: "", userId: null, linkedLabel: null, image: null, speakers: [] };
}

function withKey(talk: TalkDraft): TalkDraft {
  return {
    ...talk,
    speakers: talk.speakers?.length
      ? talk.speakers
      : talk.speaker
        ? [{ name: talk.speaker, userId: talk.userId || null, image: talk.image || null }]
        : [],
    clientKey: talk.clientKey || talk.id || nextKey(),
  };
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

export default function MeetingTalksEditor({ activityId, initialTalks = [], embedded = false, framed = true }: Props) {
  const { lang } = useLang();
  const router = useRouter();
  const [talks, setTalks] = useState<TalkDraft[]>(
    (initialTalks.length > 0 ? initialTalks : [emptyTalk()]).map(withKey),
  );
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [speakerQuery, setSpeakerQuery] = useState("");
  const [results, setResults] = useState<UserHit[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bvOpen, setBvOpen] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
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
    setSpeakerQuery(value);
    setActiveSearch(i);
    setShowDropdown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchUsers(value.trim()), 200);
  }

  function linkUser(i: number, user: UserHit) {
    const name = displayNameOf(user, t(lang, "meetingTalks.unnamedUser"));
    const current = talks[i].speakers || [];
    if (!current.some((speaker) => speaker.userId === user.id)) {
      update(i, { speakers: [...current, { name, userId: user.id, image: user.image }] });
    }
    setShowDropdown(false);
    setActiveSearch(null);
    setSpeakerQuery("");
    setResults([]);
  }

  function addExternalSpeaker(i: number) {
    const name = speakerQuery.trim();
    if (!name) return;
    const current = talks[i].speakers || [];
    if (!current.some((speaker) => !speaker.userId && speaker.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      update(i, { speakers: [...current, { name, userId: null, image: null }] });
    }
    setShowDropdown(false);
    setActiveSearch(null);
    setSpeakerQuery("");
    setResults([]);
  }

  function removeSpeaker(talkIndex: number, speakerIndex: number) {
    update(talkIndex, {
      speakers: (talks[talkIndex].speakers || []).filter((_, index) => index !== speakerIndex),
    });
  }

  async function handleAgendaImage(i: number, file: File) {
    setUploadError("");
    setUploadingImage(i);
    try {
      const result = await uploadImage(file, { endpoint: "/api/upload/cover", type: "proposal" });
      update(i, { imageUrl: result.url });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t(lang, "form.uploadFailed"));
    } finally {
      setUploadingImage(null);
    }
  }

  function talksPayload() {
    return talks.map((row) => {
      const speakers = (row.speakers || [])
        .map((speaker) => ({ name: speaker.name.trim(), userId: speaker.userId || null }))
        .filter((speaker) => speaker.name);
      return {
        id: row.id,
        sourceProposalId: row.sourceProposalId || null,
        speaker: speakers[0]?.name || "",
        title: row.title.trim(),
        description: row.description?.trim() || null,
        imageUrl: row.imageUrl?.trim() || null,
        talkType: (row.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE") as "SHARE" | "SHOWCASE",
        bvId: row.bvId,
        userId: speakers[0]?.userId || null,
        speakers,
      };
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (embedded) return;
    setMessage(null);
    startTransition(async () => {
      const payload = talksPayload().filter((row) => row.speakers.length || row.title);

      // 保存失败（网络抖动、服务端 500 等）只行内提示，绝不让错误冒泡到
      // 路由级错误边界——那会卸载整个编辑器，用户填了一半的内容全丢。
      let result: Awaited<ReturnType<typeof saveMeetingTalks>>;
      try {
        result = await saveMeetingTalks(activityId, payload);
      } catch {
        setMessage({ type: "err", text: t(lang, "meetingTalks.errSaveFailed") });
        return;
      }
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
                  sourceProposalId: tk.sourceProposalId,
                  speaker: tk.speaker,
                  title: tk.title,
                  description: tk.description || "",
                  imageUrl: tk.imageUrl || "",
                  talkType: tk.talkType === "SHOWCASE" ? "SHOWCASE" : "SHARE",
                  bvId: tk.bvId || "",
                  userId: tk.userId || null,
                  image: tk.user?.image || null,
                  speakers: tk.speakers.map((speaker) => ({
                    name: speaker.name,
                    userId: speaker.userId,
                    image: speaker.user?.image || null,
                  })),
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

  const rowListClass = "space-y-2";

  const body = (
    <>
      {embedded && (
        <input type="hidden" name="talksJson" value={JSON.stringify(talksPayload())} />
      )}
      {framed ? (
        <h2 className="text-lg font-semibold text-brand-navy">{t(lang, "meetingTalks.title")}</h2>
      ) : null}

      <div className={rowListClass} ref={searchBoxRef}>
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
              className={`relative grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-brand-border-subtle bg-card p-3 shadow-sm transition-colors ${
                draggingOver ? "border-brand-blue/50 bg-brand-blue/10" : "hover:border-brand-blue/30"
              }`}
            >
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
                className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-text-heading cursor-grab active:cursor-grabbing"
              >
                <GripIcon />
              </button>

              <button
                type="button"
                onClick={() => update(i, { talkType: type === "SHARE" ? "SHOWCASE" : "SHARE" })}
                title={t(lang, "meetingTalks.type")}
                aria-label={t(lang, "meetingTalks.type")}
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                  type === "SHOWCASE" ? "agenda-chip-showcase" : "agenda-chip-share"
                }`}
              >
                {type === "SHOWCASE"
                  ? t(lang, "activityDetail.proposalShowcase")
                  : t(lang, "activityDetail.proposalShare")}
              </button>

              <div className="relative col-start-4 mr-8 shrink-0">
                <button
                  type="button"
                  onClick={() => setBvOpen(bvOpen === i ? null : i)}
                  title={t(lang, "meetingTalks.bvToggle")}
                  aria-label={t(lang, "meetingTalks.bvToggle")}
                  aria-expanded={bvOpen === i}
                  className={`relative w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${
                    hasBv ? "bg-[#00A1D6]/10" : "text-brand-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/links/bilibili.png"
                    alt=""
                    width={14}
                    height={14}
                    className={`object-contain ${hasBv ? "opacity-100" : "opacity-55"}`}
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
                className="absolute right-3 top-3 w-8 h-8 inline-flex items-center justify-center rounded-lg text-xl font-medium text-brand-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label={t(lang, "meetingTalks.remove")}
                title={t(lang, "meetingTalks.remove")}
              >
                ×
              </button>

              <input
                value={talk.title}
                onChange={(e) => update(i, { title: e.target.value })}
                aria-label={t(lang, "meetingTalks.topicPlaceholder")}
                placeholder={t(lang, "meetingTalks.topicPlaceholder")}
                className="col-span-4 block w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-0.5 text-base font-semibold leading-6 text-brand-text-heading placeholder:font-normal placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />

              <div className="relative col-span-4 flex flex-wrap items-center gap-2 border-t border-brand-border-subtle pt-2">
                <span className="mr-1 text-xs font-medium text-brand-text-muted">{t(lang, "meetingTalks.speakers")}</span>
                {(talk.speakers || []).map((speaker, speakerIndex) => (
                  <span key={`${speaker.userId || speaker.name}-${speakerIndex}`} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs ${speaker.userId ? "bg-brand-blue/10 text-brand-blue" : "bg-brand-orange/10 text-brand-orange"}`}>
                    <UserAvatar src={speaker.image} name={speaker.name} size={20} />
                    <span className="max-w-32 truncate">{speaker.name}</span>
                    <button type="button" onClick={() => removeSpeaker(i, speakerIndex)} className="ml-0.5 text-sm leading-none opacity-60 hover:text-red-500 hover:opacity-100" aria-label={`${t(lang, "meetingTalks.removeSpeaker")} ${speaker.name}`}>×</button>
                  </span>
                ))}
                {activeSearch === i ? (
                  <div className="relative min-w-[13rem] flex-1 sm:max-w-sm">
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={speakerQuery}
                        onChange={(e) => onSpeakerChange(i, e.target.value)}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) return;
                          if (event.key === "Escape") { setActiveSearch(null); setShowDropdown(false); }
                          if (event.key === "Enter") { event.preventDefault(); addExternalSpeaker(i); }
                        }}
                        placeholder={t(lang, "meetingTalks.speakerPlaceholder")}
                        className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading placeholder:text-brand-text-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                        autoComplete="off"
                      />
                      <button type="button" disabled={!speakerQuery.trim()} onClick={() => addExternalSpeaker(i)} className="btn-primary shrink-0 rounded-lg px-3 py-2 text-xs disabled:opacity-40">{t(lang, "profile.edit.add")}</button>
                    </div>
                    {showDropdown && (results.length > 0 || speakerQuery.trim()) && (
                      <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-brand-border-subtle bg-card p-1 shadow-xl">
                        {results.filter((u) => !(talk.speakers || []).some((speaker) => speaker.userId === u.id)).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => linkUser(i, u)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand-surface"
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
                        {speakerQuery.trim() ? (
                          <button type="button" onClick={() => addExternalSpeaker(i)} className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-brand-blue hover:bg-brand-surface">
                            {t(lang, "meetingTalks.addExternal", { name: speakerQuery.trim() })}
                          </button>
                        ) : null}
                  </div>
                )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSearch(i);
                      setSpeakerQuery("");
                      setShowDropdown(true);
                      searchUsers("");
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-blue/40 px-2.5 py-1 text-xs font-medium text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/5"
                  >
                    {t(lang, "meetingTalks.addSpeaker")} <span className="text-sm leading-none">＋</span>
                  </button>
                )}
              </div>

              <div className="col-span-4 min-w-0 space-y-1.5 border-t border-brand-border-subtle pt-2">
                <textarea
                  rows={1}
                  value={talk.description || ""}
                  onChange={(event) => update(i, { description: event.target.value })}
                  placeholder={t(lang, "meetingTalks.descriptionPlaceholder")}
                  aria-label={t(lang, "meetingTalks.descriptionPlaceholder")}
                  className="block h-8 w-full min-w-0 resize-none rounded-md border-0 bg-transparent px-0 py-1 text-sm leading-6 text-brand-text-secondary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
                <ImageDropZone
                  className={talk.imageUrl ? "w-full max-w-xs" : "w-fit max-w-full"}
                  disabled={uploadingImage === i}
                  onInvalid={setUploadError}
                  onFile={(file) => void handleAgendaImage(i, file)}
                >
                  {talk.imageUrl ? (
                    <div className="group/image relative h-24 overflow-hidden rounded-lg border border-brand-border-subtle bg-brand-surface">
                      <img src={talk.imageUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => update(i, { imageUrl: "" })}
                        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-lg text-white transition hover:bg-black/85"
                        aria-label={t(lang, "meetingTalks.removeImage")}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/5 focus-within:ring-2 focus-within:ring-brand-blue/30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
                      <span>{uploadingImage === i ? t(lang, "meetingTalks.uploadingImage") : t(lang, "meetingTalks.addImage")}</span>
                      <input
                        type="file"
                        accept={ACCEPT_ATTR}
                        className="sr-only"
                        disabled={uploadingImage === i}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void handleAgendaImage(i, file);
                        }}
                      />
                    </label>
                  )}
                </ImageDropZone>
              </div>
            </div>
          );
        })}
      </div>

      {uploadError ? <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p> : null}

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

  const shell = framed
    ? "bg-card rounded-xl border p-4 sm:p-5 space-y-3 shadow-sm border-brand-border-subtle"
    : "space-y-2";
  if (embedded) return <section className={shell}>{body}</section>;
  return <form onSubmit={onSubmit} className={shell}>{body}</form>;
}
