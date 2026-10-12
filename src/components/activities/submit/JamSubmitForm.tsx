"use client";

import { useState, useRef } from "react";
import { submitJamWork } from "@/lib/actions/submissions";
import MentionEditor from "@/components/ui/MentionEditor";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import {
  uploadImage,
  ACCEPT_ATTR,
  assertImageFile,
  compressionNote,
} from "@/lib/utils/clientUpload";
import { useLang } from "@/lib/i18n/LangProvider";
import { tagDisplayName, tagGroupDisplayName } from "@/lib/tags/tag-names";
import type { DictKey } from "@/lib/i18n/dict";

const PROJECT_TYPES: { value: string; k: DictKey }[] = [
  { value: "IN_DEVELOPMENT", k: "work.status.IN_DEVELOPMENT" },
  { value: "TRIAL_DEMO", k: "work.status.TRIAL_DEMO" },
  { value: "MINI_GAME", k: "work.status.MINI_GAME" },
  { value: "OFFICIAL_RELEASE", k: "work.status.OFFICIAL_RELEASE" },
];

const ROLE_PRESETS: { cn: string; k: DictKey }[] = [
  { cn: "程序", k: "form.role.program" },
  { cn: "策划", k: "form.role.design" },
  { cn: "美术", k: "form.role.art" },
  { cn: "音效", k: "form.role.sound" },
  { cn: "音乐", k: "form.role.music" },
  { cn: "测试", k: "form.role.test" },
  { cn: "宣发", k: "form.role.pr" },
  { cn: "全栈", k: "form.role.fullstack" },
];

const ROLE_CN_TO_KEY: Record<string, DictKey> = {
  制作: "form.role.production",
  ...Object.fromEntries(ROLE_PRESETS.map((r) => [r.cn, r.k])),
};

const LINK_LABEL_PRESETS: { v: string; k?: DictKey }[] = [
  { v: "Steam" },
  { v: "itch.io" },
  { v: "官网", k: "form.link.official" },
  { v: "百度网盘", k: "form.link.baidu" },
  { v: "Google Drive" },
  { v: "GitHub" },
  { v: "B站", k: "form.link.bilibili" },
];

interface TeamMember {
  id: string;
  userId: string;
  userName: string;
  role: string;
}

interface CreatorEntry {
  name: string;
  roles: string[];
}

interface LinkEntry {
  label: string;
  url: string;
}

const inputClass =
  "w-full rounded-lg border border-brand-border-subtle px-3 py-2 text-sm text-brand-text-heading focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent transition-shadow disabled:opacity-50";

