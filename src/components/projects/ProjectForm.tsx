"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLang } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/dict";
import MentionEditor from "@/components/ui/MentionEditor";
import EngineTagIcon from "@/components/tags/EngineTagIcon";
import EventTagIcon from "@/components/tags/EventTagIcon";
import TrophyIcon from "@/components/icons/TrophyIcon";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import {
  uploadImage,
  ACCEPT_ATTR,
  assertImageFile,
  compressionNote,
} from "@/lib/utils/clientUpload";
import { getEngineChipClass, getEngineColor, isEngineTagSlug, sortTagsEngineFirst } from "@/lib/tags/engine-tags";
import { getEventChipClass, getEventColor, isEventTagSlug } from "@/lib/tags/event-tags";
import { tagDisplayName, tagGroupDisplayName } from "@/lib/tags/tag-names";

// ── 作品类型 ──
const PROJECT_TYPES = ["IN_DEVELOPMENT", "TRIAL_DEMO", "MINI_GAME", "OFFICIAL_RELEASE"] as const;
const PROJECT_TYPE_LABELS: Record<(typeof PROJECT_TYPES)[number], DictKey> = {
  IN_DEVELOPMENT: "work.status.IN_DEVELOPMENT",
  TRIAL_DEMO: "work.status.TRIAL_DEMO",
  MINI_GAME: "work.status.MINI_GAME",
  OFFICIAL_RELEASE: "work.status.OFFICIAL_RELEASE",
};

const ROLE_PRESETS: [string, DictKey][] = [
  ["程序", "form.role.program"],
  ["策划", "form.role.design"],
  ["美术", "form.role.art"],
  ["音效", "form.role.sound"],
  ["音乐", "form.role.music"],
  ["测试", "form.role.test"],
  ["宣发", "form.role.pr"],
  ["全栈", "form.role.fullstack"],
];

