"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { saveMeetingTalks } from "@/app/admin/activities/actions";
import { parseBvId } from "@/lib/activities/constants";
import { SubmitButton } from "@/components/ui/SubmitButton";

export type TalkDraft = {
  id?: string;
  speaker: string;
  title: string;
  bvId: string;
  userId?: string | null;
  linkedLabel?: string | null;
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
};

function emptyTalk(): TalkDraft {
  return { speaker: "", title: "", bvId: "", userId: null, linkedLabel: null };
}

function displayNameOf(u: UserHit): string {
  return u.member?.displayName || u.name || "未命名用户";
}

export default function MeetingTalksEditor({ activityId, initialTalks = [] }: Props) {
  const [talks, setTalks] = useState<TalkDraft[]>(
    initialTalks.length > 0 ? initialTalks : [emptyTalk()],
  );
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [results, setResults] = useState<UserHit[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(i: number, patch: Partial<TalkDraft>) {
    setTalks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function move(i: number, dir: -1 | 1) {
    setTalks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
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
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function onSpeakerChange(i: number, value: string) {
    update(i, {
      speaker: value,
      // 手动改名后解除关联，避免展示名与用户不一致
      userId: null,
      linkedLabel: null,
    });
    setActiveSearch(i);
    setShowDropdown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchUsers(value.trim()), 200);
  }

  function linkUser(i: number, user: UserHit) {
    const name = displayNameOf(user);
    update(i, {
      speaker: name,
      userId: user.id,
      linkedLabel: user.member
        ? `已关联成员 · ${user.member.displayName}`
        : `已关联用户 · ${user.name || user.id.slice(0, 8)}`,
    });
    setShowDropdown(false);
    setActiveSearch(null);
    setResults([]);
  }

  function clearLink(i: number) {
    update(i, { userId: null, linkedLabel: null });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const payload = talks
        .map((t) => ({
          speaker: t.speaker.trim(),
          title: t.title.trim(),
          bvId: parseBvId(t.bvId) || undefined,
          userId: t.userId || null,
        }))
        .filter((t) => t.speaker || t.title);

      const result = await saveMeetingTalks(activityId, payload);
      if (result?.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      setMessage({ type: "ok", text: "分享条目已保存" });
      if (result?.talks) {
        setTalks(
          result.talks.length > 0
            ? result.talks.map((t) => ({
                id: t.id,
                speaker: t.speaker,
                title: t.title,
                bvId: t.bvId || "",
                userId: t.userId || null,
                linkedLabel: t.userId
                  ? t.user?.member
                    ? `已关联成员 · ${t.user.member.displayName}`
                    : `已关联用户 · ${t.user?.name || t.userId}`
                  : null,
              }))
            : [emptyTalk()],
        );
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card rounded-xl border p-6 space-y-4 shadow-sm border-brand-border-subtle"
    >
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">例会分享条目</h2>
        <p className="text-xs mt-1 text-brand-text-secondary">
          按「主讲 + 标题 + BV 号」逐条录入。主讲可搜索站内用户并关联；有录像时填 BV（或粘贴 B 站链接），前台会显示小电视跳转观看。
        </p>
      </div>

      <div className="space-y-3" ref={searchBoxRef}>
        {talks.map((talk, i) => (
          <div
            key={talk.id || `new-${i}`}
            className="rounded-lg border border-brand-border-subtle p-3 space-y-2 bg-[#F8FBFD]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-brand-text-muted">#{i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-xs px-2 py-1 rounded border border-brand-border-subtle disabled:opacity-30"
                >
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === talks.length - 1}
                  className="text-xs px-2 py-1 rounded border border-brand-border-subtle disabled:opacity-30"
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTalks((prev) =>
                      prev.length <= 1 ? [emptyTalk()] : prev.filter((_, idx) => idx !== i),
                    )
                  }
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600"
                >
                  删除
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
                  placeholder="主讲（可搜索用户）"
                  className="w-full rounded-lg border px-3 py-2 text-sm border-brand-border-subtle text-brand-text-heading"
                  autoComplete="off"
                />
                {showDropdown && activeSearch === i && results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto border-brand-border-subtle">
                    {results.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => linkUser(i, u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-brand-surface-page flex items-center gap-2 transition-colors"
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
                            {displayNameOf(u)[0]}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-brand-text-heading truncate">
                            {displayNameOf(u)}
                          </span>
                          {u.member ? (
                            <span className="text-[10px] text-brand-text-muted">社团成员</span>
                          ) : (
                            <span className="text-[10px] text-brand-text-muted">站内用户</span>
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
                placeholder="专题标题"
                className="rounded-lg border px-3 py-2 text-sm border-brand-border-subtle text-brand-text-heading sm:col-span-2"
              />
            </div>
            {(talk.userId || talk.linkedLabel) && (
              <div className="flex items-center gap-2 text-xs text-brand-blue">
                <span>{talk.linkedLabel || "已关联站内用户"}</span>
                <button
                  type="button"
                  onClick={() => clearLink(i)}
                  className="underline text-brand-text-muted"
                >
                  取消关联
                </button>
              </div>
            )}
            <input
              value={talk.bvId}
              onChange={(e) => update(i, { bvId: e.target.value })}
              placeholder="BV 号或 B 站链接（可选）"
              className="w-full rounded-lg border px-3 py-2 text-sm border-brand-border-subtle text-brand-text-heading"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTalks((prev) => [...prev, emptyTalk()])}
          className="btn-secondary px-4 py-2 rounded-lg text-sm"
        >
          + 添加一条
        </button>
        <SubmitButton
          type="submit"
          disabled={pending}
          className="btn-primary px-5 py-2 rounded-lg text-sm font-medium"
          pendingText="保存中..."
        >
          保存分享条目
        </SubmitButton>
        {message && (
          <span
            className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
