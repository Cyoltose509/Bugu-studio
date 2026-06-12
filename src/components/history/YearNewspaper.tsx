"use client";

import {useRef, useCallback, useState} from "react";
import {toPng} from "html-to-image";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { RichContentClient } from "@/components/RichContentClient";

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
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    coverImage: string | null;
    type: string;
    tags?: { tag: { name: string } }[];
    members?: { memberId: string | null; externalName: string | null; roles: string[]; member?: { displayName: string } | null }[];
    _count?: { likes: number };
}

interface EventItem {
    id: string;
    title: string;
    body: string | null;
    bodyHtml?: string;  // 预渲染的富文本 HTML
    eventDate: string | null;
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
    startYear: number;
}

// ─── 常量 ────────────────────────────────────────────
const TYPE_DESC: Record<string, string> = {DEMO: "技术演示", STEAM: "Steam 发布", ITCH: "itch.io 独立发布", OTHER: "创作项目"};
const ACT_LABELS: Record<string, string> = {COMPETITION: "比赛", COURSE: "公开课", GENERAL: "普通活动", MEETING: "例会"};
const ACT_ORDER = ["COMPETITION", "COURSE", "GENERAL", "MEETING"] as const;

// ─── 年度最佳作品选择 ─────────────────────────────────
function pickFeaturedWork(projects: Project[]): Project | null {
    if (projects.length === 0) return null;
    const scored = projects.map(p => {
        const typeWeight = p.type === "STEAM" ? 3 : p.type === "ITCH" ? 2 : 1;
        const likes = p._count?.likes ?? 0;
        return {p, score: typeWeight * (likes + 1)};
    });
    scored.sort((a, b) => b.score - a.score);
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
        const steamCount = projects.filter(p => p.type === "STEAM").length;
        const itchCount = projects.filter(p => p.type === "ITCH").length;
        const demoCount = projects.filter(p => p.type === "DEMO").length;
        const parts: string[] = [];
        if (steamCount > 0) parts.push(`${steamCount} 款上线 Steam`);
        if (itchCount > 0) parts.push(`${itchCount} 款发布 itch.io`);
        if (demoCount > 0) parts.push(`${demoCount} 款技术演示`);
        const others = projects.filter(p => !["STEAM", "ITCH", "DEMO"].includes(p.type)).length;
        if (others > 0) parts.push(`${others} 款创作项目`);
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
//  静态样式
// ═══════════════════════════════════════════════════════
const Q: Record<string, React.CSSProperties> = {
    outer: {maxWidth: 880, margin: "0 auto 48px"},
    saveRow: {display: "flex", justifyContent: "flex-end", marginBottom: 8},
    paper: {
        background: PAPER,
        border: `1px solid ${LINE}`,
        boxShadow: "0 2px 20px rgba(100,80,60,0.07)",
        fontFamily: "'Noto Serif SC','STSong','SimSun',Georgia,serif",
        color: INK
    },
    // 报头
    masthead: {textAlign: "center" as const, padding: "22px 40px 14px"},
    mastTop: {
        height: 3,
        background: `linear-gradient(90deg,transparent 8%,${GOLD} 20%,${A} 35%,${A} 65%,${GOLD} 80%,transparent 92%)`,
        marginBottom: 16
    },
    mastBot: {
        height: 3,
        background: `linear-gradient(90deg,transparent 8%,${GOLD} 20%,${A} 35%,${A} 65%,${GOLD} 80%,transparent 92%)`,
        marginTop: 16
    },
    mastContent: {display: "flex", alignItems: "flex-end", justifyContent: "space-between"},
    mastLeft: {textAlign: "left" as const, flex: "0 0 120px"},
    mastRight: {textAlign: "right" as const, flex: "0 0 120px"},
    mastCenter: {textAlign: "center" as const, flex: 1},
    clubName: {fontSize: 18, fontWeight: 700, color: A, letterSpacing: 5, fontFamily: "system-ui,'Microsoft YaHei',sans-serif"},
    clubSub: {fontSize: 9, color: GOLD, letterSpacing: 3, fontFamily: "Georgia,serif", marginTop: 1},
    mastLabel: {fontSize: 12, color: GOLD, letterSpacing: 10, fontFamily: "system-ui,'Microsoft YaHei',sans-serif", marginBottom: 2},
    mastYear: {fontSize: 78, fontWeight: 900, lineHeight: 0.95, color: A, fontFamily: "Georgia,'Times New Roman',serif"},
    mastIssue: {fontSize: 12, color: INK3, fontFamily: "system-ui,sans-serif"},
    mastDate: {fontSize: 10, color: LINE, marginTop: 3},
    // 正文
    body: {padding: "24px 44px 32px"},
    // 卷首语
    lead: {display: "flex", gap: 0, marginBottom: 20, lineHeight: 2},
    dropCap: {
        fontSize: 42,
        fontWeight: 900,
        color: A,
        lineHeight: 0.8,
        marginRight: 6,
        fontFamily: "Georgia,serif",
        flexShrink: 0,
        marginTop: -2
    },
    leadText: {fontSize: 14, color: INK2, textAlign: "justify" as const, letterSpacing: 0.3},
    // 分隔线
    rule: {
        height: 1,
        margin: "14px 0 18px",
        background: `linear-gradient(90deg,transparent 15%,${LINEL} 35%,${GOLD} 50%,${LINEL} 65%,transparent 85%)`
    },
    thickRule: {
        height: 2,
        margin: "20px 0",
        background: `linear-gradient(90deg,transparent 10%,${LINE} 30%,${GOLD} 50%,${LINE} 70%,transparent 90%)`
    },
    // 双栏数字面板
    twoCol: {display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 6},
    statPanel: {
        padding: "14px 20px",
        background: "linear-gradient(135deg,rgba(255,255,255,0.5),rgba(232,221,208,0.2))",
        border: `1px solid ${LINEL}`
    },
    panelLabel: {
        fontSize: 11,
        color: GOLD,
        letterSpacing: 6,
        marginBottom: 12,
        textAlign: "center" as const,
        fontFamily: "system-ui,'Microsoft YaHei',sans-serif"
    },
    statGrid: {display: "flex", justifyContent: "center", gap: 32},
    actStatList: {display: "flex", flexDirection: "column", gap: 8},
    actStatRow: {display: "flex", alignItems: "center", gap: 10},
    actStatName: {fontSize: 13, color: INK2, flex: 1},
    actStatNum: {fontSize: 15, fontWeight: 700, color: A, fontFamily: "Georgia,serif"},
    // 章节标题
    sectionTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: GOLD,
        letterSpacing: 8,
        textAlign: "center" as const,
        fontFamily: "system-ui,'Microsoft YaHei',sans-serif",
        marginBottom: 16
    },
    // ─── 作品巡礼：代表作 ───
    featuredWrap: {display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 24},
    featuredImgArea: {width: "100%", aspectRatio: "16/10", overflow: "hidden", border: `1px solid ${LINE}`},
    featuredImgPH: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg,${A},#4488aa)`
    },
    featuredInfo: {display: "flex", flexDirection: "column" as const, gap: 10, paddingTop: 4},
    featuredTitle: {fontSize: 24, fontWeight: 800, color: INK, fontFamily: "system-ui,'Microsoft YaHei',sans-serif", lineHeight: 1.3},
    featuredSubtitle: {fontSize: 14, color: INK3, lineHeight: 1.6, fontStyle: "italic"},
    featuredMeta: {display: "flex", alignItems: "center", gap: 14},
    featuredTypeTag: {
        fontSize: 11,
        color: "#fff",
        background: GOLD,
        padding: "3px 10px",
        fontFamily: "system-ui,sans-serif",
        fontWeight: 600,
        letterSpacing: 2
    },
    featuredLikes: {fontSize: 13, color: B, fontWeight: 700, fontFamily: "Georgia,serif"},
    featuredPeople: {fontSize: 12, color: INK3, fontFamily: "system-ui,sans-serif", lineHeight: 1.7},
    // ─── 其余作品网格 ───
    worksSpread: {display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "20px 14px", marginBottom: 8},
    workItem: {display: "flex", flexDirection: "column" as const},
    workImgWrapSm: {width: "100%", aspectRatio: "16/10", overflow: "hidden", marginBottom: 6, border: `1px solid ${LINEL}`},
    workImgPH: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg,${A},#4488aa)`
    },
    workPHIcon: {fontSize: 24, opacity: 0.4},
    workCaption: {display: "flex", flexDirection: "column" as const, gap: 2},
    workName: {
        fontSize: 13,
        fontWeight: 700,
        color: INK,
        fontFamily: "system-ui,'Microsoft YaHei',sans-serif",
        display: "flex",
        alignItems: "baseline",
        gap: 6
    },
    workType: {fontSize: 9, fontWeight: 400, color: GOLD, fontFamily: "Georgia,serif", fontStyle: "italic"},
    workTagLine: {display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 2},
    workTag: {fontSize: 9, padding: "1px 6px", color: C, background: "rgba(136,194,50,0.08)", fontFamily: "system-ui,sans-serif"},
    workCredit: {fontSize: 10, color: INK3, fontFamily: "system-ui,sans-serif", marginTop: 1},
    // ─── 这一年的新血液 ───
    roster: {display: "flex", flexWrap: "wrap" as const, gap: 14},
    rosterItem: {display: "flex", alignItems: "center", gap: 7},
    rosterAvatar: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        overflow: "hidden",
        background: `linear-gradient(135deg,${A},#4477aa)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
    },
    rosterInitial: {color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "system-ui,sans-serif"},
    rosterName: {fontSize: 13, color: INK2, fontFamily: "system-ui,'Microsoft YaHei',sans-serif"},
    // ─── 代表人物（Top3 叙事） ───
    highlightList: {display: "flex", flexDirection: "column" as const, gap: 14, marginBottom: 24},
    highlightItem: {
        fontSize: 13,
        lineHeight: 1.9,
        color: INK2,
        margin: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        textAlign: "justify" as const
    },
    // ─── 活动回顾 ───
    activityList: {display: "flex", flexDirection: "column" as const, gap: 14, marginTop: 4},
    activityItem: {},
    activityHeader: {display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const, marginBottom: 4},
    activityTitle: {fontSize: 14, fontWeight: 700, color: INK, fontFamily: "system-ui,'Microsoft YaHei',sans-serif"},
    activityDate: {fontSize: 11, color: GOLD, fontFamily: "Georgia,serif", fontStyle: "italic", marginLeft: 10},
    activityDesc: {fontSize: 13, color: INK3, lineHeight: 2, whiteSpace: "pre-wrap" as const, textAlign: "justify" as const},
    // ─── 大事记 ───
    timeline: {display: "flex", flexDirection: "column" as const, gap: 0},
    tlItem: {display: "flex", gap: 16, position: "relative" as const},
    tlMarker: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        width: 14,
        flexShrink: 0,
        position: "relative" as const
    },
    tlDot: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: C,
        marginTop: 8,
        flexShrink: 0,
        position: "relative" as const,
        zIndex: 1
    },
    tlStem: {position: "absolute" as const, top: 18, bottom: -4, left: "6.5px", width: 1, background: LINEL},
    tlContent: {flex: 1, padding: "8px 0 16px"},
    tlHeader: {display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" as const},
    tlTitle: {fontSize: 14, fontWeight: 700, color: INK, fontFamily: "system-ui,'Microsoft YaHei',sans-serif"},
    tlDate: {fontSize: 11, color: GOLD, fontFamily: "Georgia,serif", fontStyle: "italic"},
    tlBody: {fontSize: 12, color: INK3, lineHeight: 1.8, marginTop: 4, whiteSpace: "pre-wrap" as const},
    tlImages: {display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const},
    tlImgWrap: {
        position: "relative" as const,
        width: 120,
        height: 80,
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${LINEL}`,
        cursor: "zoom-in",
        flexShrink: 0
    },
    // 底栏
    colophon: {
        textAlign: "center" as const,
        fontSize: 11,
        color: LINE,
        lineHeight: 1.8,
        fontFamily: "system-ui,'Microsoft YaHei',sans-serif",
        letterSpacing: 3
    },
    colophonUrl: {fontSize: 9, letterSpacing: 1, color: LINEL, fontFamily: "Georgia,serif"},
};

