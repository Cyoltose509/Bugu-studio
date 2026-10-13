"use client";

import {useRef, useCallback, useState, useEffect, memo} from "react";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import {RichContentClient} from "@/components/ui/RichContentClient";
import {saveElementAsPDF, saveElementAsImage} from "@/lib/print-utils";
import {newspaperPositionLabel} from "@/lib/position";
import {useLang} from "@/lib/i18n/LangProvider";
import {t} from "@/lib/i18n/dict";
import type {Lang} from "@/lib/i18n/config";
import type {AwardEntry} from "@/lib/history/awards";
import {tagDisplayName} from "@/lib/tags/tag-names";
import TrophyIcon from "@/components/icons/TrophyIcon";

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
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    coverImage: string | null;
    type: string;
    tags?: { tag: { name: string } }[];
    members?: { memberId: string | null; externalName: string | null; roles: string[]; member?: { displayName: string } | null }[];
    _count?: { likes: number };
    awards?: string[];
    aiUsages?: string[];
}

interface EventItem {
    id: string;
    title: string;
    body: string | null;
    bodyHtml?: string;  // 预渲染的富文本 HTML
    eventDate: string | null;
    eventEndDate?: string | null;
    images?: { id: string; url: string; altText?: string | null }[];
}

interface Activity {
    id: string;
    title: string;
    type: string;
    status?: string | null;
    startTime: Date | string;
    coverImage: string | null;
    description: string | null;
    descriptionHtml?: string;  // 预渲染的富文本 HTML
    summary: string | null;
}

interface ActiveMember extends Member {
    score: number;
    projects: number;
    competitions: number;
    courses: number;
    meetings: number;
}

export interface SectionVisibility {
    lead: boolean;
    stats: boolean;
    projects: boolean;
    awards: boolean;
    members: boolean;
    activeMembers: boolean;
    activities: boolean;
    events: boolean;
}

interface Props {
    year: number;
    members: Member[];
    projects: Project[];
    events: EventItem[];
    activities: Activity[];
    activeMembers: ActiveMember[];
    presidents: Member[];
    awards?: AwardEntry[];
    startYear: number;
    registerRef?: (el: HTMLDivElement | null) => void;
    sections: SectionVisibility;
}

const TYPE_DESC: Record<string, { cn: string; en: string }> = {
    IN_DEVELOPMENT: { cn: "开发中", en: "In Development" },
    TRIAL_DEMO: { cn: "提供试玩", en: "Playable Demo" },
    MINI_GAME: { cn: "小游戏", en: "Mini Game" },
    OFFICIAL_RELEASE: { cn: "正式上架", en: "Official Release" },
};
const ACT_LABELS: Record<string, { cn: string; en: string }> = {
    COMPETITION: { cn: "比赛", en: "Competition" },
    COURSE: { cn: "公开课", en: "Course" },
    GENERAL: { cn: "普通活动", en: "Event" },
    MEETING: { cn: "例会", en: "Meeting" },
};
const ACT_ORDER = ["COMPETITION", "COURSE", "GENERAL", "MEETING"] as const;

// ─── 年度最佳作品选择 ─────────────────────────────────
function pickFeaturedWork(projects: Project[]): Project | null {
    if (projects.length === 0) return null;
    // 权重：正式上架 x1.0, 提供试玩 x0.8, 小游戏 x0.6, 开发中 x0.4
    // 奖项加权：整体权重 × (1 + 奖项数)
    // AI 创作惩罚：若涉及 AI 创作（AI_ART / AI_MUSIC，非 AI 生成式内容），权重 × 0.5
    const getWeight = (type: string) => {
        switch (type) {
            case "OFFICIAL_RELEASE": return 1.0;
            case "TRIAL_DEMO": return 0.8;
            case "MINI_GAME": return 0.6;
            case "IN_DEVELOPMENT": return 0.4;
            default: return 1.0;
        }
    };
    const scored = projects.map(p => {
        const likes = p._count?.likes ?? 0;
        const awardCount = (p.awards || []).length;
        const hasAiCreation = (p.aiUsages || []).some((u: string) => u !== "AI_GENERATED");
        const aiPenalty = hasAiCreation ? 0.5 : 1.0;
        const score = getWeight(p.type) * (likes || 0) * (1 + awardCount) * aiPenalty;
        return {p, score};
    });
    scored.sort((a, b) => b.score - a.score);
    // 如果所有作品得分相同（都是0），优先正式上架 > 提供试玩 > 小游戏 > 开发中
    if (scored.every(s => s.score === scored[0].score)) {
        const order: Record<string, number> = { OFFICIAL_RELEASE: 1, TRIAL_DEMO: 2, MINI_GAME: 3, IN_DEVELOPMENT: 4 };
        scored.sort((a, b) => (order[a.p.type] || 5) - (order[b.p.type] || 5));
    }
    return scored[0].p;
}

