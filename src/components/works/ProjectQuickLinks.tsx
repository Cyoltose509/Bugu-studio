"use client";

import { useState } from "react";
import LinkIcon from "@/components/icons/LinkIcon";
import { extractNetdiskPassword } from "@/lib/constants/links";

interface LinkItem {
  label: string;
  url: string;
}

interface ProjectQuickLinksProps {
  links: LinkItem[];
}

export default function ProjectQuickLinks({ links }: ProjectQuickLinksProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!links || links.length === 0) return null;

  return (
    <div className="space-y-2">
      {links.map((link, idx) => {
        const { cleanUrl, password } = extractNetdiskPassword(link.url);
        const isCopied = copiedIndex === idx;

        return (
          <div key={idx} className="relative group">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm px-3.5 py-2.5 rounded-lg transition-all duration-150 hover:shadow-sm hover:bg-brand-border-subtle/40 text-brand-text-heading bg-brand-surface border border-brand-border-subtle/60"
            >
              <LinkIcon label={link.label} url={cleanUrl} size={18} />
              <span className="font-medium truncate">{link.label}</span>
              <span className="ml-auto text-brand-text-muted transition-transform group-hover:translate-x-0.5">
                ↗
              </span>
            </a>

            {/* 网盘密码/提取码 hover 浮层 */}
            {password && (
              <div
                className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs shadow-lg bg-brand-navy text-white z-20 border border-white/10"
              >
                <span className="text-white/80">提取码:</span>
                <span className="font-mono font-semibold tracking-wider text-amber-300">
                  {password}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(password);
                    setCopiedIndex(idx);
                    setTimeout(() => setCopiedIndex(null), 2000);
                  }}
                  className={`ml-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    isCopied
                      ? "bg-emerald-500 text-white"
                      : "bg-white/20 hover:bg-white/30 text-white"
                  }`}
                  title="点击复制提取码"
                >
                  {isCopied ? "已复制" : "复制"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
