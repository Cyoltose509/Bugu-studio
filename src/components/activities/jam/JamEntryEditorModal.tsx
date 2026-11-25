"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "@/components/ui/UserAvatar";
import TrophyIcon from "@/components/icons/TrophyIcon";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import {
  uploadImage,
  ACCEPT_ATTR,
  assertImageFile,
  compressionNote,
} from "@/lib/utils/clientUpload";
import { useLang } from "@/lib/i18n/LangProvider";
import { useFormDraft } from "@/lib/hooks/use-form-draft";
import {
  adminSaveJamEntry,
  searchWorksForJamLink,
} from "@/lib/actions/submissions";
import type { JamCreatorItem, JamTrophyType } from "@/lib/activities/jam-entries";

const ROLE_PRESETS = [
  "程序",
  "策划",
  "美术",
  "音效",
  "音乐",
  "测试",
  "宣发",
  "全栈",
  "制作",
] as const;

/** 奖杯：单选，图标直接点，不选中即为无奖杯 */
const TROPHY_OPTIONS: {
  value: JamTrophyType;
  label: string;
  variant: "gold" | "silver" | "bronze";
}[] = [
  { value: "GOLD", label: "金奖", variant: "gold" },
  { value: "SILVER", label: "银奖", variant: "silver" },
  { value: "BRONZE", label: "铜奖", variant: "bronze" },
];

export interface JamEntryInitialData {
  submissionId?: string;
  title: string;
  teamName?: string;
  coverImage?: string;
  screenshots: string[];
  creators: JamCreatorItem[];
  trophy: JamTrophyType | null;
  projectId?: string | null;
  projectTitle?: string | null;
}

/** 写进 localStorage 的草稿快照，字段与弹窗受控状态一一对应 */
type JamEntryDraftState = {
  title: string;
  teamName: string;
  coverUrl: string;
  screenshots: string[];
  creators: JamCreatorItem[];
  trophy: JamTrophyType | null;
  projectId: string | null;
  projectTitle: string;
};

