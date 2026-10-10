import Link from "next/link";
import { RichContent } from "@/components/ui/RichContent";
import ProjectCard from "@/components/projects/ProjectCard";
import PosterGallery from "./PosterGallery";
import { getShowcaseProjects } from "@/lib/activities/showcase-data";
import { BAITUAN_SLUG, type ActivityShowcase } from "@/lib/activities/showcase";

interface Props {
  activity: { id: string; slug: string; title: string; summary: string | null; description: string | null;
    startTime: Date; endTime: Date; location: string | null; status: string };
  config: ActivityShowcase;
  isAdmin: boolean;
}

export default async function ActivityShowcasePage({ activity, config, isAdmin }: Props) {
  const projects = await getShowcaseProjects(config.projectIds);
  const start = new Date(activity.startTime);
  const end = new Date(activity.endTime);
  const now = new Date();
  const status = now < start ? "即将见面" : now <= end ? "正在进行" : "活动已结束";
  const date = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(start);
  const time = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const isBaituan = activity.slug === BAITUAN_SLUG;

  return <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-sm">
      <Link href="/activities" className="text-brand-text-secondary hover:text-brand-blue">← 全部活动</Link>
      {isAdmin && <Link href={`/admin/activities/${activity.id}/edit`} className="text-brand-blue underline">管理海报与试玩目录</Link>}
    </div>
    {activity.status === "DRAFT" && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">管理员预览 · 此活动为草稿，发布后访客即可查看。</p>}

    <section className="relative overflow-hidden rounded-[2rem] border border-brand-border-subtle bg-card p-6 sm:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-blue/10 blur-3xl" />
      <div className="relative grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div>
          <p className="mb-6 text-xs font-bold tracking-[0.18em] text-brand-blue">BUGOO STUDIO / {isBaituan ? "2026 CAMPUS RECRUITMENT" : "PLAY TOGETHER"}</p>
          <div className="mb-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-brand-blue">{status}</span>
            <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-brand-orange">原创游戏 · 现场试玩</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight text-brand-text-heading">{activity.title}</h1>
          <p className="my-6 text-base sm:text-lg leading-relaxed text-brand-text-body">{activity.summary || "来体验我们的原创游戏，与创作者面对面交流。"}</p>
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-brand-surface p-5">
            <div><p className="mb-1 text-xs text-brand-text-muted">活动日期</p><p className="text-lg font-bold text-brand-text-heading">{date}</p></div>
            <div><p className="mb-1 text-xs text-brand-text-muted">试玩时间</p><p className="text-lg font-bold text-brand-text-heading">{time(start)}–{time(end)}</p></div>
            <div className="col-span-2 border-t border-brand-border-subtle pt-3"><p className="mb-1 text-xs text-brand-text-muted">到这里找我们</p><p className="font-bold text-brand-blue">{activity.location || "地点待公布"}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#playable-games" className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">看看试玩游戏 ↓</a>
            <Link href="/join" className="btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">了解如何加入 ↗</Link>
          </div>
          <p className="mt-5 text-sm text-brand-text-muted">{isBaituan ? "欢迎来 B20 坐坐，下一位游戏创作者也许就是你。" : "从玩游戏开始，认识一起创作的伙伴。"}</p>
        </div>
        <PosterGallery posters={config.posters.slice(0, 1)} featured />
      </div>
    </section>

    <section id="playable-games" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold tracking-[0.16em] text-brand-orange">MADE BY US. PLAYED BY YOU.</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-text-heading">当天可以玩什么？</h2>
          <p className="mt-3 text-sm text-brand-text-secondary">{projects.length} 款社团原创作品 · 点击卡片了解玩法、作者与作品详情</p>
        </div>
        <Link href="/works" className="text-sm text-brand-blue hover:underline">逛逛全部作品 ↗</Link>
      </div>
      {projects.length ? <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{projects.map((project, idx) =>
        <article key={project.id} aria-label={`试玩作品 ${idx + 1}：${project.title}`} className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-mono font-bold tracking-widest text-brand-blue">{String(idx + 1).padStart(2, "0")} / PLAY</span>
            <span className="rounded-full bg-brand-orange/10 px-2 py-1 text-brand-orange">现场试玩</span>
          </div>
          <div className="flex-1"><ProjectCard project={project} idx={idx} /></div>
        </article>
      )}</div> : <p className="rounded-2xl border border-dashed border-brand-border-subtle p-8 text-center text-brand-text-secondary">试玩目录正在准备，欢迎到现场看看。</p>}
    </section>

    {config.posters.length > 1 && <section className="border-t border-brand-border-subtle py-10">
      <h2 className="mb-3 text-2xl font-bold text-brand-text-heading">关于我们，还有这些</h2>
      <p className="mb-6 text-sm text-brand-text-secondary">认识社团与新手村 Project。往期海报中的日期仅作历史介绍，本次活动以页面上方信息为准。</p>
      <PosterGallery posters={config.posters.slice(1)} />
    </section>}
    {activity.description && <section className="rounded-2xl border border-brand-border-subtle bg-card p-6 text-brand-text-body"><RichContent text={activity.description} /></section>}
    <div className="mt-8 rounded-2xl bg-brand-blue/10 px-6 py-8 sm:px-10 flex flex-wrap items-center justify-between gap-5">
      <div><h2 className="text-xl font-bold text-brand-text-heading">一起享受创作本身的快乐。</h2><p className="mt-2 text-sm text-brand-text-secondary">程序、策划、美术、音乐、文案……从兴趣出发，一起做游戏。</p></div>
      <Link href="/join" className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">加入布谷工作室 ↗</Link>
    </div>
  </div>;
}
