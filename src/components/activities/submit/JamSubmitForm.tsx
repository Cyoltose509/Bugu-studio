"use client";

import { useState, useRef } from "react";
import { submitJamWork } from "@/lib/actions/submissions";
import MentionEditor from "@/components/ui/MentionEditor";

const PROJECT_TYPES = [
  { value: "IN_DEVELOPMENT", label: "开发阶段" },
  { value: "TRIAL_DEMO", label: "提供试玩" },
  { value: "MINI_GAME", label: "小游戏" },
  { value: "OFFICIAL_RELEASE", label: "正式上架" },
];

const ROLE_PRESETS = ["程序", "策划", "美术", "音效", "音乐", "测试", "宣发", "全栈"];
const LINK_LABEL_PRESETS = ["Steam", "itch.io", "官网", "百度网盘", "Google Drive", "GitHub", "B站"];

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
  tags: { id: string; name: string; group?: string | null }[];
}) {
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

  const uploadFile = async (file: File, type: "cover" | "screenshot") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "上传失败");
    }
    const j = await res.json();
    return j.url || j.data?.url;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadFile(file, "cover");
      setCoverUrl(url);
      setCoverPreview(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCoverUploading(false);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (screenshots.length >= 3) return;
    setScreenshotUploading(true);
    try {
      const url = await uploadFile(file, "screenshot");
      setScreenshots((prev) => [...prev, { url }]);
    } catch (err: any) {
      setError(err.message);
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
      setError(err.message || "提交失败");
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (success) {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2 text-brand-navy">
          {existing ? "作品已更新！" : "提交成功！"}
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          {submitToWorks
            ? "你的作品已提交参赛，并已同步到作品库待审核。"
            : "你的作品已提交参赛！"}
        </p>
        <a
          href={`/activities/${activityId}`}
          className="px-6 py-2 rounded-lg text-sm text-white inline-block bg-brand-blue"
        >
          返回活动
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
          基本信息
        </h2>
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body">
            作品标题 <span className="text-red-700">*</span>
          </label>
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={existing?.title || ""}
            placeholder="给作品起个名字"
            className={inputClass}
            disabled={!isOngoing || loading}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body">
            作品描述 <span className="text-red-700">*</span>
          </label>
          <MentionEditor
            name="description"
            defaultValue={existing?.description || ""}
            placeholder="介绍一下这个作品（至少 10 字）"
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
          封面图
        </h2>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleCoverUpload}
          disabled={!isOngoing || loading}
        />
        {coverPreview && (
          <div className="relative inline-block">
            <img
              src={coverPreview}
              alt="封面预览"
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
        <button
          type="button"
          onClick={() => coverFileRef.current?.click()}
          disabled={coverUploading || !isOngoing || loading}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue"
        >
          {coverUploading ? "上传中..." : coverPreview ? "更换封面" : "+ 上传封面"}
        </button>
      </section>

      {/* 截图 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          截图 / GIF
        </h2>
        <input
          ref={screenshotFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleScreenshotUpload}
          disabled={!isOngoing || loading}
        />
        {screenshots.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {screenshots.map((img, i) => (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-brand-border-subtle"
              >
                <img
                  src={img.url}
                  alt={`截图 ${i + 1}`}
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
        <button
          type="button"
          onClick={() => screenshotFileRef.current?.click()}
          disabled={screenshotUploading || screenshots.length >= 3 || !isOngoing || loading}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue"
        >
          {screenshotUploading
            ? "上传中..."
            : screenshots.length >= 3
            ? "已达到上限"
            : "+ 添加截图"}
        </button>
        <p className="text-xs text-brand-text-muted">最多 3 张</p>
      </section>

      {/* 制作人员 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          制作人员
        </h2>
        <p className="text-xs text-brand-text-muted">
          已自动填入队伍成员，可增删或修改职位
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCreator(); }
            }}
            placeholder="输入姓名（内部或外部成员）"
            className={`${inputClass} flex-1`}

            disabled={!isOngoing || loading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ROLE_PRESETS.map((r) => {
            const active = selectedRoles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                disabled={!isOngoing || loading}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  active
                    ? "border-[#88C232] text-white bg-brand-green"
                    : "border-[#D0DEE8] text-gray-500 bg-card"
                } disabled:opacity-50`}
              >
                {r}
              </button>
            );
          })}
          <button
            type="button"
            onClick={addCreator}
            disabled={!creatorName.trim() || selectedRoles.length === 0 || !isOngoing || loading}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-white ml-2 bg-brand-green"
          >
            + 添加
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
                <span className="text-xs opacity-70">{m.roles.join("、")}</span>
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
          外部链接
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
                  移除
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
              <option value="">选择类型</option>
              {LINK_LABEL_PRESETS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value="__custom__">自定义...</option>
            </select>
          ) : (
            <input
              type="text"
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder="链接标签"
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
            + 添加
          </button>
        </div>
      </section>

      {/* 标签 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">
          标签
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
                  {tag.name}
                  {tag.group ? ` (${tag.group})` : ""}
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
            placeholder="自定义标签..."
            className={`${inputClass} w-40`}

            disabled={!isOngoing || loading}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customTagInput.trim() || !isOngoing || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-white bg-brand-green"
          >
            + 添加
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
            同时提交到作品库
          </span>
        </label>
        <p className="text-xs text-brand-text-muted">
          勾选后，参赛作品将同步创建为作品库中的作品（状态为"待审核"），可在 /works 页面展示。不勾选则仅作为参赛作品，不会出现在作品库。
        </p>
        {submitToWorks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs mb-1 text-brand-text-secondary">
                作品类型
              </label>
              <select
                name="type"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className={inputClass}
                disabled={!isOngoing || loading}
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 text-brand-text-secondary">
                开发年份
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
            {loading ? "提交中..." : existing ? "更新作品" : "提交作品"}
          </button>
        </div>
      )}

      {!isOngoing && (
        <div
          className="p-4 rounded-lg text-center text-sm bg-[#FFFDF7] border border-[#FFF3E0] text-brand-orange"
        >
          比赛尚未开始，开始后即可提交作品
        </div>
      )}
    </form>
  );
}