function formatRestoredAt(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `今天 ${hh}:${mm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

interface SearchCandidate {
  id: string;
  userId?: string;
  memberId?: string;
  displayName: string;
  avatar?: string | null;
  _type: "member" | "user";
}

export default function JamEntryEditorModal({
  activityId,
  initialData,
  onClose,
  onSaved,
}: {
  activityId: string;
  initialData?: JamEntryInitialData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const isEdit = Boolean(initialData?.submissionId);

  const [title, setTitle] = useState(initialData?.title || "");
  const [teamName, setTeamName] = useState(initialData?.teamName || "");
  const [coverUrl, setCoverUrl] = useState(initialData?.coverImage || "");
  const [coverUploading, setCoverUploading] = useState(false);

  const [screenshots, setScreenshots] = useState<string[]>(
    (initialData?.screenshots || []).slice(0, 3)
  );
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState("");

  const [creators, setCreators] = useState<JamCreatorItem[]>(
    initialData?.creators || []
  );
  const [trophy, setTrophy] = useState<JamTrophyType | null>(
    initialData?.trophy ?? null
  );

  // 关联作品库游戏
  const [projectId, setProjectId] = useState<string | null>(
    initialData?.projectId ?? null
  );
  const [projectTitle, setProjectTitle] = useState<string>(
    initialData?.projectTitle || ""
  );
  const [projectQuery, setProjectQuery] = useState("");
  const [projectOptions, setProjectOptions] = useState<
    { id: string; title: string; slug: string; developYear: number; coverImage: string | null }[]
  >([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // 开发人员搜索与添加（逻辑类同“上传游戏”）
  const [devQuery, setDevQuery] = useState("");
  const [devResults, setDevResults] = useState<SearchCandidate[]>([]);
  const [showDevDropdown, setShowDevDropdown] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SearchCandidate | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["制作"]);
  const [customRole, setCustomRole] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── 本地草稿：填到一半关掉、刷新、误点遮罩，再打开还能接着改 ──
  // 编辑态按 submissionId 分桶、新建态按活动分桶，避免不同条目互相污染。
  // 容器必须用 state 承接：ref.current 的赋值不触发重渲染，
  // 而 useFormDraft 拿不到容器就不会落盘。
  const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const draftAppliedRef = useRef(false);
  const attachDialog = useCallback((el: HTMLDivElement | null) => {
    setDialogEl(el);
  }, []);

  const entryDraft = useFormDraft<JamEntryDraftState>({
    key: `jam-entry-draft:v1:${activityId}:${initialData?.submissionId ?? "new"}`,
    container: dialogEl,
    enabled: !saving,
    watch: JSON.stringify({
      title,
      teamName,
      coverUrl,
      screenshots,
      creators,
      trophy,
      projectId,
    }),
    getSnapshot: () => ({
      title,
      teamName,
      coverUrl,
      screenshots,
      creators,
      trophy,
      projectId,
      projectTitle,
    }),
    applySnapshot: (s) => {
      setTitle(s.title ?? "");
      setTeamName(s.teamName ?? "");
      setCoverUrl(s.coverUrl ?? "");
      setScreenshots(Array.isArray(s.screenshots) ? s.screenshots.slice(0, 3) : []);
      setCreators(Array.isArray(s.creators) ? s.creators : []);
      setTrophy(s.trophy ?? null);
      setProjectId(s.projectId ?? null);
      setProjectTitle(s.projectTitle ?? "");
    },
  });

  // 检测到草稿就自动写回（用户要求「再打开时加载」），顶部同时给一条可撤销的提示
  useEffect(() => {
    if (draftAppliedRef.current || !entryDraft.draft) return;
    draftAppliedRef.current = true;
    const at = entryDraft.draft.at;
    entryDraft.restore();
    setRestoredAt(at);
  }, [entryDraft.draft, entryDraft.restore]);

  /** 丢掉草稿并把表单还原成打开时的初始值 */
  const handleDiscardDraft = () => {
    entryDraft.discard();
    setRestoredAt(null);
    setTitle(initialData?.title || "");
    setTeamName(initialData?.teamName || "");
    setCoverUrl(initialData?.coverImage || "");
    setScreenshots((initialData?.screenshots || []).slice(0, 3));
    setCreators(initialData?.creators || []);
    setTrophy(initialData?.trophy ?? null);
    setProjectId(initialData?.projectId ?? null);
    setProjectTitle(initialData?.projectTitle || "");
  };

  const coverFileRef = useRef<HTMLInputElement>(null);
  const screenshotFileRef = useRef<HTMLInputElement>(null);
  const devDropdownRef = useRef<HTMLDivElement>(null);
  const searchReqRef = useRef(0);

  // 搜索站内社团成员与用户
  const searchDevelopers = useCallback(async (q: string) => {
    const reqId = ++searchReqRef.current;
    try {
      const [memberRes, userRes] = await Promise.all([
        fetch(`/api/members/search?q=${encodeURIComponent(q)}`),
        fetch(`/api/users/search?q=${encodeURIComponent(q)}`),
      ]);
      const merged: SearchCandidate[] = [];
      if (memberRes.ok) {
        const data = await memberRes.json();
        const list = Array.isArray(data) ? data : data.data || [];
        for (const m of list) {
          merged.push({
            id: m.id,
            memberId: m.id,
            userId: m.userId || undefined,
            displayName: m.displayName,
            avatar: m.avatar || m.user?.image || null,
            _type: "member",
          });
        }
      }
      if (userRes.ok) {
        const data = await userRes.json();
        const list = Array.isArray(data) ? data : data.data || [];
        for (const u of list) {
          if (u.member) {
            merged.push({
              id: u.member.id,
              memberId: u.member.id,
              userId: u.id,
              displayName: u.member.displayName,
              avatar: u.image || null,
              _type: "member",
            });
          } else {
            merged.push({
              id: u.id,
              userId: u.id,
              displayName: u.name || u.email || "用户",
              avatar: u.image || null,
              _type: "user",
            });
          }
        }
      }
      const seen = new Set<string>();
      const unique = merged.filter((item) => {
        const k = `${item._type}:${item.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (reqId === searchReqRef.current) {
        setDevResults(unique);
      }
    } catch {
      if (reqId === searchReqRef.current) {
        setDevResults([]);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDevelopers(devQuery.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [devQuery, searchDevelopers]);

  // 搜索作品库游戏
  useEffect(() => {
    if (!showProjectPicker) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await searchWorksForJamLink(projectQuery);
        if (active && res?.projects) {
          setProjectOptions(res.projects);
        }
      } catch {
        // ignore
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectQuery, showProjectPicker]);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (devDropdownRef.current && !devDropdownRef.current.contains(e.target as Node)) {
        setShowDevDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleUploadFile = async (file: File, type: "cover" | "screenshot") => {
    await assertImageFile(file, lang);
    const result = await uploadImage(file, {
      endpoint: "/api/upload",
      type,
      lang,
    });
    setUploadNote(compressionNote(result, lang));
    return result.url;
  };

  const handleCoverSelect = async (file: File | undefined) => {
    if (!file) return;
    setCoverUploading(true);
    setError("");
    try {
      const url = await handleUploadFile(file, "cover");
      setCoverUrl(url);
    } catch (err: any) {
      setError(err.message || "封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleScreenshotSelect = async (file: File | undefined) => {
    if (!file) return;
    if (screenshots.length >= 3) {
      setError("游戏截图至多上传 3 张");
      return;
    }
    setScreenshotUploading(true);
    setError("");
    try {
      const url = await handleUploadFile(file, "screenshot");
      setScreenshots((prev) => (prev.length < 3 ? [...prev, url] : prev));
    } catch (err: any) {
      setError(err.message || "截图上传失败");
    } finally {
      setScreenshotUploading(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleAddCustomRole = () => {
    const r = customRole.trim();
    if (!r) return;
    if (!selectedRoles.includes(r)) {
      setSelectedRoles((prev) => [...prev, r]);
    }
    setCustomRole("");
  };

  const handleAddDeveloper = () => {
    const name = (selectedCandidate?.displayName || devQuery).trim();
    if (!name) return;
    const roles = selectedRoles.length > 0 ? selectedRoles : ["制作"];

    setCreators((prev) => [
      ...prev,
      {
        name,
        roles,
        userId: selectedCandidate?.userId,
        memberId: selectedCandidate?.memberId,
        avatar: selectedCandidate?.avatar || null,
      },
    ]);
    setDevQuery("");
    setSelectedCandidate(null);
    setShowDevDropdown(false);
  };

  const handleRemoveDeveloper = (index: number) => {
    setCreators((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("请填写游戏名称");
      return;
    }
    if (screenshots.length > 3) {
      setError("游戏截图至多 3 张");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await adminSaveJamEntry(activityId, {
        submissionId: initialData?.submissionId,
        title: cleanTitle,
        teamName: teamName.trim() || undefined,
        coverImage: coverUrl || undefined,
        screenshots: screenshots.slice(0, 3),
        creators,
        trophy,
        projectId,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      // 已入库，草稿使命结束；不清掉的话下次打开会拿旧内容盖住刚存的值
      entryDraft.clear();
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "保存失败");
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "编辑 Game Jam 参赛条目" : "新建 Game Jam 参赛条目"}
        ref={attachDialog}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-border-subtle bg-card shadow-2xl"
      >
        {/* 顶部标题栏：紧凑适配 Game Jam 活动占位条目 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-border-subtle bg-card/95 px-5 py-3.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <TrophyIcon size={18} className="align-[-0.18em]" />
            <h3 className="text-base font-bold text-brand-navy">
              {isEdit ? "编辑 Game Jam 作品条目" : "添加 Game Jam 参赛作品条目"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-brand-text-muted hover:bg-brand-surface hover:text-brand-navy"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {restoredAt && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-blue/25 bg-brand-blue/5 px-3.5 py-2.5 text-xs text-brand-text-secondary">
              <span>
                已恢复上次未保存的草稿（{formatRestoredAt(restoredAt)}）
              </span>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="shrink-0 font-medium text-brand-blue hover:underline"
              >
                清除草稿
              </button>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {/* 双列：左列媒体（封面 + 截图），右列信息（名称 / 队名 / 奖杯 / 关联作品） */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]">
            {/* ── 左列：游戏封面 + 游戏截图 ── */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-text-body">
                  游戏封面
                </label>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    handleCoverSelect(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {coverUrl ? (
                  <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-brand-border-subtle bg-brand-surface">
                    <img
                      src={coverUrl}
                      alt="游戏封面预览"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => coverFileRef.current?.click()}
                        className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-white"
                      >
                        更换
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverUrl("")}
                        className="rounded-md bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <ImageDropZone
                    onFile={(file) => handleCoverSelect(file)}
                    disabled={coverUploading}
                    className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-border-subtle bg-brand-surface/50 px-3 text-center transition-colors hover:border-brand-blue"
                  >
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={coverUploading}
                      className="text-xs text-brand-text-muted"
                    >
                      {coverUploading ? "封面上传中..." : "点击或拖拽上传封面 (16:9)"}
                    </button>
                  </ImageDropZone>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-brand-text-body">
                    游戏截图
                    <span className="ml-1 text-xs font-normal text-brand-text-muted">
                      （可选，{screenshots.length}/3）
                    </span>
                  </label>
                  {uploadNote && (
                    <span className="shrink-0 text-xs text-brand-text-muted">{uploadNote}</span>
                  )}
                </div>
                <input
                  ref={screenshotFileRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    handleScreenshotSelect(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  {screenshots.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="group relative aspect-video overflow-hidden rounded-xl border border-brand-border-subtle bg-brand-surface"
                    >
                      <img
                        src={url}
                        alt={`游戏截图 ${idx + 1}`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setScreenshots((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-90 hover:opacity-100"
                        aria-label={`删除截图 ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {screenshots.length < 3 && (
                    <ImageDropZone
                      onFile={(file) => handleScreenshotSelect(file)}
                      disabled={screenshotUploading}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-border-subtle bg-brand-surface/40 p-2 text-center transition-colors hover:border-brand-blue ${
                        screenshots.length === 1 ? "aspect-video" : "col-span-2 h-24"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => screenshotFileRef.current?.click()}
                        disabled={screenshotUploading}
                        className="text-xs text-brand-text-muted"
                      >
                        {screenshotUploading ? "上传中..." : "+ 添加截图"}
                      </button>
                    </ImageDropZone>
                  )}
                </div>
              </div>
            </div>

            {/* ── 右列：名称 / 队名 / 奖杯 / 关联作品 ── */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-text-body">
                  游戏名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入参赛游戏名称..."
                  className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-text-body">
                  队名
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="参赛队伍名称..."
                  className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>

              {/* 金银铜奖杯：单图标直选，再点一次取消 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-text-body">
                  奖杯荣誉
                </label>
                <div className="flex items-center gap-1.5">
                  {TROPHY_OPTIONS.map((opt) => {
                    const active = trophy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTrophy(active ? null : opt.value)}
                        aria-pressed={active}
                        aria-label={opt.label}
                        title={active ? `取消${opt.label}` : opt.label}
                        className={`rounded-lg p-1 transition-all ${
                          active
                            ? "opacity-100"
                            : "opacity-40 grayscale hover:opacity-70"
                        }`}
                      >
                        <TrophyIcon variant={opt.variant} size={26} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 关联作品库游戏（可选）：推到右列底部，与左列媒体底边对齐 */}
              <div className="mt-auto rounded-xl border border-brand-border-subtle bg-brand-surface/20 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-sm font-medium text-brand-text-body">
                    关联作品库游戏
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProjectPicker((v) => !v)}
                    className="shrink-0 text-sm font-medium text-brand-blue hover:underline"
                  >
                    {showProjectPicker ? "收起选择" : projectId ? "更换关联作品" : "选择作品库游戏"}
                  </button>
                </div>
                <div className="mt-1.5 min-w-0">
                  {projectId ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-medium text-brand-blue">
                      <span className="truncate">🎮 {projectTitle || projectId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setProjectId(null);
                          setProjectTitle("");
                        }}
                        className="shrink-0 text-brand-text-muted hover:text-red-500"
                        title="取消关联"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-brand-text-muted">未关联（仅作为活动页占位条目）</span>
                  )}
                </div>

                {showProjectPicker && (
                  <div className="mt-2.5 space-y-2">
                    <input
                      type="text"
                      value={projectQuery}
                      onChange={(e) => setProjectQuery(e.target.value)}
                      placeholder="输入作品库游戏名称搜索..."
                      className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none"
                    />
                    <div className="max-h-40 divide-y divide-brand-border-subtle overflow-y-auto rounded-lg border border-brand-border-subtle bg-card">
                      {projectOptions.length === 0 ? (
                        <p className="py-3 text-center text-xs text-brand-text-muted">
                          未找到匹配的作品库游戏
                        </p>
                      ) : (
                        projectOptions.map((proj) => (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              setProjectId(proj.id);
                              setProjectTitle(proj.title);
                              setShowProjectPicker(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-surface ${
                              projectId === proj.id ? "bg-brand-blue/10 font-semibold" : ""
                            }`}
                          >
                            <span className="truncate text-brand-navy">{proj.title}</span>
                            <span className="ml-2 shrink-0 text-xs text-brand-text-muted">
                              {proj.developYear}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 开发人员关联（通栏，需要横向空间排胶囊与角色） */}
          <div className="rounded-xl border border-brand-border-subtle bg-brand-surface/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-brand-text-body">
                游戏相关开发人员关联
              </label>
              <span className="text-xs text-brand-text-muted">
                可搜索站内成员或直接输入姓名并勾选分工
              </span>
            </div>

            {/* 已关联开发人员列表（对齐上传游戏 ProjectForm 胶囊样式） */}
            {creators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {creators.map((c, idx) => {
                  const isMember = Boolean(c.memberId);
                  const isUser = Boolean(!c.memberId && c.userId);
                  return (
                    <span
                      key={`${c.name}-${idx}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                        isMember
                          ? "bg-brand-navy/10 text-brand-navy"
                          : isUser
                            ? "bg-brand-blue/10 text-brand-blue"
                            : "bg-brand-orange/10 text-brand-orange"
                      }`}
                    >
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white overflow-hidden shrink-0 ${
                          isMember
                            ? "bg-brand-orange"
                            : isUser
                              ? "bg-brand-blue"
                              : "bg-gray-500"
                        }`}
                      >
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          c.name.charAt(0)
                        )}
                      </span>
                      <span>{c.name}</span>
                      {c.roles.length > 0 && (
                        <span className="text-xs opacity-70">
                          {c.roles.join("、")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDeveloper(idx)}
                        className="ml-0.5 hover:text-red-500"
                        aria-label={`移除开发人员 ${c.name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* 搜索/输入人员 + 角色选择 */}
            <div ref={devDropdownRef} className="relative space-y-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={devQuery}
                    onFocus={() => setShowDevDropdown(true)}
                    onChange={(e) => {
                      setDevQuery(e.target.value);
                      setSelectedCandidate(null);
                      setShowDevDropdown(true);
                    }}
                    placeholder="搜索社团成员 / 注册用户，或直接输入外部开发者姓名..."
                    className="w-full rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none"
                  />
                  {selectedCandidate && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-brand-blue/15 px-1.5 py-0.5 text-xs font-medium text-brand-blue">
                      已选站内成员
                    </span>
                  )}

                  {showDevDropdown && devResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-xl border border-brand-border-subtle bg-card py-1 shadow-lg">
                      {devResults.map((cand) => (
                        <button
                          key={`${cand._type}:${cand.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(cand);
                            setDevQuery(cand.displayName);
                            setShowDevDropdown(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-surface"
                        >
                          <UserAvatar
                            src={cand.avatar || null}
                            name={cand.displayName}
                            size={22}
                          />
                          <span className="flex-1 truncate font-medium text-brand-navy">
                            {cand.displayName}
                          </span>
                          <span className="rounded bg-brand-surface px-1.5 py-0.5 text-xs text-brand-text-muted">
                            {cand._type === "member" ? "社团成员" : "注册用户"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddDeveloper}
                  disabled={!devQuery.trim()}
                  className="shrink-0 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
                >
                  + 添加人员
                </button>
              </div>

              {/* 角色分工预设（对齐上传游戏 ProjectForm 绿色胶囊） */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-brand-text-muted mr-1">分工角色：</span>
                {ROLE_PRESETS.map((role) => {
                  const active = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`rounded-full border px-2 py-1 text-xs transition-all cursor-pointer ${
                        active
                          ? "border-brand-green bg-brand-green text-white"
                          : "border-brand-border-subtle bg-card text-brand-text-muted hover:border-brand-green"
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
                <div className="inline-flex items-center gap-1 ml-1">
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomRole();
                      }
                    }}
                    placeholder="自定义分工"
                    className="w-24 rounded-full border border-brand-border-subtle bg-card px-2 py-1 text-xs text-brand-text-heading focus:outline-none"
                  />
                  {customRole.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustomRole}
                      className="rounded bg-brand-surface px-1.5 py-0.5 text-xs text-brand-blue"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作按钮 */}
          <div className="flex items-center justify-end gap-2.5 border-t border-brand-border-subtle pt-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-brand-border-subtle px-4 py-2 text-sm font-medium text-brand-text-secondary hover:bg-brand-surface"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || coverUploading || screenshotUploading}
              className="rounded-lg bg-brand-blue px-5 py-2 text-sm font-medium text-white hover:bg-brand-blue-hover disabled:opacity-50"
            >
              {saving ? "保存中..." : isEdit ? "保存修改" : "创建参赛条目"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