// ═══════════════════════════════════════════════════════
//  动态样式函数
// ═══════════════════════════════════════════════════════
function saveBtnStyle(loading: boolean): React.CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 18px",
        borderRadius: 8,
        border: `1.5px solid ${A}`,
        background: loading ? A : "transparent",
        color: loading ? "#fff" : A,
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? "default" : "pointer",
        fontFamily: "system-ui,sans-serif",
        transition: "all 0.2s"
    };
}

function actDotStyle(t: string): React.CSSProperties {
    const colors: Record<string, string> = {COMPETITION: B, COURSE: A, GENERAL: C, MEETING: LINE};
    return {width: 8, height: 8, borderRadius: "50%", background: colors[t] || LINE, flexShrink: 0};
}

function highlightDropStyle(i: number): React.CSSProperties {
    const colors = [GOLD, "#a0a0a0", "#c4885a"];
    const sizes = [38, 34, 34];
    return {
        width: sizes[i] || 34,
        height: sizes[i] || 34,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg,${colors[i] || "#a0a0a0"},${i === 0 ? "#d4b87a" : i === 1 ? "#c0c0c0" : "#d4a57a"})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "system-ui,sans-serif",
        overflow: "hidden"
    };
}

function activityTypeTagStyle(t: string): React.CSSProperties {
    const colors: Record<string, string> = {COMPETITION: B, COURSE: A, GENERAL: C, MEETING: LINE};
    return {
        fontSize: 10,
        fontWeight: 600,
        color: "#fff",
        background: colors[t] || LINE,
        padding: "2px 8px",
        fontFamily: "system-ui,sans-serif",
        letterSpacing: 1,
        flexShrink: 0
    };
}

