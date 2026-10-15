import { notFound } from "next/navigation";
import ShareButton from "@/components/share/ShareButton";
import { activityShareData } from "@/lib/share";
import { BAITUAN_POSTERS } from "@/lib/activities/showcase";
import { productionMeeting, productionRecruitment } from "./production-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "分享设计预览", robots: { index: false, follow: false } };

export default function SharePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const previewDate = new Date("2026-10-15T08:00:00.000Z");
  const meeting = activityShareData(productionMeeting, "cn", previewDate);
  const recruitment = activityShareData({ ...productionRecruitment, relatedImages: BAITUAN_POSTERS }, "cn", previewDate);
  return <div className="mx-auto max-w-3xl px-5 py-12">
    <p className="text-xs tracking-widest text-brand-orange">DESIGN PREVIEW</p>
    <h1 className="mt-3 text-3xl font-bold text-brand-navy">分享卡片预览</h1>
    <p className="mt-4 text-sm leading-relaxed text-brand-text-secondary">使用官网公开活动数据预览，仅本地开发环境可见。</p>
    <div className="mt-8 rounded-2xl border border-brand-border-subtle bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-brand-navy">10 月 18 日例会</h2><p className="mt-2 text-sm text-brand-text-secondary">官网已有主讲人和分享内容，且开放报名分享</p></div><ShareButton data={meeting} label="预览活动卡片" /></div>
    </div>
    <div className="mt-4 rounded-2xl border border-brand-border-subtle bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-brand-navy">百团大战 · 活动分享</h2><p className="mt-2 text-sm text-brand-text-secondary">可切换本次活动的三张海报或品牌色卡头</p></div><ShareButton data={recruitment} label="预览活动卡片" /></div>
    </div>
    <div className="mt-6 flex flex-wrap gap-4 text-sm text-brand-blue"><a href={`https://www.bugoostudio.com/activities/${productionMeeting.id}`} target="_blank" rel="noopener noreferrer">官网例会页面 ↗</a><a href="/members/cmq6ek1ml000n14orru5vmfyg">实际成员主页 ↗</a></div>
  </div>;
}
