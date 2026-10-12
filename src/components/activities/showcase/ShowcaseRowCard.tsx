import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import { TagChip } from "@/components/tags/TagChip";
import { toPlainCardText } from "@/lib/rich-content";
import { sortProjectTagsEngineFirst } from "@/lib/tags/engine-tags";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import type { DictKey } from "@/lib/i18n/dict";

/**
 * 试玩目录的长条卡片（Steam 商店式：左图右文，一行一个）
 *
 * 原来的网格卡片在手机上占满一屏，扫目录要滚很久；
 * 改成横条后一屏能看 3~4 款，标题和简介横向铺开也更好读。
 */

/** 类型值 → 词典键（与作品库筛选、作品卡片共用同一套 work.status.*） */
const TYPE_LABELS: Record<string, DictKey> = {
  IN_DEVELOPMENT: "work.status.IN_DEVELOPMENT",
  TRIAL_DEMO: "work.status.TRIAL_DEMO",
  MINI_GAME: "work.status.MINI_GAME",
  OFFICIAL_RELEASE: "work.status.OFFICIAL_RELEASE",
};

interface RowProject {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  type: string;
  developYear: number | null;
  tags?: { tag: { slug: string; name: string; color?: string | null; group?: string | null; sortOrder?: number } }[];
}

export default function ShowcaseRowCard({
  project,
  index,
  lang,
}: {
  project: RowProject;
  index: number;
  lang: Lang;
}) {
  const excerpt = toPlainCardText(project.description);
  const tags = sortProjectTagsEngineFirst(project.tags ?? []);

  return (
    <Link
      href={`/works/${project.slug}`}
      aria-label={t(lang, "showcase.cardAria", { n: index + 1, title: project.title })}
      className="group grid grid-cols-1 sm:grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-xl border border-brand-border-subtle bg-card shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:border-brand-blue/50 hover:shadow-md"
    >
      {/* 左：封面 */}
      <div className="relative aspect-[16/9] overflow-hidden bg-brand-surface sm:aspect-auto sm:h-full">
        {project.coverImage ? (
          <SafeImage
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full min-h-[140px] w-full items-center justify-center bg-brand-surface text-3xl opacity-40">
            🎮
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {TYPE_LABELS[project.type] ? t(lang, TYPE_LABELS[project.type]) : project.type}
        </span>
      </div>

      {/* 右：文字区 */}
      <div className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs font-bold tracking-widest text-brand-blue">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="min-w-0 truncate text-lg font-bold text-brand-text-heading group-hover:text-brand-blue">
            {project.title}
            {project.subtitle && (
              <span className="ml-2 text-xs font-normal text-brand-text-muted">{project.subtitle}</span>
            )}
          </h3>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-brand-text-secondary">
          {excerpt || t(lang, "showcase.noDesc")}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map(({ tag }) => (
            <TagChip key={tag.slug} tag={tag} />
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="rounded-full bg-brand-orange/10 px-2 py-1 text-xs text-brand-orange">{t(lang, "showcase.playable")}</span>
          {project.developYear && (
            <span className="text-xs text-brand-text-muted">{project.developYear}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
