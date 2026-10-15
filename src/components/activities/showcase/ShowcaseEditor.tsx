"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveActivityShowcase } from "@/app/admin/activities/showcase-actions";
import type { ActivityShowcase } from "@/lib/activities/showcase";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { uploadImage, ACCEPT_ATTR, formatMB } from "@/lib/utils/clientUpload";

type ProjectOption = { id: string; title: string; slug: string };
const buttonClass = "rounded-lg border border-brand-border-subtle px-3 py-1.5 text-sm disabled:opacity-40";

export default function ShowcaseEditor({ activityId, initial, projects }: {
  activityId: string; initial: ActivityShowcase | null; projects: ProjectOption[];
}) {
  const [config, setConfig] = useState<ActivityShowcase>(initial || { enabled: false, projectIds: [], posters: [] });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const disabled = uploading || pending;
  const markChanged = () => { setMessage(""); setError(""); };
  const available = projects.filter(p => !config.projectIds.includes(p.id) && p.title.toLowerCase().includes(query.toLowerCase()));

  function move(kind: "projectIds" | "posters", index: number, delta: number) {
    markChanged();
    setConfig(c => {
      const items = [...c[kind]];
      [items[index], items[index + delta]] = [items[index + delta], items[index]];
      return { ...c, [kind]: items };
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    markChanged();
    setUploading(true);
    try {
      // 原图在限额内直传，超了才压缩；太大/格式不对会给中文提示
      const result = await uploadImage(file, { endpoint: "/api/upload/cover", type: "cover" });
      setConfig(c => ({
        ...c,
        posters: [...c.posters, { title: file.name.replace(/\.[^.]+$/, ""), url: result.url }],
      }));
      if (result.compressed) {
        setMessage(`海报已压缩：${formatMB(result.originalSize)}MB → ${formatMB(result.uploadedSize)}MB`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败，请重试");
      setMessage("");
    } finally { setUploading(false); }
  }

  return <section className="rounded-xl border border-brand-border-subtle bg-card p-6 shadow-sm space-y-5 text-brand-text-body">
    <div><h2 className="text-lg font-bold text-brand-text-heading">海报与试玩目录</h2>
      <p className="mt-2 text-sm text-brand-text-secondary">
        可复用模块：启用后详情页展示海报专页，并用试玩目录（长条作品卡 + 全屏放映 + 跳转作品页）。
        内容独立保存；作品信息自动同步站内最新数据。
      </p></div>
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={config.enabled}
        onChange={e => { markChanged(); setConfig(c => ({ ...c, enabled: e.target.checked })); }} />启用海报与试玩专页</label>

      <div className="space-y-3">
        <h3 className="font-semibold">试玩作品（{config.projectIds.length}/50）</h3>
        <ol className="space-y-2">{config.projectIds.map((id, index) => {
          const project = projects.find(p => p.id === id);
          const title = project?.title || "已下架或已删除的作品";
          return <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-surface p-3">
            <span className="mr-auto text-sm">{index + 1}. {title}</span>
            {project && <a href={`/works/${project.slug}`} target="_blank" rel="noreferrer" className="text-xs text-brand-blue underline">查看</a>}
            <button type="button" className={buttonClass} disabled={index === 0} aria-label={`上移作品：${title}`} onClick={() => move("projectIds", index, -1)}>↑</button>
            <button type="button" className={buttonClass} disabled={index === config.projectIds.length - 1} aria-label={`下移作品：${title}`} onClick={() => move("projectIds", index, 1)}>↓</button>
            <button type="button" className={buttonClass} aria-label={`移除作品：${title}`} onClick={() => {
              markChanged(); setConfig(c => ({ ...c, projectIds: c.projectIds.filter(p => p !== id) }));
            }}>移除</button>
          </li>;
        })}</ol>
        <label className="block text-sm">搜索已发布作品
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="输入作品名"
            className="mt-2 w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2" />
        </label>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-brand-border-subtle p-2">
          {available.map(p => <button type="button" key={p.id} disabled={config.projectIds.length >= 50}
            className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-surface disabled:opacity-40"
            onClick={() => { markChanged(); setConfig(c => ({ ...c, projectIds: [...c.projectIds, p.id] })); }}>
            <span>{p.title}</span><span className="text-brand-blue">＋ 添加</span>
          </button>)}
          {!available.length && <p className="p-3 text-sm text-brand-text-muted">没有可添加的作品</p>}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">活动海报（{config.posters.length}/10）</h3>
        <p className="text-xs text-brand-text-muted">第一张显示在页面首屏，其余显示在介绍区。图片保留完整比例。上传后请点击保存。</p>
        {config.posters.map((poster, index) => <div key={`${poster.url}-${index}`} className="flex gap-3 rounded-lg bg-brand-surface p-3">
          <img src={poster.url} alt={poster.title} className="h-24 w-16 shrink-0 rounded object-contain" />
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block text-xs">海报 {index + 1} 标题<input value={poster.title} maxLength={80}
              className="mt-1 w-full rounded border border-brand-border-subtle bg-card px-2 py-1.5 text-sm"
              onChange={e => { markChanged(); setConfig(c => ({ ...c, posters: c.posters.map((p, i) => i === index ? { ...p, title: e.target.value } : p) })); }} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={index === 0} aria-label={`上移海报：${poster.title}`} onClick={() => move("posters", index, -1)}>↑</button>
              <button type="button" className={buttonClass} disabled={index === config.posters.length - 1} aria-label={`下移海报：${poster.title}`} onClick={() => move("posters", index, 1)}>↓</button>
              <button type="button" className={buttonClass} aria-label={`移除海报：${poster.title}`} onClick={() => {
                markChanged(); setConfig(c => ({ ...c, posters: c.posters.filter((_, i) => i !== index) }));
              }}>移除</button>
            </div>
          </div>
        </div>)}
        <ImageDropZone className="rounded-xl p-1" hint="松开以添加海报"
          disabled={disabled || config.posters.length >= 10}
          onFile={file => upload(file)}
          onInvalid={msg => { markChanged(); setError(msg); }}>
          <label className="block text-sm">添加海报（可直接拖图片到此处）<input type="file" accept={ACCEPT_ATTR} disabled={disabled || config.posters.length >= 10}
            className="mt-2 block w-full text-sm" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </ImageDropZone>
      </div>
    </fieldset>
    {uploading && <p role="status" className="text-sm text-brand-blue">海报上传中…</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" disabled={disabled} className="btn-primary rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        onClick={() => startTransition(async () => {
          markChanged();
          try {
            const result = await saveActivityShowcase(activityId, config);
            if (result.error) setError(result.error);
            else { setMessage("海报与试玩目录已保存"); router.refresh(); }
          } catch { setError("保存失败，请稍后重试"); }
        })}>{pending ? "保存中…" : "保存海报与试玩目录"}</button>
      <a href={`/activities/${activityId}`} target="_blank" rel="noreferrer" className="text-sm text-brand-blue underline">预览活动页 ↗</a>
    </div>
  </section>;
}
