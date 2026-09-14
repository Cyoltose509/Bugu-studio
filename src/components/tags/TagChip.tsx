"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import EngineTagIcon from "./EngineTagIcon";
import {
  getEngineChipClass,
  getEngineColor,
  isEngineTagSlug,
} from "@/lib/tags/engine-tags";

type TagLike = {
  slug: string;
  name: string;
  color?: string | null;
  group?: string | null;
};

function resolveColor(tag: TagLike): string {
  return getEngineColor(tag.slug) || tag.color || "#88C232";
}

function chipStyle(tag: TagLike, active?: boolean): CSSProperties | undefined {
  // 引擎用 CSS class 自适应暗色；非引擎保持原 inline 色
  if (isEngineTagSlug(tag.slug)) {
    return active
      ? { boxShadow: `inset 0 0 0 1px currentColor` }
      : undefined;
  }
  const color = resolveColor(tag);
  return {
    backgroundColor: `${color}18`,
    color,
    boxShadow: active ? `inset 0 0 0 1px ${color}` : undefined,
  };
}

/** 纯展示胶囊（卡片内） */
export function TagChip({
  tag,
  className = "",
}: {
  tag: TagLike;
  className?: string;
}) {
  const engine = isEngineTagSlug(tag.slug);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded whitespace-nowrap font-medium ${
        engine ? getEngineChipClass(tag.slug) : ""
      } ${className}`}
      style={chipStyle(tag)}
    >
      {engine && <EngineTagIcon slug={tag.slug} />}
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** 可点筛选 / 详情跳转 */
export function TagChipLink({
  tag,
  href,
  active = false,
  className = "",
  onClick,
}: {
  tag: TagLike;
  href: string;
  active?: boolean;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const engine = isEngineTagSlug(tag.slug);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 transition-opacity hover:opacity-90 ${
        engine ? `font-medium rounded-full ${getEngineChipClass(tag.slug)}` : "rounded"
      } ${active ? "ring-1 ring-offset-1" : "opacity-80 hover:opacity-100"} ${className}`}
      style={chipStyle(tag, active)}
    >
      {engine && <EngineTagIcon slug={tag.slug} />}
      <span className="truncate">{tag.name}</span>
    </Link>
  );
}
