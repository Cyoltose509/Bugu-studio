"use client";

import { useState, useEffect } from "react";
import YearNewspaper, { SectionVisibility } from "@/components/history/YearNewspaper";
import type { AwardEntry } from "@/lib/history/awards";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

const SECTION_LABEL_KEYS: { key: keyof SectionVisibility; dictKey: "history.section.lead" | "history.section.stats" | "history.section.projects" | "history.section.awards" | "history.section.members" | "history.section.activeMembers" | "history.section.activities" | "history.section.events" }[] = [
  { key: "lead", dictKey: "history.section.lead" },
  { key: "stats", dictKey: "history.section.stats" },
  { key: "projects", dictKey: "history.section.projects" },
  { key: "awards", dictKey: "history.section.awards" },
  { key: "members", dictKey: "history.section.members" },
  { key: "activeMembers", dictKey: "history.section.activeMembers" },
  { key: "activities", dictKey: "history.section.activities" },
  { key: "events", dictKey: "history.section.events" },
];

function allSections(value: boolean): SectionVisibility {
  return {
    lead: value, stats: value, projects: value, awards: value,
    members: value, activeMembers: value, activities: value, events: value,
  };
}

// ─── 类型 ────────────────────────────────────────────
interface Member {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: number | null;
  joinYear: number | null;
  position: string | null;
  user?: { image: string | null } | null;
}
interface Project {
  id: string; slug: string; title: string; subtitle: string | null;
  coverImage: string | null; type: string;
  tags?: { tag: { name: string } }[];
  members?: { memberId: string | null; externalName: string | null; roles: string[]; member?: { displayName: string } | null }[];
  _count?: { likes: number };
}
interface EventItem {
  id: string; title: string; body: string | null; bodyHtml?: string;
  eventDate: string | null; eventEndDate?: string | null;
  images?: { id: string; url: string; altText?: string | null }[];
}
interface Activity {
  id: string; title: string; type: string; status?: string | null;
  startTime: Date | string; coverImage: string | null;
  description: string | null; descriptionHtml?: string; summary: string | null;
}
interface ActiveMember extends Member {
  score: number; projects: number; competitions: number; courses: number; meetings: number;
}
interface YearDetail {
  year: number;
  members: Member[];
  projects: Project[];
  events: EventItem[];
  activities: Activity[];
  activeMembers: ActiveMember[];
  presidents: Member[];
  awards: AwardEntry[];
}

// ─── 样式工具 ────────────────────────────────────────
// （保存入口已移到每个年报右下角的 SaveMenu，顶部不再放全局保存按钮）

// ═══════════════════════════════════════════════════════
export default function HistoryClient({
  yearDetails, startYear, yearCount,
}: {
  yearDetails: YearDetail[];
  startYear: number;
  yearCount: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<SectionVisibility>(allSections(true));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang } = useLang();

  // 等待客户端挂载后再显示按钮（避免 SSR 水合不匹配）
  useEffect(() => { setMounted(true); }, []);

  const visibleCount = Object.values(sections).filter(Boolean).length;

  return (
    <>
      {/* ═══ 打印样式 ═══ */}
      <style>{`
        @media print {
          nav, header, footer, .navbar, [data-nav] {
            display: none !important;
          }
          body {
            background: var(--np-paper, #faf8f5) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .dark body {
            background: #1a1f28 !important;
          }
          .newspaper-paper {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 auto 16px !important;
          }
          [data-save-buttons], [data-toolbar], [data-history-sidebar] {
            display: none !important;
          }
          @page {
            margin: 8mm;
            size: A4;
          }
        }
      `}</style>

      <div className="relative">
        {/* ═══ 浮层栏目筛选（默认收起，展开不挤占年报宽度） ═══ */}
        {mounted && yearDetails.length > 0 && (
          <div
            data-history-sidebar
            className="sticky top-24 z-30 h-0 pointer-events-none"
          >
            <aside
              className={`
                pointer-events-auto absolute left-0 top-0
                shadow-lg backdrop-blur-md
                transition-[width,opacity] duration-200
                ${sidebarOpen
                  ? "w-[200px] bg-card/95 border border-brand-border-subtle rounded-lg p-4"
                  : "w-9"}
              `}
            >
              {sidebarOpen ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-brand-navy">栏目筛选</span>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="text-brand-text-muted hover:text-brand-text-heading text-xs p-0.5"
                      title="收起"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                    </button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setSections(allSections(true))}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${visibleCount === 8 ? "bg-brand-navy text-white border-brand-navy" : "border-brand-border-subtle text-brand-text-secondary hover:border-brand-blue"}`}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setSections(allSections(false))}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${visibleCount === 0 ? "bg-brand-navy text-white border-brand-navy" : "border-brand-border-subtle text-brand-text-secondary hover:border-brand-blue"}`}
                    >
                      {t(lang, "history.clear")}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    {SECTION_LABEL_KEYS.map(({ key, dictKey }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer hover:bg-brand-surface transition-colors text-sm text-brand-text-body"
                      >
                        <input
                          type="checkbox"
                          checked={sections[key]}
                          onChange={() => setSections(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="w-3.5 h-3.5 rounded accent-brand-navy cursor-pointer"
                        />
                        {t(lang, dictKey)}
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-brand-border-subtle text-[11px] text-brand-text-muted">
                    显示 {visibleCount}/8 个栏目
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="w-9 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-border-subtle bg-card/95 text-brand-text-muted hover:text-brand-text-heading shadow-md"
                  title="展开栏目筛选"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span className="text-[10px] leading-tight" style={{ writingMode: "vertical-rl" }}>栏目</span>
                </button>
              )}
            </aside>
          </div>
        )}

        {/* ═══ 主内容区 ═══ */}
        <div className="min-w-0">
          {/* ═══ 顶部信息行 ═══ */}
          {mounted && yearDetails.length > 0 && (
            <div data-toolbar className="flex justify-center mb-6">
              <span className="text-sm text-brand-text-secondary">
                {t(lang, "history.yearsSummary", { n: yearCount, start: startYear })}
              </span>
            </div>
          )}

          {/* ═══ 报纸列表 ═══ */}
          {yearDetails.length === 0 ? (
            <div className="rounded-xl border border-brand-border-subtle bg-card px-6 py-16 text-center">
              <p className="text-lg font-medium text-brand-navy">{t(lang, "history.empty")}</p>
              <p className="mt-2 text-sm text-brand-text-secondary">
                {t(lang, "history.emptyDesc")}
              </p>
            </div>
          ) : (
          <div className="space-y-8">
            {yearDetails.map(({ year, members, projects, events, activities, activeMembers, presidents, awards }) => (
              <div key={year} className="history-scroll-wrapper">
                <YearNewspaper
                  year={year}
                  members={members}
                  projects={projects}
                  events={events}
                  activities={activities}
                  activeMembers={activeMembers}
                  presidents={presidents}
                  awards={awards}
                  startYear={startYear}
                  sections={sections}
                />
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </>
  );
}
