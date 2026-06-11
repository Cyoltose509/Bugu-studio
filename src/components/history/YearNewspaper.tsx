"use client";

import Link from "next/link";
import SafeImage from "@/components/SafeImage";

// ─── 类型定义 ───────────────────────────────────────────
interface Member {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: string | null;
  user?: { image: string | null } | null;
}
interface Project {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  type: string;
}
interface Event {
  id: string;
  title: string;
  body: string | null;
  eventDate: string | null;
  images?: { id: string; url: string; altText?: string | null }[];
}
interface Activity {
  id: string;
  title: string;
  type: string;
  startTime: Date | string;
  coverImage: string | null;
}

interface Props {
  year: number;
  members: Member[];
  projects: Project[];
  events: Event[];
  activities: Activity[];
  totalYears: number;
}

// ─── 标签映射 ───────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  DEMO: "Demo", STEAM: "Steam", ITCH: "itch.io", OTHER: "其他",
  MEETING: "例会", COURSE: "公开课", COMPETITION: "比赛", GENERAL: "普通活动",
};
const TYPE_GRADIENTS: Record<string, [string, string]> = {
  DEMO: ["#25547A", "#3388BB"],
  STEAM: ["#1a4d2e", "#2d8a4e"],
  ITCH: ["#8b3a3a", "#c05050"],
  OTHER: ["#4a4a6a", "#6a6a8a"],
};