const ROLE_LABELS: Record<string, DictKey> = {
  "程序": "form.role.program",
  "策划": "form.role.design",
  "美术": "form.role.art",
  "音效": "form.role.sound",
  "音乐": "form.role.music",
  "测试": "form.role.test",
  "宣发": "form.role.pr",
  "全栈": "form.role.fullstack",
  "制作": "form.role.production",
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

// ── 通用类型 ──
interface Tag { id: string; name: string; slug: string; group?: string | null; color?: string | null; sortOrder?: number; }

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
  aiUsages?: string[];
  platforms?: string[];
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
  aiUsages?: string[];
  platforms?: string[];
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
  const { t, lang } = useLang();
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
  const [selectedAiUsages, setSelectedAiUsages] = useState<string[]>(initialData?.aiUsages ?? []);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialData?.platforms ?? []);

  // ── 截图 ──
  const [screenshots, setScreenshots] = useState<ProjectImage[]>(initialData?.images ?? []);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const [screenshotNote, setScreenshotNote] = useState("");
  const screenshotFileRef = useRef<HTMLInputElement>(null);

  // ── 封面图 ──
  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.coverImage || null);
  const [coverUrl, setCoverUrl] = useState(initialData?.coverImage || "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const coverFileRef = useRef<HTMLInputElement>(null);

  // ── 成员搜索 ──
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberSearchRequestRef = useRef(0);

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

  const localizedRole = (r: string) => (ROLE_LABELS[r] ? t(ROLE_LABELS[r]) : r);
  const joinRoles = (roles: string[]) => roles.map(localizedRole).join(lang === "en" ? ", " : "、");

  const groupLabel = (g: string) => tagGroupDisplayName(g, lang);

  // ── 创建模式：搜索框预填当前用户名，用户选择角色后点击「+ 添加」即可加入 ──
  const namePrefilledRef = useRef(false);
  const { data: sessionData } = useSession();
  useEffect(() => {
    if (mode !== "create") return;
    if (namePrefilledRef.current) return;
    if (!sessionData?.user?.id) return;
    const displayName = sessionData.user.name || sessionData.user.email || "";
    if (!displayName) return;
    namePrefilledRef.current = true;
    setMemberQuery(displayName);
    // 预设当前用户，之后点击「+ 添加」时 addMemberFromSearch 会读取
    (memberDropdownRef.current as any).__selectedMember = {
      id: sessionData.user.id,
      displayName,
      _type: "user",
    };
  }, [mode, sessionData?.user?.id]);

  // ── 成员搜索 ──
  const searchMembers = useCallback(async (q: string) => {
    const requestId = ++memberSearchRequestRef.current;
    try {
      const [memberRes, userRes] = await Promise.all([
        fetch(`/api/members/search?q=${encodeURIComponent(q)}`),
        fetch(`/api/users/search?q=${encodeURIComponent(q)}`),
      ]);
      const results: any[] = [];
      if (memberRes.ok) {
        const data = await memberRes.json();
        const members = (Array.isArray(data) ? data : data.data || []).map((m: any) => ({
          ...m, _type: "member" as const
        }));
        results.push(...members);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        const users = (Array.isArray(data) ? data : data.data || []).map((u: any) =>
          u.member
            ? { id: u.member.id, userId: u.id, displayName: u.member.displayName, avatar: u.image, _type: "member" as const }
            : { id: u.id, displayName: u.name, image: u.image, _type: "user" as const },
        );
        results.push(...users);
      }
      // 两个接口统一用 ClubMember.id 识别社团成员；同名的不同人仍各自保留。
      const seen = new Set<string>();
      const unique = results.filter((item: any) => {
        const key = `${item._type}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (requestId === memberSearchRequestRef.current) setMemberResults(unique);
    } catch {
      if (requestId === memberSearchRequestRef.current) setMemberResults([]);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    memberSearchRequestRef.current += 1;
    setMemberResults([]);
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
    if (selectedMembers.some((m) =>
      (isUser ? m.userId === id : m.memberId === id) ||
      (!!member.userId && m.userId === member.userId)
    )) return;
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

  // ── 封面 ──
  async function handleCoverFile(file: File | undefined) {
    if (!file) return;
    setCoverError("");
    setCoverNote("");
    try {
      await assertImageFile(file, lang);
    } catch (err: any) {
      setCoverError(err.message);
      return;
    }
    setCoverUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setCoverPreview(previewUrl);
      const result = await uploadImage(file, {
        endpoint: "/api/upload/cover",
        type: "cover",
        lang,
      });
      setCoverUrl(result.url);
      setCoverNote(compressionNote(result, lang));
    } catch (err: any) {
      setCoverError(err.message || t("form.uploadFailed"));
      setCoverPreview(null);
    } finally {
      setCoverUploading(false);
      if (coverFileRef.current) coverFileRef.current.value = "";
    }
  }

  // ── 截图 ──
  async function handleScreenshotFile(file: File | undefined) {
    if (!file) return;
    if (screenshots.length >= 3) return;
    setScreenshotError("");
    setScreenshotNote("");
    try {
      await assertImageFile(file, lang);
    } catch (err: any) {
      setScreenshotError(err.message);
      return;
    }
    setScreenshotUploading(true);
    try {
      const result = await uploadImage(file, {
        endpoint: "/api/upload",
        type: "screenshot",
        lang,
      });
      setScreenshots((prev) => [...prev, { url: result.url }]);
      setScreenshotNote(compressionNote(result, lang));
    } catch (err: any) {
      setScreenshotError(err.message || t("form.uploadFailed"));
    } finally {
      setScreenshotUploading(false);
      if (screenshotFileRef.current) screenshotFileRef.current.value = "";
    }
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }

  const screenshotDragFrom = useRef<number | null>(null);
  const [screenshotDragOver, setScreenshotDragOver] = useState<number | null>(null);

  function moveScreenshot(from: number, to: number) {
    if (from === to) return;
    setScreenshots((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
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
      aiUsages: selectedAiUsages,
      platforms: selectedPlatforms,
      images: screenshots.length > 0 ? screenshots : undefined,
    };

    try {
      if (isEdit && onSubmit) {
        // 编辑模式：调用外部 onSubmit
        const result = await onSubmit(data);
        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error || t("works.edit.saveFail"));
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
          setError(t("works.edit.networkFail") + (lastErr?.message || ""));
        } else {
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            setError(json?.error || `${t("submit.fail")} (${res.status})`);
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
      setError(err.message || t("submit.fail"));
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
          {isReEdit ? t("form.successReEdit") : isResubmit ? t("form.successResubmit") : isEdit ? t("form.successSaved") : t("form.successSubmitted")}
        </h2>
        <p className="mb-6 text-brand-text-secondary">
          {isReEdit
            ? t("form.successReEditDesc")
            : isResubmit
            ? t("form.successResubmitDesc")
            : isEdit
            ? t("form.successSavedDesc")
            : t("form.successSubmittedDesc")}
        </p>
        {isEdit && initialData ? (
          <a href={`/works/${initialData.slug || initialData.title}`} className="btn-primary bg-brand-blue text-white px-6 py-2 rounded-lg text-sm inline-block">
            {t("form.backToWork")}
          </a>
        ) : (
          <button onClick={() => setSuccess(false)}
            className="px-6 py-2 rounded-lg text-sm text-white bg-brand-blue">
            {t("form.continueSubmit")}
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
        <h2 className="text-lg font-semibold text-brand-navy">📋 {t("form.basicInfo")}</h2>
        <div>
          <label className={labelClass}>{t("form.workName")} <span className="text-[var(--ui-text-red)]">*</span></label>
          <input name="title" type="text" required maxLength={200} defaultValue={initialData?.title}
            placeholder={t("form.titlePlaceholder")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t("form.subtitle")}</label>
          <input name="subtitle" type="text" maxLength={300} defaultValue={initialData?.subtitle}
            placeholder={t("form.subtitlePlaceholder")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t("form.intro")} <span className="text-[var(--ui-text-red)]">*</span></label>
          <MentionEditor name="description" defaultValue={initialData?.description || ""}
            placeholder={t("form.descPlaceholder")} rows={4} required minLength={10} maxLength={10000}
            className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("form.workType")} <span className="text-[var(--ui-text-red)]">*</span></label>
            <select name="type" required defaultValue={initialData?.type} className={inputClass}>
              <option value="">{t("form.selectType")}</option>
              {PROJECT_TYPES.map((v) => (
                <option key={v} value={v}>{t(PROJECT_TYPE_LABELS[v])}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("form.devYear")} <span className="text-[var(--ui-text-red)]">*</span></label>
            <input name="developYear" type="number" required min={2000} max={new Date().getFullYear() + 1}
              defaultValue={initialData?.developYear ?? new Date().getFullYear()}
              className={inputClass} />
          </div>
        </div>
      </section>

      {/* ═══════════════ 封面图 ═══════════════ */}

      {/* ═════════ 所获奖项 ═════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy"><TrophyIcon size={18} className="mr-1.5 align-[-0.18em]" />{t("form.awards")}</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input type="text" value={awardInput} onChange={(e) => setAwardInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAward(); } }}
              placeholder={t("form.awardPlaceholder")}
              className={inputClass} />
          </div>
          <button type="button" onClick={addAward} disabled={!awardInput.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all bg-brand-green text-white">{t("profile.edit.add")}</button>
        </div>
        {awards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {awards.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full text-amber-500 bg-amber-500/15">
                <TrophyIcon size={13} />
                {a}
                <button type="button" onClick={() => removeAward(i)} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ═════════ AI 使用声明 ═════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🤖 {t("form.aiDeclare")}</h2>
        <p className="text-xs text-brand-text-muted">{t("form.aiHint")}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "AI_GENERATED", label: "form.aiGenerated", desc: "form.aiGeneratedDesc" },
            { value: "AI_ART", label: "form.aiArt", desc: "form.aiArtDesc" },
            { value: "AI_MUSIC", label: "form.aiMusic", desc: "form.aiMusicDesc" },
          ].map((item) => {
            const active = selectedAiUsages.includes(item.value);
            return (
              <button key={item.value} type="button"
                onClick={() => setSelectedAiUsages(prev =>
                  prev.includes(item.value) ? prev.filter(v => v !== item.value) : [...prev, item.value]
                )}
                className={`text-sm px-3 py-2 rounded-lg border transition-all cursor-pointer text-left ${
                  active
                    ? "border-brand-purple bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple"
                    : "border-brand-border-subtle hover:border-brand-purple/40 text-brand-text-secondary"
                }`}
              >
                <div className="font-medium">{t(item.label as DictKey)}</div>
                <div className="text-xs mt-0.5 opacity-75">{t(item.desc as DictKey)}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═════════ 支持平台 ═════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">💻 {t("form.platforms")}</h2>
        <p className="text-xs text-brand-text-muted">{t("form.platformsHint")}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "WINDOWS", label: "Windows" },
            { value: "MAC", label: "macOS" },
            { value: "LINUX", label: "Linux" },
            { value: "ANDROID", label: "Android" },
            { value: "IOS", label: "iOS" },
            { value: "WEB", label: "Web" },
          ].map((item) => {
            const active = selectedPlatforms.includes(item.value);
            return (
              <button key={item.value} type="button"
                onClick={() => setSelectedPlatforms(prev =>
                  prev.includes(item.value) ? prev.filter(v => v !== item.value) : [...prev, item.value]
                )}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all cursor-pointer ${
                  active
                    ? "border-brand-blue bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue font-medium"
                    : "border-brand-border-subtle hover:border-brand-blue/40 text-brand-text-secondary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🖼️ {t("form.coverImage")}</h2>
        <input ref={coverFileRef} type="file" accept={ACCEPT_ATTR} className="hidden"
          onChange={(e) => void handleCoverFile(e.target.files?.[0])} />
        <ImageDropZone
          hint={t("form.dropCover")}
          disabled={coverUploading}
          onFile={(file) => handleCoverFile(file)}
          onInvalid={(msg) => setCoverError(msg)}
          className="rounded-xl p-1"
        >
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {coverPreview ? (
              <img src={coverPreview} alt={t("form.coverPreviewAlt")} className="w-40 h-24 object-cover rounded-lg border border-brand-border-subtle" />
            ) : (
              <div className="w-40 h-24 flex items-center justify-center rounded-lg border border-dashed border-brand-border-subtle bg-brand-surface-page">
                <span className="text-xs text-brand-text-muted">{t("form.noCover")}</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <button type="button" onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 bg-brand-blue">
              {coverUploading ? t("form.uploading") : coverPreview ? t("form.changeCover") : t("form.selectCover")}
            </button>
            {coverPreview && <span className="text-xs ml-2 text-brand-green">{t("form.uploaded")}</span>}
            <p className="text-xs text-brand-text-muted">{t("form.dragHint")}</p>
            {coverNote && <p className="text-xs text-brand-text-muted">{coverNote}</p>}
            {coverError && <p className="text-xs text-brand-orange">{coverError}</p>}
          </div>
        </div>
        </ImageDropZone>
      </section>

      {/* ═══════════════ 作品截图 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">📸 {t("form.screenshots")} ({screenshots.length}/3)</h2>
        <input ref={screenshotFileRef} type="file" accept={ACCEPT_ATTR} className="hidden"
          onChange={(e) => void handleScreenshotFile(e.target.files?.[0])} />
        <ImageDropZone
          hint={t("form.dropScreenshot")}
          disabled={screenshotUploading || screenshots.length >= 3}
          onFile={(file) => handleScreenshotFile(file)}
          onInvalid={(msg) => setScreenshotError(msg)}
          className="rounded-xl p-1"
        >
        {screenshots.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {screenshots.map((img, i) => (
              <div
                key={`${img.url}-${i}`}
                draggable
                onDragStart={(e) => {
                  screenshotDragFrom.current = i;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                  e.stopPropagation();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (screenshotDragOver !== i) setScreenshotDragOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const from = screenshotDragFrom.current;
                  screenshotDragFrom.current = null;
                  setScreenshotDragOver(null);
                  if (from == null) return;
                  moveScreenshot(from, i);
                }}
                onDragEnd={() => {
                  screenshotDragFrom.current = null;
                  setScreenshotDragOver(null);
                }}
                className={`relative group rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing ${
                  screenshotDragOver === i
                    ? "border-brand-blue ring-1 ring-brand-blue"
                    : "border-brand-border-subtle"
                }`}
              >
                <img src={img.url} alt={img.altText || t("form.screenshotAlt", { n: i + 1 })} className="w-full aspect-video object-cover pointer-events-none" />
                <button type="button" onClick={() => removeScreenshot(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  title={t("form.deleteScreenshot")}>×</button>
              </div>
            ))}
          </div>
        )}
        <div>
          <button type="button" onClick={() => screenshotFileRef.current?.click()}
            disabled={screenshotUploading || screenshots.length >= 3}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-all bg-brand-blue text-white">
            {screenshotUploading ? t("form.uploading") : screenshots.length >= 3 ? t("form.maxReached") : t("form.addScreenshot")}
          </button>
          {screenshotError && <p className="text-xs mt-1 text-brand-orange">{screenshotError}</p>}
          {screenshotNote && <p className="text-xs mt-1 text-brand-text-muted">{screenshotNote}</p>}
          <p className="text-xs mt-1 text-brand-text-muted">{t("form.screenshotLimit")}</p>
          {screenshots.length > 1 && (
            <p className="text-xs mt-1 text-brand-text-muted">{t("form.screenshotReorder")}</p>
          )}
        </div>
        </ImageDropZone>
      </section>

      {/* ═══════════════ 制作成员 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">👥 {t("form.members")}</h2>

        {/* 统一添加行：姓名搜索 → 职位多选 → 添加按钮 */}
        <div className="flex flex-col gap-2" ref={memberDropdownRef}>
          <div className="relative">
            <input type="text" value={memberQuery}
              onChange={(e) => {
                delete (memberDropdownRef.current as any).__selectedMember;
                setMemberQuery(e.target.value);
                setShowMemberDropdown(true);
              }}
              onFocus={() => setShowMemberDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addExternalMember(); }
              }}
              placeholder={t("form.memberSearchPlaceholder")}
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
                      {Array.isArray(m.skills) && m.skills.length > 0 && ` · ${m.skills.slice(0, 3).join(lang === "en" ? ", " : "、")}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {ROLE_PRESETS.map(([val, key]) => {
                const active = selectedRoles.includes(val);
                return (
                  <button key={val} type="button" onClick={() => {
                    setSelectedRoles((prev) => active ? prev.filter((x) => x !== val) : [...prev, val]);
                  }}
                    className={`text-xs px-2 py-1 rounded-full border transition-all cursor-pointer ${active
                      ? "border-brand-green text-white bg-brand-green"
                      : "border-brand-border-subtle text-brand-text-muted bg-card hover:border-brand-green"}`}
                    >
                    {t(key)}
                  </button>
                );
              })}
              {showCustomRole ? (
                <input type="text" value={customRoleInput} onChange={(e) => setCustomRoleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternalMember(); } }}
                  placeholder={t("form.customRolePlaceholder")}                   className="text-xs px-2 py-1 rounded-full border w-28 focus:outline-none border-brand-green text-brand-text-heading" autoFocus />
              ) : (
                <button type="button" onClick={() => setShowCustomRole(true)}
                  className="text-xs px-2 py-1 rounded-full border border-dashed bg-card hover:border-brand-green transition-colors cursor-pointer border-brand-border-subtle text-brand-text-muted">{t("form.addCustom")}</button>
              )}
            </div>
            <button type="button" onClick={() => {
              const m = (memberDropdownRef.current as any).__selectedMember;
              if (m) { addMemberFromSearch(m); } else { addExternalMember(); }
            }} disabled={!memberQuery.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all whitespace-nowrap bg-brand-green text-white">{t("profile.edit.add")}</button>
          </div>
        </div>
        <p className="text-xs text-brand-text-muted">{t("form.memberHint")}</p>

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
                <span className="text-xs opacity-70">{joinRoles(m.roles)}</span>
                <button type="button" onClick={() => removeMember(i)} className="ml-0.5 hover:text-red-500" title={t("profile.edit.remove")}>×</button>
              </span>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══════════════ 外部链接 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🔗 {t("form.links")}</h2>
        <p className="text-xs text-brand-text-muted">{t("form.linksHint")}</p>
        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--ui-surface-alt2)] rounded-lg text-sm">
                <span className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-brand-navy text-white">{link.label}</span>
                <span className="truncate flex-1 text-brand-blue">{link.url}</span>
                <button type="button" onClick={() => removeLink(i)} className="text-xs flex-shrink-0 hover:text-red-500 text-brand-text-muted">{t("profile.edit.remove")}</button>
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
              <option value="">{t("form.selectType")}</option>
              {LINK_LABEL_PRESETS.map((l) => <option key={l.v} value={l.v}>{l.k ? t(l.k) : l.v}</option>)}
              <option value="__custom__">{t("form.customEllipsis")}</option>
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                placeholder={t("form.linkLabel")} className={`${inputClass} w-36`} />
              <button type="button" onClick={() => { setShowCustomLabel(false); setNewLinkLabel(""); }}
                className="text-xs px-2 py-1.5 rounded hover:bg-muted whitespace-nowrap text-brand-blue">{t("form.backToPreset")}</button>
            </div>
          )}
          <input type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="https://..." className={`${inputClass} flex-1 min-w-[200px]`} />
          <button type="button" onClick={addLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all bg-brand-green text-white">{t("profile.edit.add")}</button>
        </div>
      </section>

      {/* ═══════════════ 标签 ═══════════════ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy">🏷️ {t("form.tags")}</h2>
        {tags.length > 0 && (
          (() => {
            const grouped = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
              const key = tag.group || "其他";
              (acc[key] ??= []).push(tag);
              return acc;
            }, {});
            const groupOrder = ["引擎", "大类", "要素", "活动&赛事", "其他"];
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
                  {sortTagsEngineFirst(tags).map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    const branded = isEngineTagSlug(tag.slug) || isEventTagSlug(tag.slug);
                    const color = getEngineColor(tag.slug) || getEventColor(tag.slug) || tag.color || "#88C232";
                    return (
                      <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 transition-all cursor-pointer rounded-full ${
                          branded ? `font-medium ${getEngineChipClass(tag.slug) || getEventChipClass(tag.slug)}` : ""
                        } ${active ? "ring-2 ring-offset-1 opacity-100" : "opacity-60 hover:opacity-100"}`}
                        style={
                          branded
                            ? { ["--tw-ring-color" as string]: "currentColor" }
                            : { color, backgroundColor: `${color}18`, ["--tw-ring-color" as string]: color }
                        }
                        >
                        {isEngineTagSlug(tag.slug) && <EngineTagIcon slug={tag.slug} />}
                        {isEventTagSlug(tag.slug) && <EventTagIcon slug={tag.slug} />}
                        {tagDisplayName(tag.slug, tag.name, lang)}
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
                    <h3 className="text-xs font-medium mb-1.5 text-brand-text-muted">{groupLabel(group)}</h3>
                    <div className="flex flex-wrap gap-2">
                      {sortTagsEngineFirst(grouped[group]).map((tag) => {
                        const active = selectedTags.includes(tag.id);
                        const branded = isEngineTagSlug(tag.slug) || isEventTagSlug(tag.slug);
                        const color = getEngineColor(tag.slug) || getEventColor(tag.slug) || tag.color || "#88C232";
                        return (
                          <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                            className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 transition-all cursor-pointer rounded-full ${
                              branded ? `font-medium ${getEngineChipClass(tag.slug) || getEventChipClass(tag.slug)}` : ""
                            } ${active ? "ring-2 ring-offset-1 opacity-100" : "opacity-60 hover:opacity-100"}`}
                            style={
                              branded
                                ? { ["--tw-ring-color" as string]: "currentColor" }
                                : { color, backgroundColor: `${color}18`, ["--tw-ring-color" as string]: color }
                            }
                          >
                            {isEngineTagSlug(tag.slug) && <EngineTagIcon slug={tag.slug} />}
                            {isEventTagSlug(tag.slug) && <EventTagIcon slug={tag.slug} />}
                            {tagDisplayName(tag.slug, tag.name, lang)}
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
            placeholder={t("form.customTagInputHint")} className={`${inputClass} max-w-xs`} />
          <button type="button" onClick={addCustomTag} disabled={!customTagInput.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 bg-brand-orange text-white">{t("profile.edit.add")}</button>
        </div>
      </section>

      {/* ═══════════════ 提交 ═══════════════ */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white bg-brand-blue">
          {loading
            ? (isResubmit ? t("form.resubmitting") : isEdit ? t("common.saving") : t("form.submitting"))
            : (isResubmit ? t("form.resubmit") : isEdit ? t("form.saveChanges") : t("form.submitWork"))}
        </button>
        {isEdit && initialData ? (
          <a href={`/works/${initialData.slug || initialData.title}`} className="text-sm text-brand-text-muted">{t("profile.edit.cancel")}</a>
        ) : (
          <span className="text-xs text-brand-text-muted">{isResubmit ? t("form.resubmitHint") : t("form.submitHint")}</span>
        )}
      </div>
    </form>
  );
}
