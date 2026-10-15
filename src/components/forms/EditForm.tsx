"use client";

import {useActionState, useState, useRef, useEffect} from "react";
import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import dynamic from "next/dynamic";
import {saveProfile, redeemInviteCode} from "@/app/profile/edit/actions";
import {SubmitButton} from "@/components/ui/SubmitButton";
import {getCroppedImg, readFileAsDataURL} from "@/lib/utils/imageCrop";
import MentionEditor from "@/components/ui/MentionEditor";
import {ImageDropZone} from "@/components/ui/ImageDropZone";
import {uploadImage, ACCEPT_ATTR, AVATAR_LIMIT_BYTES} from "@/lib/utils/clientUpload";
import {useLang} from "@/lib/i18n/LangProvider";
import type {DictKey} from "@/lib/i18n/dict";

const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false }) as any;

type UserSnippet = { id: string; name: string | null; bio: string | null; image: string | null };
type MemberSnippet = {
    id: string;
    displayName: string;
    bio: string | null;
    grade: number | null;
    skills: string[];
    location: string | null;
    phone: string | null;
    wechat: string | null;
    qq: string | null;
    socialLinks: { id: string; label: string; url: string; sortOrder: number }[];
    workExperiences: { id: string; type: string; company: string; position: string; startDate: Date; endDate: Date | null; sortOrder: number }[];
    graduated: boolean;
    realName: string | null;
    joinYear: number | null;
    college: string | null;
    major: string | null;
    workLocation: string | null;
    workPosition: string | null;
};
type CooldownInfo = { canEdit: boolean; remainingDays: number };

interface LinkEntry {
    label: string;
    url: string;
}

const LINK_LABEL_PRESETS = ["GitHub", "Bilibili", "个人网站", "知乎", "Steam", "itch.io"];

// 预设标签 → 词典键（值保持原样存储，仅本地化显示）
const LINK_LABEL_KEYS: Record<string, DictKey> = {
    "个人网站": "form.link.personalSite",
    "知乎": "form.link.zhihu",
};
// 职能预设：值保持中文存储，仅本地化显示
const SKILL_PRESET_KEYS: Record<string, DictKey> = {
    "程序": "form.role.program",
    "策划": "form.role.design",
    "美术": "form.role.art",
    "音效": "form.role.sound",
    "音乐": "form.role.music",
    "测试": "form.role.test",
    "宣发": "form.role.pr",
    "全栈": "form.role.fullstack",
};
const SKILL_PRESETS = Object.keys(SKILL_PRESET_KEYS);

