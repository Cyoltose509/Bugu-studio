"use client";

import CdnImage from "@/components/ui/CdnImage";
import { useEffect, useRef, useState } from "react";
import type { ActivityShowcase } from "@/lib/activities/showcase";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { uploadImage, ACCEPT_ATTR, formatMB } from "@/lib/utils/clientUpload";
import PlusIcon from "@/components/ui/PlusIcon";

type ProjectOption = { id: string; title: string; slug: string };
const moveButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border-subtle bg-card text-brand-text-secondary transition-colors hover:border-brand-blue/50 hover:bg-brand-blue/5 hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-40";
const removeButtonClass = "rounded-lg border border-red-200 bg-card px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40";

export default function ShowcaseEditor({ activityId, initial, projects }: {
  activityId: string; initial: ActivityShowcase | null; projects: ProjectOption[];
}) {
  const [config, setConfig] = useState<ActivityShowcase>(initial || { enabled: false, projectIds: [], posters: [] });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<"poster" | "project" | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
  const markChanged = () => { setMessage(""); setError(""); };
  const available = projects.filter(p => !config.projectIds.includes(p.id) && p.title.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!addMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (adding) addPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [adding]);

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
      setAdding(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败，请重试");
      setMessage("");
    } finally { setUploading(false); }
  }

  return <section className="space-y-5 rounded-xl border border-brand-border-subtle bg-card p-5 text-brand-text-body shadow-sm sm:p-6">
    <input type="hidden" name="showcaseJson" value={JSON.stringify(config)} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-brand-text-heading">海报与试玩目录</h2>
        <p className="mt-1 text-sm text-brand-text-secondary">活动海报 {config.posters.length} 张 · 试玩作品 {config.projectIds.length} 个</p>
      </div>
      <div ref={addMenuRef} className="relative flex shrink-0 items-center gap-2">
        <button type="button" title="新增内容" aria-label="新增海报或试玩作品" aria-expanded={addMenuOpen} aria-haspopup="menu"
          disabled={uploading} onClick={() => setAddMenuOpen(open => !open)}
          className={`btn-primary brand-add-control brand-add-control--compact focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2 ${addMenuOpen || adding ? "ring-2 ring-brand-orange/40 ring-offset-2" : ""}`}>
          <PlusIcon size={21} />
        </button>
        <button type="button" title={editing ? "完成编辑" : "编辑海报与试玩目录"} aria-label={editing ? "完成编辑" : "编辑海报与试玩目录"} aria-pressed={editing}
          disabled={uploading} onClick={() => { setEditing(value => !value); setAdding(null); setAddMenuOpen(false); }}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 ${editing ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue" : "border-brand-border-subtle bg-card text-brand-text-secondary hover:border-brand-blue/40 hover:text-brand-blue"}`}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
        </button>
        {addMenuOpen && <div role="menu" aria-label="新增内容" className="absolute right-0 top-full z-40 mt-2 w-44 rounded-xl border border-brand-border-subtle bg-card p-1.5 shadow-xl">
          <button type="button" role="menuitem" aria-label="＋ 添加海报" disabled={config.posters.length >= 10}
            onClick={() => { setAdding("poster"); setAddMenuOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-text-heading transition-colors hover:bg-brand-blue/10 disabled:opacity-40"><PlusIcon size={15} className="text-brand-blue" />添加海报</button>
          <button type="button" role="menuitem" aria-label="＋ 添加试玩作品" disabled={config.projectIds.length >= 50}
            onClick={() => { setQuery(""); setAdding("project"); setAddMenuOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-text-heading transition-colors hover:bg-brand-blue/10 disabled:opacity-40"><PlusIcon size={15} className="text-brand-blue" />添加试玩作品</button>
        </div>}
      </div>
    </div>

    <fieldset disabled={uploading} className="space-y-5 disabled:opacity-60">
      {editing ? <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-brand-border-subtle bg-brand-surface-page px-4 py-3 text-sm transition-colors hover:border-brand-blue/40">
        <span className="font-medium text-brand-text-heading">启用海报与试玩专页</span>
        <input type="checkbox" checked={config.enabled} className="peer sr-only"
          onChange={e => { markChanged(); setConfig(c => ({ ...c, enabled: e.target.checked })); }} />
        <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-brand-border-subtle transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-card after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-brand-blue peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-blue/40 peer-focus-visible:ring-offset-2" />
      </label> : <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${config.enabled ? "bg-brand-blue/10 text-brand-blue" : "bg-brand-surface text-brand-text-muted"}`}>{config.enabled ? "专页已启用" : "专页未启用"}</span>}

      {(config.projectIds.length > 0 || editing || adding === "project") && <div className="space-y-3">
        <h3 className="font-semibold text-brand-text-heading">试玩作品（{config.projectIds.length}/50）</h3>
        {config.projectIds.length ? <ol className="space-y-2">{config.projectIds.map((id, index) => {
          const project = projects.find(p => p.id === id);
          const title = project?.title || "已下架或已删除的作品";
          return <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-surface px-3 py-2.5">
            <span className="mr-auto text-sm">{index + 1}. {title}</span>
            {project && <a href={`/works/${project.slug}`} target="_blank" rel="noreferrer" className="text-xs text-brand-blue underline">查看</a>}
            {editing && <>
              <button type="button" className={moveButtonClass} disabled={index === 0} aria-label={`上移作品：${title}`} onClick={() => move("projectIds", index, -1)}>↑</button>
              <button type="button" className={moveButtonClass} disabled={index === config.projectIds.length - 1} aria-label={`下移作品：${title}`} onClick={() => move("projectIds", index, 1)}>↓</button>
              <button type="button" className={removeButtonClass} aria-label={`移除作品：${title}`} onClick={() => { markChanged(); setConfig(c => ({ ...c, projectIds: c.projectIds.filter(p => p !== id) })); }}>移除</button>
            </>}
          </li>;
        })}</ol> : <p className="rounded-lg bg-brand-surface px-3 py-2.5 text-sm text-brand-text-muted">尚未添加试玩作品</p>}
        {adding === "project" && <div ref={addPanelRef} className="space-y-2 rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-3">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-brand-blue">添加试玩作品</span><button type="button" onClick={() => setAdding(null)} aria-label="关闭添加试玩作品" className="rounded-lg px-2 py-1 text-brand-text-muted hover:bg-card">×</button></div>
          <input type="search" aria-label="搜索已发布作品" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索已发布作品"
            className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-brand-border-subtle bg-card p-1.5">
            {available.map(p => <button type="button" key={p.id} className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-blue/5"
              onClick={() => { markChanged(); setConfig(c => ({ ...c, projectIds: [...c.projectIds, p.id] })); setAdding(null); }}><span>{p.title}</span><span className="inline-flex items-center gap-1 text-brand-blue"><PlusIcon size={14} />添加</span></button>)}
            {!available.length && <p className="p-2 text-sm text-brand-text-muted">没有可添加的作品</p>}
          </div>
        </div>}
      </div>}

      <ImageDropZone className="space-y-3 rounded-xl" hint="松开以添加海报"
        disabled={uploading || config.posters.length >= 10} onFile={file => upload(file)} onInvalid={msg => { markChanged(); setError(msg); }}>
        <h3 className="font-semibold text-brand-text-heading">活动海报（{config.posters.length}/10）</h3>
        {config.posters.length ? <div className={editing ? "space-y-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>{config.posters.map((poster, index) => <div key={`${poster.url}-${index}`} className={`rounded-xl border border-brand-border-subtle bg-brand-surface p-3 ${editing ? "flex gap-3" : "min-w-0"}`}>
          <CdnImage src={poster.url} alt={poster.title} className={`rounded-lg bg-card object-contain ${editing ? "h-24 w-16 shrink-0" : "h-32 w-full"}`} />
          {editing ? <div className="min-w-0 flex-1 space-y-2">
            <label className="block text-xs">海报 {index + 1} 标题<input value={poster.title} maxLength={80}
              className="mt-1 w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              onChange={e => { markChanged(); setConfig(c => ({ ...c, posters: c.posters.map((p, i) => i === index ? { ...p, title: e.target.value } : p) })); }} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={moveButtonClass} disabled={index === 0} aria-label={`上移海报：${poster.title}`} onClick={() => move("posters", index, -1)}>↑</button>
              <button type="button" className={moveButtonClass} disabled={index === config.posters.length - 1} aria-label={`下移海报：${poster.title}`} onClick={() => move("posters", index, 1)}>↓</button>
              <button type="button" className={removeButtonClass} aria-label={`移除海报：${poster.title}`} onClick={() => { markChanged(); setConfig(c => ({ ...c, posters: c.posters.filter((_, i) => i !== index) })); }}>移除</button>
            </div>
          </div> : <p className="mt-2 truncate text-sm font-medium text-brand-text-heading">{poster.title}</p>}
        </div>)}</div> : <p className="rounded-lg bg-brand-surface px-3 py-2.5 text-sm text-brand-text-muted">尚未添加活动海报</p>}
        {adding === "poster" && <div ref={addPanelRef} className="rounded-xl border-2 border-dashed border-brand-blue/30 bg-brand-blue/5 p-1 transition-colors hover:border-brand-blue/60 hover:bg-brand-blue/10">
          <input ref={posterInputRef} type="file" accept={ACCEPT_ATTR} disabled={uploading || config.posters.length >= 10}
            className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" disabled={uploading || config.posters.length >= 10} onClick={() => posterInputRef.current?.click()}
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg px-4 py-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:opacity-60">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-brand-blue shadow-sm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg></span>
            <span className="text-sm font-semibold text-brand-blue">{uploading ? "海报上传中…" : "点击选择海报"}</span>
            <span className="text-xs text-brand-text-muted">拖拽图片到此处，或聚焦后 Ctrl+V 粘贴 · JPG / PNG / WebP / GIF</span>
          </button>
        </div>}
      </ImageDropZone>
    </fieldset>
    {uploading && <p role="status" className="text-sm text-brand-blue">海报上传中…</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <a href={`/activities/${activityId}`} target="_blank" rel="noreferrer" className="text-sm text-brand-blue underline">预览活动页 ↗</a>
  </section>;
}
