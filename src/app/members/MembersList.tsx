"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

interface MemberItem {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: number | null;
  joinYear: number | null;
  isActive: boolean;
  position: string;
  userId: string;
  user: { image: string | null } | null;
  projectCount: number;
  skills?: string[];
  bio?: string | null;
}

interface Props {
  members: MemberItem[];
  grouped: Record<string, MemberItem[]>;
  sortedKeys: string[];
}

export default function MembersList({ members: allMembers, grouped: initialGrouped, sortedKeys: initialSortedKeys }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grade" | "joinYear">("grade");

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
      {/* 搜索栏 */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#999" }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索成员姓名或职能…"
            className="w-full bg-white border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
            style={{ borderColor: "#D0DEE8", color: "#333" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm hover:opacity-70"
              style={{ color: "#999" }}
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <p className="text-xs mt-2" style={{ color: "#999" }}>
            找到 {filtered.length} 位匹配成员
          </p>
        )}
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setMode("grade")}
          className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={mode === "grade" ? {background: "#25547A", color: "#fff"} : {background: "#F0F5F9", color: "#555"}}
        >按年级</button>
        <button type="button" onClick={() => setMode("joinYear")}
          className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={mode === "joinYear" ? {background: "#25547A", color: "#fff"} : {background: "#F0F5F9", color: "#555"}}
        >按入社年份</button>
      </div>

      {/* 成员列表 */}
      {sortedKeysFiltered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "#999" }}>
          <div className="text-4xl mb-4">🔍</div>
          <p>没有找到匹配的成员</p>
        </div>
      ) : (
        sortedKeysFiltered.map(key => (
          <section key={key} className="mb-12">
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-3" style={{ color: "#25547A" }}>
              <span>{key}</span>
              <span className="text-sm font-normal" style={{ color: "#999" }}>{groupedFiltered[key].length} 人</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {groupedFiltered[key].map(m => (
                <Link key={m.id} href={`/members/${m.id}`} className="group text-center p-4 rounded-xl bg-white border shadow-sm hover:shadow-md transition-all" style={{ borderColor: "#D0DEE8" }}>
                  <div className="w-16 h-16 mx-auto mb-3 overflow-hidden">
                    <UserAvatar src={m.user?.image || m.avatar} name={m.displayName} size={64} className="mx-auto" />
                  </div>
                  <div className="text-sm font-medium group-hover:text-[#3388BB] transition-colors line-clamp-1 flex items-center gap-1" style={{ color: "#333" }}>
                    {m.displayName}
                    {m.position && m.position !== "MEMBER" && (
                      <span className="text-[10px] px-1 py-0.5 rounded" style={m.position === "FOUNDER" ? { background: "#FFE384", color: "#5C4B00" } : { background: "#25547A", color: "#fff" }}>
                        {m.position === "PRESIDENT" ? "社长" : m.position === "VICE_PRESIDENT" ? "副社长" : m.position === "FOUNDER" ? "创始人" : m.position}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#999" }}>{m.projectCount ?? 0} 个项目</div>
                  {!m.isActive && <div className="text-xs mt-0.5" style={{ color: "#aaa" }}>已退役</div>}
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