export function JamSubmitForm({
  activityId,
  isOngoing,
  existing,
  teamMembers,
  tags,
}: {
  activityId: string;
  isOngoing: boolean;
  existing: any;
  teamMembers: TeamMember[];
  tags: { id: string; name: string; slug: string; group?: string | null }[];
}) {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const [coverUrl, setCoverUrl] = useState(existing?.coverImage || "");
  const [coverPreview, setCoverPreview] = useState<string | null>(existing?.coverImage || null);
  const [coverUploading, setCoverUploading] = useState(false);

  const [screenshots, setScreenshots] = useState<{ url: string }[]>(
    (existing?.files || []).map((url: string) => ({ url }))
  );
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState("");

  const [creators, setCreators] = useState<CreatorEntry[]>(
    teamMembers.map((m) => ({ name: m.userName, roles: ["制作"] }))
  );
  const [creatorName, setCreatorName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const [links, setLinks] = useState<LinkEntry[]>(existing?.links || []);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showCustomLabel, setShowCustomLabel] = useState(false);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(existing?.tagIds || []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>(existing?.customTags || []);

  const [submitToWorks, setSubmitToWorks] = useState(false);
  const [projectType, setProjectType] = useState("TRIAL_DEMO");
  const [developYear, setDevelopYear] = useState(new Date().getFullYear());

  const coverFileRef = useRef<HTMLInputElement>(null);
  const screenshotFileRef = useRef<HTMLInputElement>(null);

  /** 统一的上传内核：原图在限额内就直传，超了才压缩；失败时给本地化提示 */
  const uploadFile = async (file: File, type: "cover" | "screenshot") => {
    assertImageFile(file, lang);
    const result = await uploadImage(file, {
      endpoint: "/api/upload",
      type,
      lang,
    });
    setUploadNote(compressionNote(result, lang));
    return result.url;
  };

  const handleCoverFile = async (file: File | undefined) => {
    if (!file) return;
    setCoverUploading(true);
    setError("");
    setUploadNote("");
    try {
      const url = await uploadFile(file, "cover");
      setCoverUrl(url);
      setCoverPreview(url);
    } catch (err: any) {
      setError(err.message || t("form.uploadFailed"));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleScreenshotFile = async (file: File | undefined) => {
    if (!file) return;
    if (screenshots.length >= 3) return;
    setScreenshotUploading(true);
    setError("");
    setUploadNote("");
    try {
      const url = await uploadFile(file, "screenshot");
      setScreenshots((prev) => [...prev, { url }]);
    } catch (err: any) {
      setError(err.message || t("form.uploadFailed"));
    } finally {
      setScreenshotUploading(false);
    }
  };

  const addCreator = () => {
    const name = creatorName.trim();
    if (!name || selectedRoles.length === 0) return;
    setCreators((prev) => [...prev, { name, roles: [...selectedRoles] }]);
    setCreatorName("");
    setSelectedRoles([]);
  };

  const removeCreator = (idx: number) => {
    setCreators((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const addLink = () => {
    const label = newLinkLabel.trim();
    const url = newLinkUrl.trim();
    if (!label || !url) return;
    setLinks((prev) => [...prev, { label, url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
    setShowCustomLabel(false);
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const addCustomTag = () => {
    const name = customTagInput.trim();
    if (!name || customTags.includes(name)) return;
    setCustomTags((prev) => [...prev, name]);
    setCustomTagInput("");
  };

  const removeCustomTag = (name: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== name));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    setLoading(true);
    submittingRef.current = true;

    const form = new FormData(e.currentTarget);
    form.set("coverImage", coverUrl);
    form.set("screenshots", JSON.stringify(screenshots.map((s) => s.url)));
    form.set("creators", JSON.stringify(creators));
    form.set("links", JSON.stringify(links));
    form.set("tagIds", JSON.stringify(selectedTagIds));
    form.set("customTags", JSON.stringify(customTags));
    form.set("submitToWorks", submitToWorks ? "1" : "0");
    form.set("projectType", projectType);
    form.set("developYear", String(developYear));

    try {
      const result = await submitJamWork(activityId, form);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        submittingRef.current = false;
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || t("submit.fail"));
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (success) {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2 text-brand-navy">
          {t(existing ? "gamejam.successUpdate" : "gamejam.successNew")}
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          {t(submitToWorks ? "gamejam.successToWorks" : "gamejam.successOnly")}
        </p>
        <a
          href={`/activities/${activityId}`}
          className="px-6 py-2 rounded-lg text-sm text-white inline-block bg-brand-blue"
        >
          {t("gamejam.backToActivity")}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div
          className="p-3 rounded-lg text-sm whitespace-pre-line bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
        >
          {error}
        </div>
      )}

      {/* 基本信息 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.basicInfo")}
        </h2>
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body">
            {t("gamejam.title")} <span className="text-red-700">*</span>
          </label>
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={existing?.title || ""}
            placeholder={t("gamejam.titlePlaceholder")}
            className={inputClass}
            disabled={!isOngoing || loading}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body">
            {t("gamejam.description")} <span className="text-red-700">*</span>
          </label>
          <MentionEditor
            name="description"
            defaultValue={existing?.description || ""}
            placeholder={t("gamejam.descriptionPlaceholder")}
            rows={4}
            required
            minLength={10}
            maxLength={10000}
            className={inputClass}
            disabled={!isOngoing || loading}
          />
        </div>
      </section>

      {/* 封面图 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.cover")}
        </h2>
        <input
          ref={coverFileRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => void handleCoverFile(e.target.files?.[0])}
          disabled={!isOngoing || loading}
        />
        <ImageDropZone
          hint={t("gamejam.coverHint")}
          disabled={coverUploading || !isOngoing || loading}
          onFile={(file) => handleCoverFile(file)}
          onInvalid={(msg) => setError(msg)}
          className="rounded-xl p-1"
        >
        {coverPreview && (
          <div className="relative inline-block">
            <img
              src={coverPreview}
              alt={t("gamejam.coverPreviewAlt")}
              className="w-48 h-32 object-cover rounded-lg border border-brand-border-subtle"
            />
            <button
              type="button"
              onClick={() => {
                setCoverUrl("");
                setCoverPreview(null);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
              disabled={!isOngoing || loading}
            >
              ×
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => coverFileRef.current?.click()}
            disabled={coverUploading || !isOngoing || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue"
          >
            {coverUploading ? t("form.uploading") : coverPreview ? t("form.changeCover") : t("form.selectCover")}
          </button>
          <span className="text-xs text-brand-text-muted">{t("form.dragHint")}</span>
        </div>
        </ImageDropZone>
      </section>

      {/* 截图 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.screenshots")}
        </h2>
        <input
          ref={screenshotFileRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => void handleScreenshotFile(e.target.files?.[0])}
          disabled={!isOngoing || loading}
        />
        <ImageDropZone
          hint={t("gamejam.screenshotHint")}
          disabled={screenshotUploading || screenshots.length >= 3 || !isOngoing || loading}
          onFile={(file) => handleScreenshotFile(file)}
          onInvalid={(msg) => setError(msg)}
          className="rounded-xl p-1"
        >
        {screenshots.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {screenshots.map((img, i) => (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-brand-border-subtle"
              >
                <img
                  src={img.url}
                  alt={t("form.screenshotAlt", { n: i + 1 })}
                  className="w-full aspect-video object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setScreenshots((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500"
                  disabled={!isOngoing || loading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => screenshotFileRef.current?.click()}
            disabled={screenshotUploading || screenshots.length >= 3 || !isOngoing || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue"
          >
            {screenshotUploading
              ? t("form.uploading")
              : screenshots.length >= 3
              ? t("gamejam.maxReached")
              : t("form.addScreenshot")}
          </button>
          <span className="text-xs text-brand-text-muted">{t("form.dragHint")}</span>
        </div>
        {uploadNote && <p className="text-xs text-brand-text-muted">{uploadNote}</p>}
        <p className="text-xs text-brand-text-muted">{t("gamejam.screenshotLimit")}</p>
        </ImageDropZone>
      </section>

      {/* 制作人员 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.creators")}
        </h2>
        <p className="text-xs text-brand-text-muted">
          {t("gamejam.creatorsHint")}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCreator(); }
            }}
            placeholder={t("gamejam.creatorPlaceholder")}
            className={`${inputClass} flex-1`}

            disabled={!isOngoing || loading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ROLE_PRESETS.map((r) => {
            const active = selectedRoles.includes(r.cn);
            return (
              <button
                key={r.cn}
                type="button"
                onClick={() => toggleRole(r.cn)}
                disabled={!isOngoing || loading}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  active
                    ? "border-[#88C232] text-white bg-brand-green"
                    : "border-[#D0DEE8] text-gray-500 bg-card"
                } disabled:opacity-50`}
              >
                {t(r.k)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={addCreator}
            disabled={!creatorName.trim() || selectedRoles.length === 0 || !isOngoing || loading}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-white ml-2 bg-brand-green"
          >
            {t("gamejam.add")}
          </button>
        </div>
        {creators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {creators.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[rgba(37,84,122,0.1)] text-brand-navy"
              >
                {m.name}
                <span className="text-xs opacity-70">
                  {m.roles.map((role) => t(ROLE_CN_TO_KEY[role] ?? "form.role.production")).join(lang === "en" ? ", " : "、")}
                </span>
                <button
                  type="button"
                  onClick={() => removeCreator(i)}
                  className="ml-0.5 hover:text-red-500"
                  disabled={!isOngoing || loading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 外部链接 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.links")}
        </h2>
        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[#F0F5F9]"
              >
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 text-white bg-brand-navy"
                >
                  {link.label}
                </span>
                <span className="truncate flex-1 text-brand-blue">{link.url}</span>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="text-xs flex-shrink-0 hover:text-red-500 text-brand-text-muted"
                  disabled={!isOngoing || loading}
                >
                  {t("profile.edit.remove")}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {!showCustomLabel ? (
            <select
              value={newLinkLabel}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") { setShowCustomLabel(true); setNewLinkLabel(""); }
                else setNewLinkLabel(v);
              }}
              className={`${inputClass} w-36`}
              disabled={!isOngoing || loading}
            >
              <option value="">{t("gamejam.selectLabel")}</option>
              {LINK_LABEL_PRESETS.map((l) => (
                <option key={l.v} value={l.v}>{l.k ? t(l.k) : l.v}</option>
              ))}
              <option value="__custom__">{t("form.customEllipsis")}</option>
            </select>
          ) : (
            <input
              type="text"
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder={t("gamejam.linkLabelPlaceholder")}
              className={`${inputClass} w-36`}
              disabled={!isOngoing || loading}
            />
          )}
          <input
            type="url"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="https://..."
            className={`${inputClass} flex-1 min-w-[200px]`}

            disabled={!isOngoing || loading}
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim() || !isOngoing || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-white bg-brand-green"
          >
            {t("gamejam.add")}
          </button>
        </div>
      </section>

      {/* 标签 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          {t("gamejam.tags")}
        </h2>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={!isOngoing || loading}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? "border-[#88C232] text-white bg-brand-green"
                      : "border-[#D0DEE8] text-gray-500 bg-card"
                  } disabled:opacity-50`}
                >
                  {tagDisplayName(tag.slug, tag.name, lang)}
                  {tag.group ? ` (${tagGroupDisplayName(tag.group, lang)})` : ""}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
            }}
            placeholder={t("gamejam.customTagPlaceholder")}
            className={`${inputClass} w-40`}

            disabled={!isOngoing || loading}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customTagInput.trim() || !isOngoing || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-white bg-brand-green"
          >
            {t("gamejam.add")}
          </button>
        </div>
        {customTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customTags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[rgba(227,128,67,0.1)] text-brand-orange"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeCustomTag(name)}
                  disabled={!isOngoing || loading}
                  className="hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 提交到作品库 */}
      <section
        className="p-4 rounded-lg border border-[#FFF3E0] bg-[#FFFDF7] space-y-3"
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={submitToWorks}
            onChange={(e) => setSubmitToWorks(e.target.checked)}
            disabled={!isOngoing || loading}
            className="w-4 h-4 accent-[#E38043]"
          />
          <span className="text-sm font-medium text-brand-text-body">
            {t("gamejam.submitToWorks")}
          </span>
        </label>
        <p className="text-xs text-brand-text-muted">
          {t("gamejam.submitToWorksDesc")}
        </p>
        {submitToWorks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs mb-1 text-brand-text-secondary">
                {t("form.workType")}
              </label>
              <select
                name="type"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className={inputClass}
                disabled={!isOngoing || loading}
              >
                {PROJECT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(p.k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 text-brand-text-secondary">
                {t("form.devYear")}
              </label>
              <input
                type="number"
                value={developYear}
                onChange={(e) =>
                  setDevelopYear(parseInt(e.target.value) || new Date().getFullYear())
                }
                min={2000}
                max={new Date().getFullYear() + 1}
                className={inputClass}
                disabled={!isOngoing || loading}
              />
            </div>
          </div>
        )}
      </section>

      {/* 提交按钮 */}
      {isOngoing && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 bg-brand-navy"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {loading ? t("form.submitting") : existing ? t("gamejam.updateWork") : t("form.submitWork")}
          </button>
        </div>
      )}

      {!isOngoing && (
        <div
          className="p-4 rounded-lg text-center text-sm bg-[#FFFDF7] border border-[#FFF3E0] text-brand-orange"
        >
          {t("gamejam.notStarted")}
        </div>
      )}
    </form>
  );
}
