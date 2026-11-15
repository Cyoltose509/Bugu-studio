"use client";

import { useState, useRef, useEffect } from "react";
import { useLang } from "@/lib/i18n/LangProvider";
import LinkIcon from "@/components/icons/LinkIcon";
import {
  LINK_GROUPS,
  ALL_LINK_PRESETS,
  QUICK_SELECT_PRESETS,
  isNetdiskLink,
  extractNetdiskPassword,
  buildNetdiskUrl,
} from "@/lib/constants/links";

export interface LinkEntry {
  label: string;
  url: string;
}

interface ProjectLinksEditorProps {
  links: LinkEntry[];
  onChange: (links: LinkEntry[]) => void;
  disabled?: boolean;
}

const inputClass =
  "rounded-lg border border-brand-border-subtle bg-brand-surface px-3 py-2 text-sm text-brand-text-heading focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent transition-shadow disabled:opacity-50";

export default function ProjectLinksEditor({
  links,
  onChange,
  disabled = false,
}: ProjectLinksEditorProps) {
  const { t } = useLang();

  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkPwd, setNewLinkPwd] = useState("");
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 按 Escape 关闭下拉菜单
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 判断当前选中的标签或输入 URL 是否属于网盘
  const isCurrentNetdisk = isNetdiskLink(newLinkLabel, newLinkUrl);

  // 选择预设
  function handleSelectPreset(val: string) {
    setNewLinkLabel(val);
    setShowCustomLabel(false);
    setIsDropdownOpen(false);
    // 自动聚焦 URL 输入框，方便直接粘贴
    urlInputRef.current?.focus();
  }

  // 切换到自定义
  function handleSelectCustom() {
    setShowCustomLabel(true);
    setNewLinkLabel("");
    setIsDropdownOpen(false);
  }

  // 处理 URL 输入或粘贴（支持自动识别提取码并切分）
  function handleUrlChange(val: string) {
    const { cleanUrl, password } = extractNetdiskPassword(val);
    if (password && !newLinkPwd) {
      setNewLinkPwd(password);
      setNewLinkUrl(cleanUrl);
    } else {
      setNewLinkUrl(val);
    }
  }

  // 添加链接
  function addLink() {
    const label = newLinkLabel.trim();
    const rawUrl = newLinkUrl.trim();
    if (!label || !rawUrl) return;

    const isNet = isNetdiskLink(label, rawUrl);
    const finalUrl = isNet ? buildNetdiskUrl(rawUrl, newLinkPwd) : rawUrl;

    onChange([...links, { label, url: finalUrl }]);

    // 重置输入状态
    setNewLinkLabel("");
    setNewLinkUrl("");
    setNewLinkPwd("");
    setShowCustomLabel(false);
  }

  // 删除链接
  function removeLink(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  // 获取当前选中预设的本地化显示名称
  function getSelectedDisplayName(): string {
    if (!newLinkLabel) return t("form.selectType");
    const matched = ALL_LINK_PRESETS.find((p) => p.v === newLinkLabel);
    return matched?.k ? t(matched.k) : newLinkLabel;
  }

  return (
    <div className="space-y-3">
      {/* ── 已添加的链接列表 ── */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link, i) => {
            const { cleanUrl, password } = extractNetdiskPassword(link.url);
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 bg-[var(--ui-surface-alt2)] rounded-lg text-sm border border-brand-border-subtle/50"
              >
                <LinkIcon label={link.label} url={cleanUrl} size={16} />
                <span className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-brand-navy text-white">
                  {link.label}
                </span>
                <span className="truncate flex-1 text-brand-blue font-mono text-xs">
                  {cleanUrl}
                </span>
                {password && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-brand-surface border border-brand-border-subtle text-brand-text-secondary flex-shrink-0">
                    提取码: <strong className="font-semibold text-brand-navy">{password}</strong>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  disabled={disabled}
                  className="text-xs flex-shrink-0 hover:text-red-500 text-brand-text-muted transition-colors disabled:opacity-40"
                >
                  {t("profile.edit.remove")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 输入区域 ── */}
      <div className="space-y-2">
        {/* 第一行：类型选择下拉框 + 右侧预设图标快捷填充 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 第一个框：下拉选择器 或 自定义文本输入 */}
          {!showCustomLabel ? (
            <div ref={dropdownRef} className="relative w-44">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={disabled}
                className={`${inputClass} w-full flex items-center justify-between text-left cursor-pointer`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <LinkIcon label={newLinkLabel} size={16} />
                  <span
                    className={`truncate text-sm ${
                      newLinkLabel ? "text-brand-text-heading font-medium" : "text-brand-text-muted"
                    }`}
                  >
                    {getSelectedDisplayName()}
                  </span>
                </div>
                <span
                  className={`text-xs text-brand-text-muted ml-1 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* 下拉菜单 Popover */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-60 max-h-80 overflow-y-auto bg-brand-surface rounded-xl shadow-xl border border-brand-border-subtle p-1.5 z-40 space-y-2">
                  {LINK_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-0.5">
                      <div className="px-2.5 py-1 text-[11px] font-semibold text-brand-text-muted tracking-wider">
                        {t(group.k)}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((preset) => {
                          const isSelected = newLinkLabel === preset.v && !showCustomLabel;
                          return (
                            <button
                              key={preset.v}
                              type="button"
                              onClick={() => handleSelectPreset(preset.v)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                                isSelected
                                  ? "bg-brand-surface-page font-semibold text-[#3388BB]"
                                  : "hover:bg-brand-surface-page text-brand-text-heading"
                              }`}
                            >
                              <LinkIcon label={preset.v} size={16} />
                              <span className="flex-1 truncate">
                                {preset.k ? t(preset.k) : preset.v}
                              </span>
                              {isSelected && <span className="text-xs text-[#3388BB]">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* 分隔线与自定义选项 */}
                  <div className="border-t border-brand-border-subtle pt-1 mt-1">
                    <button
                      type="button"
                      onClick={handleSelectCustom}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-brand-surface-page text-brand-text-heading transition-colors text-left"
                    >
                      <span className="w-4 h-4 flex items-center justify-center text-xs">✏️</span>
                      <span className="flex-1 truncate">{t("form.customEllipsis")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 w-44">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
                placeholder={t("form.linkLabel")}
                className={`${inputClass} w-full`}
                disabled={disabled}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setShowCustomLabel(false);
                  setNewLinkLabel("");
                }}
                disabled={disabled}
                className="text-xs px-2 py-1.5 rounded hover:bg-muted whitespace-nowrap text-brand-blue"
                title={t("form.backToPreset")}
              >
                ✕
              </button>
            </div>
          )}

          {/* 第一个框右侧区域：预设网站图标快速选择填充 */}
          <div className="flex items-center gap-1 bg-[var(--ui-surface-alt2)] px-2 py-1 rounded-lg border border-brand-border-subtle/60 flex-wrap">
            <span className="text-[11px] text-brand-text-muted px-1 hidden md:inline">
              {t("form.link.quickSelect")}:
            </span>
            {QUICK_SELECT_PRESETS.map((p) => {
              const isActive = newLinkLabel === p.v && !showCustomLabel;
              const title = p.k ? t(p.k) : p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => handleSelectPreset(p.v)}
                  disabled={disabled}
                  title={title}
                  aria-label={title}
                  className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                    isActive
                      ? "bg-brand-surface shadow-sm ring-2 ring-[#3388BB] scale-105"
                      : "hover:bg-brand-surface opacity-70 hover:opacity-100"
                  }`}
                >
                  <LinkIcon label={p.v} size={18} />
                </button>
              );
            })}
          </div>
        </div>

        {/* 第二个框：链接 URL 输入 + 网盘密码框（右侧切出适应4字母宽度） + 添加按钮 */}
        <div className="flex items-center gap-2">
          <input
            ref={urlInputRef}
            type="url"
            value={newLinkUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="https://..."
            disabled={disabled}
            className={`${inputClass} flex-1 min-w-[180px]`}
          />

          {/* 对于网盘类链接，切出适应4个字母宽度的选填网盘密码框 */}
          {isCurrentNetdisk && (
            <input
              type="text"
              value={newLinkPwd}
              onChange={(e) => setNewLinkPwd(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder={t("form.link.passwordPlaceholder")}
              title={t("form.link.password")}
              maxLength={10}
              disabled={disabled}
              className={`${inputClass} w-20 text-center font-mono uppercase tracking-wider shrink-0 font-medium`}
            />
          )}

          <button
            type="button"
            onClick={addLink}
            disabled={disabled || !newLinkLabel.trim() || !newLinkUrl.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all bg-brand-green text-white shrink-0 hover:brightness-105"
          >
            {t("profile.edit.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