export default function YearNewspaper({ year, members, projects, events, activities, totalYears }: Props) {
  const issueNum = totalYears - (new Date().getFullYear() - year);

  return (
    <article className="year-newspaper" style={newspaperStyle}>
      {/* ═══════ 报头 ═══════ */}
      <header style={headerStyle}>
        <div style={headerTopBar} />
        <div style={headerInner}>
          <div style={headerLeft}>
            <div style={clubNameCn}>布谷工作室</div>
            <div style={clubNameEn}>BUGU STUDIO</div>
          </div>
          <div style={headerCenter}>
            <div style={headerLabel}>年度报告 · ANNUAL REPORT</div>
            <div style={yearBig}>{year}</div>
          </div>
          <div style={headerRight}>
            <div style={issueText}>第 {issueNum} 期</div>
            <div style={headerDate}>{year}年度</div>
          </div>
        </div>
        <div style={headerTopBar} />
      </header>

      <div style={contentStyle}>
        {/* ─── 第一栏：成员 + 作品 ─── */}
        <div style={twoColRow}>
          {/* 年度成员 */}
          {members.length > 0 && (
            <section style={memberSection}>
              <h3 style={sectionTitle}>
                <span style={sectionTitleBar} />
                {year}级成员
                <span style={sectionCount}>({members.length}人)</span>
              </h3>
              <div style={memberGrid}>
                {members.map((m) => {
                  const avatarUrl = m.avatar || m.user?.image;
                  return (
                    <Link key={m.id} href={`/members/${m.id}`} style={memberItem}>
                      <div style={memberAvatar}>
                        {avatarUrl ? (
                          <SafeImage src={avatarUrl} alt={m.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span style={memberInitial}>{m.displayName[0]}</span>
                        )}
                      </div>
                      <span style={memberName}>{m.displayName}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* 年度作品精选 */}
          {projects.length > 0 && (
            <section style={projectSection}>
              <h3 style={sectionTitle}>
                <span style={sectionTitleBar} />
                年度作品
                <span style={sectionCount}>({projects.length}件)</span>
              </h3>
              <div style={projectGrid}>
                {projects.map((p) => {
                  const [g1, g2] = TYPE_GRADIENTS[p.type] || TYPE_GRADIENTS.OTHER;
                  return (
                    <Link key={p.id} href={`/works/${p.slug}`} title={p.title} style={projectCard}>
                      <div
                        style={{
                          ...projectCardInner,
                          background: p.coverImage ? "#f5f0eb" : `linear-gradient(135deg, ${g1}, ${g2})`,
                        }}
                      >
                        {p.coverImage ? (
                          <SafeImage src={p.coverImage} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <span style={projectCardTitle}>{p.title}</span>
                            <span style={projectCardType}>{TYPE_LABELS[p.type] || p.type}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ─── 大事记 ─── */}
        {events.length > 0 && (
          <section style={eventsSection}>
            <h3 style={{ ...sectionTitle, borderBottom: "1px solid #d4c5b2", paddingBottom: 8, marginBottom: 16 }}>
              <span style={sectionTitleBar} />
              年度大事记
            </h3>
            <div style={eventsGrid}>
              {events.map((event) => (
                <div key={event.id} style={eventItem}>
                  <div style={eventDot}>◆</div>
                  <div style={eventContent}>
                    <div style={eventHeader}>
                      <span style={eventTitle}>{event.title}</span>
                      {event.eventDate && (
                        <span style={eventDate}>
                          {new Date(event.eventDate).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    {event.body && <p style={eventBody}>{event.body}</p>}
                    {event.images && event.images.length > 0 && (
                      <div style={eventImagesRow}>
                        {event.images.map((img: any) => (
                          <div key={img.id} style={eventImageWrap}>
                            <SafeImage
                              src={img.url}
                              alt={img.altText || event.title}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── 活动回顾 ─── */}
        {activities.length > 0 && (
          <section style={activitySection}>
            <h3 style={{ ...sectionTitle, borderBottom: "1px solid #d4c5b2", paddingBottom: 8, marginBottom: 16 }}>
              <span style={sectionTitleBar} />
              活动回顾
              <span style={sectionCount}>({activities.length}场)</span>
            </h3>
            <div style={activityGrid}>
              {activities.map((a) => (
                <Link key={a.id} href={`/activities/${a.id}`} style={activityCard}>
                  <div style={activityCardImg}>
                    <img
                      src={a.coverImage || "/images/default_pic.png"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div style={activityCardInfo}>
                    <span style={activityCardTitle}>{a.title}</span>
                    <span style={activityCardMeta}>
                      <span style={activityTypeTag}>{TYPE_LABELS[a.type] || a.type}</span>
                      {new Date(a.startTime).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ─── 报尾 ─── */}
      <footer style={footerStyle}>
        <div style={headerTopBar} />
        <div style={footerText}>© 布谷工作室 · {year} 年度报告 · 第 {issueNum} 期</div>
      </footer>

      {/* ─── 打印保存按钮（屏幕可见，打印时隐藏）─── */}
      <div className="no-print" style={printBtnWrap}>
        <button
          type="button"
          onClick={() => window.print()}
          style={printBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#25547A";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#25547A";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <path d="M6 14h12v8H6z" />
          </svg>
          保存/打印
        </button>
      </div>
    </article>
  );
}

// ─── 样式对象 ────────────────────────────────────────────

const newspaperStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto 64px",
  background: "#faf8f5",
  border: "1px solid #d4c5b2",
  borderRadius: 4,
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(100,80,60,0.12)",
  fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'STSong', Georgia, serif",
  position: "relative",
};

const headerStyle: React.CSSProperties = {
  padding: "24px 32px 16px",
  textAlign: "center" as const,
};

const headerTopBar: React.CSSProperties = {
  height: 3,
  background: "linear-gradient(90deg, transparent, #25547A, #E38043, #25547A, transparent)",
};

const headerInner: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  padding: "16px 0",
};

const headerLeft: React.CSSProperties = {
  textAlign: "left" as const,
  flex: "0 0 160px",
};

const clubNameCn: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#25547A",
  letterSpacing: 4,
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const clubNameEn: React.CSSProperties = {
  fontSize: 10,
  color: "#8b7355",
  letterSpacing: 2,
  textTransform: "uppercase" as const,
  fontFamily: "Georgia, serif",
  marginTop: 2,
};

const headerCenter: React.CSSProperties = {
  textAlign: "center" as const,
  flex: 1,
};

const headerLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#8b7355",
  letterSpacing: 6,
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
  textTransform: "uppercase" as const,
};

const yearBig: React.CSSProperties = {
  fontSize: 80,
  fontWeight: 900,
  lineHeight: 1,
  color: "#25547A",
  fontFamily: "Georgia, 'Noto Serif SC', serif",
  letterSpacing: -2,
  marginTop: 4,
};

const headerRight: React.CSSProperties = {
  textAlign: "right" as const,
  flex: "0 0 160px",
};

const issueText: React.CSSProperties = {
  fontSize: 13,
  color: "#8b7355",
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const headerDate: React.CSSProperties = {
  fontSize: 11,
  color: "#b8a590",
  marginTop: 4,
  fontFamily: "Georgia, serif",
};

const contentStyle: React.CSSProperties = {
  padding: "0 32px 24px",
};

// ─── 两栏布局 ───
const twoColRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 24,
};

const memberSection: React.CSSProperties = {
  minWidth: 0,
};

const projectSection: React.CSSProperties = {
  minWidth: 0,
};

// ─── 区块标题 ───
const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#2c1810",
  marginBottom: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const sectionTitleBar: React.CSSProperties = {
  display: "inline-block",
  width: 3,
  height: 16,
  background: "#E38043",
  borderRadius: 2,
};

const sectionCount: React.CSSProperties = {
  fontSize: 11,
  color: "#b8a590",
  fontWeight: 400,
  marginLeft: 4,
};

// ─── 成员网格 ───
const memberGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const memberItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  textDecoration: "none",
  fontSize: 12,
  color: "#4a3728",
  transition: "color 0.2s",
};

const memberAvatar: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  overflow: "hidden",
  background: "#25547A",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const memberInitial: React.CSSProperties = {
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "system-ui, sans-serif",
};

const memberName: React.CSSProperties = {
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 100,
};

// ─── 作品网格 ───
const projectGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
};

const projectCard: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  borderRadius: 4,
  overflow: "hidden",
  aspectRatio: "4/3",
  transition: "transform 0.2s, box-shadow 0.2s",
};

const projectCardInner: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
};

const projectCardTitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#fff",
  textAlign: "center" as const,
  lineHeight: 1.3,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const projectCardType: React.CSSProperties = {
  fontSize: 8,
  color: "rgba(255,255,255,0.6)",
  marginTop: 4,
  fontFamily: "system-ui, sans-serif",
};

// ─── 大事记 ───
const eventsSection: React.CSSProperties = {
  marginTop: 24,
};

const eventsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "12px 24px",
};

const eventItem: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "8px 0",
  borderBottom: "1px dotted #e8ddd0",
};

const eventDot: React.CSSProperties = {
  color: "#88C232",
  fontSize: 12,
  marginTop: 2,
  flexShrink: 0,
  fontFamily: "system-ui, sans-serif",
};

const eventContent: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const eventHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};

const eventTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#2c1810",
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const eventDate: React.CSSProperties = {
  fontSize: 10,
  color: "#b8a590",
  fontFamily: "Georgia, serif",
};

const eventBody: React.CSSProperties = {
  fontSize: 11,
  color: "#6b5d4f",
  lineHeight: 1.6,
  marginTop: 4,
  whiteSpace: "pre-wrap" as const,
};

const eventImagesRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginTop: 8,
  flexWrap: "wrap",
};

const eventImageWrap: React.CSSProperties = {
  width: 72,
  height: 52,
  borderRadius: 3,
  overflow: "hidden",
  border: "1px solid #e8ddd0",
};

// ─── 活动 ───
const activitySection: React.CSSProperties = {
  marginTop: 24,
};

const activityGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
};

const activityCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 6,
  background: "rgba(255,255,255,0.6)",
  border: "1px solid #e8ddd0",
  textDecoration: "none",
  transition: "background 0.2s",
};

const activityCardImg: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 6,
  overflow: "hidden",
  flexShrink: 0,
};

const activityCardInfo: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const activityCardTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#2c1810",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};

const activityCardMeta: React.CSSProperties = {
  fontSize: 10,
  color: "#b8a590",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const activityTypeTag: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 9,
  background: "#E6F0F8",
  color: "#3388BB",
  fontFamily: "system-ui, sans-serif",
};

// ─── 报尾 ───
const footerStyle: React.CSSProperties = {
  padding: "16px 32px",
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  fontSize: 10,
  color: "#b8a590",
  marginTop: 8,
  fontFamily: "Georgia, serif",
  letterSpacing: 1,
};

// ─── 打印按钮 ───
const printBtnWrap: React.CSSProperties = {
  textAlign: "right" as const,
  padding: "0 32px 16px",
};

const printBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  borderRadius: 6,
  border: "1.5px solid #25547A",
  background: "transparent",
  color: "#25547A",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
  fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
};
