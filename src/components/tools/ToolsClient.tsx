"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveToolsData } from "@/app/tools/actions";
import { faviconFor, type ToolSection, type ToolSite, type ToolsData } from "@/lib/tools/shared";
import { useLang } from "@/lib/i18n/LangProvider";

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="mx-auto block">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 图标块：favicon / 上传图像优先（撑满行高），失败链式回退，字标常驻兜底。
 *  抓取链：iconUrl → 目标站 /favicon.ico → 品牌色字标。
 *  分层渲染（字标垫底、图标加载成功才覆盖）：Google s2 在部分网络下水合前就
 *  加载失败，React 的 onError 接不住——字标垫底可保证任何时刻都不出现破图。 */
function IconBlock({ tool }: { tool: Pick<ToolSite, "url" | "iconUrl" | "color" | "letter" | "name"> }) {
  const candidates: string[] = [];
  if (tool.iconUrl) candidates.push(tool.iconUrl);
  try {
    const direct = `https://${new URL(tool.url).hostname}/favicon.ico`;
    if (!candidates.includes(direct)) candidates.push(direct);
  } catch { /* 非法 url 时不追加候选 */ }
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 水合后再挂 img：水合前的加载失败 React onError 接不住，会出现破图残留
  useEffect(() => setMounted(true), []);
  const showImg = mounted && idx < candidates.length;
  return (
    <span
      aria-hidden
      className="relative flex w-16 shrink-0 items-center justify-center overflow-hidden select-none"
      style={{
        background: `linear-gradient(160deg, ${tool.color} 0%, ${tool.color}BB 100%)`,
      }}
    >
      <span
        className="text-2xl font-bold text-white"
        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)", visibility: loaded ? "hidden" : "visible" }}
      >
        {tool.letter}
      </span>
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={candidates[idx]}
          src={candidates[idx]}
          alt=""
          width={44}
          height={44}
          onError={() => {
            setLoaded(false);
            setIdx((i) => i + 1);
          }}
          onLoad={(e) => {
            // 极小的占位图（s2 对无 favicon 站点返回 1×1）视为失败
            const img = e.currentTarget;
            if (img.naturalWidth <= 2) setIdx((i) => i + 1);
            else setLoaded(true);
          }}
          className="absolute inset-0 h-full w-full bg-card object-contain p-2.5"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      )}
    </span>
  );
}

/** 编辑态输入基样：仅描边提示可编辑，字号/字重随展示态字段另配 */
const editBase =
  "rounded border border-brand-border-subtle bg-card px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 placeholder:font-normal placeholder:tracking-normal placeholder:text-brand-text-muted/60";

/**
 * 行内编辑表单 —— 版式镜像展示态行：左侧图标列（可上传/重新获取 favicon）、
 * 中间 名称+分栏 / 网址 / 简介 与展示态同位同字号，右侧 保存/取消 取代展示态的 →。
 */
