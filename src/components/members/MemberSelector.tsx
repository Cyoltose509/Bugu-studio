"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UserResult {
  id: string;
  name: string | null;
  image: string | null;
}

interface MemberSelectorProps {
  onSelect: (user: UserResult) => void;
  placeholder?: string;
  excludeIds?: string[];
}

export default function MemberSelector({
  onSelect,
  placeholder = "搜索成员…",
  excludeIds = [],
}: MemberSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const list: UserResult[] = Array.isArray(data) ? data : data.data || [];
        setResults(list.filter((u) => !excludeIds.includes(u.id)));
      }
    } catch {}
  }, [excludeIds]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length >= 1) {
      timerRef.current = setTimeout(() => search(query), 200);
    } else {
      search("");
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(user: UserResult) {
    setSelectedUser(user);
    setQuery(user.name || "");
    setShowDropdown(false);
    onSelect(user);
  }

  function clearSelection() {
    setSelectedUser(null);
    setQuery("");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            setSelectedUser(null);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm border-brand-border-subtle text-brand-text-heading"
        />
        {selectedUser && (
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs px-2 py-1.5 rounded text-brand-text-muted border border-brand-border-subtle"
          >
            清除
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div
          className="absolute z-20 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto border-brand-border-subtle"
        >
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-surface-page flex items-center gap-2 transition-colors"
            >
              {u.image ? (
                <img
                  src={u.image}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0 bg-brand-orange"
                >
                  {(u.name || "?")[0]}
                </span>
              )}
              <span className="text-brand-text-heading">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