export default function EditForm({
                                     user,
                                     member,
                                     isAdmin,
                                     avatarCooldown,
                                 }: {
    user: UserSnippet;
    member: MemberSnippet | null;
    isAdmin: boolean;
    avatarCooldown: CooldownInfo;
}) {
    const {update: updateSession} = useSession();
    const router = useRouter();
    const { t } = useLang();

    const [state, formAction, pending] = useActionState(
        async (_prev: any, formData: FormData) => {
            const result = await saveProfile(formData);
            if (result?.success) {
                // 刷新 JWT token 中的 name，确保 Navbar 等客户端组件立即显示新名称
                await updateSession();
                router.push("/profile");
            }
            return result;
        },
        null
    );

    // 表单原始值（用于检测是否有修改）
    const originalName = user.name ?? "";
    const originalBio = user.bio ?? "";
    const originalSkills = member?.skills ?? [];
    const originalLinks: LinkEntry[] = (member?.socialLinks ?? []).map(l => ({label: l.label, url: l.url}));

    const [skillInput, setSkillInput] = useState("");
    const [skills, setSkills] = useState<string[]>(originalSkills);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(
        user.image
            ? user.image.startsWith("http")
                ? user.image
                : `${process.env.NEXT_PUBLIC_SITE_URL}${user.image}`
            : null
    );
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState("");
    const [avatarSuccess, setAvatarSuccess] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    // 裁剪状态
    const [showCrop, setShowCrop] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({x: 0, y: 0});
    const [zoom, setZoom] = useState(1);
    const [croppedPixels, setCroppedPixels] = useState<any>(null);

    // 邀请码
    const [inviteInput, setInviteInput] = useState("");
    const [invitePending, setInvitePending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

    // 表单值
    const [nameValue, setNameValue] = useState(originalName);
    const [bioValue, setBioValue] = useState(originalBio);
    const [gradeValue, setGradeValue] = useState<number | null>(member?.grade ?? null);
    const [locationValue, setLocationValue] = useState(member?.location ?? "");
    const [phoneValue, setPhoneValue] = useState(member?.phone ?? "");
    const [wechatValue, setWechatValue] = useState(member?.wechat ?? "");
    const [qqValue, setQqValue] = useState(member?.qq ?? "");
    const [graduatedVal, setGraduatedVal] = useState(member?.graduated ?? false);
    const [realNameVal, setRealNameVal] = useState(member?.realName ?? "");
    const [joinYearVal, setJoinYearVal] = useState(member?.joinYear ?? null);
    const [collegeVal, setCollegeVal] = useState(member?.college ?? "");
    const [majorVal, setMajorVal] = useState(member?.major ?? "");
    const [workLocationVal, setWorkLocationVal] = useState(member?.workLocation ?? "");
    const [workPositionVal, setWorkPositionVal] = useState(member?.workPosition ?? "");

    // 自定义链接
    const [socialLinks, setSocialLinks] = useState<LinkEntry[]>(originalLinks);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showCustomLabel, setShowCustomLabel] = useState(false);

  // 经历（原工作经历，现已包含学习和工作）
  const [workExperiences, setWorkExperiences] = useState<MemberSnippet["workExperiences"]>(
    member?.workExperiences ?? []
  );
  const [newExpType, setNewExpType] = useState("工作");
  const [newExpCompany, setNewExpCompany] = useState("");
  const [newExpPosition, setNewExpPosition] = useState("");
  const [newExpStart, setNewExpStart] = useState("");
  const [newExpEnd, setNewExpEnd] = useState("");
  const [expSaving, setExpSaving] = useState(false);
  const [expMsg, setExpMsg] = useState("");
  const [expError, setExpError] = useState(false);

    // dirty state 检测
    const hasChanged =
        nameValue !== originalName ||
        bioValue !== originalBio ||
        (member && locationValue !== (member.location ?? "")) ||
        (member && phoneValue !== (member.phone ?? "")) ||
        (member && wechatValue !== (member.wechat ?? "")) ||
        (member && qqValue !== (member.qq ?? "")) ||
        (member && gradeValue !== (member.grade ?? null)) ||
        (member && graduatedVal !== (member.graduated ?? false)) ||
        (member && realNameVal !== (member.realName ?? "")) ||
        (member && joinYearVal !== (member.joinYear ?? null)) ||
        (member && collegeVal !== (member.college ?? "")) ||
        (member && majorVal !== (member.major ?? "")) ||
        (member && workLocationVal !== (member.workLocation ?? "")) ||
        (member && workPositionVal !== (member.workPosition ?? "")) ||
        (member && JSON.stringify(skills) !== JSON.stringify(originalSkills)) ||
        JSON.stringify(socialLinks.map(({label, url}) => ({label, url}))) !==
        JSON.stringify(originalLinks.map(({label, url}) => ({label, url})));

    const canSave = hasChanged && !pending;
    const canEditLinks = !!member;

    function addSkill() {
        const v = skillInput.trim();
        if (v && !skills.includes(v)) {
            setSkills([...skills, v]);
            setSkillInput("");
        }
    }

    function removeSkill(s: string) {
        setSkills(skills.filter((x) => x !== s));
    }

    function addLink() {
        const label = newLinkLabel.trim();
        const url = newLinkUrl.trim();
        if (!label || !url) return;
        setSocialLinks([...socialLinks, {label, url}]);
        setNewLinkLabel("");
        setNewLinkUrl("");
        setShowCustomLabel(false);
    }

  function removeLink(index: number) {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  }

  // ── 经历 CRUD ──
  async function addWorkExperience() {
    const type = newExpType;
    const company = newExpCompany.trim();
    const position = newExpPosition.trim();
    const startDate = newExpStart;
    if (!company || !position || !startDate || !member) return;
    setExpSaving(true);
    setExpMsg("");
    setExpError(false);
    try {
      const res = await fetch(`/api/members/${member.id}/work-experience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, company, position, startDate, endDate: newExpEnd || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || t("profile.edit.addFailed"));
      }
      const created = await res.json();
      setWorkExperiences((prev: MemberSnippet["workExperiences"]) => [...prev, created]);
      setNewExpCompany("");
      setNewExpPosition("");
      setNewExpStart("");
      setNewExpEnd("");
      setExpMsg(t("profile.edit.added"));
      setExpError(false);
      setTimeout(() => setExpMsg(""), 2000);
    } catch (e: any) {
      setExpError(true);
      setExpMsg(t("profile.edit.addFailed"));
    } finally {
      setExpSaving(false);
    }
  }

  async function removeWorkExperience(expId: string) {
    if (!member) return;
    setExpSaving(true);
    setExpMsg("");
    setExpError(false);
    try {
      const res = await fetch(`/api/members/${member.id}/work-experience`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: expId }),
      });
      if (!res.ok) throw new Error(t("profile.edit.deleteFailed"));
      setWorkExperiences((prev: MemberSnippet["workExperiences"]) => prev.filter((e: MemberSnippet["workExperiences"][number]) => e.id !== expId));
      setExpMsg(t("profile.edit.deleted"));
      setExpError(false);
      setTimeout(() => setExpMsg(""), 2000);
    } catch {
      setExpError(true);
      setExpMsg(t("profile.edit.deleteFailed"));
    } finally {
      setExpSaving(false);
    }
  }

    // 文件（点选或拖拽）→ 打开裁剪弹窗
    async function openCropWith(file: File | undefined) {
        if (!file) return;
        setAvatarError("");
        setAvatarSuccess("");
        try {
            const dataUrl = await readFileAsDataURL(file);
            setCropSrc(dataUrl);
            setShowCrop(true);
        } catch {
            setAvatarError(t("profile.edit.readImageFailed"));
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        void openCropWith(e.target.files?.[0]);
    }

    // 裁剪确认 → 压缩 → 上传
    async function handleCropConfirm() {
        if (!cropSrc || !croppedPixels) return;
        setAvatarUploading(true);
        setShowCrop(false);
        setAvatarError("");
        setAvatarSuccess("");
        try {
            const {blob} = await getCroppedImg(cropSrc, croppedPixels, 400, 0.85);
            const file = new File([blob], "avatar.jpg", {type: "image/jpeg"});
            const {url} = await uploadImage(file, {
                endpoint: "/api/upload/avatar",
                limit: AVATAR_LIMIT_BYTES,
            });
            setAvatarPreview(url);
            setAvatarSuccess(t("profile.edit.avatarUpdated"));
            await updateSession();
        } catch (err: any) {
            setAvatarError(err.message || t("profile.edit.uploadFailed"));
        } finally {
            setAvatarUploading(false);
            setCropSrc(null);
        }
    }

    function handleCropCancel() {
        setShowCrop(false);
        setCropSrc(null);
    }

    // 兑换邀请码
    async function handleRedeemInvite() {
        if (!inviteInput.trim()) return;
        setInvitePending(true);
        setInviteError("");
        setInviteMsg("");
        try {
            const result = await redeemInviteCode(inviteInput.trim());
            if (result.error) {
                setInviteError(result.error);
            } else {
                setInviteMsg(result.message!);
                setInviteInput("");
                await updateSession();
            }
        } catch {
            setInviteError(t("profile.edit.redeemFailed"));
        } finally {
            setInvitePending(false);
        }
    }

    return (
        <>
            <form
                action={(fd) => {
                    fd.set("name", fd.get("name") ?? originalName);
                    fd.set("bio", fd.get("bio") ?? originalBio);
                    fd.set("skills", skills.join(","));
                    fd.set("socialLinks", JSON.stringify(socialLinks));
                    fd.set("grade", gradeValue != null ? String(gradeValue) : "");
                    fd.set("graduated", graduatedVal.toString());
                    fd.set("realName", realNameVal);
                    fd.set("joinYear", joinYearVal != null ? String(joinYearVal) : "");
                    fd.set("college", collegeVal);
                    fd.set("major", majorVal);
                    fd.set("workLocation", workLocationVal);
                    fd.set("workPosition", workPositionVal);
                    if (member) {
                        fd.set("location", locationValue);
                        fd.set("phone", phoneValue);
                        fd.set("wechat", wechatValue);
                        fd.set("qq", qqValue);
                    }
                    formAction(fd);
                }}
                className="space-y-6 bg-card p-6 rounded-xl border border-brand-border-subtle"
            >
                {/* ══════════ 基本信息 ══════════ */}
                <div className="border-b pb-6 border-brand-border-subtle">
                  <h3 className="text-sm font-semibold mb-4 text-brand-navy">{t("profile.edit.basicInfo")}</h3>
                  {/* 头像 */}
                  <ImageDropZone
                    className="mb-5 rounded-xl p-1"
                    hint={t("profile.edit.avatarHint")}
                    disabled={avatarUploading || !avatarCooldown.canEdit}
                    onFile={(file) => openCropWith(file)}
                    onInvalid={(msg) => setAvatarError(msg)}
                  >
                    <div className="flex items-center gap-6">
                    <div className="shrink-0">
                        {avatarPreview ? (
                            <img
                                src={avatarPreview}
                                alt={t("profile.edit.avatarPreviewAlt")}
                                className="w-20 h-20 rounded-full object-cover border-2 border-brand-blue"
                            />
                        ) : (
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-brand-navy"
                            >
                                {(user.name ?? t("profile.edit.defaultInitial"))[0]}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm text-brand-text-body">
                            {t("profile.edit.avatar")}{" "}
                            {avatarCooldown.canEdit ? (
                                <span className="text-xs text-brand-text-muted">{t("profile.edit.avatarOnceHint")}</span>
                            ) : (
                                <span className="text-xs font-medium text-brand-orange">
                  {t("profile.edit.avatarCooldown", { n: avatarCooldown.remainingDays })}
                </span>
                            )}
                        </p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ACCEPT_ATTR}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={avatarUploading || !avatarCooldown.canEdit}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${avatarCooldown.canEdit ? "bg-brand-blue" : "bg-muted"}`}
                            >
                                {avatarUploading ? t("profile.edit.processing") : t("profile.edit.changeAvatar")}
                            </button>
                            {avatarSuccess && (
                                <span className="text-xs text-brand-green">✓ {avatarSuccess}</span>
                            )}
                        </div>
                        {avatarCooldown.canEdit && (
                            <p className="text-xs text-brand-text-muted">{t("profile.edit.dragHint")}</p>
                        )}
                        {avatarError && (
                            <p className="text-xs text-brand-orange">{avatarError}</p>
                        )}
                    </div>
                    </div>
                  </ImageDropZone>

                {/* 姓名 */}
                <div>
                    <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="name">
                        {t("profile.edit.displayName")}
                    </label>
                    <input
                        id="name"
                        name="name"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        required
                        className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                    />
                </div>

                {/* 个人介绍 — 所有用户可编辑 */}
                <div>
                    <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="bio">
                        {t("profile.edit.bio")}
                    </label>
                    <MentionEditor
                        id="bio"
                        name="bio"
                        value={bioValue}
                        onChange={setBioValue}
                        rows={4}
                        placeholder={t("profile.edit.bioPlaceholder")}
                        className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                    />
                </div>
                </div>

                {/* 社团成员专属字段 */}
                {member && (
                    <>
                        {/* ── 联系方式 ── */}
                        <div className="border-b pb-6 border-brand-border-subtle">
                          <h3 className="text-sm font-semibold mb-4 text-brand-navy">{t("profile.edit.contact")}</h3>
                        {/* 所在地 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="location">
                                {t("profile.edit.location")} <span className="text-xs text-brand-text-muted">{t("profile.edit.locationHint")}</span>
                            </label>
                            <input
                                id="location"
                                value={locationValue}
                                onChange={(e) => setLocationValue(e.target.value)}
                                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                placeholder={t("profile.edit.locationPlaceholder")}
                            />
                        </div>

                        {/* 联系方式 — 三列 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="phone">
                                    {t("profile.edit.phone")}
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">{t("profile.edit.sensitive")}</span>
                                </label>
                                <input
                                    id="phone"
                                    value={phoneValue}
                                    onChange={(e) => setPhoneValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder={t("profile.edit.phonePlaceholder")}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="wechat">
                                    {t("profile.edit.wechat")}
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">{t("profile.edit.sensitive")}</span>
                                </label>
                                <input
                                    id="wechat"
                                    value={wechatValue}
                                    onChange={(e) => setWechatValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder={t("profile.edit.wechatPlaceholder")}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="qq">
                                    {t("profile.edit.qq")}
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">{t("profile.edit.sensitive")}</span>
                                </label>
                                <input
                                    id="qq"
                                    value={qqValue}
                                    onChange={(e) => setQqValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder={t("profile.edit.qqPlaceholder")}
                                />
                            </div>
                        </div>
                        </div>

                        {/* 成员简介 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="memberBio">
                                {t("profile.edit.memberBio")} <span className="text-xs text-brand-text-muted">{t("profile.edit.memberBioHint")}</span>
                            </label>
                            <MentionEditor
                                id="memberBio"
                                name="memberBio"
                                defaultValue={member.bio ?? ""}
                                rows={4}
                                placeholder={t("profile.edit.memberBioPlaceholder")}
                                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                            />
                        </div>

                        {/* 毕业情况、入社年份、年级 — 紧凑三列 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body">
                                    {t("profile.edit.graduation")}
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none pt-2">
                                    <input
                                        type="checkbox"
                                        checked={graduatedVal}
                                        onChange={(e) => setGraduatedVal(e.target.checked)}
                                        className="w-4 h-4 rounded accent-brand-blue"
                                    />
                                    <span className="text-sm text-brand-text-heading">{t("profile.edit.graduated")}</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="joinYear">
                                    {t("members.joinYearLabel")}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setJoinYearVal(Math.max(2000, (joinYearVal ?? 2024) - 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded border text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0 border-brand-border-subtle text-brand-text-heading"
                                    >-</button>
                                    <input
                                        id="joinYear"
                                        type="number"
                                        value={joinYearVal ?? ""}
                                        onChange={(e) => setJoinYearVal(e.target.value ? Number(e.target.value) : null)}
                                        min={2000}
                                        max={2100}
                                        className="w-20 text-center rounded-lg bg-card border px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent text-sm border-brand-border-subtle text-brand-text-heading"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setJoinYearVal(Math.min(2100, (joinYearVal ?? 2024) + 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded border text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0 border-brand-border-subtle text-brand-text-heading"
                                    >+</button>
                                    <span className="text-xs flex-shrink-0 text-brand-text-secondary">{joinYearVal != null ? t("profile.edit.yearValue", { n: joinYearVal }) : t("common.unset")}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="grade">
                                    {t("members.gradeLabel")}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setGradeValue(Math.max(2000, (gradeValue ?? 2024) - 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded border text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0 border-brand-border-subtle text-brand-text-heading"
                                    >-</button>
                                    <input
                                        id="grade"
                                        type="number"
                                        value={gradeValue ?? ""}
                                        onChange={(e) => setGradeValue(e.target.value ? Number(e.target.value) : null)}
                                        min={2000}
                                        max={2100}
                                        className="w-20 text-center rounded-lg bg-card border px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent text-sm border-brand-border-subtle text-brand-text-heading"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setGradeValue(Math.min(2100, (gradeValue ?? 2024) + 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded border text-sm font-medium hover:bg-gray-100 transition-colors flex-shrink-0 border-brand-border-subtle text-brand-text-heading"
                                    >+</button>
                                    <span className="text-xs flex-shrink-0 text-brand-text-secondary">{gradeValue != null ? t("profile.edit.gradeValue", { n: gradeValue }) : t("common.unset")}</span>
                                </div>
                            </div>
                        </div>

                        {/* 真名、学院/工作所在地、专业/岗位 — 三列（仿手机号/微信/QQ） */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="realName">
                                    {t("profile.edit.realName")}
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                          title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                                </label>
                                <input
                                    id="realName"
                                    value={realNameVal}
                                    onChange={(e) => setRealNameVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder={t("profile.edit.realNamePlaceholder")}
                                />
                            </div>
                            {!graduatedVal ? (
                                <>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="college">
                                            {t("profile.edit.college")}
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                                        </label>
                                        <input
                                            id="college"
                                            value={collegeVal}
                                            onChange={(e) => setCollegeVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder={t("profile.edit.collegePlaceholder")}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="major">
                                            {t("profile.edit.major")}
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                                        </label>
                                        <input
                                            id="major"
                                            value={majorVal}
                                            onChange={(e) => setMajorVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder={t("profile.edit.majorPlaceholder")}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="workLocation">
                                            {t("profile.edit.workLocation")}
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                                        </label>
                                        <input
                                            id="workLocation"
                                            value={workLocationVal}
                                            onChange={(e) => setWorkLocationVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder={t("profile.edit.workLocationPlaceholder")}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="workPosition">
                                            {t("profile.edit.workPosition")}
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                                        </label>
                                        <input
                                            id="workPosition"
                                            value={workPositionVal}
                                            onChange={(e) => setWorkPositionVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder={t("profile.edit.workPositionPlaceholder")}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 职能标签 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body">{t("profile.edit.skills")}</label>
                            {/* 快捷预设 */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {SKILL_PRESETS.filter(tag => !skills.includes(tag)).map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSkills([...skills, tag])}
                                        className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-brand-surface hover:border-brand-blue hover:text-brand-blue border-brand-border-subtle text-brand-text-muted"
                                    >
                                        + {t(SKILL_PRESET_KEYS[tag])}
                                    </button>
                                ))}
                            </div>
                            {/* 已选标签 */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {skills.map((s) => (
                                    <span
                                        key={s}
                                        className="text-xs px-2 py-0.5 rounded cursor-pointer select-none bg-brand-surface text-brand-blue"
                                        onClick={() => removeSkill(s)}
                                    >
                    {SKILL_PRESET_KEYS[s] ? t(SKILL_PRESET_KEYS[s]) : s} ×
                  </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={skillInput}
                                    onChange={(e) => setSkillInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addSkill();
                                        }
                                    }}
                                    className="flex-1 rounded-lg bg-card border px-4 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent text-sm border-brand-border-subtle text-brand-text-heading"
                                    placeholder={t("profile.edit.skillPlaceholder")}
                                />
                                <button
                                    type="button"
                                    onClick={addSkill}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-brand-orange"
                                >
                                    {t("profile.edit.add")}
                                </button>
                            </div>
                        </div>

                        {/* ══════════ 自定义链接 ══════════ */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body">
                                {t("profile.edit.links")} <span className="text-xs text-brand-text-muted">{t("profile.edit.linksHint")}</span>
                            </label>

                            {/* 已添加的链接 */}
                            {socialLinks.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {socialLinks.map((link, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-brand-border-subtle bg-muted text-sm">
                      <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-brand-navy text-white">
                        {LINK_LABEL_KEYS[link.label] ? t(LINK_LABEL_KEYS[link.label]) : link.label}
                      </span>
                                            <span className="flex-1 truncate text-brand-text-secondary">{link.url}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeLink(i)}
                                                className="text-xs shrink-0 hover:underline text-brand-orange"
                                            >
                                                {t("profile.edit.remove")}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 添加链接 */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                {/* 标签选择 */}
                                <div className="sm:w-28 shrink-0">
                                    {showCustomLabel ? (
                                        <input
                                            value={newLinkLabel}
                                            onChange={(e) => setNewLinkLabel(e.target.value)}
                                            placeholder={t("profile.edit.customLabelPlaceholder")}
                                            className="w-full rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addLink();
                                                }
                                            }}
                                        />
                                    ) : (
                                        <select
                                            value={newLinkLabel}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "__custom__") {
                                                    setShowCustomLabel(true);
                                                    setNewLinkLabel("");
                                                } else setNewLinkLabel(v);
                                            }}
                                            className="w-full rounded-lg bg-card border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                        >
                                            <option value="">{t("profile.edit.selectLabel")}</option>
                                            {LINK_LABEL_PRESETS.map((l) => (
                                                <option key={l} value={l}>{LINK_LABEL_KEYS[l] ? t(LINK_LABEL_KEYS[l]) : l}</option>
                                            ))}
                                            <option value="__custom__">{t("profile.edit.customLabel")}</option>
                                        </select>
                                    )}
                                </div>
                                {/* URL 输入 */}
                                <input
                                    value={newLinkUrl}
                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                    type="url"
                                    placeholder="https://..."
                                    className="flex-1 rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addLink();
                                        }
                                    }}
                                />
                                {/* 添加按钮 */}
                                <button
                                    type="button"
                                    onClick={addLink}
                                    disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 shrink-0 bg-brand-blue"
                                >
                                    {t("profile.edit.add")}
                                </button>
                            </div>
                        </div>

                        {/* ══════════ 经历（学习 + 工作）══════════ */}
                        <div className="border-t pt-5 border-[#E8F0F8]">
                          <label className="block text-sm mb-2 text-brand-text-body">
                            {t("profile.edit.experience")}
                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                  title={t("profile.edit.sensitiveTitle")}>{t("profile.edit.sensitive")}</span>
                            <span className="text-xs ml-1 text-brand-text-muted">{t("profile.edit.experienceHint")}</span>
                          </label>

                          {/* 已有经历列表 */}
                          {workExperiences.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {workExperiences.map((exp) => {
                                const startStr = `${new Date(exp.startDate).getFullYear()}.${String(new Date(exp.startDate).getMonth() + 1).padStart(2, "0")}`;
                                const endStr = exp.endDate
                                  ? `${new Date(exp.endDate).getFullYear()}.${String(new Date(exp.endDate).getMonth() + 1).padStart(2, "0")}`
                  : t("profile.edit.present");
                                const isStudy = exp.type === "学习";
                                return (
                                  <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border border-brand-border-subtle bg-muted text-sm">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${isStudy ? "bg-brand-surface text-brand-blue" : "bg-[#FFF3E0] text-brand-orange"}`}>
                                      {isStudy ? t("profile.edit.study") : t("profile.edit.work")}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-brand-text-heading">{exp.company}</span>
                                      <span className="mx-1 text-brand-text-muted">·</span>
                                      <span className="text-brand-text-secondary">{exp.position}</span>
                                    </div>
                                    <span className="text-xs shrink-0 text-brand-text-muted">{startStr} ~ {endStr}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeWorkExperience(exp.id)}
                                      disabled={expSaving}
                                      className="text-xs shrink-0 hover:underline disabled:opacity-50 text-brand-orange"
                                    >
                                      {t("profile.edit.remove")}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 添加新经历 */}
                          <div className="p-3 rounded-lg border border-brand-border-subtle bg-muted">
                            {/* 类型选择 */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-xs text-brand-text-secondary">{t("profile.edit.type")}</span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="expType"
                                  checked={newExpType === "工作"}
                                  onChange={() => setNewExpType("工作")}
                                  className="w-3.5 h-3.5 accent-brand-orange"
                                />
                                <span className="text-sm text-brand-text-heading">{t("profile.edit.work")}</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="expType"
                                  checked={newExpType === "学习"}
                                  onChange={() => setNewExpType("学习")}
                                  className="w-3.5 h-3.5 accent-brand-blue"
                                />
                                <span className="text-sm text-brand-text-heading">{t("profile.edit.study")}</span>
                              </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                              <input
                                value={newExpCompany}
                                onChange={(e) => setNewExpCompany(e.target.value)}
                                placeholder={newExpType === "学习" ? t("profile.edit.schoolPlaceholder") : t("profile.edit.companyPlaceholder")}
                                className="rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                              />
                              <input
                                value={newExpPosition}
                                onChange={(e) => setNewExpPosition(e.target.value)}
                                placeholder={newExpType === "学习" ? t("profile.edit.majorDegreePlaceholder") : t("profile.edit.positionPlaceholder")}
                                className="rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                              />
                              <div>
                                <label className="block text-xs mb-0.5 text-brand-text-muted">
                                  {newExpType === "学习" ? t("profile.edit.enrollDate") : t("profile.edit.joinDate")}
                                </label>
                                <input
                                  type="month"
                                  value={newExpStart}
                                  onChange={(e) => setNewExpStart(e.target.value)}
                                  className="w-full rounded-lg bg-card border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                />
                              </div>
                              <div>
                                <label className="block text-xs mb-0.5 text-brand-text-muted">
                                  {newExpType === "学习" ? t("profile.edit.gradDate") : t("profile.edit.leaveDate")}
                                </label>
                                <input
                                  type="month"
                                  value={newExpEnd}
                                  onChange={(e) => setNewExpEnd(e.target.value)}
                                  className="w-full rounded-lg bg-card border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={addWorkExperience}
                                disabled={expSaving || !newExpCompany.trim() || !newExpPosition.trim() || !newExpStart}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 bg-brand-green"
                              >
                                {expSaving ? t("common.saving") : t("profile.edit.addExperience")}
                              </button>
                              {expMsg && (
                                <span className={`text-xs ${expError ? "text-brand-orange" : "text-brand-green"}`}>
                                  {expMsg}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                    </>
                )}

                {/* ══════════ 邀请码兑换（仅非管理员/非成员显示）══════════ */}
                {!isAdmin && !member && (
                    <div className="border-t pt-4 border-[#E8F0F8]">
                        <label className="block text-sm mb-1.5 text-brand-text-body">
                            {t("profile.edit.invite")} <span className="text-xs text-brand-text-muted">{t("profile.edit.inviteHint")}</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={inviteInput}
                                onChange={(e) => setInviteInput(e.target.value)}
                                placeholder={t("profile.edit.invitePlaceholder")}
                                className="flex-1 rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleRedeemInvite();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleRedeemInvite}
                                disabled={invitePending || !inviteInput.trim()}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 whitespace-nowrap bg-brand-orange"
                            >
                                {invitePending ? t("profile.edit.redeeming") : t("profile.edit.redeem")}
                            </button>
                        </div>
                        {inviteMsg && <p className="text-xs mt-1 text-brand-green">{inviteMsg}</p>}
                        {inviteError && <p className="text-xs mt-1 text-brand-orange">{inviteError}</p>}
                    </div>
                )}

                {/* 错误提示 */}
                {state?.error && (
                    <div className="text-sm px-4 py-2.5 rounded-lg bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">
                        {state.error}
                    </div>
                )}

                {/* 提交按钮 */}
                <SubmitButton
                    type="submit"
                    disabled={!canSave}
                    pendingText={t("common.saving")}
                    className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {!hasChanged ? t("profile.edit.noChange") : t("profile.edit.save")}
                </SubmitButton>
            </form>

            {/* ══════════ 裁剪弹窗 ══════════ */}
            {showCrop && cropSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleCropCancel}>
                    <div
                        className="bg-card rounded-2xl w-[420px] max-w-[95vw] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative w-full h-80 bg-gray-900">
                            <Cropper
                                image={cropSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_: any, croppedAreaPixels: any) => setCroppedPixels(croppedAreaPixels)}
                            />
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{t("profile.edit.zoom")}</span>
                                <input
                                    type="range" min={1} max={3} step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={handleCropCancel} className="px-4 py-2 rounded-lg border text-sm">{t("profile.edit.cancel")}
                                </button>
                                <button
                                    type="button" onClick={handleCropConfirm}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-blue"
                                >
                                    {t("profile.edit.confirmCrop")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