function ToolRowEditor({
  sections,
  initial,
  defaultSectionId,
  onSave,
  onCancel,
}: {
  sections: ToolSection[];
  initial: ToolSite | null;
  defaultSectionId?: string;
  onSave: (next: ToolSite) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [iconErr, setIconErr] = useState("");
  const [draft, setDraft] = useState<ToolSite>(
    initial ?? {
      id: "",
      name: "",
      url: "https://",
      iconUrl: "",
      color: "#25547A",
      letter: "?",
      category: "",
      description: "",
    },
  );
  const sectionOptions = sections.length ? sections : [{ id: "__default", name: t("tools.section.default") }];
  const [sectionId, setSectionId] = useState(
    initial
      ? (sections.find((s) => s.name === initial.category)?.id ?? sectionOptions[0].id)
      : (defaultSectionId ?? sectionOptions[0].id),
  );
  const valid = draft.name.trim() && /^https?:\/\/.+\..+/.test(draft.url.trim());

  /** 输入网址即联动获取该域名 favicon（与保存时的服务端补全逻辑一致）；管理员上传过的自定义图标不被覆盖 */
  function onUrlChange(url: string) {
    let iconUrl = draft.iconUrl;
    const trimmed = url.trim();
    if (/^https?:\/\/.+\..+/.test(trimmed) && (!iconUrl || iconUrl.includes("google.com/s2/favicons"))) {
      iconUrl = faviconFor(trimmed);
    }
    setDraft({ ...draft, url, iconUrl });
  }

  /** 上传自定义图标（复用站内通用图片上传接口） */
  async function onPickIcon(file: File | undefined) {
    if (!file) return;
    setIconErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) throw new Error(json?.error || t("tools.errUpload"));
      setDraft((d) => ({ ...d, iconUrl: json.url! }));
    } catch (e) {
      setIconErr(e instanceof Error && e.message ? e.message : t("tools.errUpload"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-stretch border-b border-brand-border-subtle bg-brand-surface/30">
      {/* 左：图标列（与展示态同宽），上传 / 重新获取 favicon */}
      <div className="flex w-16 shrink-0 flex-col items-center py-3.5">
        <IconBlock key={draft.iconUrl} tool={{ ...draft, letter: (draft.name.trim()[0] || "?").toUpperCase() }} />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onPickIcon(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-1.5 rounded border border-brand-border-subtle px-1 py-px text-[10px] leading-4 text-brand-text-muted transition-colors hover:border-brand-blue/50 hover:text-brand-navy disabled:opacity-50"
        >
          {uploading ? t("tools.icon.uploading") : t("tools.icon.upload")}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ ...draft, iconUrl: faviconFor(draft.url.trim()) })}
          title={t("tools.icon.refetch")}
          aria-label={t("tools.icon.refetch")}
          className="mt-0.5 px-1 text-[11px] leading-4 text-brand-text-muted transition-colors hover:text-brand-navy"
        >
          ⟳
        </button>
      </div>

      {/* 中：镜像展示态排版（名称+分栏 / 网址 / 简介） */}
      <div className="min-w-0 flex-1 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("tools.form.name")}
            aria-label={t("tools.form.name")}
            className={`${editBase} min-w-0 flex-1 text-sm font-semibold text-brand-text-heading`}
          />
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            aria-label={t("tools.form.section")}
            className="shrink-0 cursor-pointer rounded border border-brand-border-subtle bg-card px-1.5 py-0.5 text-[11px] text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          >
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <input
          value={draft.url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={t("tools.form.url")}
          aria-label={t("tools.form.url")}
          className={`${editBase} mt-1.5 w-full text-[11px] text-brand-text-muted ${draft.url && !/^https?:\/\/.+\..+/.test(draft.url.trim()) ? "border-red-400" : ""}`}
        />
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder={t("tools.form.description")}
          aria-label={t("tools.form.description")}
          className={`${editBase} mt-1.5 w-full resize-y text-xs leading-5 text-brand-text-secondary`}
        />
        {iconErr ? <p className="mt-1 text-[11px] text-red-600">{iconErr}</p> : null}
      </div>

      {/* 右：保存 / 取消（占据展示态 → 箭头列的位置） */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-3">
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              ...draft,
              id: draft.id || `tool-${Date.now().toString(36)}`,
              name: draft.name.trim(),
              url: draft.url.trim(),
              category: sectionOptions.find((s) => s.id === sectionId)?.name ?? t("tools.section.default"),
              description: draft.description.trim(),
              letter: (draft.name.trim()[0] || "?").toUpperCase(),
            })
          }
          className="btn-primary rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("tools.save")}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-brand-text-muted hover:text-brand-navy">
          {t("tools.cancel")}
        </button>
      </div>
    </div>
  );
}

/** 分栏名原位编辑：Enter/失焦确认，Esc/空值取消；样式贴近分栏标题本身 */
function SectionNameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(initial);
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => (name.trim() ? onCommit(name.trim()) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === "Enter") name.trim() ? onCommit(name.trim()) : onCancel();
        if (e.key === "Escape") onCancel();
      }}
      placeholder={t("tools.section.name")}
      aria-label={t("tools.section.name")}
      className="w-44 rounded border-b-2 border-brand-blue bg-transparent px-0.5 text-xs font-bold uppercase tracking-widest text-brand-text-heading placeholder:font-normal placeholder:tracking-normal placeholder:text-brand-text-muted/60 focus:outline-none"
    />
  );
}

