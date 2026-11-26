"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import UserAvatar from "@/components/ui/UserAvatar";
import Image from "@/components/ui/SiteImage";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import GradeYearPicker from "@/components/profile/GradeYearPicker";
import { completeOnboarding } from "@/app/onboarding/actions";
import { getCroppedImg, readFileAsDataURL } from "@/lib/utils/imageCrop";
import { uploadImage, ACCEPT_ATTR, AVATAR_LIMIT_BYTES } from "@/lib/utils/clientUpload";
import {
  ONBOARDING_SKILL_PRESETS,
  isLikelyGraduated,
} from "@/lib/profile/onboarding";

const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false }) as any;

interface OnboardingWizardProps {
  user: {
    id: string;
    name: string;
    image: string | null;
    bio: string | null;
  };
  member: {
    id: string;
    displayName: string;
    grade: number | null;
    graduated: boolean;
    skills: string[];
    bio: string | null;
  } | null;
  canChangeAvatar: boolean;
  avatarCooldownDays: number;
}

export default function OnboardingWizard({
  user,
  member,
  canChangeAvatar,
  avatarCooldownDays,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [grade, setGrade] = useState<number | null>(member?.grade ?? null);
  const [graduated, setGraduated] = useState<boolean>(member?.graduated ?? false);
  const [skills, setSkills] = useState<string[]>(member?.skills ?? []);
  const [customSkill, setCustomSkill] = useState("");
  const [bio, setBio] = useState<string>(member?.bio ?? user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.image);

  // 头像上传 & 裁剪状态
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [showCrop, setShowCrop] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 简介文本框跟内容自动长高（站内文本域统一做法：不显示原生拖拽柄）
  const bioRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [bio]);

  const displayName = member?.displayName || user.name || "新成员";

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    if (!skills.includes(trimmed) && skills.length < 12) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setCustomSkill("");
  }

  async function openCropWith(file: File | undefined) {
    if (!file || !canChangeAvatar) return;
    setAvatarError("");
    try {
      const dataUrl = await readFileAsDataURL(file);
      setCropSrc(dataUrl);
      setShowCrop(true);
    } catch {
      setAvatarError("图片读取失败，请重试");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedPixels) return;
    setAvatarUploading(true);
    setShowCrop(false);
    setAvatarError("");
    try {
      const { blob } = await getCroppedImg(cropSrc, croppedPixels, 400, 0.85);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const { url } = await uploadImage(file, {
        endpoint: "/api/upload/avatar",
        limit: AVATAR_LIMIT_BYTES,
      });
      setAvatarUrl(url);
      await updateSession();
    } catch (err: any) {
      setAvatarError(err?.message || "头像上传失败，请稍后重试");
    } finally {
      setAvatarUploading(false);
      setCropSrc(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (member && grade == null) {
      setError("请先点选你的本科入学年份");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await completeOnboarding({
        grade: member ? grade : undefined,
        graduated: member ? graduated : undefined,
        skills: member ? skills : undefined,
        bio,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      await updateSession();
      router.push("/profile");
      router.refresh();
    } catch {
      setError("保存失败，请稍后重试");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 animate-fade-in">
      {/* 顶部标题与跳过入口 */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-navy">
            完善你的社团名片
          </h1>
          <p className="mt-1 text-sm text-brand-text-secondary">
            30 秒点选几项基本信息，让大家在成员墙和作品页更快认识你
          </p>
        </div>
        <Link
          href="/profile"
          className="text-sm text-brand-text-muted hover:text-brand-blue transition-colors py-1"
        >
          先跳过，稍后完善 →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
        {/* 左侧：轻量建档表单 */}
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-brand-border-subtle p-6 shadow-sm space-y-6"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {/* 1. 本科入学年份（仅社团成员展示） */}
          {member && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-brand-navy">
                  本科入学年份 <span className="text-red-500">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-brand-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={graduated}
                    onChange={(e) => setGraduated(e.target.checked)}
                    className="rounded border-brand-border-subtle text-brand-navy focus:ring-brand-blue"
                  />
                  已毕业
                </label>
              </div>
              <GradeYearPicker
                value={grade}
                onChange={(y) => {
                  setGrade(y);
                  setError("");
                }}
                onSelectPreset={(y) => setGraduated(isLikelyGraduated(y))}
              />
            </section>
          )}

          {/* 2. 擅长方向（仅社团成员展示） */}
          {member && (
            <section className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-semibold text-brand-navy">
                  擅长方向 / 职能
                </label>
                <span className="text-xs text-brand-text-muted">可多选</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ONBOARDING_SKILL_PRESETS.map((skill) => {
                  const active = skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? "border-brand-green bg-brand-green text-white"
                          : "border-brand-border-subtle bg-card text-brand-text-body hover:border-brand-green"
                      }`}
                    >
                      {active ? `✓ ${skill}` : skill}
                    </button>
                  );
                })}
                {skills
                  .filter((s) => !(ONBOARDING_SKILL_PRESETS as readonly string[]).includes(s))
                  .map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-green bg-brand-green px-3 py-1 text-xs font-medium text-white"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => toggleSkill(s)}
                        aria-label={`移除 ${s}`}
                        className="ml-0.5 hover:opacity-80"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="text"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSkill();
                    }
                  }}
                  placeholder="自定义方向（如 剧情、TA、建模）..."
                  maxLength={24}
                  className="flex-1 max-w-xs rounded-lg border border-brand-border-subtle bg-card px-3 py-1.5 text-xs text-brand-text-heading focus:border-brand-blue focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  disabled={!customSkill.trim()}
                  className="rounded-lg border border-brand-border-subtle px-3 py-1.5 text-xs font-medium text-brand-text-body hover:bg-brand-surface disabled:opacity-40"
                >
                  + 添加
                </button>
              </div>
            </section>
          )}

          {/* 3. 上传头像 */}
          <section className="space-y-2.5">
            <label className="block text-sm font-semibold text-brand-navy">
              个人头像
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => void openCropWith(e.target.files?.[0])}
            />
            <ImageDropZone
              hint="拖拽图片到这里上传头像"
              disabled={!canChangeAvatar || avatarUploading}
              onFile={(file) => void openCropWith(file)}
              onInvalid={(msg) => setAvatarError(msg)}
              className="rounded-xl"
            >
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-brand-border-subtle bg-brand-surface/35 p-4">
                <UserAvatar src={avatarUrl} name={displayName} size={56} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={!canChangeAvatar || avatarUploading}
                      className="rounded-lg bg-brand-blue px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
                    >
                      {avatarUploading
                        ? "上传中..."
                        : avatarUrl
                          ? "更换头像"
                          : "上传头像"}
                    </button>
                    {!canChangeAvatar && (
                      <span className="text-xs text-brand-text-muted">
                        近期已更换，{avatarCooldownDays} 天后可再次修改
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-text-muted">
                    支持 JPG / PNG / WebP，支持拖拽并自由裁剪；头像会展示在成员墙与作品卡片上
                  </p>
                  {avatarError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{avatarError}</p>
                  )}
                </div>
              </div>
            </ImageDropZone>
          </section>

          {/* 4. 一句话简介 */}
          <section className="space-y-2.5">
            <label className="block text-sm font-semibold text-brand-navy" htmlFor="onboarding-bio">
              一句话简介
            </label>
            <textarea
              id="onboarding-bio"
              ref={bioRef}
              rows={2}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="介绍一下你喜欢的游戏类型、常用引擎或想做的项目..."
              className="w-full min-h-[3.75rem] resize-none overflow-hidden rounded-lg border border-brand-border-subtle bg-card px-3.5 py-2 text-sm text-brand-text-heading focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/25"
            />
          </section>

          {/* 底部提交 */}
          <div className="flex items-center justify-between gap-3 border-t border-brand-border-subtle pt-4">
            <Link
              href="/profile/edit"
              className="text-xs text-brand-text-muted hover:text-brand-blue hover:underline"
            >
              想填学院/外链等更多资料？去完整编辑页 →
            </Link>
            <button
              type="submit"
              disabled={saving || avatarUploading}
              className="btn-primary rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "保存中..." : "完成并进入主页"}
            </button>
          </div>
        </form>

        {/* 右侧：实时成员名片预览（对齐成员墙卡片设计语言） */}
        <aside className="space-y-3 lg:sticky lg:top-24">
          <p className="text-xs font-medium text-brand-text-muted">成员墙名片实时预览</p>
          <div className="rounded-xl bg-card border border-brand-border-subtle p-5 shadow-sm text-center">
            <div className={`relative w-14 h-14 mx-auto ${graduated ? "mt-2" : ""}`}>
              <UserAvatar src={avatarUrl} name={displayName} size={56} className="mx-auto" />
              {graduated && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[24px] z-10 block w-20 h-[59px] drop-shadow-md"
                  aria-hidden
                >
                  <Image
                    src="/images/graduation-cap.png"
                    alt=""
                    width={80}
                    height={59}
                    className="w-full h-full object-contain select-none"
                  />
                </span>
              )}
            </div>
            <div className="mt-2.5 text-base font-semibold text-brand-text-heading truncate">
              {displayName}
            </div>
            <div className="mt-1 text-xs text-brand-text-muted">
              {member
                ? grade
                  ? `${grade}级${graduated ? " · 已毕业" : ""}`
                  : "尚未选择入学年份"
                : "注册用户"}
            </div>
            {member && skills.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {skills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded px-2 py-0.5 text-xs bg-brand-surface text-brand-blue"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {bio.trim() ? (
              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-brand-text-secondary line-clamp-3">
                {bio.trim()}
              </p>
            ) : (
              <p className="mt-3 text-xs text-brand-text-muted/70">
                写一句简介，让同好更快找到你
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* 头像裁剪弹窗 */}
      {showCrop && cropSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="裁剪头像"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-brand-border-subtle p-5 shadow-2xl space-y-4">
            <h2 className="text-base font-semibold text-brand-navy">裁剪头像</h2>
            <div className="relative h-64 w-full overflow-hidden rounded-xl bg-black">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_: any, pixels: any) => setCroppedPixels(pixels)}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-text-muted">缩放</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCrop(false);
                  setCropSrc(null);
                }}
                className="rounded-lg border border-brand-border-subtle px-4 py-1.5 text-sm text-brand-text-secondary hover:bg-brand-surface"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="btn-primary rounded-lg px-4 py-1.5 text-sm font-medium"
              >
                确认上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
