"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { positionLabel, positionColor } from "@/lib/position";
import MemberGraph from "./MemberGraph";
import { useLang } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/dict";

const SKILL_LABEL_KEYS: Record<string, DictKey> = {
  "程序": "form.role.program",
  "策划": "form.role.design",
  "美术": "form.role.art",
  "音效": "form.role.sound",
  "音乐": "form.role.music",
  "测试": "form.role.test",
  "宣发": "form.role.pr",
  "全栈": "form.role.fullstack",
};

/** 线性（描边）放大镜图标 */
function SearchIcon({ className = "" }: { className?: string }) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={className}
        >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="15.5" y1="15.5" x2="20" y2="20" />
        </svg>
    );
}

/** 线性关闭图标 */
function CloseIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
        >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
    );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 items-start gap-2">
            <h3 className="w-12 shrink-0 whitespace-nowrap pt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">{label}</h3>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {children}
            </div>
        </div>
    );
}

const FILTER_TONES = {
    blue: {
        idle: "border-[#3388BB]/25 bg-[#3388BB]/10 text-[#28739D] dark:text-[#8CCCF0]",
        active: "border-[#3388BB]/55 bg-[#3388BB]/25 text-[#1D668E] ring-1 ring-[#3388BB]/20 dark:text-[#A9DDF7]",
    },
    green: {
        idle: "border-[#88C232]/30 bg-[#88C232]/10 text-[#568515] dark:text-[#B9E479]",
        active: "border-[#88C232]/60 bg-[#88C232]/25 text-[#46720A] ring-1 ring-[#88C232]/20 dark:text-[#C8EC94]",
    },
    orange: {
        idle: "border-[#E38043]/30 bg-[#E38043]/10 text-[#B15B27] dark:text-[#F2B185]",
        active: "border-[#E38043]/60 bg-[#E38043]/25 text-[#9D4817] ring-1 ring-[#E38043]/20 dark:text-[#F7C09A]",
    },
    purple: {
        idle: "border-purple-400/25 bg-purple-400/10 text-purple-700 dark:text-purple-300",
        active: "border-purple-400/55 bg-purple-400/25 text-purple-800 ring-1 ring-purple-400/20 dark:text-purple-200",
    },
    rose: {
        idle: "border-rose-400/25 bg-rose-400/10 text-rose-700 dark:text-rose-300",
        active: "border-rose-400/55 bg-rose-400/25 text-rose-800 ring-1 ring-rose-400/20 dark:text-rose-200",
    },
    teal: {
        idle: "border-teal-400/30 bg-teal-400/10 text-teal-700 dark:text-teal-300",
        active: "border-teal-400/60 bg-teal-400/25 text-teal-800 ring-1 ring-teal-400/20 dark:text-teal-200",
    },
    amber: {
        idle: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
        active: "border-amber-400/60 bg-amber-400/25 text-amber-800 ring-1 ring-amber-400/20 dark:text-amber-200",
    },
    gray: {
        idle: "border-slate-400/25 bg-slate-400/10 text-slate-600 dark:text-slate-300",
        active: "border-slate-400/55 bg-slate-400/25 text-slate-700 ring-1 ring-slate-400/20 dark:text-slate-200",
    },
} as const;

type FilterTone = keyof typeof FILTER_TONES;

// 仅用于筛选菜单：个人主页仍按成员提交的 skills 顺序展示。
const COMMON_SKILL_TONES = new Map<string, FilterTone>([
    ["策划", "purple"],
    ["程序", "blue"],
    ["美术", "rose"],
    ["音乐", "teal"],
    ["全栈", "orange"],
    ["宣发", "green"],
    ["测试", "amber"],
]);
const COMMON_SKILL_ORDER = [...COMMON_SKILL_TONES.keys()];
const COMMON_SKILL_SET = new Set(COMMON_SKILL_ORDER);

function FilterChip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: FilterTone; children: ReactNode }) {
    const colors = FILTER_TONES[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`rounded-full border px-2.5 py-1 text-[11px] leading-tight font-medium backdrop-blur-sm transition-all hover:-translate-y-px hover:brightness-95 ${active ? colors.active : colors.idle}`}
        >
            {active && <span className="mr-1" aria-hidden>✓</span>}
            {children}
        </button>
    );
}

interface MemberItem {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: number | null;
  joinYear: number | null;
  graduated: boolean;
  position: string;
  userId: string;
  user: { image: string | null } | null;
  projectCount: number;
  skills?: string[];
  bio?: string | null;
}

interface Props {
  members: MemberItem[];
  totalCount: number;
  activeCount: number;
}

