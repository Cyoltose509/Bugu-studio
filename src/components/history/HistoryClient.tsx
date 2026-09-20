"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { saveAllAsLongImage, saveAllAsPDF } from "@/lib/print-utils";
import YearNewspaper, { SectionVisibility } from "@/components/history/YearNewspaper";

const SECTION_LABELS: { key: keyof SectionVisibility; label: string }[] = [
  { key: "lead", label: "卷首语" },
  { key: "stats", label: "数字面板" },
  { key: "projects", label: "作品巡礼" },
  { key: "awards", label: "所获奖项" },
  { key: "members", label: "新血液" },
  { key: "activeMembers", label: "活跃成员" },
  { key: "activities", label: "活动回顾" },
  { key: "events", label: "大事记" },
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
}

// ─── 样式工具 ────────────────────────────────────────
function topBtnClass(loading: boolean): string {
  return `inline-flex items-center gap-1.5 px-[22px] py-2.5 rounded-lg border-[1.5px] border-brand-navy text-sm font-semibold transition-all duration-200 ${loading ? "bg-brand-navy text-white cursor-default" : "bg-transparent text-brand-navy cursor-pointer"}`;
}

// ═══════════════════════════════════════════════════════
export default function HistoryClient({
  yearDetails, startYear, yearCount,
}: {
  yearDetails: YearDetail[];
  startYear: number;
  yearCount: number;
}) {
  const paperRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [savingAllImg, setSavingAllImg] = useState(false);
  const [savingAllPdf, setSavingAllPdf] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<SectionVisibility>(allSections(true));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 等待客户端挂载后再显示按钮（避免 SSR 水合不匹配）
  useEffect(() => { setMounted(true); }, []);

  const registerPaper = useCallback((year: number, el: HTMLDivElement | null) => {
    if (el) paperRefs.current.set(year, el);
    else paperRefs.current.delete(year);
  }, []);

  // ── 保存全部为长图 ──
  const saveAllAsImage = useCallback(async () => {
    if (savingAllImg) return;
    setSavingAllImg(true);
    try {
      const sorted = [...paperRefs.current.entries()]
        .sort(([a], [b]) => b - a);
      const els = sorted.map(([, el]) => el).filter(Boolean);

      if (els.length === 0) return;

      await saveAllAsLongImage(
        els,
        `布谷工作室·${startYear}-至今·年度回顾.png`,
        24
      );
      // 保存完毕后强制刷新页面，杜绝第二次保存时图片错乱
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      console.error("保存全部长图失败", e);
      setSavingAllImg(false);
    }
  }, [savingAllImg, startYear]);

  // ── 保存全部为PDF（新窗口 + 动态 @page 尺寸 → 链接可点击 + 不截页） ──
  const saveAllPDF = useCallback(async () => {
    if (savingAllPdf) return;
    setSavingAllPdf(true);
    try {
      const sorted = [...paperRefs.current.entries()]
        .sort(([a], [b]) => b - a);
      const els = sorted.map(([, el]) => el).filter(Boolean);
      if (els.length === 0) return;
      await saveAllAsPDF(
        els,
        `布谷工作室·${startYear}-至今·年度回顾.pdf`,
        24
      );
      // 刷新页面确保下次保存状态干净
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      console.error("保存全部PDF失败", e);
      setSavingAllPdf(false);
    }
  }, [savingAllPdf, startYear]);

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
                      清空
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    {SECTION_LABELS.map(({ key, label }) => (
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
                        {label}
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
          {/* ═══ 顶部工具栏 ═══ */}
          {mounted && yearDetails.length > 0 && (
            <div data-toolbar className="flex flex-wrap items-center justify-center gap-4 mb-6">
              <span className="text-sm mr-2 text-brand-text-secondary">
                共 {yearCount} 年年报（{startYear}年至今）
              </span>
              <button type="button" onClick={saveAllPDF} disabled={savingAllPdf} className={topBtnClass(savingAllPdf)} title="可能需要关闭浏览器的窗口拦截">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9 15 12 18 15 15"/>
                </svg>
                {savingAllPdf ? "生成中…" : "保存全部为PDF"}
              </button>
              <button type="button" onClick={saveAllAsImage} disabled={savingAllImg} className={topBtnClass(savingAllImg)} title="页面左侧上暂时出现图片是正常现象">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {savingAllImg ? "生成中…" : "保存全部为长图"}
              </button>
            </div>
          )}

          {/* ═══ 报纸列表 ═══ */}
          {yearDetails.length === 0 ? (
            <div className="rounded-xl border border-brand-border-subtle bg-card px-6 py-16 text-center">
              <p className="text-lg font-medium text-brand-navy">暂无年报内容</p>
              <p className="mt-2 text-sm text-brand-text-secondary">
                发布作品、大事记或活动后，这里会按年份自动生成回顾。
              </p>
            </div>
          ) : (
          <div className="space-y-8">
            {yearDetails.map(({ year, members, projects, events, activities, activeMembers, presidents }) => (
              <div key={year} className="history-scroll-wrapper">
                <YearNewspaper
                  year={year}
                  members={members}
                  projects={projects}
                  events={events}
                  activities={activities}
                  activeMembers={activeMembers}
                  presidents={presidents}
                  startYear={startYear}
                  registerRef={(el) => registerPaper(year, el)}
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
