"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { compressImage } from "@/lib/utils/imageCrop";
import MentionEditor from "@/components/ui/MentionEditor";

// ── 作品类型 ──
const PROJECT_TYPES = [
  { value: "IN_DEVELOPMENT", label: "开发阶段" },
  { value: "TRIAL_DEMO", label: "提供试玩" },
  { value: "MINI_GAME", label: "小游戏" },
  { value: "OFFICIAL_RELEASE", label: "正式上架" },
];

const ROLE_PRESETS = ["程序", "策划", "美术", "音效", "音乐", "测试", "宣发", "全栈"];
const LINK_LABEL_PRESETS = ["Steam", "itch.io", "官网", "百度网盘", "Google Drive", "GitHub", "B站"];

// ── 通用类型 ──
interface Tag { id: string; name: string; slug: string; group?: string | null; }

interface LinkEntry { label: string; url: string; }

interface SelectedMember {
  memberId?: string;
  userId?: string;
  externalName?: string;
  displayName: string;
  roles: string[];
}

interface ProjectImage { url: string; altText?: string; }

export interface ProjectFormData {
  title: string;
  subtitle?: string;
  description: string;
  type: string;
  developYear: number;
  coverImage?: string;
  tagIds: string[];
  customTags: string[];
  links: LinkEntry[];
  memberRoles: { memberId?: string; userId?: string; externalName?: string; roles: string[] }[];
  images?: ProjectImage[];
  awards?: string[];
}

export interface InitialData {
  title: string;
  slug?: string;
  subtitle: string;
  description: string;
  type: string;
  developYear: number;
  coverImage: string;
  tagIds: string[];
  links: LinkEntry[];
  memberRoles: SelectedMember[];
  images: ProjectImage[];
  awards?: string[];
}

export interface ProjectFormProps {
  mode: "create" | "edit";
  tags: Tag[];
  initialData?: InitialData;
  /** 项目的当前状态（编辑模式下用于判断是否显示"重新提交"） */
  projectStatus?: string;
  /** 编辑模式下的提交处理，传入数据和 slug 跳转路径 */
  onSubmit?: (data: ProjectFormData) => Promise<{ success: boolean; error?: string; slug?: string }>;
}

// ── 通用样式 ──
const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-shadow border-brand-border-subtle text-brand-text-heading";
const labelClass = "block text-sm font-medium mb-1.5 text-brand-text-body";