export default function ToolsClient({ initialData, isAdmin }: { initialData: ToolsData; isAdmin: boolean }) {
  const { t } = useLang();
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ sectionId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const manageLabel = manageOpen ? t("tools.manageExit") : t("tools.manage");

  function persist(next: ToolsData) {
    const previous = data;
    setData(next);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveToolsData(next);
        if (result?.error) {
          setData(previous); // 保存失败回滚本地乐观状态，避免界面与库不一致
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setData(previous);
        setError(t("tools.errSave"));
      }
    });
  }

  function renameSection(section: ToolSection, name: string) {
    if (name === section.name) return;
    if (data.sections.some((s) => s.id !== section.id && s.name === name)) {
      setError(t("tools.section.duplicate"));
      return;
    }
    persist({
      sections: data.sections.map((s) => (s.id === section.id ? { ...s, name } : s)),
      // 分栏改名后，栏内条目同步归属新名
      sites: data.sites.map((site) => (site.category === section.name ? { ...site, category: name } : site)),
    });
  }

  function addSection(name: string) {
    if (data.sections.some((s) => s.name === name)) {
      setError(t("tools.section.duplicate"));
      return;
    }
    persist({
      sections: [...data.sections, { id: `sec-${Date.now().toString(36)}`, name }],
      sites: data.sites,
    });
  }

  function deleteSection(id: string) {
    persist({ sections: data.sections.filter((s) => s.id !== id), sites: data.sites });
  }

  const sitesOf = (section: ToolSection) => data.sites.filter((site) => site.category === section.name);
  // 展示态不渲染空分栏；管理模式下全部可见（含空栏，便于向其中添加）
  const visibleSections = isAdmin && manageOpen ? data.sections : data.sections.filter((s) => sitesOf(s).length > 0);

  return (
    <div className="container mx-auto px-4 py-6 lg:py-10 animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3 lg:mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy">{t("page.tools.title")}</h1>
          <p className="mt-2 text-sm text-brand-text-secondary">{t("page.tools.description")}</p>
        </div>
        {isAdmin && (
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setRenamingId(null);
                setAdding((v) => (v ? null : { sectionId: data.sections[0]?.id ?? "__default" }));
              }}
              title={t("tools.add")}
              aria-label={t("tools.add")}
              aria-expanded={!!adding}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors ${
                adding ? "bg-brand-orange" : "bg-brand-blue hover:bg-brand-blue/90"
              }`}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              onClick={() => {
                setManageOpen((v) => !v);
                setEditingId(null);
                setAdding(null);
                setRenamingId(null);
                setAddingSection(false);
              }}
              title={manageLabel}
              aria-label={manageLabel}
              aria-pressed={manageOpen}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors ${
                manageOpen ? "bg-brand-orange" : "bg-brand-navy hover:bg-brand-navy/90"
              }`}
            >
              <PencilIcon />
            </button>
          </span>
        )}
      </div>

      <div className="mx-auto max-w-3xl">
        {visibleSections.map((section) => {
          const items = sitesOf(section);
          return (
            <section key={section.id} className="mt-7 first:mt-0">
              {/* 分栏标题：管理模式可原位改名 / 添加条目 / 删除空栏 */}
              <div className="mb-1 flex h-6 items-center gap-2 px-1">
                {renamingId === section.id ? (
                  <SectionNameInput
                    initial={section.name}
                    onCommit={(name) => {
                      setRenamingId(null);
                      renameSection(section, name);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text-muted">{section.name}</h2>
                )}
                {isAdmin && manageOpen && renamingId !== section.id && (
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setRenamingId(section.id)}
                      title={t("tools.section.rename")}
                      aria-label={t("tools.section.rename")}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-brand-text-muted transition-colors hover:bg-brand-blue/10 hover:text-brand-navy"
                    >
                      <PencilIcon size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setAdding({ sectionId: section.id });
                      }}
                      title={t("tools.add")}
                      aria-label={t("tools.add")}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-brand-text-muted transition-colors hover:bg-brand-blue/10 hover:text-brand-navy"
                    >
                      <PlusIcon size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={items.length > 0 || pending}
                      onClick={() => deleteSection(section.id)}
                      title={items.length > 0 ? t("tools.section.deleteBlocked") : t("tools.section.delete")}
                      aria-label={t("tools.section.delete")}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-brand-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand-text-muted"
                    >
                      <span aria-hidden className="text-sm leading-none">
                        ×
                      </span>
                    </button>
                  </span>
                )}
              </div>

              <div className="border-t border-brand-border-subtle">
                {items.map((tool) =>
                  editingId === tool.id ? (
                    <ToolRowEditor
                      key={tool.id}
                      sections={data.sections}
                      initial={tool}
                      onSave={(next) => {
                        setEditingId(null);
                        persist({ ...data, sites: data.sites.map((s) => (s.id === tool.id ? next : s)) });
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div key={tool.id} className="group/row">
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-stretch border-b border-brand-border-subtle cursor-pointer transition-colors hover:bg-brand-surface/50"
                      >
                        <IconBlock tool={tool} />
                        <span className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5">
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="min-w-0 truncate text-sm font-semibold text-brand-text-heading transition-colors group-hover/row:text-[#3388BB]">
                                {tool.name}
                              </span>
                              <span className="min-w-0 truncate text-[11px] text-brand-text-muted">
                                {tool.url.replace(/^https?:\/\//, "")}
                              </span>
                            </span>
                            {tool.description && (
                              <span className="mt-0.5 block text-xs leading-5 text-brand-text-secondary break-words">
                                {tool.description}
                              </span>
                            )}
                          </span>
                          <span
                            aria-hidden
                            className="shrink-0 self-center text-2xl leading-none text-brand-text-muted/50 transition-all group-hover/row:translate-x-1 group-hover/row:text-[#3388BB]"
                          >
                            →
                          </span>
                        </span>
                      </a>
                      {isAdmin && manageOpen && (
                        <div className="-mt-px flex justify-end gap-1 border-b border-brand-border-subtle bg-brand-surface/40 px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(null);
                              setEditingId(tool.id);
                            }}
                            className="rounded-lg px-2.5 py-1 text-xs text-brand-blue transition-colors hover:bg-brand-blue/10"
                          >
                            {t("tools.edit")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => persist({ ...data, sites: data.sites.filter((s) => s.id !== tool.id) })}
                            className="rounded-lg px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {t("tools.remove")}
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )}

                {adding?.sectionId === section.id && isAdmin && (
                  <ToolRowEditor
                    sections={data.sections}
                    initial={null}
                    defaultSectionId={section.id}
                    onSave={(next) => {
                      setAdding(null);
                      persist({ ...data, sites: [...data.sites, next] });
                    }}
                    onCancel={() => setAdding(null)}
                  />
                )}

                {items.length === 0 && adding?.sectionId !== section.id && isAdmin && manageOpen && (
                  <p className="border-b border-brand-border-subtle px-4 py-3 text-xs text-brand-text-muted">
                    {t("tools.section.empty")}
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {/* 兜底：目标分栏当前未渲染（如空栏且非管理模式）时，新增表单落在列表末尾 */}
        {adding && isAdmin && !visibleSections.some((s) => s.id === adding.sectionId) && (
          <section className="mt-7 first:mt-0">
            <div className="border-t border-brand-border-subtle">
              <ToolRowEditor
                sections={data.sections}
                initial={null}
                defaultSectionId={adding.sectionId}
                onSave={(next) => {
                  setAdding(null);
                  persist({ ...data, sites: [...data.sites, next] });
                }}
                onCancel={() => setAdding(null)}
              />
            </div>
          </section>
        )}

        {/* 新增分栏（管理模式） */}
        {isAdmin && manageOpen && (
          addingSection ? (
            <div className="mt-7 px-1">
              <SectionNameInput
                initial=""
                onCommit={(name) => {
                  setAddingSection(false);
                  addSection(name);
                }}
                onCancel={() => setAddingSection(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setAdding(null);
                setAddingSection(true);
              }}
              className="mt-7 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-border-subtle py-2.5 text-xs text-brand-text-muted transition-colors hover:border-brand-blue/50 hover:text-brand-navy"
            >
              <PlusIcon size={13} />
              {t("tools.section.add")}
            </button>
          )
        )}
      </div>

      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
      {pending ? <p className="mt-4 text-center text-xs text-brand-text-muted">{t("common.processing")}</p> : null}
    </div>
  );
}
