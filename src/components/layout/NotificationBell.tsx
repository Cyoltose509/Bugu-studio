"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";
import TrophyIcon from "@/components/icons/TrophyIcon";
import UserAvatar from "@/components/ui/UserAvatar";
import type { NotifBucket } from "@/lib/notifications/buckets";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string | null;
  relatedType?: string | null;
  relatedSlug?: string | null;
  read: boolean;
  createdAt: string;
  outcome?: {
    result: "approved" | "rejected" | "dismissed";
    emoji: string;
    handler?: { name: string | null; image: string | null };
  } | null;
}

interface UnreadBuckets {
  count: number;
  review: number;
  activity: number;
  bug: number;
}

const EMPTY_UNREAD: UnreadBuckets = { count: 0, review: 0, activity: 0, bug: 0 };

let _lastFetched = 0;
const CACHE_TTL = 10_000;

function formatTime(iso: string, lang: "cn" | "en") {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 1) return t(lang, "notification.justNow");
  if (diff < 60) return t(lang, "notification.minutesAgo", { n: Math.floor(diff) });
  if (diff < 1440) return t(lang, "notification.hoursAgo", { n: Math.floor(diff / 60) });
  return d.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN");
}

function getIcon(type: string) {
  if (type === "PROJECT_REVIEW") return "✅";
  if (type === "PROPOSAL_REVIEW") return "📋";
  if (type === "COMMENT_REPLY" || type === "COMMENT_LIKE") return "💬";
  if (type === "ROLE_CHANGE") return "🏷️";
  if (type === "NEW_PROJECT") return "🎮";
  if (type === "NEW_USER") return "👤";
  if (type === "ACTIVITY_PROPOSAL") return "🎤";
  if (type === "ACTIVITY_ENROLL") return "📚";
  if (type === "ACTIVITY_SUBMISSION") return <TrophyIcon size={16} />;
  if (type === "JAM_APPLICATION") return "📨";
  if (type === "JAM_APPROVED") return "✅";
  if (type === "JAM_REJECTED") return "❌";
  if (type === "JAM_INVITATION") return "📩";
  if (type === "JAM_INVITATION_ACCEPTED") return "🤝";
  if (type === "MENTION") return "💬";
  if (type === "ERROR_REPORT" || type === "CSP_VIOLATION") return "🐞";
  return "🔔";
}

