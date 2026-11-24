"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  adminLinkJamSubmissionProject,
  searchWorksForJamLink,
  submitToWorksLibrary,
} from "@/lib/actions/submissions";

export default function JamProjectLinkModal({
  activityId,
  submissionId,
  submissionTitle,
  currentProjectId,
  currentProjectTitle,
  onClose,
  onUpdated,
}: {
  activityId: string;
  submissionId: string;
  submissionTitle: string;
  currentProjectId?: string | null;
  currentProjectTitle?: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<
    { id: string; slug: string; title: string; developYear: number; coverImage: string | null; status: string }[]
  >([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchWorksForJamLink(query);
        if (active && res?.projects) {
          setProjects(res.projects);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingList(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleLink = async (projectId: string | null) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await adminLinkJamSubmissionProject(activityId, submissionId, projectId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "关联失败");
      setSubmitting(false);
    }
  };

  const handleCreateInWorks = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("submissionId", submissionId);
      fd.set("projectType", "TRIAL_DEMO");
      fd.set("developYear", String(new Date().getFullYear()));
      const res = await submitToWorksLibrary(activityId, fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "提交到作品库失败");
      setSubmitting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="关联作品库游戏"
        className="w-full max-w-md rounded-2xl border border-brand-border-subtle bg-card p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-brand-navy">关联到作品库游戏</h3>
            <p className="mt-0.5 text-xs text-brand-text-muted truncate max-w-[300px]">
              当前条目：{submissionTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1 text-brand-text-muted hover:bg-brand-surface"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {currentProjectId && (
          <div className="flex items-center justify-between rounded-xl border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-sm">
            <span className="truncate font-medium text-brand-navy">
              已关联：{currentProjectTitle || currentProjectId}
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleLink(null)}
              className="ml-2 shrink-0 text-xs font-medium text-red-600 hover:underline"
            >
              取消关联
            </button>
          </div>
        )}

        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索作品库已有的游戏名称..."
            className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none"
          />

          <div className="max-h-56 overflow-y-auto divide-y divide-brand-border-subtle rounded-xl border border-brand-border-subtle bg-card">
            {loadingList ? (
              <p className="py-6 text-center text-xs text-brand-text-muted">加载中...</p>
            ) : projects.length === 0 ? (
              <p className="py-6 text-center text-xs text-brand-text-muted">未找到匹配的作品库游戏</p>
            ) : (
              projects.map((p) => {
                const isCurrent = p.id === currentProjectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleLink(p.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-surface ${
                      isCurrent ? "bg-brand-blue/10 font-semibold" : ""
                    }`}
                  >
                    <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-brand-surface flex items-center justify-center text-[10px] text-brand-text-muted">
                      {p.coverImage ? (
                        <img
                          src={p.coverImage}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        "🎮"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-brand-navy">{p.title}</div>
                      <div className="text-xs text-brand-text-muted">
                        {p.developYear} · {p.status === "PUBLISHED" ? "已发布" : "待审核"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-brand-blue">
                      {isCurrent ? "当前关联" : "选择关联"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {!currentProjectId && (
          <div className="flex items-center justify-between border-t border-brand-border-subtle pt-3 text-xs">
            <span className="text-brand-text-muted">作品库尚无此游戏？</span>
            <button
              type="button"
              disabled={submitting}
              onClick={handleCreateInWorks}
              className="font-medium text-brand-orange hover:underline"
            >
              以当前条目一键生成作品库草稿 →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
