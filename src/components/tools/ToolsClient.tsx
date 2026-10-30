"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveToolSites } from "@/app/tools/actions";
import type { ToolSite } from "@/lib/tools/tools";
import { useLang } from "@/lib/i18n/LangProvider";

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="mx-auto block">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/** 图标块：favicon 优先（撑满行高），加载失败回退品牌色字标 */
function IconBlock({ tool }: { tool: Pick<ToolSite, "iconUrl" | "color" | "letter" | "name"> }) {
  const [failed, setFailed] = useState(false);
  const showImg = tool.iconUrl && !failed;
  return (
    <span
      aria-hidden
      className="flex w-16 shrink-0 items-center justify-center select-none"
      style={
        showImg
          ? undefined
          : {
              background: `linear-gradient(160deg, ${tool.color} 0%, ${tool.color}BB 100%)`,
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 700,
            }
      }
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tool.iconUrl}
          alt=""
          width={44}
          height={44}
          onError={() => setFailed(true)}
          className="h-11 w-11 rounded-lg object-contain drop-shadow-sm"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      ) : (
        tool.letter
      )}
    </span>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-border-subtle bg-card px-2.5 py-1.5 text-sm text-brand-text-heading placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

/** 行内编辑表单：左侧图标预览 + 名称/网址/分类/简介 */
function ToolRowEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ToolSite | null;
  onSave: (next: ToolSite) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
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
  const valid = draft.name.trim() && /^https?:\/\/.+\..+/.test(draft.url.trim());

  return (
    <div className="flex items-stretch border-b border-brand-border-subtle">
      <IconBlock tool={{ ...draft, letter: (draft.name.trim()[0] || "?").toUpperCase() }} />
      <div className="flex-1 space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("tools.form.name")}
            aria-label={t("tools.form.name")}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder={t("tools.form.category")}
            aria-label={t("tools.form.category")}
            className={`${inputCls} w-28 shrink-0`}
          />
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            title={t("tools.form.color")}
            aria-label={t("tools.form.color")}
            className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-brand-border-subtle bg-card p-0.5"
          />
        </div>
        <input
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          placeholder={t("tools.form.url")}
          aria-label={t("tools.form.url")}
          className={`${inputCls} ${draft.url && !/^https?:\/\/.+\..+/.test(draft.url.trim()) ? "border-red-400" : ""}`}
        />
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder={t("tools.form.description")}
          aria-label={t("tools.form.description")}
          className={`${inputCls} resize-y`}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSave({
                ...draft,
                id: draft.id || `tool-${Date.now().toString(36)}`,
                name: draft.name.trim(),
                url: draft.url.trim(),
                category: draft.category.trim() || "工具",
                description: draft.description.trim(),
                letter: (draft.name.trim()[0] || "?").toUpperCase(),
              })
            }
            className="btn-primary rounded-lg px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("tools.save")}
          </button>
          <button type="button" onClick={onCancel} className="text-xs text-brand-text-muted hover:text-brand-navy">
            {t("tools.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ToolsClient({ initialSites, isAdmin }: { initialSites: ToolSite[]; isAdmin: boolean }) {
  const { t } = useLang();
  const router = useRouter();
  const [sites, setSites] = useState(initialSites);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const manageLabel = manageOpen ? t("tools.manageExit") : t("tools.manage");

  function persist(next: ToolSite[]) {
    setSites(next);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveToolSites(next);
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError(t("tools.errSave"));
      }
    });
  }

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
                setAdding((v) => !v);
                setEditingId(null);
              }}
              title={t("tools.add")}
              aria-label={t("tools.add")}
              aria-expanded={adding}
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
                setAdding(false);
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

      <div className="mx-auto max-w-3xl border-t border-brand-border-subtle">
        {sites.map((tool) =>
          editingId === tool.id ? (
            <ToolRowEditor
              key={tool.id}
              initial={tool}
              onSave={(next) => {
                setEditingId(null);
                persist(sites.map((s) => (s.id === tool.id ? next : s)));
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
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-brand-text-heading transition-colors group-hover/row:text-[#3388BB]">
                        {tool.name}
                      </span>
                      {tool.category && (
                        <span className="shrink-0 rounded border border-brand-border-subtle px-1.5 py-px text-[10px] text-brand-text-muted">
                          {tool.category}
                        </span>
                      )}
                      <span className="shrink-0 text-[11px] text-brand-text-muted">
                        {tool.url.replace(/^https?:\/\//, "")}
                      </span>
                    </span>
                    {tool.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-brand-text-secondary">{tool.description}</span>
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
                    onClick={() => setEditingId(tool.id)}
                    className="rounded-lg px-2.5 py-1 text-xs text-brand-blue transition-colors hover:bg-brand-blue/10"
                  >
                    {t("tools.edit")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => persist(sites.filter((s) => s.id !== tool.id))}
                    className="rounded-lg px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {t("tools.remove")}
                  </button>
                </div>
              )}
            </div>
          ),
        )}

        {adding && isAdmin && (
          <ToolRowEditor
            initial={null}
            onSave={(next) => {
              setAdding(false);
              persist([...sites, next]);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>

      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
      {pending ? <p className="mt-4 text-center text-xs text-brand-text-muted">{t("common.processing")}</p> : null}
    </div>
  );
}