function ExpandableText({
  children,
  className,
  grow = false,
}: {
  children: ReactNode;
  className?: string;
  grow?: boolean;
}) {
  return (
    <div
      className={`${grow ? "flex-1" : ""} min-w-0 max-h-5 overflow-hidden text-ellipsis whitespace-nowrap transition-[max-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:max-h-40 group-hover:whitespace-normal group-hover:text-clip break-words ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function destination(item: NotificationItem, isAdmin: boolean): string | null {
  if (item.type === "ERROR_REPORT") {
    return item.relatedId ? `/admin/errors?reportId=${encodeURIComponent(item.relatedId)}` : "/admin/errors";
  }
  if (item.type === "CSP_VIOLATION") return null;
  if (item.type === "JAM_INVITATION") {
    return item.relatedId ? `/activities/${item.relatedId}#jam` : "/activities";
  }
  if (item.relatedType === "Project") {
    const target = item.relatedSlug || item.relatedId;
    return target ? `/works/${target}` : "/works";
  }
  if (item.relatedType === "Activity") {
    return item.relatedId ? `/activities/${item.relatedId}` : "/activities";
  }
  if (item.type === "ROLE_CHANGE") return null;
  if (item.relatedType === "User") return isAdmin ? "/admin/users" : "/profile";
  if (item.relatedType === "JamTeam" && item.relatedId) {
    const parts = item.relatedId.split(":");
    if (parts.length === 2) return `/activities/${parts[0]}/game-jam/teams/${parts[1]}`;
  }
  if (item.relatedType === "HistoryEvent") return "/history";
  return null;
}

export default function NotificationBell({ isAdmin = false }: { isAdmin?: boolean }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifBucket>("review");
  const [unread, setUnread] = useState<UnreadBuckets>(EMPTY_UNREAD);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUnreadCount = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - _lastFetched < CACHE_TTL) return;
    _lastFetched = now;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        setUnread({
          count: data.count ?? 0,
          review: data.review ?? 0,
          activity: data.activity ?? 0,
          bug: data.bug ?? 0,
        });
      }
    } catch { /* ignore */ }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: "1", unreadOnly: "false" });
      if (isAdmin) qs.set("bucket", tab);
      const res = await fetch(`/api/notifications?${qs}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data?.items ?? []);
        const u = json.data?.unread;
        if (u) {
          setUnread({
            count: u.count ?? 0,
            review: u.review ?? 0,
            activity: u.activity ?? 0,
            bug: u.bug ?? 0,
          });
        } else {
          setUnread((prev) => ({ ...prev, count: json.data?.unreadCount ?? prev.count }));
        }
      }
    } finally { setLoading(false); }
  }, [isAdmin, tab]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  useEffect(() => {
    const timer = setInterval(() => fetchUnreadCount(true), 60_000);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const bell = document.getElementById("notif-bell");
      if (bell && !bell.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open || unread.count === 0) return;
    fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isAdmin ? { bucket: tab } : {}),
    }).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread((prev) => {
      if (!isAdmin) return EMPTY_UNREAD;
      const cleared = tab === "review" ? prev.review : tab === "bug" ? prev.bug : prev.activity;
      return {
        ...prev,
        [tab]: 0,
        count: Math.max(0, prev.count - cleared),
      };
    });
  }, [open]);

  const markOneRead = useCallback(async (item: NotificationItem) => {
    if (item.read) return;
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setUnread((prev) => {
      const b = item.type === "ERROR_REPORT" || item.type === "CSP_VIOLATION"
        ? "bug"
        : ["NEW_PROJECT", "PROJECT_UPDATE", "ACTIVITY_PROPOSAL", "JAM_APPLICATION", "NEW_USER"].includes(item.type)
          ? "review"
          : "activity";
      return {
        count: Math.max(0, prev.count - 1),
        review: b === "review" ? Math.max(0, prev.review - 1) : prev.review,
        activity: b === "activity" ? Math.max(0, prev.activity - 1) : prev.activity,
        bug: b === "bug" ? Math.max(0, prev.bug - 1) : prev.bug,
      };
    });
  }, []);

  const handleClick = useCallback(async (item: NotificationItem) => {
    await markOneRead(item);
    if (item.type === "ERROR_REPORT" || item.type === "CSP_VIOLATION") {
      setExpandedId((id) => (id === item.id ? null : item.id));
      return;
    }
    const href = destination(item, isAdmin);
    setOpen(false);
    if (href) window.location.href = href;
  }, [isAdmin, markOneRead]);

  const markAllRead = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isAdmin ? { bucket: tab } : {}),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread((prev) => {
      if (!isAdmin) return EMPTY_UNREAD;
      const cleared = tab === "review" ? prev.review : tab === "bug" ? prev.bug : prev.activity;
      return { ...prev, [tab]: 0, count: Math.max(0, prev.count - cleared) };
    });
  }, [isAdmin, tab]);

  async function deleteOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const deleted = items.find((n) => n.id === id);
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (deleted && !deleted.read) {
      setUnread((prev) => ({ ...prev, count: Math.max(0, prev.count - 1) }));
    }
  }

  async function deleteAll(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isAdmin ? { bucket: tab } : {}),
    });
    setItems([]);
    setUnread((prev) => {
      if (!isAdmin) return EMPTY_UNREAD;
      const cleared = items.filter((n) => !n.read).length;
      return { ...prev, [tab]: 0, count: Math.max(0, prev.count - cleared) };
    });
  }

  const tabs: { id: NotifBucket; label: string; count: number }[] = [
    { id: "review", label: t(lang, "notification.tab.review"), count: unread.review },
    { id: "activity", label: t(lang, "notification.tab.activity"), count: unread.activity },
    { id: "bug", label: t(lang, "notification.tab.bug"), count: unread.bug },
  ];

  const list = (
    <>
      {loading ? (
        <div className="p-6 text-center text-xs text-brand-text-muted">{t(lang, "common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="p-6 text-center text-xs text-brand-text-muted">{t(lang, "notification.empty")}</div>
      ) : (
        <div>
          {items.map((n) => {
            const expanded = expandedId === n.id;
            const errorHref = n.type === "ERROR_REPORT"
              ? destination(n, true)
              : null;
            return (
              <div
                key={n.id}
                className={`relative w-full group ${n.read ? "" : "bg-[#F0F8FF] dark:bg-[#1a2a3a]"} border-[#f0f0f0] dark:border-[#2a3045]`}
              >
                <button
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-4 py-3 pr-8 border-b transition-colors hover:bg-[#F0F5F9] dark:hover:bg-[#1e2840] border-[#f0f0f0] dark:border-[#2a3045]"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0 mt-0.5">{getIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <ExpandableText grow className={`text-sm font-medium leading-5 ${n.read ? "" : "text-[#25547A] dark:text-[#7ab8e0]"}`}>
                          {n.title}
                        </ExpandableText>
                        {n.outcome && (
                          <span
                            className="inline-flex items-center gap-1 shrink-0 mt-px"
                            title={[
                              n.outcome.result === "approved" ? "已通过" : n.outcome.result === "rejected" ? "已拒绝" : "已标记非成员",
                              n.outcome.handler?.name,
                            ].filter(Boolean).join(" · ")}
                          >
                            {n.outcome.handler && (
                              <UserAvatar
                                src={n.outcome.handler.image}
                                name={n.outcome.handler.name}
                                size={16}
                              />
                            )}
                            <span className="text-sm leading-none">{n.outcome.emoji}</span>
                          </span>
                        )}
                      </div>
                      <ExpandableText className={`text-xs mt-0.5 leading-5 text-brand-text-secondary ${expanded ? "whitespace-pre-wrap" : ""}`}>
                        {n.content}
                      </ExpandableText>
                      {expanded && errorHref && (
                        <a
                          href={errorHref}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block mt-1.5 text-xs text-brand-blue hover:underline"
                        >
                          {t(lang, "notification.openError")}
                        </a>
                      )}
                      <div className="text-xs mt-1 text-brand-text-muted">{formatTime(n.createdAt, lang)}</div>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-brand-blue" />
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteOne(e, n.id)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-950 text-brand-text-muted"
                  title={t(lang, "notification.deleteOne")}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div id="notif-bell" className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
        title={t(lang, "notification.title")}
      >
        <span className="relative block w-5 h-5" aria-hidden>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`absolute inset-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              open ? "opacity-0 -translate-y-0.5 scale-75 rotate-12" : "opacity-100 translate-y-0 scale-100 rotate-0"
            }`}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path
              d="M13.73 21a2 2 0 0 1-3.46 0"
              className={`transition-opacity duration-150 ${open ? "opacity-0" : "opacity-100"}`}
            />
          </svg>
          <span
            className={`absolute left-[3px] top-[9px] h-[2px] w-[14px] rounded-full bg-current transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center ${
              open ? "rotate-45 opacity-100" : "rotate-0 opacity-0"
            }`}
          />
          <span
            className={`absolute left-[3px] top-[9px] h-[2px] w-[14px] rounded-full bg-current transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center ${
              open ? "-rotate-45 opacity-100" : "rotate-0 opacity-0"
            }`}
          />
        </span>
        {unread.count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 bg-brand-orange">
            {unread.count > 99 ? "99+" : unread.count}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 ${isAdmin ? "w-[22.5rem] sm:w-[26rem]" : "w-80"} max-h-[420px] rounded-xl border bg-card shadow-xl z-50 border-brand-border-subtle overflow-hidden`}>
          {isAdmin ? (
            <div className="flex max-h-[420px]">
              <aside className="w-[4.25rem] shrink-0 border-r border-brand-border-subtle py-2 flex flex-col gap-0.5">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => { setTab(tb.id); setExpandedId(null); }}
                    className={`mx-1 px-1.5 py-2 rounded-lg text-xs leading-tight text-center transition-colors ${
                      tab === tb.id
                        ? "bg-[#E8F4FD] text-brand-blue font-medium"
                        : "text-brand-text-secondary hover:bg-brand-surface"
                    }`}
                  >
                    <span className="block">{tb.label}</span>
                    {tb.count > 0 && (
                      <span className="mt-0.5 inline-flex min-w-[1.1rem] h-4 px-1 items-center justify-center rounded-full text-[10px] text-white bg-brand-orange">
                        {tb.count > 99 ? "99+" : tb.count}
                      </span>
                    )}
                  </button>
                ))}
              </aside>
              <div className="min-w-0 flex-1 flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-brand-border-subtle shrink-0">
                  <span className="font-semibold text-sm text-brand-navy">{t(lang, "notification.title")}</span>
                  <div className="flex items-center gap-2">
                    {unread.count > 0 && (
                      <button onClick={markAllRead} className="text-xs hover:underline text-brand-blue">
                        {t(lang, "notification.markAllRead")}
                      </button>
                    )}
                    {items.length > 0 && (
                      <button onClick={deleteAll} className="text-xs hover:underline text-[var(--ui-text-red)]">
                        {t(lang, "notification.deleteAll")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">{list}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border-subtle">
                <span className="font-semibold text-sm text-brand-navy">{t(lang, "notification.title")}</span>
                <div className="flex items-center gap-2">
                  {unread.count > 0 && (
                    <button onClick={markAllRead} className="text-xs hover:underline text-brand-blue">
                      {t(lang, "notification.markAllRead")}
                    </button>
                  )}
                  {items.length > 0 && (
                    <button onClick={deleteAll} className="text-xs hover:underline text-[var(--ui-text-red)]">
                      {t(lang, "notification.deleteAll")}
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[360px] overflow-y-auto">{list}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