// StatBox 样式
const STAT_Q: Record<string, React.CSSProperties> = {
    statBox: {display: "flex", flexDirection: "column", alignItems: "center", gap: 4},
    statNum: {fontSize: 36, fontWeight: 900, color: A, fontFamily: "Georgia,serif", lineHeight: 1},
    statLabel: {fontSize: 12, color: INK3, fontFamily: "system-ui,'Microsoft YaHei',sans-serif", letterSpacing: 1},
};

// ─── 小组件 ──────────────────────────────────────────
function StatBox({num, label}: { num: number; label: string }) {
    return <div style={STAT_Q.statBox}>
        <div style={STAT_Q.statNum}>{num}</div>
        <div style={STAT_Q.statLabel}>{label}</div>
    </div>;
}

// ═══════════════════════════════════════════════════════
//  主组件
// ═══════════════════════════════════════════════════════
export default function YearNewspaper({year, members, projects, events, activities, activeMembers, startYear}: Props) {
    const paperRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const yearIndex = year - startYear + 1;

    const topNarrative = generateMemberHighlight(activeMembers);
    const leadText = generateLead(year, members, projects, activities, events, yearIndex, activeMembers);
    const featuredWork = pickFeaturedWork(projects);
    // 过滤掉 hero 作品后的其余作品
    const otherWorks = featuredWork ? projects.filter(p => p.id !== featuredWork.id) : projects;

    const actCounts: Record<string, number> = {};
    for (const a of activities) actCounts[a.type] = (actCounts[a.type] || 0) + 1;
    const nonMeeting = activities.filter(a => a.type !== "MEETING");
    const meetingCount = activities.filter(a => a.type === "MEETING").length;

    const saveImage = useCallback(async () => {
        if (!paperRef.current || saving) return;
        setSaving(true);
        try {
            const dataUrl = await toPng(paperRef.current, {quality: 0.95, pixelRatio: 2, backgroundColor: "#faf8f5"});
            const link = document.createElement("a");
            link.download = `布谷工作室·${year}年度回顾.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error("保存失败", e);
        } finally {
            setSaving(false);
        }
    }, [saving, year]);

    const hasContent = members.length > 0 || projects.length > 0 || events.length > 0 || activities.length > 0;
    if (!hasContent) return null;

    return (
        <>
            <article style={Q.outer}>
                {/* 保存按钮 */}
                <div style={Q.saveRow}>
                    <button type="button" onClick={saveImage} disabled={saving} style={saveBtnStyle(saving)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        {saving ? "生成中…" : "保存图片"}
                    </button>
                </div>

                <div ref={paperRef} style={Q.paper}>
                    {/* ═══ 报头 ═══ */}
                    <header style={Q.masthead}>
                        <div style={Q.mastTop}/>
                        <div style={Q.mastContent}>
                            <div style={Q.mastLeft}>
                                <div style={Q.clubName}>布谷工作室</div>
                                <div style={Q.clubSub}>BUGU STUDIO</div>
                            </div>
                            <div style={Q.mastCenter}>
                                <div style={Q.mastLabel}>年 度 回 顾</div>
                                <div style={Q.mastYear}>{year}</div>
                            </div>
                            <div style={Q.mastRight}>
                                <div style={Q.mastIssue}>第 {yearIndex} 期</div>
                                <div style={Q.mastDate}>{year}年刊</div>
                            </div>
                        </div>
                        <div style={Q.mastBot}/>
                    </header>

                    <div style={Q.body}>

                        {/* ─── 卷首语 ─── */}
                        <div style={Q.lead}>
                            <span style={Q.dropCap}>这</span>
                            <span style={Q.leadText}>{leadText}</span>
                        </div>

                        <div style={Q.rule}/>

                        {/* ─── 数字面板 ─── */}
                        <div style={Q.twoCol}>
                            <div style={Q.statPanel}>
                                <div style={Q.panelLabel}>年 度 数 字</div>
                                <div style={Q.statGrid}>
                                    {members.length > 0 && <StatBox num={members.length} label="新成员"/>}
                                    {activeMembers.length > 0 && <StatBox num={activeMembers.length} label="活跃成员"/>}
                                    {projects.length > 0 && <StatBox num={projects.length} label="件作品"/>}
                                    {events.length > 0 && <StatBox num={events.length} label="条大事记"/>}
                                </div>
                            </div>
                            <div style={Q.statPanel}>
                                <div style={Q.panelLabel}>活 动 概 览</div>
                                {activities.length > 0 ? (
                                    <div style={Q.actStatList}>
                                        {ACT_ORDER.filter(t => actCounts[t]).map(t => (
                                            <div key={t} style={Q.actStatRow}>
                                                <span style={actDotStyle(t)}/>
                                                <span style={Q.actStatName}>{ACT_LABELS[t]}</span>
                                                <span style={Q.actStatNum}>{actCounts[t]} 场</span>
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
                                <div style={Q.thickRule}/>
                                <div style={Q.sectionTitle}>作 品 巡 礼</div>

                                {/* 年度代表作（大头） */}
                                {featuredWork && (
                                    <div style={Q.featuredWrap}>
                                        <Link href={`/works/${featuredWork.slug}`} style={{display: "block"}}>
                                            <div style={Q.featuredImgArea}>
                                                {featuredWork.coverImage ? (
                                                    <SafeImage src={featuredWork.coverImage} alt={featuredWork.title}
                                                               className="w-full h-full object-cover"/>
                                                ) : (
                                                    <div style={Q.featuredImgPH}><span style={{fontSize: 48, opacity: 0.4}}>🎮</span></div>
                                                )}
                                            </div>
                                        </Link>
                                        <div style={Q.featuredInfo}>
                                            <div style={Q.featuredTitle}>
                                                <Link href={`/works/${featuredWork.slug}`}
                                                      style={{color: "inherit", textDecoration: "none"}}>
                                                    {featuredWork.title}
                                                </Link>
                                            </div>
                                            {featuredWork.subtitle && <div style={Q.featuredSubtitle}>{featuredWork.subtitle}</div>}
                                            <div style={Q.featuredMeta}>
                                                <span style={Q.featuredTypeTag}>{TYPE_DESC[featuredWork.type] || featuredWork.type}</span>
                                                <span style={Q.featuredLikes}>♥ {(featuredWork._count?.likes ?? 0)}</span>
                                            </div>
                                            {featuredWork.tags && featuredWork.tags.length > 0 && (
                                                <div style={Q.workTagLine}>
                                                    {featuredWork.tags.slice(0, 4).map((t: any) => (
                                                        <span key={t.tag.name} style={Q.workTag}>{t.tag.name}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {featuredWork.members && featuredWork.members.length > 0 && (
                                                <div style={Q.featuredPeople}>制作：{formatCredits(featuredWork.members)}</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 其余作品网格（不含 hero） */}
                                {otherWorks.length > 0 && (
                                    <div style={Q.worksSpread}>
                                        {otherWorks.map((p) => (
                                            <div key={p.id} style={Q.workItem}>
                                                <Link href={`/works/${p.slug}`} style={{display: "block"}}>
                                                    <div style={Q.workImgWrapSm}>
                                                        {p.coverImage ? (
                                                            <SafeImage src={p.coverImage} alt={p.title}
                                                                       className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <div style={Q.workImgPH}><span style={Q.workPHIcon}>🎮</span></div>
                                                        )}
                                                    </div>
                                                </Link>
                                                <div style={Q.workCaption}>
                                                    <div style={Q.workName}>
                                                        <Link href={`/works/${p.slug}`} style={{color: "inherit", textDecoration: "none"}}>
                                                            {p.title}
                                                        </Link>
                                                        <span style={Q.workType}>{TYPE_DESC[p.type] || p.type}</span>
                                                    </div>
                                                    {p.tags && p.tags.length > 0 && (
                                                        <div style={Q.workTagLine}>
                                                            {p.tags.slice(0, 3).map((t: any) => (
                                                                <span key={t.tag.name} style={Q.workTag}>{t.tag.name}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {p.members && p.members.length > 0 && (
                                                        <div style={Q.workCredit}>{formatCredits(p.members)}</div>
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
                                <div style={Q.thickRule}/>
                                <div style={Q.sectionTitle}>这 一 年 的 新 血 液</div>

                                <div style={Q.roster}>
                                    {members.map(m => {
                                        const avatarUrl = m.avatar || m.user?.image;
                                        return (
                                            <div key={m.id} style={Q.rosterItem}>
                                                <Link href={`/members/${m.id}`} style={{display: "block", flexShrink: 0}}>
                                                    <div style={Q.rosterAvatar}>
                                                        {avatarUrl ? (
                                                            <SafeImage src={avatarUrl} alt={m.displayName}
                                                                       className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <span style={Q.rosterInitial}>{m.displayName[0]}</span>
                                                        )}
                                                    </div>
                                                </Link>
                                                <span style={Q.rosterName}>{m.displayName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* ═══ 年度活跃成员（Top3 展示，无排名） ═══ */}
                        {activeMembers.length > 0 && (
                            <>
                                <div style={Q.thickRule}/>
                                <div style={Q.sectionTitle}>年 度 活 跃 成 员</div>

                                <div style={Q.highlightList}>
                                    {activeMembers.slice(0, 3).map((m, i) => (
                                        <div key={m.id} style={Q.highlightItem}>
                    <span style={highlightDropStyle(i)}>
                      {m.avatar || m.user?.image ? (
                          <SafeImage src={m.avatar || m.user?.image || ""} alt="" className="w-full h-full object-cover"/>
                      ) : (
                          m.displayName?.[0] || "?"
                      )}
                    </span>
                                            <span>
                      <strong style={{color: INK, fontSize: 14}}>{m.displayName}</strong>
                      <span style={{color: INK3, marginLeft: 8}}>{topNarrative[i] || ""}</span>
                    </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ═══ 活动回顾 ═══ */}
                        {(nonMeeting.length > 0 || meetingCount > 0) && (
                            <>
                                <div style={Q.thickRule}/>
                                <div style={Q.sectionTitle}>活 动 回 顾</div>

                                {meetingCount > 0 && (
                                    <p style={{fontSize: 13, color: INK3, lineHeight: 2, textAlign: "justify" as const, marginBottom: 16}}>
                                        全年共举办了 {meetingCount} 场例会。
                                    </p>
                                )}

                                {nonMeeting.length > 0 && (
                                    <div style={Q.activityList}>
                                        {nonMeeting.map(a => {
                                            const d = new Date(a.startTime);
                                            const desc = narrateActivity(a);
                                            const descHtml = a.descriptionHtml;
                                            return (
                                                <div key={a.id} style={Q.activityItem}>
                                                    <div style={Q.activityHeader}>
                                                        <span style={activityTypeTagStyle(a.type)}>{ACT_LABELS[a.type] || a.type}</span>
                                                        <Link href={`/activities/${a.id}`}
                                                              style={{color: "inherit", textDecoration: "none"}}>
                                                            <span style={Q.activityTitle}>{a.title}</span>
                                                        </Link>
                                                        {a.status === "ARCHIVED" &&
                                                            <span style={{fontSize: 10, color: INK3, fontStyle: "italic"}}>(已归档)</span>}
                                                        <span
                                                            style={Q.activityDate}>{d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, "0")}.{String(d.getDate()).padStart(2, "0")}</span>
                                                    </div>
                                                    {descHtml ? <div style={Q.activityDesc}><RichContentClient html={descHtml} /></div> : desc && <div style={Q.activityDesc}>{desc}</div>}
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
                                <div style={Q.thickRule}/>
                                <div style={Q.sectionTitle}>大 事 记</div>
                                <div style={Q.timeline}>
                                    {events.map((e) => {
                                        const d = e.eventDate ? new Date(e.eventDate) : null;
                                        return (
                                            <div key={e.id} style={Q.tlItem}>
                                                <div style={Q.tlMarker}>
                                                    <span style={Q.tlDot}/>
                                                    <span style={Q.tlStem}/>
                                                </div>
                                                <div style={Q.tlContent}>
                                                    <div style={Q.tlHeader}>
                                                        <span style={Q.tlTitle}>{e.title}</span>
                                                        {d && <span style={Q.tlDate}>{d.getMonth() + 1}月{d.getDate()}日</span>}
                                                    </div>
                                                    {e.bodyHtml ? <div style={Q.tlBody}><RichContentClient html={e.bodyHtml} /></div> : e.body && <div style={Q.tlBody}>{e.body}</div>}
                                                    {e.images && e.images.length > 0 && (
                                                        <div style={Q.tlImages}>
                                                            {e.images.map((img) => (
                                                                <button
                                                                    key={img.id}
                                                                    type="button"
                                                                    style={Q.tlImgWrap}
                                                                    onClick={() => setLightboxSrc(img.url)}
                                                                    aria-label="查看大图"
                                                                >
                                                                    <SafeImage src={img.url} alt={img.altText || e.title} fill
                                                                               style={{objectFit: "contain"}}/>
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
                        <div style={Q.rule}/>
                        <div style={Q.colophon}>
                            布谷工作室 · 保持热爱 · 持续创造
                            <br/>
                            <span style={Q.colophonUrl}>bugu.studio</span>
                        </div>
                    </div>
                </div>
            </article>
            {lightboxSrc && (
                <div onClick={() => setLightboxSrc(null)} style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "zoom-out"
                }}>
                    <img src={lightboxSrc} style={{maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain"}} alt=""/>
                </div>
            )}
        </>
    );
}
