"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { saveAllAsLongImage, saveAllAsPDF } from "@/lib/print-utils";
import YearNewspaper from "@/components/history/YearNewspaper";

// ─── 类型 ────────────────────────────────────────────
interface Member {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: number | null;
  joinYear: number | null;
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
}

// ─── 样式常量 ────────────────────────────────────────
const A = "#25547A";
const GREEN = "#88C232";

function topBtn(loading: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "10px 22px", borderRadius: 8, border: `1.5px solid ${A}`,
    background: loading ? A : "transparent", color: loading ? "#fff" : A,
    fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer",
    fontFamily: "system-ui,sans-serif", transition: "all 0.2s",
  };
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

  return (
    <>
      {/* ═══ 打印样式 ═══ */}
      <style>{`
        @media print {
          nav, header, footer, .navbar, [data-nav] {
            display: none !important;
          }
          body {
            background: #faf8f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .newspaper-paper {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 auto 16px !important;
          }
          [data-save-buttons], [data-toolbar] {
            display: none !important;
          }
          @page {
            margin: 8mm;
            size: A4;
          }
        }
        /* ─── 手机端：横向滚动保持桌面级渲染 ─── */
        @media (max-width: 920px) {
          .history-scroll-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
          }
          .history-scroll-wrapper::-webkit-scrollbar {
            height: 4px;
          }
          .history-scroll-wrapper::-webkit-scrollbar-thumb {
            background: #d4c5b2;
            border-radius: 2px;
          }
        }
      `}</style>

      {/* ═══ 顶部工具栏 ═══ */}
      {mounted && (
        <div data-toolbar className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <span className="text-sm mr-2" style={{ color: "#777" }}>
            共 {yearCount} 年年报（{startYear}年至今）
          </span>
          <button type="button" onClick={saveAllPDF} disabled={savingAllPdf} style={topBtn(savingAllPdf)} title="可能需要关闭浏览器的窗口拦截">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
            {savingAllPdf ? "生成中…" : "保存全部为PDF"}
          </button>
          <button type="button" onClick={saveAllAsImage} disabled={savingAllImg} style={topBtn(savingAllImg)} title="页面左侧上暂时出现图片是正常现象">
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
      <div className="space-y-8">
        {yearDetails.map(({ year, members, projects, events, activities, activeMembers }) => (
          <div key={year} className="history-scroll-wrapper">
            <YearNewspaper
              year={year}
              members={members}
              projects={projects}
              events={events}
              activities={activities}
              activeMembers={activeMembers}
              startYear={startYear}
              registerRef={(el) => registerPaper(year, el)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
