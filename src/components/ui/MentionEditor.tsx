"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface Member {
  id: string;
  displayName: string;
}

interface MentionEditorProps {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** 显示 inline 富文本预览（高亮链接 + @mention） */
  richPreview?: boolean;
}

import { COMMON_TLDS } from "@/lib/rich-content";

/** URL 正则 — 匹配 http(s):// 或 www. 开头的完整 URL */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'，。！？、；：（）【】《》\u2018\u2019\u201c\u201d]+(?:\/[^\s<>"'，。！？、；：（）【】《》\u2018\u2019\u201c\u201d]*)?/gi;

/** 裸域名粗略正则 */
const BARE_DOMAIN_RE = /(?<![.@\/])([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,6})/g;

/**
 * 新版 @mention 正则（内嵌 memberId）：@displayName(memberId)
 * 用于在文本中识别已解析的 mention
 */
const RESOLVED_MENTION_RE = /@([^(]+)\(([a-zA-Z0-9_]+)\)/g;

/** 旧版 @mention 正则 — @后跟非空格名称片段 */
const PLAIN_MENTION_RE = /@[^\s@]+/g;

/**
 * @mention 触发检测正则（光标前）— 仅匹配 @后 1-30 个非空字符
 * 确保在 @displayName(memberId) 之后的新 @ 也能触发
 */
const MENTION_RE = /@([^\s@]{1,30})$/;

/** 验证裸域名的 TLD */
function isValidTld(word: string): boolean {
  const lastDot = word.lastIndexOf(".");
  if (lastDot === -1) return false;
  const tld = word.slice(lastDot + 1).split(/[/?#]/)[0].toLowerCase();
  if (!/^[a-z]{2,6}$/.test(tld)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(word)) return false;
  return COMMON_TLDS.has(tld);
}

interface Token {
  text: string;
  type: "text" | "url" | "mention";
  /** 新版 mention 携带的 memberId */
  memberId?: string;
}

/**
 * 将纯文本拆分为片段数组，标记 URL 和 @mention
 * 支持：
 *   1. http(s)://xxx / www.xxx URL
 *   2. 裸域名（常见 TLD）
 *   3. 新版 @mention：@displayName(memberId)
 *   4. 旧版 @mention：@displayName
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIdx = 0;

  // ── 步骤 1: 标记带协议的 URL + www. URL ──
  const urlMatches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    urlMatches.push({ start: m.index, end: URL_RE.lastIndex });
  }

  // ── 步骤 2: 标记裸域名 ──
  BARE_DOMAIN_RE.lastIndex = 0;
  while ((m = BARE_DOMAIN_RE.exec(text)) !== null) {
    const word = m[1];
    if (!isValidTld(word)) continue;
    const start = m.index;
    const end = m.index + word.length;
    const overlap = urlMatches.some(u => start < u.end && end > u.start);
    if (!overlap) urlMatches.push({ start, end });
  }
  urlMatches.sort((a, b) => a.start - b.start);

  // ── 步骤 3: 标记新版 @mention（带 memberId） ──
  const mentionMatches: Array<{ start: number; end: number; memberId: string }> = [];
  RESOLVED_MENTION_RE.lastIndex = 0;
  while ((m = RESOLVED_MENTION_RE.exec(text)) !== null) {
    const isInUrl = urlMatches.some(u => m!.index >= u.start && m!.index < u.end);
    if (!isInUrl) {
      mentionMatches.push({
        start: m.index,
        end: RESOLVED_MENTION_RE.lastIndex,
        memberId: m[2],
      });
    }
  }

  // ── 步骤 4: 标记旧版 @mention（排除已匹配的新版和 URL） ──
  PLAIN_MENTION_RE.lastIndex = 0;
  while ((m = PLAIN_MENTION_RE.exec(text)) !== null) {
    const inResolved = mentionMatches.some(r => m!.index >= r.start && m!.index < r.end);
    const inUrl = urlMatches.some(u => m!.index >= u.start && m!.index < u.end);
    if (!inResolved && !inUrl) {
      mentionMatches.push({
        start: m.index,
        end: PLAIN_MENTION_RE.lastIndex,
        memberId: "",
      });
    }
  }

  // ── 步骤 5: 合并所有标记，按位置排序 ──
  const allMarks = [
    ...urlMatches.map(mrk => ({ start: mrk.start, end: mrk.end, type: "url" as const, memberId: "" })),
    ...mentionMatches.map(mrk => ({ start: mrk.start, end: mrk.end, type: "mention" as const, memberId: mrk.memberId })),
  ].sort((a, b) => a.start - b.start);

  for (const mark of allMarks) {
    if (mark.start > lastIdx) {
      tokens.push({ text: text.slice(lastIdx, mark.start), type: "text" });
    }
    tokens.push({
      text: text.slice(mark.start, mark.end),
      type: mark.type,
      memberId: mark.memberId || undefined,
    });
    lastIdx = mark.end;
  }
  if (lastIdx < text.length) {
    tokens.push({ text: text.slice(lastIdx), type: "text" });
  }

  return tokens;
}

export default function MentionEditor({
  name: formName,
  id,
  value: controlledValue,
  defaultValue,
  onChange: controlledOnChange,
  placeholder,
  rows = 4,
  className = "",
  style,
  disabled = false,
  required,
  minLength,
  maxLength,
  richPreview = true,
}: MentionEditorProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const value = isControlled ? controlledValue : internalValue;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [mentionQuery, setMentionQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupIdx, setPopupIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);

  // ── 搜索成员 ──
  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 1) {
      setMembers([]);
      setShowPopup(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/members/search?q=${encodeURIComponent(mentionQuery)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setMembers(data);
          setShowPopup(data.length > 0);
          setPopupIdx(0);
        }
      })
      .catch(() => {
        if (!cancelled) setShowPopup(false);
      });

    return () => { cancelled = true; controller.abort(); };
  }, [mentionQuery]);

  // ── 点击外部关闭弹窗 ──
  useEffect(() => {
    if (!showPopup) return;
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setShowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopup]);

  // ── 滚动同步 ──
  const syncScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // ── 输入处理 ──
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (isControlled) {
      controlledOnChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }
    syncScroll();

    // 检测 @mention 触发
    const pos = e.target.selectionStart;
    const beforeCursor = newValue.slice(0, pos);
    const match = beforeCursor.match(MENTION_RE);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(pos - match[0].length);
    } else {
      setShowPopup(false);
      setMentionQuery("");
      setMentionStart(-1);
    }
  }, [isControlled, controlledOnChange, syncScroll]);

  // ── 选择提及成员 → 插入 @displayName(memberId) 格式 ──
  const selectMember = useCallback((member: Member) => {
    if (mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
    // 新版格式：@displayName(memberId) — 内嵌 ID 确保改名后仍可解析
    const mentionText = `@${member.displayName}(${member.id})`;
    const newValue = `${before}${mentionText} ${after}`;
    if (isControlled) {
      controlledOnChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }

    const cursorPos = mentionStart + mentionText.length + 1; // 空格后
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });

    setShowPopup(false);
    setMentionQuery("");
    setMentionStart(-1);
  }, [value, mentionStart, isControlled, controlledOnChange]);

  // ── 键盘处理 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showPopup || members.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPopupIdx(i => Math.min(i + 1, members.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPopupIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectMember(members[popupIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowPopup(false);
    }
  }, [showPopup, members, popupIdx, selectMember]);

  // ── 构建高亮版文本（编辑器的 overlay 背景层） ──
  // 新版 @mention：显示 @displayName 橙色，(memberId) 灰色淡化
  // 旧版 @mention：显示 @displayName 橙色
  // URL：蓝色带下划线
  // 普通文本：深灰色
  const highlightHtml = useMemo(() => {
    if (!richPreview || !value) return "";
    const tokens = tokenize(value);
    return tokens.map((t) => {
      if (t.type === "url") {
        return `<span style="color:#3388BB;text-decoration:underline">${escHtml(t.text)}</span>`;
      }
      if (t.type === "mention") {
        const text = t.text;
        // 解析 @displayName(memberId) 格式
        const rm = text.match(/^@([^(]+)\(([^)]+)\)$/);
        if (rm) {
          // 新版格式：名字橙色，ID 淡灰
          return `<span style="color:#E38043;font-weight:500">@${escHtml(rm[1])}</span><span style="color:#ccc;font-size:0.85em">(${escHtml(rm[2])})</span>`;
        }
        // 旧版格式
        return `<span style="color:#E38043;font-weight:500">${escHtml(text)}</span>`;
      }
      return `<span style="color:#333">${escHtml(t.text).replace(/\n/g, "<br>")}</span>`;
    }).join("");
  }, [value, richPreview]);

  const sharedClassName = "font-[inherit] text-[inherit] leading-[inherit] tracking-[inherit] [word-spacing:inherit] px-3 py-2.5 border border-transparent whitespace-pre-wrap break-words box-border w-full";

  return (
    <div className="relative isolate">
      {richPreview && (
        <div
          ref={backdropRef}
          aria-hidden
          className={`absolute inset-0 pointer-events-none overflow-auto ${sharedClassName} text-transparent min-h-[var(--min-h)] z-[1]`}
          style={{"--min-h": `${rows * 1.5 + 1.5}em`} as React.CSSProperties}
        >
          <div dangerouslySetInnerHTML={{ __html: highlightHtml + " " }} />
        </div>
      )}

      <textarea
        ref={textareaRef}
        name={formName}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={`relative resize-y ${sharedClassName} ${className} min-h-[var(--min-h)] bg-transparent caret-black z-[2]${richPreview ? " text-transparent" : ""}`}
        style={{
          ...style,
          "--min-h": `${rows * 1.5 + 1.5}em`,
        } as React.CSSProperties}
      />

      {showPopup && members.length > 0 && (
        <div
          ref={popupRef}
          className="absolute left-0 z-50 bg-card rounded-lg border shadow-lg overflow-hidden max-h-48 overflow-y-auto border-brand-border-subtle bottom-full mb-1 min-w-[200px]"
        >
          {members.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                i === popupIdx ? "bg-[#F0F5F9]" : "hover:bg-[#F5F8FA]"
              } text-brand-text-heading`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(m);
              }}
              onMouseEnter={() => setPopupIdx(i)}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-brand-orange to-brand-orange-light"
              >
                {m.displayName[0]}
              </span>
              <span>{m.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
