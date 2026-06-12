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

/** 常见 TLD 列表（用于裸域名识别） */
const COMMON_TLDS = new Set([
  "com","org","net","io","dev","app","co","info","xyz","me","cc","tv","fm","be","to","nl","de","fr","uk","eu","ai","sh","ac","tw","hk","jp","kr","sg","in","au","nz","br","mx","ru","pl","it","es","pt","se","no","fi","dk","cz","ro","bg","hr","si","sk","lt","lv","ee","hu","gr","cy","mt","lu","at","ch","li","mc","ad","sm","va","tk","ws","am","az","ge","kg","kz","md","mn","th","tr","uz","vn","ph","id","my","pk","bd","lk","np","mm","kh","la","bn","tl","pg","fj","nc","pf","wf","yt","pm","bl","mf","gl","bq","cw","sx","aw","je","gg","im","tc","vi","pr","as","gu","mp","um","is","fo","sj","bv","hm","gs","tf","aq",
  "com.cn","net.cn","org.cn","gov.cn","edu.cn","co.uk","co.jp","co.kr","co.nz","ac.uk","ac.cn","ac.jp",
]);

/** URL 正则 — 匹配 http(s):// 或 www. 开头的完整 URL */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'，。！？、；：（）【】《》\u2018\u2019\u201c\u201d]+(?:\/[^\s<>"'，。！？、；：（）【】《》\u2018\u2019\u201c\u201d]*)?/gi;

/** 裸域名粗略正则 — 匹配 xxx.yy 模式（yy 为 2-6 位字母），二次验证 TLD */
const BARE_DOMAIN_RE = /(?<![.@\/])([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,6})/g;

/** @mention 正则 — 匹配 @后跟非空格的名称片段（光标前） */
const MENTION_RE = /@([^\s@]{1,30})$/;

/** 验证裸域名的 TLD 是否在常见列表中 */
function isValidTld(word: string): boolean {
  const lastDot = word.lastIndexOf(".");
  if (lastDot === -1) return false;
  const tld = word.slice(lastDot + 1).split(/[/?#]/)[0].toLowerCase();
  if (!/^[a-z]{2,6}$/.test(tld)) return false;
  // 排除纯数字段（IP 地址）
  if (/^\d+\.\d+\.\d+\.\d+$/.test(word)) return false;
  return COMMON_TLDS.has(tld);
}

/**
 * 将纯文本拆分为片段数组，标记 URL 和 @mention
 * 支持三种 URL 格式：
 * 1. http(s)://xxx
 * 2. www.xxx
 * 3. 裸域名（仅当 TLD 在常见列表中）
 */
function tokenize(text: string): Array<{ text: string; type: "text" | "url" | "mention" }> {
  const tokens: Array<{ text: string; type: "text" | "url" | "mention" }> = [];
  const mentionAllRe = /@[^\s@]+/g;
  let lastIdx = 0;

  // ── 步骤 1: 标记带协议头的 URL（http(s)://）和 www. 开头的 URL ──
  const urlMatches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    urlMatches.push({ start: m.index, end: URL_RE.lastIndex });
  }

  // ── 步骤 2: 标记裸域名（在被已有 URL 覆盖的区域之外） ──
  BARE_DOMAIN_RE.lastIndex = 0;
  while ((m = BARE_DOMAIN_RE.exec(text)) !== null) {
    const word = m[1];
    if (!isValidTld(word)) continue;
    const start = m.index;
    const end = m.index + word.length;
    // 不与已有 URL 重叠
    const overlap = urlMatches.some(u => start < u.end && end > u.start);
    if (!overlap) {
      urlMatches.push({ start, end });
    }
  }
  urlMatches.sort((a, b) => a.start - b.start);

  // ── 步骤 3: 标记 @mention（排除 URL 内的部分） ──
  mentionAllRe.lastIndex = 0;
  const mentionMatches: Array<{ start: number; end: number }> = [];
  while ((m = mentionAllRe.exec(text)) !== null) {
    const isInUrl = urlMatches.some(u => m!.index >= u.start && m!.index < u.end);
    if (!isInUrl) {
      mentionMatches.push({ start: m.index, end: mentionAllRe.lastIndex });
    }
  }

  // ── 步骤 4: 合并所有标记，按位置排序 ──
  const allMarks = [
    ...urlMatches.map(m => ({ ...m, type: "url" as const })),
    ...mentionMatches.map(m => ({ ...m, type: "mention" as const })),
  ].sort((a, b) => a.start - b.start);

  for (const mark of allMarks) {
    if (mark.start > lastIdx) {
      tokens.push({ text: text.slice(lastIdx, mark.start), type: "text" });
    }
    tokens.push({ text: text.slice(mark.start, mark.end), type: mark.type });
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

    // 检测 @mention
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

  // ── 选择提及成员 ──
  const selectMember = useCallback((member: Member) => {
    if (mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
    const newValue = `${before}@${member.displayName} ${after}`;
    if (isControlled) {
      controlledOnChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }

    const cursorPos = mentionStart + member.displayName.length + 2;
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

  // ── 构建高亮版文本 ──
  const highlightHtml = useMemo(() => {
    if (!richPreview || !value) return "";
    const tokens = tokenize(value);
    return tokens.map((t) => {
      if (t.type === "url") {
        return `<span style="color:#3388BB;text-decoration:underline">${escHtml(t.text)}</span>`;
      }
      if (t.type === "mention") {
        return `<span style="color:#E38043;font-weight:500">${escHtml(t.text)}</span>`;
      }
      return `<span style="color:#333">${escHtml(t.text).replace(/\n/g, "<br>")}</span>`;
    }).join("");
  }, [value, richPreview]);

  const sharedStyle: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    letterSpacing: "inherit",
    wordSpacing: "inherit",
    padding: "0.625rem 0.75rem",
    border: "1px solid transparent",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    overflowWrap: "break-word",
    boxSizing: "border-box",
    width: "100%",
    resize: "vertical",
    minHeight: `${rows * 1.5 + 1.5}em`,
  };

  return (
    <div className="relative" style={{ isolation: "isolate" }}>
      {richPreview && (
        <div
          ref={backdropRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none overflow-auto"
          style={{
            ...sharedStyle,
            color: "transparent",
            zIndex: 1,
          }}
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
        className={`relative resize-y ${className}`}
        style={{
          ...sharedStyle,
          ...style,
          color: richPreview ? "transparent" : undefined,
          caretColor: "black",
          background: "transparent",
          position: "relative",
          zIndex: 2,
        }}
      />

      {showPopup && members.length > 0 && (
        <div
          ref={popupRef}
          className="absolute left-0 z-50 bg-white rounded-lg border shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          style={{
            borderColor: "#D0DEE8",
            bottom: "100%",
            marginBottom: 4,
            minWidth: 200,
          }}
        >
          {members.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                i === popupIdx ? "bg-[#F0F5F9]" : "hover:bg-[#F5F8FA]"
              }`}
              style={{ color: "#333" }}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(m);
              }}
              onMouseEnter={() => setPopupIdx(i)}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #E38043, #F09055)" }}
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