// ─── 叙事文案 ────────────────────────────────────────
function generateLead(lang: Lang, year: number, members: Member[], projects: Project[], activities: Activity[], events: EventItem[], yearIndex: number, activeMembers: ActiveMember[]): string {
    const lines: string[] = [];
    const sep = t(lang, "history.lead.listSep");

    if (yearIndex === 1) {
        lines.push(t(lang, "history.lead.yearOne", { year }));
    } else {
        lines.push(t(lang, "history.lead.yearN", { year, n: yearIndex }));
    }

    if (members.length > 0) {
        lines.push(t(lang, "history.lead.newMembers", { n: members.length }));
    }
    if (activeMembers.length > 0) {
        lines.push(t(lang, "history.lead.activeMembersLine", { n: activeMembers.length }));
    }

    if (projects.length > 0) {
        const officialCount = projects.filter(p => p.type === "OFFICIAL_RELEASE").length;
        const trialCount = projects.filter(p => p.type === "TRIAL_DEMO").length;
        const miniCount = projects.filter(p => p.type === "MINI_GAME").length;
        const devCount = projects.filter(p => p.type === "IN_DEVELOPMENT").length;
        const parts: string[] = [];
        if (officialCount > 0) parts.push(t(lang, "history.lead.worksPartOfficial", { n: officialCount }));
        if (trialCount > 0) parts.push(t(lang, "history.lead.worksPartTrial", { n: trialCount }));
        if (miniCount > 0) parts.push(t(lang, "history.lead.worksPartMini", { n: miniCount }));
        if (devCount > 0) parts.push(t(lang, "history.lead.worksPartDev", { n: devCount }));
        lines.push(t(lang, "history.lead.worksSummary", { n: projects.length, parts: parts.join(sep) }));
    }

    if (activities.length > 0) {
        const actCounts: Record<string, number> = {};
        for (const a of activities) actCounts[a.type] = (actCounts[a.type] || 0) + 1;
        const parts: string[] = [];
        for (const type of ACT_ORDER) {
            if (actCounts[type]) parts.push(t(lang, "history.lead.activityPart", { label: ACT_LABELS[type][lang], n: actCounts[type] }));
        }
        lines.push(t(lang, "history.lead.activitiesSummary", { n: activities.length, parts: parts.join(sep) }));
    }

    if (events.length > 0) {
        lines.push(t(lang, "history.lead.eventsSummary", { n: events.length }));
    }

    return lines.join("");
}

function generateMemberHighlight(lang: Lang, activeMembers: ActiveMember[]): string[] {
    const top3 = activeMembers.slice(0, 3);
    if (top3.length === 0) return [];
    const sep = t(lang, "history.lead.listSep");
    return top3.map(m => {
        const parts: string[] = [];
        if (m.projects > 0) parts.push(t(lang, "history.lead.memberPartWorks", { n: m.projects }));
        if (m.competitions > 0) parts.push(t(lang, "history.lead.memberPartCompetitions", { n: m.competitions }));
        if (m.courses > 0) parts.push(t(lang, "history.lead.memberPartCourses", { n: m.courses }));
        if (m.meetings > 0) parts.push(t(lang, "history.lead.memberPartMeetings", { n: m.meetings }));
        const detail = parts.join(sep) || t(lang, "history.lead.memberActive");
        return t(lang, "history.lead.memberParticipated", { detail });
    });
}

// ─── 格式化制作名单 ──────────────────────────────────
function formatCredits(members: NonNullable<Project["members"]>): string {
    return members.map(pm => pm.member?.displayName || pm.externalName || "?").filter(Boolean).join("、");
}

// ─── 活动描述叙事 ────────────────────────────────────
function narrateActivity(act: Activity): string {
    const desc = act.description || act.summary;
    if (!desc) return "";
    return desc.replace(/\n{3,}/g, "\n\n").trim();
}

// ═══════════════════════════════════════════════════════
//  字体样式（无法用 Tailwind 表达的多 fallback 字体栈）
// ═══════════════════════════════════════════════════════
const F_SERIF: React.CSSProperties = {fontFamily: "'Noto Serif SC','STSong','SimSun',Georgia,serif"};
const F_SANS: React.CSSProperties = {fontFamily: "system-ui,'Microsoft YaHei',sans-serif"};
const F_SANS_SM: React.CSSProperties = {fontFamily: "system-ui,sans-serif"};
const F_GEORGIA: React.CSSProperties = {fontFamily: "Georgia,serif"};
const F_GEORGIA_TNR: React.CSSProperties = {fontFamily: "Georgia,'Times New Roman',serif"};

// ═══════════════════════════════════════════════════════
//  橄榄枝（月桂叶）：程序化生成，左右对称，像括号一样包住奖项
//  参考样式：小椭圆叶密集排列在弧线两侧，颜色用 --np-laurel（青色）
// ═══════════════════════════════════════════════════════
const LAUREL_VIEWBOX = "0 0 80 200";

function LaurelBranch({flip = false, className = ""}: { flip?: boolean; className?: string }) {
    // 茎是一条左开口的二次贝塞尔曲线，像半个括号 "("
    const P0 = { x: 54, y: 10 };
    const P1 = { x: 2, y: 100 };
    const P2 = { x: 54, y: 190 };

    const bezier = (t: number) => {
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        return {
            x: a * P0.x + b * P1.x + c * P2.x,
            y: a * P0.y + b * P1.y + c * P2.y,
        };
    };

    // 切线角度（度）
    const tangentDeg = (t: number) => {
        const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
        const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
        return (Math.atan2(dy, dx) * 180) / Math.PI;
    };

    // 平滑的茎路径
    const stemPath = `M ${P0.x},${P0.y} Q ${P1.x},${P1.y} ${P2.x},${P2.y}`;

    // 叶片：带尖端的披针形（参考图不是钝椭圆，是两头尖的细叶）
    const leafPath = (len: number, wid: number) =>
        `M 0,0 C ${len * 0.28},${-wid} ${len * 0.72},${-wid * 0.85} ${len},0` +
        ` C ${len * 0.72},${wid * 0.85} ${len * 0.28},${wid} 0,0 Z`;

    // 羽状对生叶：每个节点沿茎两侧各出一片，密集交叠成一条粗羽枝
    const leaves: React.ReactElement[] = [];
    const PAIRS = 16;
    for (let i = 0; i < PAIRS; i++) {
        const t = 0.04 + (i / (PAIRS - 1)) * 0.88;  // 0.04 ~ 0.92
        const p = bezier(t);
        const theta = tangentDeg(t);
        // 中段叶最大，向两端渐小
        const sizeFactor = 1 - 0.3 * Math.abs(t - 0.48) * 2;
        const len = 16 * sizeFactor;
        const wid = 6.0 * sizeFactor;
        for (const side of [1, -1]) {
            leaves.push(
                <path key={`${i}-${side}`} d={leafPath(len, wid)}
                      transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(theta + side * 62).toFixed(1)})`}/>
            );
        }
    }
    // 两端各补一片沿茎延长线的顶叶
    for (const t of [0, 1]) {
        const p = bezier(t);
        const theta = tangentDeg(t);
        leaves.push(
            <path key={`tip-${t}`} d={leafPath(7.5, 2.4)}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${theta.toFixed(1)})`}/>
        );
    }

    return (
        <svg viewBox={LAUREL_VIEWBOX} className={className} aria-hidden="true"
             fill="currentColor" style={flip ? {transform: "scaleX(-1)"} : undefined}>
            <path d={stemPath} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"/>
            {leaves}
        </svg>
    );
}

