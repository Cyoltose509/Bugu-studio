"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { positionLabel, positionColor } from "@/lib/position";
import MemberGraph from "./MemberGraph";

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
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grade" | "joinYear" | "graph">("grade");
  const [searchRaw, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const hasQuery = query.trim().length > 0;
  // 有搜索词时保持展开，清空后自动收回成图标
  const searchOpen = searchRaw || hasQuery;

  // 展开后 <input> 才挂载，靠它的 autoFocus 拿到焦点。
  // 这里只补一种情况：挂载完仍没有任何焦点（个别浏览器不认 autoFocus）。
  // 用户已经点了别处时不抢焦点。
  useEffect(() => {
    if (!searchOpen) return;
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (el && document.activeElement === document.body) el.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [searchOpen]);

  // 客户端过滤 + 按模式分组
  const { filtered, groupedFiltered, sortedKeysFiltered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // 无搜索时：按当前模式重新分组
      const groups: Record<string, MemberItem[]> = {};
      for (const m of allMembers) {
        let key: string;
        if (mode === "grade") {
          key = m.grade != null ? `${m.grade}级` : "未设置";
        } else {
          key = m.joinYear != null ? `${m.joinYear}年入社` : "未设置";
        }
        (groups[key] ??= []).push(m);
      }
      const keys = Object.keys(groups).sort((a, b) => {
        const nA = parseInt(a) || 0;
        const nB = parseInt(b) || 0;
        return nB - nA;
      });
      return { filtered: allMembers, groupedFiltered: groups, sortedKeysFiltered: keys };
    }
    const matched = allMembers.filter((m) => {
      const name = m.displayName.toLowerCase();
      const skillsText = (m.skills || []).join(" ").toLowerCase();
      return name.includes(q) || skillsText.includes(q);
    });
    // 重新分组
    const groups: Record<string, MemberItem[]> = {};
    for (const m of matched) {
      let key: string;
      if (mode === "grade") {
        key = m.grade != null ? `${m.grade}级` : "未设置";
      } else {
        key = m.joinYear != null ? `${m.joinYear}年入社` : "未设置";
      }
      (groups[key] ??= []).push(m);
    }
    const keys = Object.keys(groups).sort((a, b) => {
      const nA = parseInt(a) || 0;
      const nB = parseInt(b) || 0;
      return nB - nA;
    });
    return { filtered: matched, groupedFiltered: groups, sortedKeysFiltered: keys };
  }, [query, allMembers, mode]);

  return (
    <>
      {/* 头部：标题与统计在左，搜索框靠右对齐 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-brand-navy">成员列表</h1>
          <p className="mt-2 text-brand-text-secondary">
            共 {totalCount} 位历届成员，{activeCount} 位在读成员
            {hasQuery && <> · 找到 {filtered.length} 位匹配成员</>}
          </p>
        </div>
        {/* 搜索：默认收起为一个线性放大镜图标，点开才展开输入框 */}
        <div className="relative h-[42px] w-full sm:w-72 sm:shrink-0">
          {/* 收起态：一个线性放大镜图标按钮 */}
          <button
            type="button"
            ref={searchBtnRef}
            onClick={() => setSearchOpen(true)}
            aria-label="展开搜索框"
            aria-expanded={searchOpen}
            aria-hidden={searchOpen}
            tabIndex={searchOpen ? -1 : 0}
            className={`absolute right-0 top-0 h-[42px] w-[42px] flex items-center justify-center rounded-lg text-brand-text-muted transition-all hover:text-brand-text hover:bg-brand-surface ${
              searchOpen ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <SearchIcon />
          </button>

          {/* 展开态：输入框（收起时不渲染，避免藏一个可聚焦元素在无障碍树里） */}
          <div
            className={`absolute inset-y-0 right-0 flex items-center transition-all duration-200 ${
              searchOpen ? "w-full" : "w-[42px] pointer-events-none"
            }`}
          >
            {searchOpen && (
              <>
                <span className="pointer-events-none absolute left-3 text-brand-text-muted">
                  <SearchIcon />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => setSearchOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="搜索成员姓名或职能…"
                  aria-label="搜索成员姓名或职能"
                  autoFocus
                  className="w-full bg-card border rounded-lg pl-9 pr-9 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                    searchBtnRef.current?.focus();
                  }}
                  aria-label="关闭搜索"
                  className="absolute right-3 text-brand-text-muted hover:opacity-70"
                >
                  <CloseIcon />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" onClick={() => setMode("grade")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "grade" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >按年级</button>
        <button type="button" onClick={() => setMode("joinYear")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "joinYear" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >按入社年份</button>
        <button type="button" onClick={() => setMode("graph")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "graph" ? "bg-brand-navy text-white" : "bg-brand-surface-page text-brand-text-body"}`}
        >关系图谱</button>
      </div>

      {mode === "graph" ? (
        <MemberGraph query={query} />
      ) : (
      <>
      {/* 成员列表 */}
      {sortedKeysFiltered.length === 0 ? (
        <div className="text-center py-16 text-brand-text-muted">
          <SearchIcon className="w-10 h-10 mx-auto mb-4 opacity-60" />
          <p>没有找到匹配的成员</p>
        </div>
      ) : (
        sortedKeysFiltered.map(key => (
          <section key={key} className="mb-12">
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-brand-navy">
              <span>{key}</span>
              <span className="text-sm font-normal text-brand-text-muted">{groupedFiltered[key].length} 人</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {groupedFiltered[key].map(m => (
                <Link key={m.id} href={`/members/${m.id}`} className="group text-center p-4 pt-5 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all border-brand-border-subtle">
                  <div className="relative w-12 h-12 mx-auto">
                    <UserAvatar src={m.user?.image || m.avatar} name={m.displayName} size={48} className="mx-auto" />
                    {m.graduated && (
                      <Image
                        src="/images/graduation-cap.png"
                        alt=""
                        width={40}
                        height={40}
                        className="pointer-events-none absolute -top-3 left-1/2 z-10 w-10 h-10 -translate-x-1/2 object-contain drop-shadow-sm select-none"
                        aria-hidden
                      />
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
                  <div className="text-xs mt-0.5 text-brand-text-muted">{m.projectCount ?? 0} 个项目</div>
                  {m.graduated && <div className="text-xs mt-0.5 text-[#aaa]">已毕业</div>}
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
