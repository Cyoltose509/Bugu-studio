"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

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
}

/** 客户端本地缓存：避免短时间内重复请求 */
let _lastFetched = 0;
const CACHE_TTL = 10_000; // 10 秒去重

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ── 获取未读数（带 10s 本地去重） ──
  const fetchUnreadCount = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - _lastFetched < CACHE_TTL) return;
    _lastFetched = now;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.data?.count ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  // ── 获取通知列表（打开下拉时强制刷新） ──
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?page=1&unreadOnly=false");
      if (res.ok) {
        const json = await res.json();
        setItems(json.data?.items ?? []);
        setUnreadCount(json.data?.unreadCount ?? 0);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  // 每 60 秒自动轮询未读数
  useEffect(() => {
    const timer = setInterval(() => fetchUnreadCount(true), 60_000);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  // 打开时加载列表
  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const bell = document.getElementById("notif-bell");
      if (bell && !bell.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 收起时自动标记全部为已读
  useEffect(() => {
    if (open || unreadCount === 0) return;
    fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [open]);

  // ── 标记单条已读并跳转 ──
  async function handleClick(item: NotificationItem) {
    if (!item.read) {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
    }
    setOpen(false);
    // JAM 邀请通知需要优先匹配（type 判断），因为新通知的 relatedType 也是 "Activity"
    if (item.type === "JAM_INVITATION") {
      if (item.relatedId) window.location.href = `/activities/${item.relatedId}#jam`;
      else window.location.href = `/activities`;
    } else if (item.relatedType === "Project") {
      const target = item.relatedSlug || item.relatedId;
      if (target) window.location.href = `/works/${target}`;
      else window.location.href = `/works`;
    } else if (item.relatedType === "Activity") {
      const target = item.relatedId;
      if (target) window.location.href = `/activities/${target}`;
      else window.location.href = `/activities`;
    } else if (item.type === "ROLE_CHANGE") {
      // "社团身份已变更"通知无需跳转
      setOpen(false);
    } else if (item.relatedType === "User") {
      window.location.href = `/admin/users`;
    } else if (item.relatedType === "JamTeam") {
      const target = item.relatedId;
      if (target) {
        const parts = target.split(":");
        if (parts.length === 2) {
          window.location.href = `/activities/${parts[0]}/game-jam/teams/${parts[1]}`;
        }
      }
    } else if (item.relatedType === "HistoryEvent") {
      window.location.href = `/history`;
    }
  }

  // ── 全部标为已读 ──
  async function markAllRead(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // ── 删除单条通知 ──
  async function deleteOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) => prev.filter((n) => n.id !== id));
    // 如果删除的是未读的，减少未读数
    const deleted = items.find((n) => n.id === id);
    if (deleted && !deleted.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  // ── 全部删除 ──
  async function deleteAll(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setItems([]);
    setUnreadCount(0);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 60000;
    if (diff < 1) return "刚刚";
    if (diff < 60) return `${Math.floor(diff)}分钟前`;
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
    return d.toLocaleDateString("zh-CN");
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
    if (type === "ACTIVITY_SUBMISSION") return "🏆";
    if (type === "JAM_APPLICATION") return "📨";
    if (type === "JAM_APPROVED") return "✅";
    if (type === "JAM_REJECTED") return "❌";
    if (type === "JAM_INVITATION") return "📩";
    if (type === "JAM_INVITATION_ACCEPTED") return "🤝";
    if (type === "MENTION") return "💬";
    return "🔔";
  }

  return (
    <div id="notif-bell" className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
        title="通知"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 bg-brand-orange">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] overflow-y-auto rounded-xl border bg-card shadow-xl z-50 border-brand-border-subtle">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border-subtle">
            <span className="font-semibold text-sm text-brand-navy">通知</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs hover:underline text-brand-blue">
                  全部已读
                </button>
              )}
              {items.length > 0 && (
                <button onClick={deleteAll} className="text-xs hover:underline text-[var(--ui-text-red)]">
                  全部删除
                </button>
              )}
            </div>
          </div>

          {/* 列表 */}
          {loading ? (
            <div className="p-6 text-center text-xs text-brand-text-muted">加载中...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-brand-text-muted">暂无通知</div>
          ) : (
            <div>
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`relative w-full group ${n.read ? "" : "bg-[#F0F8FF]"} border-[#f0f0f0]`}
                >
                  <button
                    onClick={() => handleClick(n)}
                    className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-[#F0F5F9] border-[#f0f0f0]"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0 mt-0.5">{getIcon(n.type)}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${n.read ? "" : "text-[#25547A]"}`}>
                          {n.title}
                        </div>
                        <div className="text-xs mt-0.5 truncate text-brand-text-secondary">{n.content}</div>
                        <div className="text-xs mt-1 text-brand-text-muted">{formatTime(n.createdAt)}</div>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-brand-blue" />
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteOne(e, n.id)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-brand-text-muted"
                    title="删除此通知"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
