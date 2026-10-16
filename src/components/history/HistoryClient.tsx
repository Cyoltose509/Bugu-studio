"use client";

import { useState, useEffect, useRef } from "react";
import YearNewspaper, { SectionVisibility } from "@/components/history/YearNewspaper";
import type { AwardEntry } from "@/lib/history/awards";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

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

function yearAnchorId(year: number) {
  return `history-year-${year}`;
}

// ═══════════════════════════════════════════════════════
export default function HistoryClient({
  yearDetails, startYear,
}: {
  yearDetails: YearDetail[];
  startYear: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeYear, setActiveYear] = useState(yearDetails[0]?.year);
  const { lang } = useLang();
  const sections = allSections(true);
  const jumpingYearRef = useRef<number | null>(null);
  const jumpGenRef = useRef(0);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (yearDetails.length === 0) return;
    const nodes = yearDetails
      .map(({ year }) => document.getElementById(yearAnchorId(year)))
      .filter((el): el is HTMLElement => !!el);
    if (nodes.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (jumpingYearRef.current != null) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const year = Number(visible.target.getAttribute("data-year"));
        if (year) setActiveYear(year);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0.08, 0.25, 0.5] },
    );
    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [yearDetails]);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, []);

  function jumpToYear(year: number) {
    setActiveYear(year);
    const el = document.getElementById(yearAnchorId(year));
    if (!el) return;

    const gen = ++jumpGenRef.current;
    jumpingYearRef.current = year;

    const finish = () => {
      if (jumpGenRef.current !== gen) return;
      jumpingYearRef.current = null;
      if (jumpTimerRef.current) {
        clearTimeout(jumpTimerRef.current);
        jumpTimerRef.current = null;
      }
    };

    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.addEventListener("scrollend", finish, { once: true });
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(finish, 1200);
  }

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
          [data-save-buttons], [data-history-sidebar] {
            display: none !important;
          }
          @page {
            margin: 8mm;
            size: A4;
          }
        }
      `}</style>

      <div className="relative">
        {/* ═══ 浮层年份滚轴（默认收起，展开不挤占年报宽度） ═══ */}
        {mounted && yearDetails.length > 0 && (
          <div
            data-history-sidebar
            className="sticky top-24 z-30 h-0 pointer-events-none"
          >
            <aside
              className={`
                pointer-events-auto absolute left-0 top-0 overflow-hidden
                shadow-lg backdrop-blur-md
                transition-[width,opacity] duration-200
                ${sidebarOpen
                  ? "w-[104px] bg-card/95 border border-brand-border-subtle rounded-lg p-3"
                  : "w-9"}
              `}
            >
              {sidebarOpen ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-navy">{t(lang, "history.yearJump")}</span>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="text-brand-text-muted hover:text-brand-text-heading text-xs p-0.5"
                      title={t(lang, "history.yearJumpCollapse")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                    </button>
                  </div>

                  <div
                    className="relative max-h-[min(420px,60vh)] overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:thin]"
                    role="listbox"
                    aria-label={t(lang, "history.yearJumpTitle")}
                  >
                    <div className="flex min-w-0 flex-col items-stretch">
                      {yearDetails.map(({ year }) => {
                        const active = activeYear === year;
                        return (
                          <button
                            key={year}
                            type="button"
                            data-year-btn={year}
                            role="option"
                            aria-selected={active}
                            onClick={() => jumpToYear(year)}
                            className={`py-1.5 text-center text-[13px] tabular-nums tracking-wide transition-colors duration-150 ${
                              active
                                ? "font-bold text-brand-navy"
                                : "font-medium text-brand-text-muted hover:text-brand-text-heading"
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="w-9 min-h-[5rem] flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-border-subtle bg-card/95 text-brand-text-muted hover:text-brand-text-heading shadow-md py-2"
                  title={t(lang, "history.yearJumpExpand")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span className="text-[10px] font-semibold leading-tight" style={{ writingMode: "vertical-rl" }}>
                    {t(lang, "history.yearJump")}
                  </span>
                </button>
              )}
            </aside>
          </div>
        )}

        {/* ═══ 主内容区 ═══ */}
        <div className="min-w-0">
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
              <div
                key={year}
                id={yearAnchorId(year)}
                data-year={year}
                className="history-scroll-wrapper scroll-mt-24"
              >
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
