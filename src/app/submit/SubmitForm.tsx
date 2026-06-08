"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { submitProject } from "./actions";
import Cropper from "react-easy-crop";
import { getCroppedImg, readFileAsDataURL } from "@/lib/utils/imageCrop";

// ── 简化后的作品类型 ──
const PROJECT_TYPES = [
  { value: "DEMO", label: "Demo 演示" },
  { value: "STEAM", label: "Steam 发布" },
  { value: "ITCH", label: "itch.io 发布" },
  { value: "OTHER", label: "其他" },
];

// ── 常用链接标签预设 ──
const LINK_LABEL_PRESETS = ["Steam", "itch.io", "官网", "百度网盘", "Google Drive", "GitHub", "B站"];

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface MemberResult {
  id: string;
  displayName: string;
  avatar: string | null;
  grade: string | null;
  joinYear: number;
  skills: string[];
}

interface SelectedMember {
  memberId: string;
  displayName: string;
  role: string;
}

interface LinkEntry {
  label: string;
  url: string;
}

interface Props {
  tags: Tag[];
}

// ── 通用样式 ──
const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent transition-shadow";
const inputStyle = { borderColor: "#D0DEE8", color: "#333" };
const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: "#555" };

export default function SubmitForm({ tags }: Props) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const coverFileRef = useRef<HTMLInputElement>(null);

  // 裁剪状态
  const [showCoverCrop, setShowCoverCrop] = useState(false);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCropped, setCoverCropped] = useState<any>(null);

  // ── 成员搜索 ──
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [memberRole, setMemberRole] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 动态链接 ──
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showCustomLabel, setShowCustomLabel] = useState(false);

  // ── 自定义标签 ──
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // ── 成员搜索 ──
  const searchMembers = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setMemberResults(Array.isArray(data) ? data : data.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (memberQuery.length >= 1) {
      searchTimerRef.current = setTimeout(() => searchMembers(memberQuery), 200);
    } else {
      searchMembers(""); // 空查询返回最近活跃成员
    }
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [memberQuery, searchMembers]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addMember(member: MemberResult) {
    if (selectedMembers.some((m) => m.memberId === member.id)) return;
    setSelectedMembers((prev) => [
      ...prev,
      { memberId: member.id, displayName: member.displayName, role: memberRole || "成员" },
    ]);
    setMemberQuery("");
    setMemberRole("");
    setShowMemberDropdown(false);
  }

  function removeMember(memberId: string) {
    setSelectedMembers((prev) => prev.filter((m) => m.memberId !== memberId));
  }

  function updateMemberRole(memberId: string, role: string) {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.memberId === memberId ? { ...m, role } : m))
    );
  }

  // ── 链接 ──
  function addLink() {
    const label = newLinkLabel.trim();
    const url = newLinkUrl.trim();
    if (!label || !url) return;
    setLinks((prev) => [...prev, { label, url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
    setShowCustomLabel(false);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  // ── 自定义标签 ──
  function addCustomTag() {
    const name = customTagInput.trim();
    if (!name) return;
    if (customTags.includes(name)) {
      setCustomTagInput("");
      return;
    }
    setCustomTags((prev) => [...prev, name]);
    setCustomTagInput("");
  }

  function removeCustomTag(name: string) {
    setCustomTags((prev) => prev.filter((t) => t !== name));
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  // ── 提交 ──
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    form.set("tagIds", selectedTags.join(","));
    form.set("coverImage", coverUrl);
    form.set("customTags", JSON.stringify(customTags));
    form.set("links", JSON.stringify(links));
    form.set("memberRoles", JSON.stringify(selectedMembers.map((m) => ({ memberId: m.memberId, role: m.role }))));

    const result = await submitProject(form);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setCoverPreview(null);
      setCoverUrl("");
      setSelectedTags([]);
      setCustomTags([]);
      setLinks([]);
      setSelectedMembers([]);
    } else {
      setError(result.error || "提交失败");
    }
  }

  if (success) {
    return (
      <div className="animate-fade-in text-center py-16">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "#25547A" }}>
          提交成功！
        </h2>
        <p className="mb-6" style={{ color: "#777" }}>
          你的作品已提交审核，管理员会尽快处理。
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="btn-primary px-6 py-2 rounded-lg text-sm"
        >
          继续提交
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: "#FDE8E8", color: "#C62828" }}
        >
          {error}
        </div>
      )}

      {/* ═══════════════ 基本信息 ═══════════════ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          📋 基本信息
        </h2>

        <div>
          <label className={labelClass} style={labelStyle}>
            作品名称 <span style={{ color: "#C62828" }}>*</span>
          </label>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="给作品起个名字"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            副标题
          </label>
          <input
            name="subtitle"
            type="text"
            maxLength={300}
            placeholder="可选副标题"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            简介 <span style={{ color: "#C62828" }}>*</span>
          </label>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={10000}
            rows={4}
            placeholder="介绍一下这个作品（至少 10 字）"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>
              作品类型 <span style={{ color: "#C62828" }}>*</span>
            </label>
            <select
              name="type"
              required
              className={inputClass}
              style={inputStyle}
            >
              <option value="">请选择类型</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              开发年份 <span style={{ color: "#C62828" }}>*</span>
            </label>
            <input
              name="developYear"
              type="number"
              required
              min={2000}
              max={new Date().getFullYear() + 1}
              defaultValue={new Date().getFullYear()}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ 封面图 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          🖼️ 封面图
        </h2>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCoverError("");
            // 先打开裁剪器，选择裁剪区域
            const src = await readFileAsDataURL(file);
            setCoverCropSrc(src);
            setCoverCrop({ x: 0, y: 0 });
            setCoverZoom(1);
            setShowCoverCrop(true);
            if (coverFileRef.current) coverFileRef.current.value = "";
          }}
        />
        {/* ── 封面裁剪弹窗 ── */}
        {showCoverCrop && coverCropSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCoverCrop(false)}>
            <div className="bg-white rounded-xl p-6 w-[90vw] max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold mb-3" style={{ color: "#25547A" }}>裁剪封面</h3>
              <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ height: 320 }}>
                <Cropper
                  image={coverCropSrc}
                  crop={coverCrop}
                  zoom={coverZoom}
                  aspect={16 / 9}
                  onCropChange={setCoverCrop}
                  onZoomChange={setCoverZoom}
                  onCropComplete={(_, area) => setCoverCropped(area)}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" className="px-4 py-2 rounded-lg text-sm" style={{ color: "#777", border: "1px solid #D0DEE8" }}
                  onClick={() => { setShowCoverCrop(false); setCoverCropSrc(null); }}>
                  取消
                </button>
                <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#3388BB" }}
                  onClick={async () => {
                    if (!coverCropSrc) return;
                    setShowCoverCrop(false);
                    setCoverUploading(true);
                    try {
                      const { file: croppedFile, url: previewUrl } = await getCroppedImg(coverCropSrc, coverCropped);
                      setCoverPreview(previewUrl);
                      const fd = new FormData();
                      fd.append("file", croppedFile);
                      const res = await fetch("/api/upload/cover", { method: "POST", body: fd });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "上传失败");
                      setCoverUrl(json.url);
                    } catch (err: any) {
                      setCoverError(err.message || "上传失败");
                      setCoverPreview(null);
                    } finally {
                      setCoverUploading(false);
                      setCoverCropSrc(null);
                    }
                  }}>
                  确认裁剪
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {coverPreview ? (
              <img
                src={coverPreview}
                alt="封面预览"
                className="w-40 h-24 object-cover rounded-lg border"
                style={{ borderColor: "#D0DEE8" }}
              />
            ) : (
              <div
                className="w-40 h-24 flex items-center justify-center rounded-lg border border-dashed"
                style={{ borderColor: "#D0DEE8", background: "#F0F5F9" }}
              >
                <span className="text-xs" style={{ color: "#999" }}>暂无封面</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              disabled={coverUploading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#3388BB" }}
            >
              {coverUploading ? "上传中..." : coverPreview ? "更换封面" : "选择封面图"}
            </button>
            {coverPreview && (
              <span className="text-xs ml-2" style={{ color: "#88C232" }}>✓ 已上传</span>
            )}
            {coverError && (
              <p className="text-xs" style={{ color: "#E38043" }}>{coverError}</p>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ 制作成员 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          👥 制作成员
        </h2>
        <p className="text-xs" style={{ color: "#999" }}>
          搜索并添加参与制作的社团成员（你本人自动为提交者，无需在此添加自己）
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2" ref={memberDropdownRef}>
          <div className="relative">
            <input
              type="text"
              value={memberQuery}
              onChange={(e) => { setMemberQuery(e.target.value); setShowMemberDropdown(true); }}
              onFocus={() => setShowMemberDropdown(true)}
              placeholder="搜索成员姓名..."
              className={inputClass}
              style={inputStyle}
            />
            {showMemberDropdown && memberResults.length > 0 && (
              <div
                className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                style={{ borderColor: "#D0DEE8" }}
              >
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMember(m)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F0F5F9] flex items-center gap-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#E38043] text-white text-xs flex items-center justify-center flex-shrink-0">
                      {m.displayName.charAt(0)}
                    </span>
                    <span style={{ color: "#333" }}>{m.displayName}</span>
                    <span className="text-xs ml-auto" style={{ color: "#999" }}>
                      {m.grade || ""}{Array.isArray(m.skills) && m.skills.length > 0 && ` · ${m.skills.slice(0, 3).join("、")}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); } }}
            placeholder="角色，如: 主程序"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedMembers.map((m) => (
              <span
                key={m.memberId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: "rgba(37,84,122,0.1)", color: "#25547A" }}
              >
                {m.displayName}
                <input
                  type="text"
                  value={m.role}
                  onChange={(e) => updateMemberRole(m.memberId, e.target.value)}
                  className="w-16 bg-transparent border-b border-dashed text-xs px-1 focus:outline-none"
                  style={{ borderColor: "#25547A", color: "#25547A" }}
                />
                <button
                  type="button"
                  onClick={() => removeMember(m.memberId)}
                  className="ml-0.5 hover:text-red-500"
                  title="移除"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════ 外部链接 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          🔗 外部链接
        </h2>
        <p className="text-xs" style={{ color: "#999" }}>
          添加作品相关链接（Steam、itch.io、官网、网盘等），可自由组合
        </p>

        {/* 已有链接列表 */}
        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-[#F0F5F9] rounded-lg text-sm"
              >
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                  style={{ background: "#25547A", color: "#fff" }}
                >
                  {link.label}
                </span>
                <span className="truncate flex-1" style={{ color: "#3388BB" }}>
                  {link.url}
                </span>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="text-xs flex-shrink-0 hover:text-red-500"
                  style={{ color: "#999" }}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 添加链接 */}
        <div className="flex flex-wrap items-end gap-2">
          {!showCustomLabel ? (
            <select
              value={newLinkLabel}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") { setShowCustomLabel(true); setNewLinkLabel(""); }
                else setNewLinkLabel(v);
              }}
              className={`${inputClass} w-36`}
              style={inputStyle}
            >
              <option value="">选择类型</option>
              {LINK_LABEL_PRESETS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value="__custom__">自定义...</option>
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addLink(); }
                }}
                placeholder="链接标签"
                className={`${inputClass} w-36`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => { setShowCustomLabel(false); setNewLinkLabel(""); }}
                className="text-xs px-2 py-1.5 rounded hover:bg-gray-100 whitespace-nowrap"
                style={{ color: "#3388BB" }}
              >
                ← 预设
              </button>
            </div>
          )}
          <input
            type="url"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addLink(); }
            }}
            placeholder="https://..."
            className={`${inputClass} flex-1 min-w-[200px]`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
            style={{ background: "#88C232", color: "#fff" }}
          >
            添加
          </button>
        </div>
      </section>

      {/* ═══════════════ 标签 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          🏷️ 标签
        </h2>

        {/* 已有标签 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    active
                      ? "ring-2 ring-offset-1"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: active
                      ? "rgba(136,194,50,0.15)"
                      : "rgba(136,194,50,0.08)",
                    color: "#88C232",
                    ...(active ? { ringColor: "#88C232", ringOffsetColor: "#F0F5F9" } : {}),
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* 自定义标签 */}
        {customTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customTags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
                style={{ background: "rgba(227,128,67,0.15)", color: "#E38043" }}
              >
                {name}
                <button type="button" onClick={() => removeCustomTag(name)} className="hover:text-red-500">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
            }}
            placeholder="输入自定义标签，回车添加"
            className={`${inputClass} max-w-xs`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customTagInput.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: "#E38043", color: "#fff" }}
          >
            添加
          </button>
        </div>
      </section>

      {/* ═══════════════ 提交 ═══════════════ */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "提交中..." : "提交作品"}
        </button>
        <span className="text-xs" style={{ color: "#999" }}>
          提交后状态为"待审核"，管理员通过后即可公开展示
        </span>
      </div>
    </form>
  );
}
