"use client";

import {useRef, useCallback, useState, useEffect, memo} from "react";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import {RichContentClient} from "@/components/ui/RichContentClient";
import {saveElementAsPDF, saveElementAsImage} from "@/lib/print-utils";
import {newspaperPositionLabel} from "@/lib/position";

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

interface Props {
    year: number;
    members: Member[];
    projects: Project[];
    events: EventItem[];
    activities: Activity[];
    activeMembers: ActiveMember[];
    presidents: Member[];
    startYear: number;
    registerRef?: (el: HTMLDivElement | null) => void;
}

const TYPE_DESC: Record<string, string> = {
    IN_DEVELOPMENT: "开发中",
    TRIAL_DEMO: "提供试玩",
    MINI_GAME: "小游戏",
    OFFICIAL_RELEASE: "正式上架",
};
const ACT_LABELS: Record<string, string> = {COMPETITION: "比赛", COURSE: "公开课", GENERAL: "普通活动", MEETING: "例会"};
const ACT_ORDER = ["COMPETITION", "COURSE", "GENERAL", "MEETING"] as const;

// ─── 年度最佳作品选择 ─────────────────────────────────
function pickFeaturedWork(projects: Project[]): Project | null {
    if (projects.length === 0) return null;
    // 权重：正式上架 x1.0, 提供试玩 x0.8, 小游戏 x0.6, 开发中 x0.4
    // 奖项加权：整体权重 × (1 + 奖项数)
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
        const score = getWeight(p.type) * (likes || 0) * (1 + awardCount);
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
function generateLead(year: number, members: Member[], projects: Project[], activities: Activity[], events: EventItem[], yearIndex: number, activeMembers: ActiveMember[]): string {
    const lines: string[] = [];

    if (yearIndex === 1) {
        lines.push(`${year}年，是布谷工作室创社元年，一切从这里开始。`);
    } else {
        lines.push(`${year}年是布谷工作室的第 ${yearIndex} 年。`);
    }

    if (members.length > 0) {
        lines.push(`这一年，${members.length} 位伙伴加入了布谷的大家庭。`);
    }
    if (activeMembers.length > 0) {
        lines.push(`全年共有 ${activeMembers.length} 位成员活跃在创作一线。`);
    }

    if (projects.length > 0) {
        const officialCount = projects.filter(p => p.type === "OFFICIAL_RELEASE").length;
        const trialCount = projects.filter(p => p.type === "TRIAL_DEMO").length;
        const miniCount = projects.filter(p => p.type === "MINI_GAME").length;
        const devCount = projects.filter(p => p.type === "IN_DEVELOPMENT").length;
        const parts: string[] = [];
        if (officialCount > 0) parts.push(`${officialCount} 款正式上架`);
        if (trialCount > 0) parts.push(`${trialCount} 款提供试玩`);
        if (miniCount > 0) parts.push(`${miniCount} 款小游戏`);
        if (devCount > 0) parts.push(`${devCount} 款开发中`);
        lines.push(`全年共产出 ${projects.length} 件作品（${parts.join("、")}）。`);
    }

    if (activities.length > 0) {
        const actCounts: Record<string, number> = {};
        for (const a of activities) actCounts[a.type] = (actCounts[a.type] || 0) + 1;
        const parts: string[] = [];
        for (const t of ACT_ORDER) {
            if (actCounts[t]) parts.push(`${ACT_LABELS[t]} ${actCounts[t]} 场`);
        }
        lines.push(`全年举办活动 ${activities.length} 场（${parts.join("、")}）。`);
    }

    if (events.length > 0) {
        lines.push(`这一年，我们共同经历了 ${events.length} 件值得铭记的时刻。`);
    }

    return lines.join("");
}

function generateMemberHighlight(activeMembers: ActiveMember[]): string[] {
    const top3 = activeMembers.slice(0, 3);
    if (top3.length === 0) return [];
    return top3.map(m => {
        const parts: string[] = [];
        if (m.projects > 0) parts.push(`${m.projects} 件作品`);
        if (m.competitions > 0) parts.push(`${m.competitions} 场比赛`);
        if (m.courses > 0) parts.push(`${m.courses} 次公开课`);
        if (m.meetings > 0) parts.push(`${m.meetings} 次例会分享`);
        const detail = parts.join("、") || "活跃参与";
        return `参与 ${detail}。`;
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
//  颜色常量
// ═══════════════════════════════════════════════════════
const A = "#25547A";
const B = "#E38043";
const C = "#88C232";
const PAPER = "#faf8f5";
const INK = "#2c1810";
const INK2 = "#4a3728";
const INK3 = "#6b5d4f";
const LINE = "#d4c5b2";
const LINEL = "#e8ddd0";
const GOLD = "#c4a86a";

// ═══════════════════════════════════════════════════════
//  字体样式（无法用 Tailwind 表达的多 fallback 字体栈）
// ═══════════════════════════════════════════════════════
const F_SERIF: React.CSSProperties = {fontFamily: "'Noto Serif SC','STSong','SimSun',Georgia,serif"};
const F_SANS: React.CSSProperties = {fontFamily: "system-ui,'Microsoft YaHei',sans-serif"};
const F_SANS_SM: React.CSSProperties = {fontFamily: "system-ui,sans-serif"};
const F_GEORGIA: React.CSSProperties = {fontFamily: "Georgia,serif"};
const F_GEORGIA_TNR: React.CSSProperties = {fontFamily: "Georgia,'Times New Roman',serif"};

// ═══════════════════════════════════════════════════════
//  静态样式 (Tailwind className)
// ═══════════════════════════════════════════════════════
const Q: Record<string, string> = {
    outer: "max-w-[880px] mx-auto mb-12",
    saveRow: "flex justify-end mb-2",
    paper: "bg-[#faf8f5] border border-[#d4c5b2] shadow-[0_2px_20px_rgba(100,80,60,0.07)] text-[#2c1810]",
    // 报头
    masthead: "text-center px-10 pt-[22px] pb-[14px]",
    mastTop: "h-[3px] mb-4",
    mastBot: "h-[3px] mt-4",
    mastContent: "flex items-end justify-between",
    mastLeft: "text-left flex-[0_0_120px]",
    mastRight: "text-right flex-[0_0_120px]",
    mastCenter: "text-center flex-1",
    clubName: "text-lg font-bold text-[#25547A] tracking-[5px]",
    clubSub: "text-[9px] text-[#c4a86a] tracking-[3px] mt-[1px]",
    mastLabel: "text-xs text-[#c4a86a] tracking-[10px] mb-[2px]",
    mastYear: "text-[78px] font-black leading-[0.95] text-[#25547A]",
    mastIssue: "text-xs text-[#6b5d4f]",
    mastDate: "text-[10px] text-[#d4c5b2] mt-[3px]",
    // 正文
    body: "px-[44px] pt-6 pb-8",
    // 卷首语
    lead: "flex gap-0 mb-5 leading-loose",
    dropCap: "text-[42px] font-black text-[#25547A] leading-[0.8] mr-[6px] shrink-0 -mt-[2px]",
    leadText: "text-sm text-[#4a3728] text-justify tracking-[0.3px]",
    // 分隔线
    rule: "h-px mt-[14px] mb-[18px]",
    thickRule: "h-[2px] my-5",
    // 双栏数字面板
    twoCol: "grid grid-cols-2 gap-6 mb-[6px]",
    statPanel: "px-5 py-[14px] border border-[#e8ddd0]",
    panelLabel: "text-[11px] text-[#c4a86a] tracking-[6px] mb-3 text-center",
    statGrid: "flex justify-center gap-8",
    actStatList: "flex flex-col gap-2",
    actStatRow: "flex items-center gap-[10px]",
    actStatName: "text-[13px] text-[#4a3728] flex-1",
    actStatNum: "text-[15px] font-bold text-[#25547A]",
    // 章节标题
    sectionTitle: "text-[15px] font-bold text-[#c4a86a] tracking-[8px] text-center mb-4",
    // ─── 作品巡礼：代表作 ───
    featuredWrap: "grid grid-cols-2 gap-7 mb-6",
    featuredImgArea: "w-full aspect-[16/10] overflow-hidden border border-[#d4c5b2]",
    featuredImgPH: "w-full h-full flex items-center justify-center",
    featuredInfo: "flex flex-col gap-[10px] pt-1",
    featuredTitle: "text-2xl font-extrabold text-[#2c1810] leading-[1.3]",
    featuredSubtitle: "text-sm text-[#6b5d4f] leading-[1.6] italic",
    featuredMeta: "flex items-center gap-[14px]",
    featuredTypeTag: "text-[11px] text-white bg-[#c4a86a] px-[10px] py-[3px] font-semibold tracking-[2px]",
    featuredLikes: "text-[13px] text-[#E38043] font-bold",
    featuredPeople: "text-xs text-[#6b5d4f] leading-[1.7]",
    // ─── 奖项标签 ───
    awardTag: "text-[10px] text-[#8B7355] bg-[rgba(196,168,106,0.12)] px-2 py-[2px] inline-block mr-1 mb-1",
    // ─── 其余作品网格 ───
    worksSpread: "grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-y-5 gap-x-[14px] mb-2",
    workItem: "flex flex-col",
    workImgWrapSm: "w-full aspect-[16/10] overflow-hidden mb-[6px] border border-[#e8ddd0]",
    workImgPH: "w-full h-full flex items-center justify-center",
    workPHIcon: "text-2xl opacity-40",
    workCaption: "flex flex-col gap-[2px]",
    workName: "text-[13px] font-bold text-[#2c1810] flex items-baseline gap-[6px]",
    workType: "text-[9px] font-normal text-[#c4a86a] italic",
    workTagLine: "flex flex-wrap gap-1 mt-[2px]",
    workTag: "text-[9px] px-[6px] py-[1px] text-[#88C232] bg-[rgba(136,194,50,0.08)]",
    workCredit: "text-[10px] text-[#6b5d4f] mt-[1px]",
    // ─── 这一年的新血液 ───
    roster: "flex flex-wrap gap-[14px]",
    rosterItem: "flex items-center gap-[7px]",
    rosterAvatar: "w-[34px] h-[34px] rounded-full overflow-hidden flex items-center justify-center shrink-0",
    rosterInitial: "text-white text-sm font-bold",
    rosterName: "text-[13px] text-[#4a3728]",
    // ─── 代表人物（Top3 叙事） ───
    highlightList: "flex flex-col gap-[14px] mb-6",
    highlightItem: "text-[13px] leading-[1.9] text-[#4a3728] m-0 flex items-start gap-3 text-justify",
    // ─── 活动回顾 ───
    activityList: "flex flex-col gap-[14px] mt-1",
    activityItem: "",
    activityHeader: "flex items-baseline gap-[10px] flex-wrap mb-1",
    activityTitle: "text-sm font-bold text-[#2c1810]",
    activityDate: "text-[11px] text-[#c4a86a] italic ml-[10px]",
    activityDesc: "text-[13px] text-[#6b5d4f] leading-loose whitespace-pre-wrap text-justify",
    // ─── 大事记 ───
    timeline: "flex flex-col gap-0",
    tlItem: "flex gap-4 relative",
    tlMarker: "flex flex-col items-center w-[14px] shrink-0 relative",
    tlDot: "w-[10px] h-[10px] rounded-full bg-[#88C232] mt-2 shrink-0 relative z-[1]",
    tlStem: "absolute top-[18px] bottom-[-4px] left-[6.5px] w-px bg-[#e8ddd0]",
    tlContent: "flex-1 pt-2 pb-4",
    tlHeader: "flex items-baseline gap-[10px] flex-wrap",
    tlTitle: "text-sm font-bold text-[#2c1810]",
    tlDate: "text-[11px] text-[#c4a86a] italic",
    tlBody: "text-xs text-[#6b5d4f] leading-[1.8] mt-1 whitespace-pre-wrap",
    tlImages: "flex gap-2 mt-2 flex-wrap",
    tlImgWrap: "relative w-[120px] h-[80px] rounded-[2px] overflow-hidden border border-[#e8ddd0] cursor-zoom-in shrink-0",
    // 底栏
    colophon: "text-center text-[11px] text-[#d4c5b2] leading-[1.8] tracking-[3px]",
    colophonUrl: "text-[9px] tracking-[1px] text-[#e8ddd0]",
};

// ─── Q 条目中仍需 inline style 的属性（渐变背景、字体栈等） ───
const QS: Record<string, React.CSSProperties> = {
    mastTop: {background: `linear-gradient(90deg,transparent 8%,${GOLD} 20%,${A} 35%,${A} 65%,${GOLD} 80%,transparent 92%)`},
    mastBot: {background: `linear-gradient(90deg,transparent 8%,${GOLD} 20%,${A} 35%,${A} 65%,${GOLD} 80%,transparent 92%)`},
    rule: {background: `linear-gradient(90deg,transparent 15%,${LINEL} 35%,${GOLD} 50%,${LINEL} 65%,transparent 85%)`},
    thickRule: {background: `linear-gradient(90deg,transparent 10%,${LINE} 30%,${GOLD} 50%,${LINE} 70%,transparent 90%)`},
    statPanel: {background: "linear-gradient(135deg,rgba(255,255,255,0.5),rgba(232,221,208,0.2))"},
    featuredImgPH: {background: `linear-gradient(135deg,${A},#4488aa)`},
    workImgPH: {background: `linear-gradient(135deg,${A},#4488aa)`},
    rosterAvatar: {background: `linear-gradient(135deg,${A},#4477aa)`},
    mastYear: {textRendering: "geometricPrecision"},
    // fontFamily 条目
    clubName: F_SANS,
    clubSub: F_GEORGIA,
    mastLabel: F_SANS,
    mastIssue: F_SANS_SM,
    dropCap: F_GEORGIA,
    panelLabel: F_SANS,
    actStatNum: F_GEORGIA,
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
};

// ═══════════════════════════════════════════════════════
//  动态样式函数
// ═══════════════════════════════════════════════════════
function saveBtnClass(loading: boolean): string {
    return `inline-flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-[1.5px] border-brand-navy text-[13px] font-semibold transition-all duration-200 ${loading ? "bg-brand-navy text-white cursor-default" : "bg-transparent text-brand-navy cursor-pointer"}`;
}

const pdfBtnClass = "inline-flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-[1.5px] border-brand-green bg-transparent text-brand-green text-[13px] font-semibold cursor-pointer transition-all duration-200";

function actDotClass(t: string): string {
    const bgMap: Record<string, string> = {COMPETITION: "bg-[#E38043]", COURSE: "bg-[#25547A]", GENERAL: "bg-[#88C232]", MEETING: "bg-[#d4c5b2]"};
    return `w-2 h-2 rounded-full shrink-0 ${bgMap[t] || "bg-[#d4c5b2]"}`;
}

function highlightDropClass(i: number): string {
    return "w-[var(--drop-size)] h-[var(--drop-size)] rounded-full shrink-0 flex items-center justify-center text-white text-[15px] font-bold overflow-hidden";
}
function highlightDropStyle(i: number): React.CSSProperties {
    const colors = [GOLD, "#a0a0a0", "#c4885a"];
    const sizes = [38, 34, 34];
    return {
        "--drop-size": `${sizes[i] || 34}px`,
        background: `linear-gradient(135deg,${colors[i] || "#a0a0a0"},${i === 0 ? "#d4b87a" : i === 1 ? "#c0c0c0" : "#d4a57a"})`,
    } as React.CSSProperties;
}

function activityTypeTagClass(t: string): string {
    const bgMap: Record<string, string> = {COMPETITION: "bg-[#E38043]", COURSE: "bg-[#25547A]", GENERAL: "bg-[#88C232]", MEETING: "bg-[#d4c5b2]"};
    return `text-[10px] font-semibold text-white ${bgMap[t] || "bg-[#d4c5b2]"} px-2 py-[2px] tracking-[1px] shrink-0`;
}

// StatBox 样式
const STAT_Q: Record<string, string> = {
    statBox: "flex flex-col items-center gap-1",
    statNum: "text-[36px] font-black text-[#25547A] leading-none",
    statLabel: "text-xs text-[#6b5d4f] tracking-[1px]",
};
const STAT_S: Record<string, React.CSSProperties> = {
    statNum: F_GEORGIA,
    statLabel: F_SANS,
};

// ─── 小组件 ──────────────────────────────────────────
function StatBox({num, label}: { num: number; label: string }) {
    return <div className={STAT_Q.statBox}>
        <div className={STAT_Q.statNum}>{num}</div>
        <div className={STAT_Q.statLabel}>{label}</div>
    </div>;
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
                                          startYear,
                                          registerRef
                                      }: Props) {
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

    const topNarrative = generateMemberHighlight(activeMembers);
    const leadText = generateLead(year, members, projects, activities, events, yearIndex, activeMembers);
    const featuredWork = pickFeaturedWork(projects);
    // 过滤掉 hero 作品后的其余作品
    const otherWorks = featuredWork ? projects.filter(p => p.id !== featuredWork.id) : projects;

    const actCounts: Record<string, number> = {};
    for (const a of activities) actCounts[a.type] = (actCounts[a.type] || 0) + 1;
    const nonMeeting = activities.filter(a => a.type !== "MEETING");
    const meetingCount = activities.filter(a => a.type === "MEETING").length;

    // ── 保存图片（html-to-image: SVG foreignObject） ──
    const saveImage = useCallback(async () => {
        if (!paperRef.current || saving) return;
        setSaving(true);
        try {
            await saveElementAsImage(paperRef.current, `布谷工作室·${year}年度回顾.png`);
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
            await saveElementAsPDF(paperRef.current, `布谷工作室·${year}年度回顾.pdf`);
            // 刷新页面确保下次保存状态干净
            setTimeout(() => window.location.reload(), 300);
        } catch (e) {
            console.error("保存PDF失败", e);
            setSavingPdf(false);
        }
    }, [savingPdf, year]);

    const hasContent = members.length > 0 || projects.length > 0 || events.length > 0 || activities.length > 0;
    if (!hasContent) return null;

    return (
        <>
            <article className={Q.outer}>

                <div ref={paperRef} className={`newspaper-paper ${Q.paper}`} style={F_SERIF}>
                    {/* ═══ 报头 ═══ */}
                    <header className={Q.masthead}>
                        <div className={Q.mastTop} style={QS.mastTop}/>
                        <div className={Q.mastContent}>
                            <div className={Q.mastLeft}>
                                <div className={Q.clubName} style={F_SANS}>布谷工作室</div>
                                <div className={Q.clubSub} style={F_GEORGIA}>BUGOO STUDIO</div>
                            </div>
                            <div className={Q.mastCenter}>
                                <div className={Q.mastLabel} style={F_SANS}>年 度 回 顾</div>
                                <div className={Q.mastYear} style={{...F_GEORGIA_TNR, ...QS.mastYear}}>{year}</div>
                            </div>
                            <div className={Q.mastRight}>
                                <div className={Q.mastIssue} style={F_SANS_SM}>{yearIndex} 期</div>
                                <div className={Q.mastDate}>{year}年刊</div>
                            </div>
                        </div>
                        <div className={Q.mastBot} style={QS.mastBot}/>
                    </header>

                    <div className={Q.body}>

                        {/* ─── 卷首语 ─── */}
                        <div className={Q.lead}>
                            <span className={Q.leadText}>{leadText}</span>
                        </div>

                        <div className={Q.rule} style={QS.rule}/>

                        {/* ─── 数字面板 ─── */}
                        <div className={Q.twoCol}>
                            <div className={Q.statPanel} style={QS.statPanel}>
                                <div className={Q.panelLabel} style={F_SANS}>{yearIndex <= 1 ? "创社元年" : `第 ${yearIndex} 年`} 数字</div>
                                <div className={Q.statGrid}>
                                    {members.length > 0 && <StatBox num={members.length} label="新成员"/>}
                                    {activeMembers.length > 0 && <StatBox num={activeMembers.length} label="活跃成员"/>}
                                    {projects.length > 0 && <StatBox num={projects.length} label="件作品"/>}
                                    {events.length > 0 && <StatBox num={events.length} label="条大事记"/>}
                                </div>
                            </div>
                            <div className={Q.statPanel}>
                                <div className={Q.panelLabel}>活 动 概 览</div>
                                {activities.length > 0 ? (
                                    <div className={Q.actStatList}>
                                        {ACT_ORDER.filter(t => actCounts[t]).map(t => (
                                            <div key={t} className={Q.actStatRow}>
                                                <span className={actDotClass(t)}/>
                                                <span className={Q.actStatName}>{ACT_LABELS[t]}</span>
                                                <span className={Q.actStatNum}>{actCounts[t]} 场</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{textAlign: "center", color: INK3, fontSize: 13, paddingTop: 8}}>暂无活动记录</div>
                                )}
                            </div>
                        </div>

                        {/* ═══ 作品巡礼（代表作 + 其余作品） ═══ */}
                        {projects.length > 0 && (
                            <>
                                <div className={Q.thickRule}/>
                                <div className={Q.sectionTitle}>作 品 巡 礼</div>

                                {/* 年度代表作（大头） */}
                                {featuredWork && (
                                    <div className={Q.featuredWrap}>
                                        <Link href={`/works/${featuredWork.slug}`} className="block">
                                            <div className={Q.featuredImgArea}>
                                                {featuredWork.coverImage ? (
                                                    <SafeImage src={featuredWork.coverImage} alt={featuredWork.title}
                                                               className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div className={Q.featuredImgPH} style={QS.featuredImgPH}><span className="text-4xl opacity-40">🎮</span></div>
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
                                                <span className={Q.featuredTypeTag} style={F_SANS_SM}>{TYPE_DESC[featuredWork.type] || featuredWork.type}</span>
                                                <span className={Q.featuredLikes} style={F_GEORGIA}>♥ {(featuredWork._count?.likes ?? 0)}</span>
                                            </div>
                                            {featuredWork.tags && featuredWork.tags.length > 0 && (
                                                <div className={Q.workTagLine}>
                                                    {featuredWork.tags.slice(0, 4).map((t: any) => (
                                                        <span key={t.tag.name} className={Q.workTag}>{t.tag.name}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {featuredWork.awards && featuredWork.awards.length > 0 && (
                                                <div className="mt-2">
                                                    {featuredWork.awards.map((award, i) => (
                                                        <span key={i} className={Q.awardTag}>🏆 {award}</span>
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
                                                            <div className={Q.workImgPH} style={QS.workImgPH}><span className={Q.workPHIcon}>🎮</span></div>
                                                        )}
                                                    </div>
                                                </Link>
                                                <div className={Q.workCaption}>
                                                    <div className={Q.workName}>
                                                        <Link href={`/works/${p.slug}`} className="text-inherit no-underline">
                                                            {p.title}
                                                        </Link>
                                                        <span className={Q.workType} style={F_GEORGIA}>{TYPE_DESC[p.type] || p.type}</span>
                                                    </div>
                                                    {p.tags && p.tags.length > 0 && (
                                                        <div className={Q.workTagLine}>
                                                            {p.tags.slice(0, 3).map((t: any) => (
                                                                <span key={t.tag.name} className={Q.workTag}>{t.tag.name}</span>
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
                            </>
                        )}

                        {/* ═══ 这一年的新血液（当年加入的成员） ═══ */}
                        {members.length > 0 && (
                            <>
                                <div className={Q.thickRule} style={QS.thickRule}/>
                                <div className={Q.sectionTitle} style={QS.sectionTitle}>这 一 年 的 新 血 液</div>

                                        <div className={Q.roster}>
                                            {members.map(m => {
                                                const avatarUrl = m.avatar || m.user?.image;
                                                return (
                                                    <div key={m.id} className={Q.rosterItem}>
                                                        <Link href={`/members/${m.id}`} className="block shrink-0">
                                                            <div className={Q.rosterAvatar} style={QS.rosterAvatar}>
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
                            </>
                        )}

                        {/* ═══ 年度活跃成员（Top3 展示 + 当年社长） ═══ */}
                        {(activeMembers.length > 0 || presidents.length > 0) && (
                            <>
                                    <div className={Q.thickRule} style={QS.thickRule}/>
                                <div className={Q.sectionTitle} style={F_SANS}>年 度 活 跃 成 员</div>

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
                      <strong className="text-[#2c1810] text-[14px]">{m.displayName}</strong>
                      <span className="text-[#6b5d4f] ml-2">{topNarrative[i] || ""}</span>
                    </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 当年社长（grade == year - 2 的 PRESIDENT / VICE_PRESIDENT） */}
                                {presidents.length > 0 && (
                                    <div className={activeMembers.length > 0 ? "mt-4" : ""}>
                                        <div className="text-[12px] text-[#c4a86a] uppercase tracking-[4px] mb-2" style={F_SANS}>
                                            ◆ 当年社长
                                        </div>
                                        <div className={Q.roster}>
                                            {presidents.map(m => {
                                                const avatarUrl = m.avatar || m.user?.image;
                                                const posLabel = newspaperPositionLabel(m.position);
                                                return (
                                                    <div key={m.id} className={Q.rosterItem}>
                                                        <Link href={`/members/${m.id}`} className="block shrink-0">
                                                            <div className={Q.rosterAvatar} style={QS.rosterAvatar}>
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
                                                                <span className="text-[10px] text-[#c4a86a] block mt-[1px]" style={F_SANS_SM}>
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
                            </>
                        )}

                        {/* ═══ 活动回顾 ═══ */}
                        {(nonMeeting.length > 0 || meetingCount > 0) && (
                            <>
                                <div className={Q.thickRule} style={QS.thickRule}/>
                                <div className={Q.sectionTitle} style={QS.sectionTitle}>活 动 回 顾</div>

                                {meetingCount > 0 && (
                                    <p className="text-[13px] text-[#4a3728] leading-loose text-justify mb-4">
                                        全年共举办了 {meetingCount} 场例会。
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
                                                        <span className={activityTypeTagClass(a.type)}>{ACT_LABELS[a.type] || a.type}</span>
                                                        <Link href={`/activities/${a.id}`}
                                                              className="text-inherit no-underline">
                                                            <span className={Q.activityTitle} style={QS.activityTitle}>{a.title}</span>
                                                        </Link>
                                                        {a.status === "ARCHIVED" &&
                                                            <span className="text-[10px] text-[#6b5d4f] italic">(已归档)</span>}
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
                            </>
                        )}

                        {/* ═══ 大事记 ═══ */}
                        {events.length > 0 && (
                            <>
                                <div className={Q.thickRule} style={QS.thickRule}/>
                                <div className={Q.sectionTitle} style={QS.sectionTitle}>大 事 记</div>
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
                                                              ? `${d.getMonth() + 1}月${d.getDate()}日 至 ${de!.getMonth() + 1}月${de!.getDate()}日`
                                                              : `${d.getMonth() + 1}月${d.getDate()}日`}
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
                                                                    aria-label="查看大图"
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

                        {/* ─── 底栏 ─── */}
                        <div className={Q.rule} style={QS.rule}/>
                        <div className={Q.colophon} style={QS.colophon}>
                            布谷工作室 · 保持热爱 · 持续创造
                            <br/>
                            <span className={Q.colophonUrl} style={QS.colophonUrl}>bugu.studio</span>
                        </div>
                    </div>
                </div>

                {/* ─── 保存按钮（报纸下方） ─── */}
                <div data-save-buttons className="flex justify-end gap-[10px] mt-[10px]">
                    <button type="button" onClick={saveImage} disabled={saving} className={saveBtnClass(saving)}
                            title="页面左侧上暂时出现图片是正常现象">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        {saving ? "生成中…" : "保存图片"}
                    </button>
                    <button type="button" onClick={savePDF} disabled={savingPdf} className={pdfBtnClass} title="可能需要关闭浏览器的窗口拦截">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <polyline points="9 15 12 18 15 15"/>
                        </svg>
                        {savingPdf ? "生成中…" : "保存PDF"}
                    </button>
                </div>
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
