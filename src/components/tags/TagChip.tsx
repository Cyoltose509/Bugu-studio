"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import EngineTagIcon from "./EngineTagIcon";
import EventTagIcon from "./EventTagIcon";
import {
  getEngineChipClass,
  getEngineColor,
  isEngineTagSlug,
} from "@/lib/tags/engine-tags";
import {
  getEventChipClass,
  getEventColor,
  isEventTagSlug,
} from "@/lib/tags/event-tags";
import { useLang } from "@/lib/i18n/LangProvider";
import { tagDisplayName } from "@/lib/tags/tag-names";

type TagLike = {
  slug: string;
  name: string;
  color?: string | null;
  group?: string | null;
};

function resolveColor(tag: TagLike): string {
  return getEngineColor(tag.slug) || getEventColor(tag.slug) || tag.color || "#88C232";
}

function usesChipClass(slug: string): boolean {
  return isEngineTagSlug(slug) || isEventTagSlug(slug);
}

function brandChipClass(slug: string): string {
  return getEngineChipClass(slug) || getEventChipClass(slug);
}

function chipStyle(tag: TagLike, active?: boolean): CSSProperties | undefined {
  // 引擎 / 活动&赛事用 CSS class 自适应暗色；其余保持 inline 色
  if (usesChipClass(tag.slug)) {
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

function TagMark({ slug }: { slug: string }) {
  if (isEngineTagSlug(slug)) return <EngineTagIcon slug={slug} />;
  if (isEventTagSlug(slug)) return <EventTagIcon slug={slug} />;
  return null;
}

/** 纯展示胶囊（卡片内） */
export function TagChip({
  tag,
  className = "",
}: {
  tag: TagLike;
  className?: string;
}) {
  const branded = usesChipClass(tag.slug);
  const { lang } = useLang();
  const displayName = tagDisplayName(tag.slug, tag.name, lang);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded whitespace-nowrap font-medium ${
        branded ? brandChipClass(tag.slug) : ""
      } ${className}`}
      style={chipStyle(tag)}
    >
      <TagMark slug={tag.slug} />
      <span className="truncate">{displayName}</span>
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
  const branded = usesChipClass(tag.slug);
  const { lang } = useLang();
  const displayName = tagDisplayName(tag.slug, tag.name, lang);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 transition-opacity hover:opacity-90 ${
        branded ? `font-medium rounded-full ${brandChipClass(tag.slug)}` : "rounded"
      } ${active ? "ring-1 ring-offset-1" : "opacity-80 hover:opacity-100"} ${className}`}
      style={chipStyle(tag, active)}
    >
      <TagMark slug={tag.slug} />
      <span className="truncate">{displayName}</span>
    </Link>
  );
}

/** Editor selection uses the same brand chip surface, with its border drawn inside the pill. */
export function TagChipButton({ tag, active, onClick }: { tag: TagLike; active: boolean; onClick: () => void }) {
  const { lang } = useLang();
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${usesChipClass(tag.slug) ? brandChipClass(tag.slug) : ""} ${active ? "opacity-100" : "opacity-75 hover:opacity-100"}`}
    style={chipStyle(tag, active)}><TagMark slug={tag.slug} /><span>{tagDisplayName(tag.slug, tag.name, lang)}</span></button>;
}
