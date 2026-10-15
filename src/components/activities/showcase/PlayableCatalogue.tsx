import Link from "next/link";
import ShowcaseRowCard from "./ShowcaseRowCard";
import GameSlideshow from "./GameSlideshow";
import { toPlainCardText } from "@/lib/rich-content";
import { sortTagsEngineFirst } from "@/lib/tags/engine-tags";
import type { ShowcaseSlideshowProject } from "@/lib/activities/slideshow";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";

/** 试玩目录条目（站内作品快照） */
export type PlayableProject = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  type: string;
  developYear: number | null;
  tags?: {
    tag: {
      slug: string;
      name: string;
      color?: string | null;
      group?: string | null;
      sortOrder?: number;
    };
  }[];
  images?: { url: string; altText?: string | null }[];
};

type Props = {
  projects: PlayableProject[];
  lang: Lang;
  /** 锚点 id，默认 playable-games */
  sectionId?: string;
  /** 是否显示全屏放映入口 */
  showSlideshow?: boolean;
  /** 是否显示「浏览全部作品」链接 */
  showBrowseAll?: boolean;
  className?: string;
};

/**
 * 可复用的活动试玩目录：长条作品卡 + 可选全屏放映 / 跳转作品库。
 * 创建「普通活动」并在后台启用海报与试玩专页后使用。
 */
export default function PlayableCatalogue({
  projects,
  lang,
  sectionId = "playable-games",
  showSlideshow = true,
  showBrowseAll = true,
  className = "",
}: Props) {
  const slideshowProjects: ShowcaseSlideshowProject[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    description: toPlainCardText(project.description),
    coverImage: project.coverImage,
    images: project.images || [],
    tags: sortTagsEngineFirst<{ name: string; slug: string; sortOrder?: number }>(
      (project.tags || []).map((item) => item.tag),
    ).map((tag) => ({ slug: tag.slug, name: tag.name })),
  }));

  return (
    <section id={sectionId} className={`scroll-mt-24 py-12 sm:py-16 ${className}`.trim()}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.16em] text-brand-orange">
            MADE BY US. PLAYED BY YOU.
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-text-heading">
            {t(lang, "showcase.sectionTitle")}
          </h2>
          <p className="mt-3 text-sm text-brand-text-secondary">
            {t(lang, "showcase.sectionDesc", { n: projects.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {showSlideshow && projects.length > 0 && (
            <GameSlideshow projects={slideshowProjects} />
          )}
          {showBrowseAll && (
            <Link href="/works" className="text-sm text-brand-blue hover:underline">
              {t(lang, "showcase.browseAll")}
            </Link>
          )}
        </div>
      </div>

      {projects.length ? (
        <div className="flex flex-col gap-3">
          {projects.map((project, idx) => (
            <ShowcaseRowCard key={project.id} project={project} index={idx} lang={lang} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-brand-border-subtle p-8 text-center text-brand-text-secondary">
          {t(lang, "showcase.emptyCatalogue")}
        </p>
      )}
    </section>
  );
}