export default function MembersList({ members: allMembers, totalCount, activeCount }: Props) {
  const { t, lang } = useLang();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grade" | "joinYear" | "graph">("grade");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedJoinYears, setSelectedJoinYears] = useState<number[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRootRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim().length > 0;
  const activeFilterCount = selectedGrades.length + selectedJoinYears.length + selectedSkills.length;
  const hasFilters = activeFilterCount > 0;

  const { grades, joinYears, skills } = useMemo(() => {
    const availableSkills = new Set(allMembers.flatMap((m) => m.skills ?? []));
    return {
      grades: [...new Set(allMembers.flatMap((m) => m.grade == null ? [] : [m.grade]))].sort((a, b) => b - a),
      joinYears: [...new Set(allMembers.flatMap((m) => m.joinYear == null ? [] : [m.joinYear]))].sort((a, b) => b - a),
      skills: [
        ...COMMON_SKILL_ORDER.filter((skill) => availableSkills.has(skill)),
        ...[...availableSkills].filter((skill) => !COMMON_SKILL_SET.has(skill)).sort((a, b) => a.localeCompare(b, lang === "cn" ? "zh" : "en")),
      ],
    };
  }, [allMembers, lang]);

  useEffect(() => {
    if (!filterPanelOpen) return;
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!filterRootRef.current?.contains(event.target as Node)) setFilterPanelOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterPanelOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusId);
    };
  }, [filterPanelOpen]);

  // 客户端过滤 + 按模式分组
  const { filtered, groupedFiltered, sortedKeysFiltered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    // 分组 key（带语言）：从字符串里取年份数字做排序，中英文都兼容
    const makeKey = (m: MemberItem): string => {
      if (mode === "grade") return m.grade != null ? t("members.gradeGroup", { g: m.grade }) : t("common.unset");
      return m.joinYear != null ? t("members.joinYearGroup", { y: m.joinYear }) : t("common.unset");
    };
    const yearVal = (key: string) => {
      const m = key.match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };
    const group = (list: MemberItem[]) => {
      const groups: Record<string, MemberItem[]> = {};
      for (const m of list) {
        const key = makeKey(m);
        (groups[key] ??= []).push(m);
      }
      const keys = Object.keys(groups).sort((a, b) => yearVal(b) - yearVal(a));
      return { groups, keys };
    };
    const matched = allMembers.filter((m) => {
      const name = m.displayName.toLowerCase();
      const skillsText = (m.skills || []).join(" ").toLowerCase();
      const matchesQuery = !q || name.includes(q) || skillsText.includes(q);
      const matchesGrade = selectedGrades.length === 0 || (m.grade != null && selectedGrades.includes(m.grade));
      const matchesJoinYear = selectedJoinYears.length === 0 || (m.joinYear != null && selectedJoinYears.includes(m.joinYear));
      const matchesSkill = selectedSkills.length === 0 || selectedSkills.some((skill) => (m.skills || []).includes(skill));
      return matchesQuery && matchesGrade && matchesJoinYear && matchesSkill;
    });
    const { groups, keys } = group(matched);
    return { filtered: matched, groupedFiltered: groups, sortedKeysFiltered: keys };
  }, [query, allMembers, mode, selectedGrades, selectedJoinYears, selectedSkills, t]);

  const toggleNumber = (value: number, selected: number[], setSelected: (next: number[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    if (mode === "graph") setMode("grade");
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
    if (mode === "graph") setMode("grade");
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedGrades([]);
    setSelectedJoinYears([]);
    setSelectedSkills([]);
  };

  return (
    <>
      {/* 标题与搜索入口同排，统计置于标题下方 */}
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:items-end sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-brand-navy">{t("page.members.title")}</h1>
          <p className="mt-2 text-brand-text-secondary">
            {t("members.summary", { total: totalCount, active: activeCount })}
            {(hasQuery || hasFilters) && <> {t("members.matched", { n: filtered.length })}</>}
          </p>
        </div>
        <div ref={filterRootRef} className="relative z-30 flex justify-end">
          <button
            type="button"
            onFocus={() => setFilterPanelOpen(true)}
            onClick={() => setFilterPanelOpen(true)}
            aria-label={t("members.openSearch")}
            aria-expanded={filterPanelOpen}
            aria-controls="member-filter-menu"
            title={t("members.openSearch")}
            className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-lg border transition-colors ${
              filterPanelOpen || hasQuery || hasFilters
                ? "border-brand-blue/40 bg-brand-surface text-brand-blue"
                : "border-brand-border-subtle bg-card text-brand-text-muted hover:border-brand-blue/40 hover:text-brand-blue"
            }`}
          >
            <SearchIcon />
            {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brand-orange px-1 text-[10px] leading-4 text-white">{activeFilterCount}</span>}
          </button>

          {filterPanelOpen && (
            <section id="member-filter-menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-brand-border-subtle bg-card/95 p-4 shadow-xl backdrop-blur-xl animate-fade-in sm:w-[min(640px,calc(100vw-2rem))]" aria-label={t("members.filterTitle")}>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted"><SearchIcon /></span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setFilterPanelOpen(false); }}
                    placeholder={t("members.searchPlaceholder")}
                    aria-label={t("members.searchPlaceholder")}
                    className="w-full rounded-lg border border-brand-border-subtle bg-card py-2.5 pl-9 pr-9 text-sm text-brand-text-heading placeholder:text-brand-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  {hasQuery && <button type="button" onClick={() => setQuery("")} aria-label={t("works.closeSearch")} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-heading"><CloseIcon /></button>}
                </div>
                <button type="button" onClick={() => setFilterPanelOpen(false)} aria-label={t("members.closeFilters")} className="shrink-0 rounded p-2 text-brand-text-muted hover:bg-brand-surface hover:text-brand-text-heading">
                  <CloseIcon />
                </button>
              </div>

              {(hasQuery || hasFilters) && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={clearFilters} className="text-xs font-medium text-brand-blue hover:underline">
                    {t("members.clearFilters")}
                  </button>
                </div>
              )}

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <FilterGroup label={t("members.gradeLabel")}>
                  {grades.map((grade) => (
                    <FilterChip key={grade} active={selectedGrades.includes(grade)} tone="blue" onClick={() => toggleNumber(grade, selectedGrades, setSelectedGrades)}>
                      {t("members.gradeGroup", { g: grade })}
                    </FilterChip>
                  ))}
                </FilterGroup>
                <FilterGroup label={t("members.joinYearLabel")}>
                  {joinYears.map((year) => (
                    <FilterChip key={year} active={selectedJoinYears.includes(year)} tone="orange" onClick={() => toggleNumber(year, selectedJoinYears, setSelectedJoinYears)}>
                      {year}
                    </FilterChip>
                  ))}
                </FilterGroup>
                <FilterGroup label={t("members.skillLabel")}>
                  {skills.map((skill) => (
                    <FilterChip key={skill} active={selectedSkills.includes(skill)} tone={COMMON_SKILL_TONES.get(skill) ?? "gray"} onClick={() => toggleSkill(skill)}>
                      {SKILL_LABEL_KEYS[skill] ? t(SKILL_LABEL_KEYS[skill]) : skill}
                    </FilterChip>
                  ))}
                </FilterGroup>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 模式切换 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" onClick={() => setMode("grade")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "grade" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >{t("members.sortByGrade")}</button>
        <button type="button" onClick={() => setMode("joinYear")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "joinYear" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >{t("members.sortByJoinYear")}</button>
        <button type="button" onClick={() => setMode("graph")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "graph" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >{t("members.sortByGraph")}</button>
      </div>

      {mode === "graph" ? (
        <MemberGraph query={query} />
      ) : (
      <>
      {/* 成员列表 */}
      {sortedKeysFiltered.length === 0 ? (
        <div className="text-center py-16 text-brand-text-muted">
          <SearchIcon className="w-10 h-10 mx-auto mb-4 opacity-60" />
          <p>{t("members.empty")}</p>
        </div>
      ) : (
        sortedKeysFiltered.map(key => (
          <section key={key} className="mb-12">
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-brand-navy">
              <span>{key}</span>
              <span className="text-sm font-normal text-brand-text-muted">{t("activityDetail.memberCountInline", { n: groupedFiltered[key].length })}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {groupedFiltered[key].map(m => (
                <Link key={m.id} href={`/members/${m.id}`} className={`group text-center p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all border-brand-border-subtle ${m.graduated ? "pt-6" : "pt-5"}`}>
                  <div className="relative w-12 h-12 mx-auto">
                    <UserAvatar src={m.user?.image || m.avatar} name={m.displayName} size={48} className="mx-auto" />
                    {m.graduated && (
                      /* 毕业帽当头像框：帽板横跨头像宽度、居中压在头顶，流苏自然垂在左侧 */
                      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[22px] z-10 block w-20 h-[59px] drop-shadow-md" aria-hidden>
                        <Image
                          src="/images/graduation-cap.png"
                          alt=""
                          width={80}
                          height={59}
                          className="w-full h-full object-contain select-none"
                        />
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-0.5 mx-auto font-medium group-hover:text-brand-blue transition-colors line-clamp-1 flex items-center gap-1 justify-center text-brand-text-heading">
                    {m.displayName}
                    {m.position && m.position !== "MEMBER" && (() => {
                      const color = positionColor(m.position);
                      return (
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: color.bg, color: color.text }}>
                          {positionLabel(m.position)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-xs mt-0.5 text-brand-text-muted">{t("members.projectCountShort", { n: m.projectCount ?? 0 })}</div>
                  {m.graduated && <div className="text-xs mt-0.5 text-[#aaa]">{t("members.graduated")}</div>}
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      </>
      )}
    </>
  );
}
