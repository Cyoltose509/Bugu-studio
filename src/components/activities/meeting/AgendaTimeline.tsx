"use client";

import { useCallback, useEffect, useState } from "react";
import { AgendaSpeaker, AgendaTypeTag } from "@/components/activities/meeting/AgendaRow";
import BilibiliTvLink from "@/components/activities/meeting/BilibiliTvLink";
import DeleteProposalButton from "@/components/activities/meeting/DeleteProposalButton";
import OwnTalkEditor, { type OwnTalkDraft } from "@/components/activities/meeting/OwnTalkEditor";
import { useLang } from "@/lib/i18n/LangProvider";

export type AgendaTimelineItem = {
  key: string;
  type: "SHARE" | "SHOWCASE";
  typeLabel: string;
  title: string;
  description: string;
  imageUrl: string;
  bvId: string;
  speakers: { name: string; href: string | null; image: string | null; byLabel: string }[];
  /** 传入即可让上传者本人编辑这张卡 */
  ownEdit?: OwnTalkDraft;
  /** 传入则在标题行显示删除按钮（管理员对未入议程申请） */
  deletableProposalId?: string;
};

/**
 * 议程时间轴（交互版）。
 * - 详情与配图默认收起：带图卡片收起时配图保持 50% 宽，hover/键盘聚焦展开
 * - 单击卡片「钉住」展开态，再次单击取消；触屏设备靠它替代 hover
 * - 单击配图打开灯箱单独放大查看
 * 铺开用 grid-template-rows 0fr→1fr 过渡，高度始终自适应内容，不会截断长文。
 */
export default function AgendaTimeline({ items }: { items: AgendaTimelineItem[] }) {
  const { t } = useLang();
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, closeLightbox]);

  function togglePin(key: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onCardClick(e: React.MouseEvent, item: AgendaTimelineItem) {
    const hasBody = !!(item.description || item.imageUrl);
    if (!hasBody) return;
    // 卡片内的链接、按钮、表单和配图各自有自己的交互，不触发钉住
    if ((e.target as HTMLElement).closest("a,button,input,textarea,label,img")) return;
    togglePin(item.key);
  }

  return (
    <>
      <ol className="relative py-1">
        {/* 时间轴轨道：细线贯穿，分享=蓝节点、展示=橙节点（实心圆）。无外框，直接落在页面上 */}
        <span aria-hidden className="absolute bottom-2 left-0 top-2 w-px -translate-x-1/2 rounded bg-brand-border-subtle" />
        {items.map((item) => {
          const isPinned = pinned.has(item.key);
          const hasBody = !!(item.description || item.imageUrl);
          const expandBody = isPinned
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr] group-hover/card:grid-rows-[1fr] group-focus-within/card:grid-rows-[1fr]";
          const expandImage = isPinned
            ? "w-full"
            : "w-1/2 group-hover/card:w-full group-focus-within/card:w-full";
          return (
            <li
              key={item.key}
              onClick={(e) => onCardClick(e, item)}
              className={`group/card relative pb-5 pl-6 last:pb-0 ${hasBody ? "cursor-pointer" : ""}`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-[7px] h-[11px] w-[11px] -translate-x-1/2 rounded-full ring-2 ring-card ${item.type === "SHOWCASE" ? "bg-brand-orange" : "bg-brand-blue"}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <AgendaTypeTag type={item.type} label={item.typeLabel} />
                <p className="min-w-0 flex-1 text-sm font-medium text-brand-navy">{item.title}</p>
                {item.bvId ? <BilibiliTvLink bvId={item.bvId} /> : null}
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {item.speakers.map((speaker, index) => (
                    <AgendaSpeaker
                      key={`${speaker.href || speaker.name}-${index}`}
                      name={speaker.name}
                      href={speaker.href}
                      image={speaker.image}
                      byLabel={speaker.byLabel}
                    />
                  ))}
                  {item.ownEdit ? <OwnTalkEditor talk={item.ownEdit} /> : null}
                  {item.deletableProposalId ? <DeleteProposalButton proposalId={item.deletableProposalId} /> : null}
                </span>
              </div>

              {item.description ? (
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${expandBody}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p className="whitespace-pre-wrap break-words pt-1.5 text-sm leading-6 text-brand-text-secondary">
                      {item.description}
                    </p>
                  </div>
                </div>
              ) : null}

              {item.imageUrl ? (
                <div
                  className={`mt-2 overflow-hidden rounded-lg transition-[width] duration-300 ease-out ${expandImage}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={t("agenda.viewImage")}
                    loading="lazy"
                    data-lightbox
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox(item.imageUrl);
                    }}
                    className="block w-full cursor-zoom-in"
                    draggable={false}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("agenda.viewImage")}
          onClick={closeLightbox}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 sm:p-8"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-full rounded-lg object-contain shadow-2xl"
            draggable={false}
          />
          <button
            type="button"
            onClick={closeLightbox}
            aria-label={t("common.cancel")}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/30"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