/**
 * 橄榄枝括号：像一对括号一样包住内容，gap 控制枝叶与文字的左右间距（px）
 */
function LaurelBracket({children, gap = 10}: { children: React.ReactNode; gap?: number }) {
    return (
        <div className="flex items-stretch justify-center w-full" style={{columnGap: gap}}>
            <LaurelBranch className="w-7 sm:w-8 shrink-0 self-stretch text-[color:var(--np-laurel)]"/>
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center py-1.5">
                {children}
            </div>
            <LaurelBranch flip className="w-7 sm:w-8 shrink-0 self-stretch text-[color:var(--np-laurel)]"/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
//  静态样式 — 配色走 .newspaper-paper CSS 变量，自适应昼/夜
// ═══════════════════════════════════════════════════════
const Q: Record<string, string> = {
    outer: "max-w-[1080px] mx-auto mb-12",
    paper: "text-[color:var(--np-ink)]",

    // ── 报头（借鉴年报模板 masthead：三行式） ──
    masthead: "px-6 sm:px-10 pt-6 pb-4",
    mastTopRow: "flex justify-between items-end border-b pb-1.5 mb-1.5 text-[9px] sm:text-xs uppercase tracking-[2px] sm:tracking-[3px] font-bold np-ink2",
    mastTitleBlock: "text-center pt-3 pb-4",
    mastClubName: "text-4xl sm:text-6xl md:text-7xl font-black tracking-[6px] sm:tracking-[10px] np-club leading-tight",
    mastYearRow: "flex items-baseline justify-center gap-3 sm:gap-6 mt-2",
    mastYearEn: "text-lg sm:text-2xl italic np-ink2",
    mastYear: "text-5xl sm:text-7xl font-bold np-club leading-none",
    mastYearCn: "text-lg sm:text-2xl italic np-ink2",
    mastBotRow: "flex justify-between items-center border-t border-b py-1.5 text-[9px] sm:text-xs font-bold uppercase tracking-[1.5px] np-ink2",

    // ── 分栏 ──
    main: "grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 sm:px-10 pt-6 pb-8",
    colLeft: "lg:col-span-8 min-w-0",
    colRight: "lg:col-span-4 min-w-0",
    colRightInner: "flex flex-col gap-8 lg:pl-2",
    leadText: "text-sm np-ink2 text-justify tracking-[0.3px] leading-loose",

    // ── 通用小元素 ──
    rule: "h-px my-4",
    thickRule: "h-[2px] my-5",
    sectionTitle: "text-[15px] font-bold np-gold tracking-[8px] text-center mb-4",
    featuredWrap: "grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6",
    featuredImgArea: "w-full aspect-[16/10] overflow-hidden border np-border",
    featuredImgPH: "w-full h-full flex items-center justify-center np-ph",
    featuredInfo: "flex flex-col gap-[10px] pt-1",
    featuredTitle: "text-2xl font-extrabold np-ink leading-[1.3]",
    featuredSubtitle: "text-sm np-ink3 leading-[1.6] italic",
    featuredMeta: "flex items-center gap-[14px]",
    featuredTypeTag: "text-[11px] np-type-tag px-[10px] py-[3px] font-semibold tracking-[2px]",
    featuredLikes: "text-[13px] np-orange font-bold",
    featuredPeople: "text-xs np-ink3 leading-[1.7]",
    awardTag: "text-[10px] np-award-tag px-2 py-[2px] inline-block mr-1 mb-1",
    worksSpread: "grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-y-5 gap-x-[14px] mb-2",
    workItem: "flex flex-col",
    workImgWrapSm: "w-full aspect-[16/10] overflow-hidden mb-[6px] border np-border-l",
    workImgPH: "w-full h-full flex items-center justify-center np-ph",
    workPHIcon: "text-2xl opacity-40",
    workCaption: "flex flex-col gap-[2px]",
    workName: "text-[13px] font-bold np-ink flex items-baseline gap-[6px]",
    workType: "text-[9px] font-normal np-gold italic",
    workTagLine: "flex flex-wrap gap-1 mt-[2px]",
    workTag: "text-[9px] px-[6px] py-[1px] np-work-tag",
    workCredit: "text-[10px] np-ink3 mt-[1px]",

    // ── 右栏面板 ──
    sidePanel: "border-2 np-border-l px-4 py-4 text-center np-panel",
    sidePanelTitle: "font-black uppercase tracking-[4px] border-b np-border-l pb-2 mb-4 text-[13px] np-ink2",
    statGrid: "grid grid-cols-2 gap-4",

    roster: "flex flex-wrap gap-[14px]",
    rosterItem: "flex items-center gap-[7px]",
    rosterAvatar: "w-[34px] h-[34px] rounded-full overflow-hidden flex items-center justify-center shrink-0 np-avatar",
    rosterInitial: "text-white text-sm font-bold",
    rosterName: "text-[13px] np-ink2",
    highlightList: "flex flex-col gap-[14px] mb-2",
    highlightItem: "text-[13px] leading-[1.9] np-ink2 m-0 flex items-start gap-3 text-justify",

    activityList: "flex flex-col gap-[14px] mt-1",
    activityItem: "",
    activityHeader: "flex items-baseline gap-[10px] flex-wrap mb-1",
    activityTitle: "text-sm font-bold np-ink",
    activityDate: "text-[11px] np-gold italic ml-[10px]",
    activityDesc: "text-[13px] np-ink3 leading-loose whitespace-pre-wrap text-justify np-rich",

    timeline: "flex flex-col gap-0",
    tlItem: "flex gap-4 relative",
    tlMarker: "flex flex-col items-center w-[14px] shrink-0 relative",
    tlDot: "w-[10px] h-[10px] rounded-full bg-[var(--np-green)] mt-2 shrink-0 relative z-[1]",
    tlStem: "absolute top-[18px] bottom-[-4px] left-[6.5px] w-px bg-[var(--np-linel)]",
    tlContent: "flex-1 pt-2 pb-4",
    tlHeader: "flex items-baseline gap-[10px] flex-wrap",
    tlTitle: "text-sm font-bold np-ink",
    tlDate: "text-[11px] np-gold italic",
    tlBody: "text-xs np-ink3 leading-[1.8] mt-1 whitespace-pre-wrap np-rich",
    tlImages: "flex gap-2 mt-2 flex-wrap",
    tlImgWrap: "relative w-[120px] h-[80px] rounded-[2px] overflow-hidden border np-border-l cursor-zoom-in shrink-0",

    colophon: "text-center text-[11px] np-line-fg leading-[1.8] tracking-[3px] pb-8",
    colophonUrl: "text-[9px] tracking-[1px] opacity-70",
};

const QS: Record<string, React.CSSProperties> = {
    rule: {background: "linear-gradient(90deg,transparent 15%,var(--np-linel) 35%,var(--np-gold) 50%,var(--np-linel) 65%,transparent 85%)"},
    thickRule: {background: "linear-gradient(90deg,transparent 10%,var(--np-line) 30%,var(--np-gold) 50%,var(--np-line) 70%,transparent 90%)"},
    clubName: F_SANS,
    sectionTitle: F_SANS,
    featuredTitle: F_SANS,
    featuredTypeTag: F_SANS_SM,
    featuredLikes: F_GEORGIA,
    featuredPeople: F_SANS,
    awardTag: F_SANS,
    workName: F_SANS,
    workType: F_GEORGIA,
    workTag: F_SANS,
    workCredit: F_SANS,
    rosterInitial: F_SANS_SM,
    rosterName: F_SANS,
    activityTitle: F_SANS,
    activityDate: F_GEORGIA,
    tlTitle: F_SANS,
    tlDate: F_GEORGIA,
    colophon: F_SANS,
    colophonUrl: F_GEORGIA,
    sidePanelTitle: F_SANS,
};

const STAT_Q: Record<string, string> = {
    statBox: "flex flex-col items-center gap-1",
    statNum: "text-[32px] font-black np-club leading-none",
    statLabel: "text-[11px] np-ink3 tracking-[1px]",
};
const STAT_S: Record<string, React.CSSProperties> = {
    statNum: F_GEORGIA,
    statLabel: F_SANS,
};

// 报头粗细双线（上粗下细 / 上细下粗，报纸经典样式）
const MAST_BLOCK_STYLE: React.CSSProperties = {
    borderTop: "4px solid var(--np-ink)",
    borderBottom: "1px solid var(--np-ink)",
};
const MAST_BOT_STYLE: React.CSSProperties = {
    borderTop: "1px solid var(--np-ink)",
    borderBottom: "1px solid var(--np-ink)",
};

function actDotClass(t: string): string {
    const map: Record<string, string> = {
        COMPETITION: "np-act-dot-competition",
        COURSE: "np-act-dot-course",
        GENERAL: "np-act-dot-general",
        MEETING: "np-act-dot-meeting",
    };
    return `w-2 h-2 rounded-full shrink-0 ${map[t] || "np-act-dot-meeting"}`;
}

function highlightDropClass(i: number): string {
    return "w-[var(--drop-size)] h-[var(--drop-size)] rounded-full shrink-0 flex items-center justify-center text-white text-[15px] font-bold overflow-hidden";
}
function highlightDropStyle(i: number): React.CSSProperties {
    const colors = ["var(--np-gold)", "#a0a0a0", "#c4885a"];
    const sizes = [38, 34, 34];
    return {
        "--drop-size": `${sizes[i] || 34}px`,
        background: `linear-gradient(135deg,${colors[i] || "#a0a0a0"},${i === 0 ? "#d4b87a" : i === 1 ? "#c0c0c0" : "#d4a57a"})`,
    } as React.CSSProperties;
}

function activityTypeTagClass(t: string): string {
    const map: Record<string, string> = {
        COMPETITION: "np-act-tag-competition",
        COURSE: "np-act-tag-course",
        GENERAL: "np-act-tag-general",
        MEETING: "np-act-tag-meeting",
    };
    return `text-[10px] font-semibold text-white ${map[t] || "np-act-tag-meeting"} px-2 py-[2px] tracking-[1px] shrink-0`;
}

// ─── 小组件 ──────────────────────────────────────────
function StatBox({num, label}: { num: number; label: string }) {
    return <div className={STAT_Q.statBox}>
        <div className={STAT_Q.statNum}>{num}</div>
        <div className={STAT_Q.statLabel}>{label}</div>
    </div>;
}

// ─── 保存菜单（右下角：单个线性图标，点击展开 PDF / 长图） ──
function SaveMenu({onImage, onPdf, saving, savingPdf, year}: {
    onImage: () => void; onPdf: () => void; saving: boolean; savingPdf: boolean; year: number;
}) {
    const { lang } = useLang();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // 点击菜单外部时收起
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const itemClass = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 bg-transparent border-[color:var(--np-line)] text-[color:var(--np-ink2)] hover:border-[color:var(--np-gold)] hover:text-[color:var(--np-ink)] cursor-pointer disabled:opacity-50";

    return (
        <div ref={rootRef} className="relative flex justify-end" data-save-buttons>
            {open ? (
                <div className="flex items-center gap-2 animate-fade-in">
                    <button type="button" onClick={() => { setOpen(false); onPdf(); }} disabled={savingPdf}
                            className={itemClass} aria-label={t(lang, "history.saveAsPdf", { y: year })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        {savingPdf ? t(lang, "common.generating") : "PDF"}
                    </button>
                    <button type="button" onClick={() => { setOpen(false); onImage(); }} disabled={saving}
                            className={itemClass} aria-label={t(lang, "history.saveAsImage", { y: year })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        {saving ? t(lang, "common.generating") : t(lang, "history.saveImageLabel")}
                    </button>
                </div>
            ) : (
                <button type="button" onClick={() => setOpen(true)} disabled={saving || savingPdf}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent text-[color:var(--np-ink3)] hover:text-[color:var(--np-ink)] hover:border-[color:var(--np-line)] transition-all duration-200 cursor-pointer"
                        aria-label={t(lang, "history.saveTitle", { y: year })} title={t(lang, "history.saveTitle", { y: year })}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                         strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </button>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
//  主组件
// ═══════════════════════════════════════════════════════
function YearNewspaper({
    year,
    members,
    projects,
    events,
    activities,
    activeMembers,
    presidents,
    awards = [],
    startYear,
    registerRef,
    sections,
}: Props) {
    const { lang } = useLang();
    const paperRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [savingPdf, setSavingPdf] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const yearIndex = year - startYear + 1;

    // 向父组件注册 paperRef
    useEffect(() => {
        if (registerRef && paperRef.current) {
            registerRef(paperRef.current);
            return () => registerRef(null);
        }
    }, [registerRef]);

    const topNarrative = generateMemberHighlight(lang, activeMembers);
    const leadText = generateLead(lang, year, members, projects, activities, events, yearIndex, activeMembers);
    const featuredWork = pickFeaturedWork(projects);
    // 过滤掉 hero 作品后的其余作品
    const otherWorks = featuredWork ? projects.filter(p => p.id !== featuredWork.id) : projects;

    const actCounts: Record<string, number> = {};
    for (const a of activities) actCounts[a.type] = (actCounts[a.type] || 0) + 1;
    const nonMeeting = activities.filter(a => a.type !== "MEETING");
    const meetingCount = activities.filter(a => a.type === "MEETING").length;

    // 奖项已按「获奖年份」在数据层归位（see lib/history/awards.ts）
    const awardEntries = awards;

    // ── 保存图片（html-to-image: SVG foreignObject） ──
    const saveImage = useCallback(async () => {
        if (!paperRef.current || saving) return;
        setSaving(true);
        try {
            await saveElementAsImage(paperRef.current, `${t(lang, "brand.name")}·${year}${lang === "en" ? " Annual Review" : "年度回顾"}.png`);
            // 保存完毕后强制刷新页面，杜绝第二次保存时图片错乱
            setTimeout(() => window.location.reload(), 300);
        } catch (e) {
            console.error("保存图片失败", e);
            setSaving(false);
        }
    }, [saving, year]);

    // ── 保存PDF（新窗口 + 动态 @page 尺寸 → 链接可点击 + 不截页） ──
    const savePDF = useCallback(async () => {
        if (!paperRef.current || savingPdf) return;
        setSavingPdf(true);
        try {
            await saveElementAsPDF(paperRef.current, `${t(lang, "brand.name")}·${year}${lang === "en" ? " Annual Review" : "年度回顾"}.pdf`);
            // 刷新页面确保下次保存状态干净
            setTimeout(() => window.location.reload(), 300);
        } catch (e) {
            console.error("保存PDF失败", e);
            setSavingPdf(false);
        }
    }, [savingPdf, year]);

    const hasContent = members.length > 0 || projects.length > 0 || events.length > 0 || activities.length > 0;
    if (!hasContent) return null;

    // ── 分栏内容判定（隐藏的栏目不占位） ──
    const showLead = sections.lead;
    const showProjects = sections.projects && projects.length > 0;
    const showActivities = sections.activities && (nonMeeting.length > 0 || meetingCount > 0);
    const showEvents = sections.events && events.length > 0;
    const showStats = sections.stats;
    const showAwards = sections.awards && awardEntries.length > 0;
    const showMembers = sections.members && members.length > 0;
    const showActive = sections.activeMembers && (activeMembers.length > 0 || presidents.length > 0);

    const hasLeft = showLead || showProjects || showActivities || showEvents;
    const hasRight = showStats || showAwards || showMembers || showActive;

    return (
        <>
            <article className={Q.outer}>

                <div ref={paperRef} className={`newspaper-paper ${Q.paper}`} style={F_SERIF}>
                    {/* ═══ 报头（三行式 masthead） ═══ */}
                    <header className={Q.masthead}>
                        <div className={Q.mastTopRow} style={F_SANS_SM}>
                            <span>Vol. {yearIndex} — Est. 2019</span>
                            <span>The Bugoo Studio Gazette</span>
                            <span>Issue No. {yearIndex}</span>
                        </div>

                        <div className={Q.mastTitleBlock} style={MAST_BLOCK_STYLE}>
                            <h1 className={Q.mastClubName} style={{...F_SANS, ...QS.clubName}}>{t(lang, "brand.name")}</h1>
                            <div className={Q.mastYearRow}>
                                <span className={Q.mastYearEn} style={F_GEORGIA}>Annual Review</span>
                                <span className={Q.mastYear} style={{...F_GEORGIA_TNR, textRendering: "geometricPrecision"}}>{year}</span>
                                <span className={Q.mastYearCn} style={F_GEORGIA}>{t(lang, "history.annualReview")}</span>
                            </div>
                        </div>

                        <div className={Q.mastBotRow} style={{...MAST_BOT_STYLE, ...F_SANS_SM}}>
                            <span>WHU · Wuhan</span>
                            <span>Published · {year}</span>
                            <span>Free · Priceless</span>
                        </div>
                    </header>

                    {/* ═══ 左右分栏 ═══ */}
                    <div className={Q.main}>

                        {/* ─── 左栏（主内容） ─── */}
                        {hasLeft && (
                            <div className={`${Q.colLeft} ${hasRight ? "lg:border-r lg:border-[color:var(--np-linel)] lg:pr-8" : ""}`}>

                                {/* 卷首语 */}
                                {showLead && (
                                    <>
                                        <div className="mb-5">
                                        <h2 className="text-xl sm:text-2xl font-black np-ink leading-tight border-b-2 border-[color:var(--np-ink)] pb-2" style={F_SANS}>
                                            {yearIndex <= 1
                                                ? t(lang, "history.leadFirst")
                                                : t(lang, "history.leadN", { n: yearIndex })}
                                        </h2>
                                            <p className={`${Q.leadText} mt-3`} style={F_SERIF}>{leadText}</p>
                                        </div>
                                        <div className={Q.rule} style={QS.rule}/>
                                    </>
                                )}

                                {/* 作品巡礼 */}
                                {showProjects && (
                                    <>
                                        <div className={Q.sectionTitle}>{t(lang, "history.worksSection")}</div>

                                        {/* 年度代表作（大头） */}
                                        {featuredWork && (
                                            <div className={Q.featuredWrap}>
                                                <Link href={`/works/${featuredWork.slug}`} className="block">
                                                    <div className={Q.featuredImgArea}>
                                                        {featuredWork.coverImage ? (
                                                            <SafeImage src={featuredWork.coverImage} alt={featuredWork.title}
                                                                       className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <div className={Q.featuredImgPH}><span className="text-4xl opacity-40">🎮</span></div>
                                                        )}
                                                    </div>
                                                </Link>
                                                <div className={Q.featuredInfo}>
                                                    <div className={Q.featuredTitle} style={F_SANS}>
                                                        <Link href={`/works/${featuredWork.slug}`}
                                                              className="text-inherit no-underline">
                                                            {featuredWork.title}
                                                        </Link>
                                                    </div>
                                                    {featuredWork.subtitle && <div className={Q.featuredSubtitle}>{featuredWork.subtitle}</div>}
                                                    <div className={Q.featuredMeta}>
                                                        <span className={Q.featuredTypeTag} style={F_SANS_SM}>{TYPE_DESC[featuredWork.type]?.[lang] || featuredWork.type}</span>
                                                        <span className={Q.featuredLikes} style={F_GEORGIA}>♥ {(featuredWork._count?.likes ?? 0)}</span>
                                                    </div>
                                                    {featuredWork.tags && featuredWork.tags.length > 0 && (
                                                        <div className={Q.workTagLine}>
                                                            {featuredWork.tags.slice(0, 4).map((t: any) => (
                                                                <span key={t.tag.name} className={Q.workTag}>{tagDisplayName(t.tag.slug, t.tag.name, lang)}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {featuredWork.awards && featuredWork.awards.length > 0 && (
                                                        <div className="mt-2">
                                                            {featuredWork.awards.map((award, i) => (
                                                                <span key={i} className={Q.awardTag}><TrophyIcon size={12} className="mr-1 align-[-0.15em]" />{award}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {featuredWork.members && featuredWork.members.length > 0 && (
                                                        <div className={Q.featuredPeople}>{formatCredits(featuredWork.members)}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 其余作品网格（不含 hero） */}
                                        {otherWorks.length > 0 && (
                                            <div className={Q.worksSpread}>
                                                {otherWorks.map((p) => (
                                                    <div key={p.id} className={Q.workItem}>
                                                        <Link href={`/works/${p.slug}`} className="block">
                                                            <div className={Q.workImgWrapSm}>
                                                                {p.coverImage ? (
                                                                    <SafeImage src={p.coverImage} alt={p.title}
                                                                               className="w-full h-full object-cover"/>
                                                                ) : (
                                                                    <div className={Q.workImgPH}><span className={Q.workPHIcon}>🎮</span></div>
                                                                )}
                                                            </div>
                                                        </Link>
                                                        <div className={Q.workCaption}>
                                                            <div className={Q.workName}>
                                                                <Link href={`/works/${p.slug}`} className="text-inherit no-underline">
                                                                    {p.title}
                                                                </Link>
                                                                <span className={Q.workType} style={F_GEORGIA}>{TYPE_DESC[p.type]?.[lang] || p.type}</span>
                                                            </div>
                                                            {p.tags && p.tags.length > 0 && (
                                                                <div className={Q.workTagLine}>
                                                                    {p.tags.slice(0, 3).map((t: any) => (
                                                                        <span key={t.tag.name} className={Q.workTag}>{tagDisplayName(t.tag.slug, t.tag.name, lang)}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {p.members && p.members.length > 0 && (
                                                                <div className={Q.workCredit}>{formatCredits(p.members)}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {(showActivities || showEvents) && <div className={Q.thickRule} style={QS.thickRule}/>}
                                    </>
                                )}

                                {/* 活动回顾 */}
                                {showActivities && (
                                    <>
                                        <div className={Q.sectionTitle}>{t(lang, "history.activitiesSection")}</div>

                                        {meetingCount > 0 && (
                                            <p className="text-[13px] np-ink2 leading-loose text-justify mb-4">
                                                {t(lang, "history.meetingsCount", { n: meetingCount })}
                                            </p>
                                        )}

                                        {nonMeeting.length > 0 && (
                                            <div className={Q.activityList}>
                                                {nonMeeting.map(a => {
                                                    const d = new Date(a.startTime);
                                                    const desc = narrateActivity(a);
                                                    const descHtml = a.descriptionHtml;
                                                    return (
                                                        <div key={a.id} className={Q.activityItem}>
                                                            <div className={Q.activityHeader}>
                                                                <span className={activityTypeTagClass(a.type)}>{ACT_LABELS[a.type]?.[lang] || a.type}</span>
                                                                <Link href={`/activities/${a.id}`}
                                                                      className="text-inherit no-underline">
                                                                    <span className={Q.activityTitle} style={QS.activityTitle}>{a.title}</span>
                                                                </Link>
                                                                {a.status === "ARCHIVED" &&
                                                                    <span className="text-[10px] np-ink3 italic">({t(lang, "common.archived")})</span>}
                                                                <span
                                                                    className={Q.activityDate} style={QS.activityDate}>{d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, "0")}.{String(d.getDate()).padStart(2, "0")}</span>
                                                            </div>
                                                            {descHtml ?
                                                                <div className={Q.activityDesc} style={QS.activityDesc}><RichContentClient html={descHtml}/></div> : desc &&
                                                                <div className={Q.activityDesc} style={QS.activityDesc}>{desc}</div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {showEvents && <div className={Q.thickRule} style={QS.thickRule}/>}
                                    </>
                                )}

                                {/* 大事记 */}
                                {showEvents && (
                                    <>
                                        <div className={Q.sectionTitle}>{t(lang, "history.eventsSection")}</div>
                                        <div className={Q.timeline}>
                                            {events.map((e) => {
                                                const d = e.eventDate ? new Date(e.eventDate) : null;
                                                const de = e.eventEndDate ? new Date(e.eventEndDate) : null;
                                                const showRange = d && de && de.getTime() !== d.getTime();
                                                return (
                                                    <div key={e.id} className={Q.tlItem}>
                                                        <div className={Q.tlMarker}>
                                                            <span className={Q.tlDot}/>
                                                            <span className={Q.tlStem}/>
                                                        </div>
                                                        <div className={Q.tlContent}>
                                                            <div className={Q.tlHeader}>
                                                                <span className={Q.tlTitle} style={QS.tlTitle}>{e.title}</span>
                                                                {d && <span className={Q.tlDate} style={QS.tlDate}>
                                                                  {showRange
                                                                      ? t(lang, "history.dateRange", { m: d.getMonth() + 1, d: d.getDate(), m2: de!.getMonth() + 1, d2: de!.getDate() })
                                                                      : t(lang, "history.dateSingle", { m: d.getMonth() + 1, d: d.getDate() })}
                                                                </span>}
                                                            </div>
                                                            {e.bodyHtml ?
                                                                <div className={Q.tlBody} style={QS.tlBody}><RichContentClient html={e.bodyHtml}/></div> : e.body &&
                                                                <div className={Q.tlBody} style={QS.tlBody}>{e.body}</div>}
                                                            {e.images && e.images.length > 0 && (
                                                                <div className={Q.tlImages}>
                                                                    {e.images.map((img) => (
                                                                        <button
                                                                            key={img.id}
                                                                            type="button"
                                                                            className={Q.tlImgWrap}
                                                                            onClick={() => setLightboxSrc(img.url)}
                                                                            aria-label={t(lang, "common.viewImage")}
                                                                        >
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img
                                                                                src={img.url}
                                                                                alt={img.altText || e.title}
                                                                                width={120}
                                                                                height={80}
                                                                                className="w-full h-full object-cover block"
                                                                                loading="lazy"
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ─── 右栏（侧栏） ─── */}
                        {hasRight && (
                            <div className={Q.colRight}>
                                <div className={Q.colRightInner}>

                                    {/* 数字面板 */}
                                    {showStats && (
                                        <div className={Q.sidePanel}>
                                            <div className={Q.sidePanelTitle}>By The Numbers</div>
                                            <div className={Q.statGrid}>
                                                {members.length > 0 && <StatBox num={members.length} label={t(lang, "history.stat.newMembers")}/>}
                                                {activeMembers.length > 0 && <StatBox num={activeMembers.length} label={t(lang, "history.stat.activeMembers")}/>}
                                                {projects.length > 0 && <StatBox num={projects.length} label={t(lang, "history.stat.works")}/>}
                                                {events.length > 0 && <StatBox num={events.length} label={t(lang, "history.stat.events")}/>}
                                            </div>
                                            {activities.length > 0 && (
                                                <>
                                                    <div className="h-px my-4" style={{background: "var(--np-linel)"}}/>
                                                    <div className={Q.sidePanelTitle} style={{border: "none", marginBottom: 0, paddingBottom: 0}}>{t(lang, "history.activityOverview")}</div>
                                                    <div className="flex flex-col gap-2 mt-3">
                                                        {ACT_ORDER.filter(k => actCounts[k]).map(k => (
                                                            <div key={k} className="flex items-center gap-[10px]">
                                                                <span className={actDotClass(k)}/>
                                                                <span className="text-[13px] np-ink2 flex-1 text-left">{ACT_LABELS[k]?.[lang]}</span>
                                                                <span className="text-[15px] font-bold np-club" style={F_GEORGIA}>{t(lang, "history.sessionsCount", { n: actCounts[k] })}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* 荣誉殿堂（橄榄枝括号） */}
                                    {showAwards && (
                                        <div className="border-2 np-border-l px-4 py-5 text-center relative overflow-hidden"
                                             style={{background: "var(--np-award-bg)"}}>
                                            <div className={Q.sidePanelTitle}>{t(lang, "history.honors")}</div>
                                            <div className="flex flex-col gap-5">
                                                {awardEntries.map((entry, idx) => (
                                                    <LaurelBracket key={`${entry.projectId}-${idx}`} gap={10}>
                                                        <Link href={`/works/${entry.slug}`}
                                                              className="text-[15px] font-black np-ink no-underline hover:text-[color:var(--np-navy)] transition-colors"
                                                              style={F_SANS}>
                                                            {entry.title}
                                                        </Link>
                                                        <div className="w-10 h-px my-1.5 mx-auto opacity-50" style={{background: "var(--np-gold)"}}/>
                                                        <p className="text-[11px] font-bold uppercase tracking-[1px] leading-snug np-gold" style={F_SANS}>
                                                            {entry.award}
                                                        </p>
                                                    </LaurelBracket>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 新血液 */}
                                    {showMembers && (
                                        <div>
                                            <div className={Q.sectionTitle} style={{textAlign: "left"}}>{t(lang, "history.newBlood")}</div>
                                            <div className={Q.roster}>
                                                {members.map(m => {
                                                    const avatarUrl = m.avatar || m.user?.image;
                                                    return (
                                                        <div key={m.id} className={Q.rosterItem}>
                                                            <Link href={`/members/${m.id}`} className="block shrink-0">
                                                                <div className={Q.rosterAvatar}>
                                                                    {avatarUrl ? (
                                                                        <SafeImage src={avatarUrl} alt={m.displayName}
                                                                                   className="w-full h-full object-cover"/>
                                                                    ) : (
                                                                        <span className={Q.rosterInitial} style={F_SANS_SM}>{m.displayName[0]}</span>
                                                                    )}
                                                                </div>
                                                            </Link>
                                                            <span className={Q.rosterName} style={F_SANS}>{m.displayName}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 年度活跃成员 + 当年社长 */}
                                    {showActive && (
                                        <div>
                                            <div className={Q.sectionTitle} style={{textAlign: "left"}}>{t(lang, "history.activeMembersSection")}</div>

                                            {activeMembers.length > 0 && (
                                                <div className={Q.highlightList}>
                                                    {activeMembers.slice(0, 3).map((m, i) => (
                                                        <div key={m.id} className={Q.highlightItem}>
                                    <span className={highlightDropClass(i)} style={{...highlightDropStyle(i), ...F_SANS_SM}}>
                                      {m.avatar || m.user?.image ? (
                                          <SafeImage src={m.avatar || m.user?.image || ""} alt="" className="w-full h-full object-cover"/>
                                      ) : (
                                          m.displayName?.[0] || "?"
                                      )}
                                    </span>
                                                            <span>
                                      <strong className="np-ink text-[14px]">{m.displayName}</strong>
                                      <span className="np-ink3 ml-2">{topNarrative[i] || ""}</span>
                                    </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 当年社长（grade == year - 2 的 PRESIDENT / VICE_PRESIDENT） */}
                                            {presidents.length > 0 && (
                                                <div className={activeMembers.length > 0 ? "mt-4" : ""}>
                                                    <div className="text-[12px] np-gold uppercase tracking-[4px] mb-2" style={F_SANS}>
                                                        {t(lang, "history.presidents")}
                                                    </div>
                                                    <div className={Q.roster}>
                                                        {presidents.map(m => {
                                                            const avatarUrl = m.avatar || m.user?.image;
                                                            const posLabel = newspaperPositionLabel(m.position);
                                                            return (
                                                                <div key={m.id} className={Q.rosterItem}>
                                                                    <Link href={`/members/${m.id}`} className="block shrink-0">
                                                                        <div className={Q.rosterAvatar}>
                                                                            {avatarUrl ? (
                                                                                <SafeImage src={avatarUrl} alt={m.displayName}
                                                                                           className="w-full h-full object-cover"/>
                                                                            ) : (
                                                                                <span className={Q.rosterInitial} style={F_SANS_SM}>{m.displayName[0]}</span>
                                                                            )}
                                                                        </div>
                                                                    </Link>
                                                                    <div>
                                                                        <span className={Q.rosterName} style={F_SANS}>{m.displayName}</span>
                                                                        {posLabel && (
                                                                            <span className="text-[10px] np-gold block mt-[1px]" style={F_SANS_SM}>
                                                                                {posLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── 底栏 ─── */}
                    <div className="px-6 sm:px-10">
                        <div className={Q.rule} style={QS.rule}/>
                        <div className={Q.colophon} style={QS.colophon}>
                            {t(lang, "history.colophon")}
                            <br/>
                            <span className={Q.colophonUrl} style={QS.colophonUrl}>bugu.studio</span>
                        </div>
                    </div>
                </div>

                {/* ─── 保存入口（右下角：线性图标，点击展开菜单） ─── */}
                <SaveMenu onImage={saveImage} onPdf={savePDF} saving={saving} savingPdf={savingPdf} year={year}/>
            </article>
            {lightboxSrc && (
                <div data-lightbox onClick={() => setLightboxSrc(null)} className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center cursor-zoom-out">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightboxSrc} className="max-w-[90vw] max-h-[90vh] object-contain" alt=""/>
                </div>
            )}
        </>
    );
}

export default memo(YearNewspaper);
