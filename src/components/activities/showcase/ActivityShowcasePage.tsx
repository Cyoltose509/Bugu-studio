import Link from "next/link";
import Image from "next/image";
import { RichContent } from "@/components/ui/RichContent";
import PosterGallery from "./PosterGallery";
import ShowcaseRowCard from "./ShowcaseRowCard";
import { getShowcaseProjects } from "@/lib/activities/showcase-data";
import { BAITUAN_SLUG, type ActivityShowcase } from "@/lib/activities/showcase";
import GameSlideshow from "./GameSlideshow";
import { toPlainCardText } from "@/lib/rich-content";
import { sortTagsEngineFirst } from "@/lib/tags/engine-tags";
import type { ShowcaseSlideshowProject } from "@/lib/activities/slideshow";
import { t } from "@/lib/i18n/dict";
import { getLang } from "@/lib/i18n/getLang";
import type { Lang } from "@/lib/i18n/config";

interface Props {
  activity: { id: string; slug: string; title: string; summary: string | null; description: string | null;
    startTime: Date; endTime: Date; location: string | null; status: string; coverImage?: string | null };
  config: ActivityShowcase;
  isAdmin: boolean;
}

export default async function ActivityShowcasePage({ activity, config, isAdmin }: Props) {
  const lang: Lang = await getLang();
  const projects = await getShowcaseProjects(config.projectIds);
  const start = new Date(activity.startTime);
  const end = new Date(activity.endTime);
  const now = new Date();
  const status = now < start
    ? t(lang, "showcase.status.upcoming")
    : now <= end
      ? t(lang, "showcase.status.ongoing")
      : t(lang, "showcase.status.ended");
  // 日期文案随语言走；时段统一 24 小时制
  const dateLocale = lang === "en" ? "en-US" : "zh-CN";
  const date = new Intl.DateTimeFormat(dateLocale, { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(start);
  const time = (d: Date) => new Intl.DateTimeFormat(dateLocale, { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const isBaituan = activity.slug === BAITUAN_SLUG;
  const slideshowProjects: ShowcaseSlideshowProject[] = projects.map(project => ({
    id: project.id, slug: project.slug, title: project.title,
    description: toPlainCardText(project.description), coverImage: project.coverImage,
    images: project.images || [],
    tags: sortTagsEngineFirst<{ name: string; slug: string; sortOrder?: number }>((project.tags || []).map((item: { tag: { name: string; slug: string; sortOrder?: number } }) => item.tag))
      .map(tag => ({ slug: tag.slug, name: tag.name })),
  }));

  return <div className="bg-[#f6f7f8] dark:bg-[#141a22]">
  <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-sm">
      <Link href="/activities" className="text-brand-text-secondary hover:text-brand-blue">{t(lang, "showcase.allActivities")}</Link>
      {isAdmin && <Link href={`/admin/activities/${activity.id}/edit`} className="text-brand-blue underline">{t(lang, "showcase.manage")}</Link>}
    </div>
    {activity.status === "DRAFT" && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t(lang, "showcase.draftNotice")}</p>}

    {/* ── 封面（后台「封面」字段；特供页此前完全没渲染它）── */}
    {activity.coverImage ? (
      <div className="mb-6 overflow-hidden rounded-2xl border border-brand-border-subtle bg-card">
        <div className="relative aspect-[21/9]">
          <Image
            src={activity.coverImage}
            alt={t(lang, "showcase.coverAlt", { title: activity.title })}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1152px"
            priority
          />
        </div>
      </div>
    ) : null}

    <section className="relative overflow-hidden rounded-[2rem] border border-brand-border-subtle bg-card p-6 sm:p-10">
      <div className="relative grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div>
          <p className="mb-6 text-xs font-bold tracking-[0.18em] text-brand-blue">BUGOO STUDIO / {isBaituan ? "2026 CAMPUS RECRUITMENT" : "PLAY TOGETHER"}</p>
          <div className="mb-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-brand-blue">{status}</span>
            <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-brand-orange">{t(lang, "showcase.badgeOriginal")}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight text-brand-text-heading">{activity.title}</h1>
          <p className="my-6 text-base sm:text-lg leading-relaxed text-brand-text-body">{activity.summary || t(lang, "showcase.summaryFallback")}</p>
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-brand-surface p-5">
            <div><p className="mb-1 text-xs text-brand-text-muted">{t(lang, "showcase.dateLabel")}</p><p className="text-lg font-bold text-brand-text-heading">{date}</p></div>
            <div><p className="mb-1 text-xs text-brand-text-muted">{t(lang, "showcase.playtimeLabel")}</p><p className="text-lg font-bold text-brand-text-heading">{time(start)}–{time(end)}</p></div>
            <div className="col-span-2 border-t border-brand-border-subtle pt-3"><p className="mb-1 text-xs text-brand-text-muted">{t(lang, "showcase.locationLabel")}</p><p className="font-bold text-brand-blue">{activity.location || t(lang, "showcase.locationTbd")}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#playable-games" className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">{t(lang, "showcase.seeGames")}</a>
            <Link href="/join" className="btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">{t(lang, "showcase.howToJoin")}</Link>
          </div>
          <p className="mt-5 text-sm text-brand-text-muted">{t(lang, "showcase.heroFootnote")}</p>
        </div>
        <PosterGallery posters={config.posters.slice(0, 1)} featured />
      </div>
    </section>

    <section id="playable-games" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold tracking-[0.16em] text-brand-orange">MADE BY US. PLAYED BY YOU.</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-text-heading">{t(lang, "showcase.sectionTitle")}</h2>
          <p className="mt-3 text-sm text-brand-text-secondary">{t(lang, "showcase.sectionDesc", { n: projects.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <GameSlideshow projects={slideshowProjects} />
          <Link href="/works" className="text-sm text-brand-blue hover:underline">{t(lang, "showcase.browseAll")}</Link>
        </div>
      </div>
      {projects.length ? <div className="flex flex-col gap-3">{projects.map((project, idx) =>
        <ShowcaseRowCard key={project.id} project={project} index={idx} lang={lang} />
      )}</div> : <p className="rounded-2xl border border-dashed border-brand-border-subtle p-8 text-center text-brand-text-secondary">{t(lang, "showcase.emptyCatalogue")}</p>}
    </section>

    {config.posters.length > 1 && <section className="border-t border-brand-border-subtle py-10">
      <h2 className="mb-6 text-2xl font-bold text-brand-text-heading">{t(lang, "showcase.morePosters")}</h2>
      <PosterGallery posters={config.posters.slice(1)} />
    </section>}
    {activity.description && <section className="rounded-2xl border border-brand-border-subtle bg-card p-6 text-brand-text-body"><RichContent text={activity.description} /></section>}
    <div className="mt-8 rounded-2xl bg-brand-blue/10 px-6 py-8 sm:px-10 flex flex-wrap items-center justify-between gap-5">
      <div><h2 className="text-xl font-bold text-brand-text-heading">{t(lang, "showcase.footerTitle")}</h2><p className="mt-2 text-sm text-brand-text-secondary">{t(lang, "showcase.footerDesc")}</p></div>
      <Link href="/join" className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">{t(lang, "showcase.joinStudio")}</Link>
    </div>
  </div></div>;
}