export default function ProjectForm({ mode, tags, initialData, projectStatus, onSubmit }: ProjectFormProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  // ── 表单状态 ──
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tagIds ?? []);
  const [links, setLinks] = useState<LinkEntry[]>(initialData?.links ?? []);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>(initialData?.memberRoles ?? []);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [awards, setAwards] = useState<string[]>(initialData?.awards ?? []);
  const [awardInput, setAwardInput] = useState("");

  // ── 截图 ──
  const [screenshots, setScreenshots] = useState<ProjectImage[]>(initialData?.images ?? []);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const screenshotFileRef = useRef<HTMLInputElement>(null);

  // ── 封面图 ──
  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.coverImage || null);
  const [coverUrl, setCoverUrl] = useState(initialData?.coverImage || "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const coverFileRef = useRef<HTMLInputElement>(null);

  // ── 成员搜索 ──
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 外部成员 ──
  const [externalName, setExternalName] = useState("");
  const [externalRole, setExternalRole] = useState("");

  // ── 链接 ──
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [showCustomRole, setShowCustomRole] = useState(false);

  const isEdit = mode === "edit";
  const isResubmit = isEdit && projectStatus === "REJECTED";
  const isReEdit = isEdit && projectStatus === "PUBLISHED";

  // ── 创建模式：默认填入当前登录用户（代投时用户可自行删除）──
  const autoAddedRef = useRef(false);
  const { data: sessionData } = useSession();
  useEffect(() => {
    if (mode !== "create") return;
    if (autoAddedRef.current) return;
    if (!sessionData?.user?.id) return;
    // 避免和 initialData 冲突（编辑模式不会走到这里）
    if (selectedMembers.length > 0) return;
    autoAddedRef.current = true;
    setSelectedMembers([{
      userId: sessionData.user.id,
      displayName: sessionData.user.name || sessionData.user.email || "我",
      roles: [],
    }]);
  }, [mode, sessionData?.user?.id]);

  // ── 成员搜索 ──
  const searchMembers = useCallback(async (q: string) => {
    try {
      const [memberRes, userRes] = await Promise.all([
        fetch(`/api/members/search?q=${encodeURIComponent(q)}`),
        fetch(`/api/users/search?q=${encodeURIComponent(q)}`),
      ]);
      let results: any[] = [];
      if (memberRes.ok) {
        const data = await memberRes.json();
        const members = (Array.isArray(data) ? data : data.data || []).map((m: any) => ({
          ...m, _type: "member" as const
        }));
        results.push(...members);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        const users = (Array.isArray(data) ? data : data.data || []).map((u: any) => ({
          id: u.id, displayName: u.name, image: u.image, _type: "user" as const
        }));
        // 过滤掉已经是社团成员的（避免与上面的结果重复）
        const memberIds = new Set(results.map((r: any) => r.id));
        results.push(...users.filter((u: any) => !memberIds.has(u.id)));
      }
      setMemberResults(results);
    } catch {}
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (memberQuery.length >= 1) {
      searchTimerRef.current = setTimeout(() => searchMembers(memberQuery), 200);
    } else {
      searchMembers("");
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

  function addMemberFromSearch(member: any) {
    const isUser = member._type === "user";
    const id = member.id;
    // 防止重复：memberId 和 userId 都检查
    if (selectedMembers.some((m) => (isUser ? m.userId === id : m.memberId === id))) return;
    const roles = [...selectedRoles];
    if (customRoleInput.trim()) roles.push(customRoleInput.trim());
    setSelectedMembers((prev) => [
      ...prev,
      isUser
        ? { userId: id, displayName: member.displayName, roles: roles.length > 0 ? roles : ["制作"] }
        : { memberId: id, displayName: member.displayName, roles: roles.length > 0 ? roles : ["制作"] },
    ]);
    setMemberQuery("");
    setSelectedRoles([]);
    setCustomRoleInput("");
    setShowCustomRole(false);
    setShowMemberDropdown(false);
    delete (memberDropdownRef.current as any).__selectedMember;
  }

  function addExternalMember() {
    const name = (memberQuery || externalName).trim();
    if (!name) return;
    const roles = [...selectedRoles];
    if (customRoleInput.trim()) roles.push(customRoleInput.trim());
    if (externalRole.trim()) roles.push(externalRole.trim());
    setSelectedMembers((prev) => [
      ...prev,
      { externalName: name, displayName: name, roles: roles.length > 0 ? roles : ["制作"] },
    ]);
    setMemberQuery("");
    setExternalName("");
    setSelectedRoles([]);
    setCustomRoleInput("");
    setExternalRole("");
    setShowCustomRole(false);
    setShowMemberDropdown(false);
    delete (memberDropdownRef.current as any).__selectedMember;
  }

  function removeMember(index: number) {
    setSelectedMembers((prev) => prev.filter((_, i) => i !== index));
  }

  // ── 截图 ──
  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotError("");
    setScreenshotUploading(true);
    try {
      const compressed = file.size > 300 * 1024
        ? await compressImage(file, 1920, 1080, 0.8)
        : file;
      const fd = new FormData();
      fd.append("file", compressed, compressed.name || file.name);
      fd.append("type", "screenshot");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      setScreenshots((prev) => [...prev, { url: json.url }]);
    } catch (err: any) {
      setScreenshotError(err.message || "上传失败");
    } finally {
      setScreenshotUploading(false);
      if (screenshotFileRef.current) screenshotFileRef.current.value = "";
    }
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
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

  // ── 标签 ──
  function toggleTag(tagId: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) return prev.filter((t) => t !== tagId);
      return [...prev, tagId];
    });
  }

  function addCustomTag() {
    const name = customTagInput.trim();
    if (!name) return;
    if (customTags.includes(name)) { setCustomTagInput(""); return; }
    setCustomTags((prev) => [...prev, name]);
    setCustomTagInput("");
  }

  function removeCustomTag(name: string) {
    setCustomTags((prev) => prev.filter((t) => t !== name));
  }

  // ── 提交 ──
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    setLoading(true);
    submittingRef.current = true;

    const form = new FormData(e.currentTarget);
    const data: ProjectFormData = {
      title: (form.get("title") as string) || "",
      subtitle: (form.get("subtitle") as string) || undefined,
      description: (form.get("description") as string) || "",
      type: (form.get("type") as string) || "",
      developYear: parseInt(form.get("developYear") as string) || new Date().getFullYear(),
      coverImage: coverUrl || undefined,
      tagIds: selectedTags,
      customTags,
      links,
      memberRoles: selectedMembers.map((m) => ({
        memberId: m.memberId || undefined,
        userId: m.userId || undefined,
        externalName: m.externalName || undefined,
        roles: m.roles,
      })),
      awards: awards.filter(Boolean),
      images: screenshots.length > 0 ? screenshots : undefined,
    };

    try {
      if (isEdit && onSubmit) {
        // 编辑模式：调用外部 onSubmit
        const result = await onSubmit(data);
        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error || "保存失败");
        }
      } else {
        // 创建模式：带重试的 fetch
        let res: Response | null = null;
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            res = await fetch("/api/projects/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (res.ok || res.status >= 400) break; // 非网络错误，直接处理
          } catch (e: any) {
            lastErr = e;
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        if (!res) {
          setError(`网络连接失败，已重试3次。${lastErr?.message || ""}`);
        } else {
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            setError(json?.error || `提交失败 (${res.status})`);
          } else {
            setSuccess(true);
            // 重置表单
            setCoverPreview(null);
            setCoverUrl("");
            setSelectedTags([]);
            setCustomTags([]);
            setLinks([]);
            setSelectedMembers([]);
            setScreenshots([]);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "提交失败");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // ── 成功状态 ──
  if (success) {
    return (
      <div className="animate-fade-in text-center py-16">
        <div className="text-5xl mb-4">{isReEdit ? "📝" : isResubmit ? "📤" : isEdit ? "✅" : "🎉"}</div>
        <h2 className="text-2xl font-bold mb-2 text-brand-navy">
          {isReEdit ? "已提交重新审核" : isResubmit ? "重新提交成功！" : isEdit ? "保存成功！" : "提交成功！"}
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          {isReEdit
            ? "你的作品已回到待审核状态，非成员将暂时无法查看。管理员审核通过后会重新公开。"
            : isResubmit
            ? "你的作品已重新提交审核，管理员会尽快处理。"
            : isEdit
            ? "作品信息已更新。"
            : "你的作品已提交审核，管理员会尽快处理。"}
        </p>
        {isEdit && initialData ? (
          <a href={`/works/${initialData.slug || initialData.title}`} className="btn-primary bg-brand-blue text-white px-6 py-2 rounded-lg text-sm inline-block">
            返回作品页
          </a>
        ) : (
          <button onClick={() => setSuccess(false)}
            className="px-6 py-2 rounded-lg text-sm text-white bg-brand-blue">
            继续提交
          </button>
        )}
      </div>
    );
  }

  // ── 奖项管理 ──
  function addAward() {
    const name = awardInput.trim();
    if (!name) return;
    if (awards.includes(name)) { setAwardInput(""); return; }
    setAwards(prev => [...prev, name]);
    setAwardInput("");
  }
  function removeAward(index: number) {
    setAwards(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
      {error && (
        <div className="p-3 rounded-lg text-sm whitespace-pre-line bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">
          {error}
        </div>
      )}

      {/* ═══════════════ 基本信息 ═══════════════ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-navy">📋 基本信息</h2>
        <div>
          <label className={labelClass}>作品名称 <span className="text-[var(--ui-text-red)]">*</span></label>
          <input name="title" type="text" required maxLength={200} defaultValue={initialData?.title}
            placeholder="给作品起个名字" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>副标题</label>
          <input name="subtitle" type="text" maxLength={300} defaultValue={initialData?.subtitle}
            placeholder="可选副标题" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>简介 <span className="text-[var(--ui-text-red)]">*</span></label>
          <MentionEditor name="description" defaultValue={initialData?.description || ""}
            placeholder="介绍一下这个作品（至少 10 字）" rows={4} required minLength={10} maxLength={10000}
            className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>作品类型 <span className="text-[var(--ui-text-red)]">*</span></label>
            <select name="type" required defaultValue={initialData?.type} className={inputClass}>
              <option value="">请选择类型</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>开发年份 <span className="text-[var(--ui-text-red)]">*</span></label>
            <input name="developYear" type="number" required min={2000} max={new Date().getFullYear() + 1}
              defaultValue={initialData?.developYear ?? new Date().getFullYear()}
              className={inputClass} />
          </div>
        </div>
      </section>

      {/* ═══════════════ 封面图 ═══════════════ */}

      {/* ═════════ 所获奖项 ═════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🏆 所获奖项</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input type="text" value={awardInput} onChange={(e) => setAwardInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAward(); } }}
              placeholder="输入奖项名称，如：最佳创意奖"
              className={inputClass} />
          </div>
          <button type="button" onClick={addAward} disabled={!awardInput.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all bg-brand-green text-white">添加</button>
        </div>
        {awards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {awards.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full text-amber-500 bg-amber-500/15">
                🏆 {a}
                <button type="button" onClick={() => removeAward(i)} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🖼️ 封面图</h2>
        <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCoverError("");
            setCoverUploading(true);
            try {
              // 本地预览（用原始文件）
              const previewUrl = URL.createObjectURL(file);
              setCoverPreview(previewUrl);
              // 压缩后上传
              const compressed = file.size > 300 * 1024
                ? await compressImage(file, 1920, 1080, 0.8)
                : file;
              const fd = new FormData();
              fd.append("file", compressed, compressed.name || file.name);
              const res = await fetch("/api/upload/cover", { method: "POST", body: fd });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || "上传失败");
              setCoverUrl(json.url);
            } catch (err: any) {
              setCoverError(err.message || "上传失败");
              setCoverPreview(null);
            } finally {
              setCoverUploading(false);
              if (coverFileRef.current) coverFileRef.current.value = "";
            }
          }} />
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {coverPreview ? (
              <img src={coverPreview} alt="封面预览" className="w-40 h-24 object-cover rounded-lg border border-brand-border-subtle" />
            ) : (
              <div className="w-40 h-24 flex items-center justify-center rounded-lg border border-dashed border-brand-border-subtle bg-brand-surface-page">
                <span className="text-xs text-brand-text-muted">暂无封面</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <button type="button" onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 bg-brand-blue">
              {coverUploading ? "上传中..." : coverPreview ? "更换封面" : "选择封面图"}
            </button>
            {coverPreview && <span className="text-xs ml-2 text-brand-green">✓ 已上传</span>}
            {coverError && <p className="text-xs text-brand-orange">{coverError}</p>}
          </div>
        </div>
      </section>

      {/* ═══════════════ 作品截图 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">📸 作品截图 ({screenshots.length}/3)</h2>
        <input ref={screenshotFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={handleScreenshotUpload} />
        {screenshots.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {screenshots.map((img, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-brand-border-subtle">
                <img src={img.url} alt={img.altText || `截图 ${i + 1}`} className="w-full aspect-video object-cover" />
                <button type="button" onClick={() => removeScreenshot(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  title="删除截图">×</button>
              </div>
            ))}
          </div>
        )}
        <div>
          <button type="button" onClick={() => screenshotFileRef.current?.click()}
            disabled={screenshotUploading || screenshots.length >= 3}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-all bg-brand-blue text-white">
            {screenshotUploading ? "上传中..." : screenshots.length >= 3 ? "已达到上限" : "+ 添加截图"}
          </button>
          {screenshotError && <p className="text-xs mt-1 text-brand-orange">{screenshotError}</p>}
          <p className="text-xs mt-1 text-brand-text-muted">最多 3 张，支持 JPG/PNG/WebP 格式</p>
        </div>
      </section>

      {/* ═══════════════ 制作成员 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">👥 制作成员</h2>

        {/* 统一添加行：姓名搜索 → 职位多选 → 添加按钮 */}
        <div className="flex flex-col gap-2" ref={memberDropdownRef}>
          <div className="relative">
            <input type="text" value={memberQuery}
              onChange={(e) => { setMemberQuery(e.target.value); setShowMemberDropdown(true); }}
              onFocus={() => setShowMemberDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addExternalMember(); }
              }}
              placeholder="搜索社团成员或输入外部成员姓名…"
              className={inputClass} />
            {showMemberDropdown && memberResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto border-brand-border-subtle">
                {memberResults.map((m: any) => (
                  <button key={m.id} type="button" onClick={() => {
                    setMemberQuery(m.displayName);
                    // 暂存选中的社团成员信息
                    (memberDropdownRef.current as any).__selectedMember = m;
                    setShowMemberDropdown(false);
                  }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ui-surface-alt2)] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs flex items-center justify-center flex-shrink-0">
                      {m.displayName.charAt(0)}
                    </span>
                    <span className="text-brand-text-heading">{m.displayName}</span>
                    <span className="text-xs ml-auto text-brand-text-muted">
                      {m.grade && `${m.grade}`}
                      {Array.isArray(m.skills) && m.skills.length > 0 && ` · ${m.skills.slice(0, 3).join("、")}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {ROLE_PRESETS.map((r) => {
                const active = selectedRoles.includes(r);
                return (
                  <button key={r} type="button" onClick={() => {
                    setSelectedRoles((prev) => active ? prev.filter((x) => x !== r) : [...prev, r]);
                  }}
                    className={`text-xs px-2 py-1 rounded-full border transition-all cursor-pointer ${active
                      ? "border-brand-green text-white bg-brand-green"
                      : "border-brand-border-subtle text-brand-text-muted bg-card hover:border-brand-green"}`}
                    >
                    {r}
                  </button>
                );
              })}
              {showCustomRole ? (
                <input type="text" value={customRoleInput} onChange={(e) => setCustomRoleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternalMember(); } }}
                  placeholder="自定义职位"                   className="text-xs px-2 py-1 rounded-full border w-28 focus:outline-none border-brand-green text-brand-text-heading" autoFocus />
              ) : (
                <button type="button" onClick={() => setShowCustomRole(true)}
                  className="text-xs px-2 py-1 rounded-full border border-dashed bg-card hover:border-brand-green transition-colors cursor-pointer border-brand-border-subtle text-brand-text-muted">+ 自定义</button>
              )}
            </div>
            <button type="button" onClick={() => {
              const m = (memberDropdownRef.current as any).__selectedMember;
              if (m) { addMemberFromSearch(m); } else { addExternalMember(); }
            }} disabled={!memberQuery.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all whitespace-nowrap bg-brand-green text-white">+ 添加</button>
          </div>
        </div>
        <p className="text-xs text-brand-text-muted">输入姓名搜索社团成员并选择，或直接输入外部成员姓名后点击添加</p>

        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedMembers.map((m, i) => {
              const isMember = !!m.memberId;
              const isUser = !!m.userId;
              const isExternal = !isMember && !isUser;
              return (
              <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                isMember
                  ? "bg-brand-navy/10 text-brand-navy"
                  : isUser
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "bg-brand-orange/10 text-brand-orange"
              }`}>
                {isMember
                  ? <span className="w-4 h-4 rounded-full bg-brand-orange text-white text-[10px] flex items-center justify-center">{m.displayName.charAt(0)}</span>
                  : isUser
                  ? <span className="w-4 h-4 rounded-full bg-brand-blue text-white text-[10px] flex items-center justify-center">{m.displayName.charAt(0)}</span>
                  : <span className="text-[10px] mr-0.5">👤</span>}
                {m.displayName}
                <span className="text-xs opacity-70">{m.roles.join("、")}</span>
                <button type="button" onClick={() => removeMember(i)} className="ml-0.5 hover:text-red-500" title="移除">×</button>
              </span>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══════════════ 外部链接 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🔗 外部链接</h2>
        <p className="text-xs text-brand-text-muted">添加作品相关链接（Steam、itch.io、官网、网盘等），可自由组合</p>
        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--ui-surface-alt2)] rounded-lg text-sm">
                <span className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-brand-navy text-white">{link.label}</span>
                <span className="truncate flex-1 text-brand-blue">{link.url}</span>
                <button type="button" onClick={() => removeLink(i)} className="text-xs flex-shrink-0 hover:text-red-500 text-brand-text-muted">移除</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          {!showCustomLabel ? (
            <select value={newLinkLabel} onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") { setShowCustomLabel(true); setNewLinkLabel(""); }
              else setNewLinkLabel(v);
            }} className={`${inputClass} w-36`}>
              <option value="">选择类型</option>
              {LINK_LABEL_PRESETS.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="__custom__">自定义...</option>
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                placeholder="链接标签" className={`${inputClass} w-36`} />
              <button type="button" onClick={() => { setShowCustomLabel(false); setNewLinkLabel(""); }}
                className="text-xs px-2 py-1.5 rounded hover:bg-muted whitespace-nowrap text-brand-blue">← 预设</button>
            </div>
          )}
          <input type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="https://..." className={`${inputClass} flex-1 min-w-[200px]`} />
          <button type="button" onClick={addLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all bg-brand-green text-white">添加</button>
        </div>
      </section>

      {/* ═══════════════ 标签 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🏷️ 标签</h2>
        {tags.length > 0 && (
          (() => {
            const grouped = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
              const key = tag.group || "其他";
              (acc[key] ??= []).push(tag);
              return acc;
            }, {});
            const groupOrder = ["引擎", "大类", "要素", "其他"];
            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              const ia = groupOrder.indexOf(a), ib = groupOrder.indexOf(b);
              if (ia === -1 && ib === -1) return a.localeCompare(b);
              if (ia === -1) return 1; if (ib === -1) return -1;
              return ia - ib;
            });
            // 全未分组 → 平铺
            if (sortedKeys.length === 1 && sortedKeys[0] === "其他") {
              return (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${active ? "ring-2 ring-offset-1 ring-brand-green" : "opacity-60 hover:opacity-100"} bg-brand-green/15 text-brand-green`}
                        >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {sortedKeys.map((group) => (
                  <div key={group}>
                    <h3 className="text-xs font-medium mb-1.5 text-brand-text-muted">{group}</h3>
                    <div className="flex flex-wrap gap-2">
                      {grouped[group].map((tag) => {
                        const active = selectedTags.includes(tag.id);
                        return (
                          <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${active ? "ring-2 ring-offset-1 ring-brand-green" : "opacity-60 hover:opacity-100"} text-brand-green ${active ? "bg-brand-green/15" : "bg-brand-green/10"}`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
        {customTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customTags.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-brand-orange/15 text-brand-orange">
                {name}
                <button type="button" onClick={() => removeCustomTag(name)} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
            placeholder="输入自定义标签，回车添加" className={`${inputClass} max-w-xs`} />
          <button type="button" onClick={addCustomTag} disabled={!customTagInput.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 bg-brand-orange text-white">添加</button>
        </div>
      </section>

      {/* ═══════════════ 提交 ═══════════════ */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue">
          {loading
            ? (isResubmit ? "重新提交中..." : isEdit ? "保存中..." : "提交中...")
            : (isResubmit ? "重新提交" : isEdit ? "保存修改" : "提交作品")}
        </button>
        {isEdit && initialData ? (
          <a href={`/works/${initialData.slug || initialData.title}`} className="text-sm text-brand-text-muted">取消</a>
        ) : (
          <span className="text-xs text-brand-text-muted">{isResubmit ? "重新提交审核，管理员将通过或驳回" : "提交后状态为\"待审核\"，管理员通过后即可公开展示"}</span>
        )}
      </div>
    </form>
  );
}
