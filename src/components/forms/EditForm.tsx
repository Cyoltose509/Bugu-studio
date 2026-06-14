"use client";

import {useActionState, useState, useRef, useEffect} from "react";
import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {saveProfile, redeemInviteCode} from "@/app/profile/edit/actions";
import {SubmitButton} from "@/components/ui/SubmitButton";
import Cropper from "react-easy-crop";
import {getCroppedImg, readFileAsDataURL} from "@/lib/utils/imageCrop";
import MentionEditor from "@/components/ui/MentionEditor";

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
    try {
      const res = await fetch(`/api/members/${member.id}/work-experience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, company, position, startDate, endDate: newExpEnd || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "添加失败");
      }
      const created = await res.json();
      setWorkExperiences((prev: MemberSnippet["workExperiences"]) => [...prev, created]);
      setNewExpCompany("");
      setNewExpPosition("");
      setNewExpStart("");
      setNewExpEnd("");
      setExpMsg("已添加");
      setTimeout(() => setExpMsg(""), 2000);
    } catch (e: any) {
      setExpMsg(e.message || "添加失败");
    } finally {
      setExpSaving(false);
    }
  }

  async function removeWorkExperience(expId: string) {
    if (!member) return;
    setExpSaving(true);
    setExpMsg("");
    try {
      const res = await fetch(`/api/members/${member.id}/work-experience`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: expId }),
      });
      if (!res.ok) throw new Error("删除失败");
      setWorkExperiences((prev: MemberSnippet["workExperiences"]) => prev.filter((e: MemberSnippet["workExperiences"][number]) => e.id !== expId));
      setExpMsg("已删除");
      setTimeout(() => setExpMsg(""), 2000);
    } catch {
      setExpMsg("删除失败");
    } finally {
      setExpSaving(false);
    }
  }

    // 文件选择 → 打开裁剪弹窗
    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarError("");
        setAvatarSuccess("");
        try {
            const dataUrl = await readFileAsDataURL(file);
            setCropSrc(dataUrl);
            setShowCrop(true);
        } catch {
            setAvatarError("读取图片失败");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
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
            const fd = new FormData();
            fd.append("file", new File([blob], "avatar.jpg", {type: "image/jpeg"}));
            const res = await fetch("/api/upload/avatar", {method: "POST", body: fd});
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "上传失败");
            setAvatarPreview(json.url);
            setAvatarSuccess("头像已更新");
            await updateSession();
        } catch (err: any) {
            setAvatarError(err.message || "上传失败");
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
            setInviteError("兑换失败，请稍后重试");
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
                  <h3 className="text-sm font-semibold mb-4 text-brand-navy">基本信息</h3>
                  {/* 头像 */}
                  <div className="flex items-center gap-6 mb-5">
                    <div className="shrink-0">
                        {avatarPreview ? (
                            <img
                                src={avatarPreview}
                                alt="头像预览"
                                className="w-20 h-20 rounded-full object-cover border-2 border-brand-blue"
                            />
                        ) : (
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-brand-navy"
                            >
                                {(user.name ?? "用")[0]}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm text-brand-text-body">
                            头像{" "}
                            {avatarCooldown.canEdit ? (
                                <span className="text-xs text-brand-text-muted">(7天内只能更换一次)</span>
                            ) : (
                                <span className="text-xs font-medium text-brand-orange">
                  冷却中 — {avatarCooldown.remainingDays} 天后可更换
                </span>
                            )}
                        </p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
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
                                {avatarUploading ? "处理中..." : "更换头像"}
                            </button>
                            {avatarSuccess && (
                                <span className="text-xs text-brand-green">✓ {avatarSuccess}</span>
                            )}
                        </div>
                        {avatarError && (
                            <p className="text-xs text-brand-orange">{avatarError}</p>
                        )}
                    </div>
                </div>

                {/* 姓名 */}
                <div>
                    <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="name">
                        显示名称
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
                        个人介绍
                    </label>
                    <MentionEditor
                        id="bio"
                        name="bio"
                        value={bioValue}
                        onChange={setBioValue}
                        rows={4}
                        placeholder="介绍一下自己..."
                        className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                    />
                </div>
                </div>

                {/* 社团成员专属字段 */}
                {member && (
                    <>
                        {/* ── 联系方式 ── */}
                        <div className="border-b pb-6 border-brand-border-subtle">
                          <h3 className="text-sm font-semibold mb-4 text-brand-navy">联系方式与所在地</h3>
                        {/* 所在地 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="location">
                                所在地 <span className="text-xs text-brand-text-muted">(省份或国家)</span>
                            </label>
                            <input
                                id="location"
                                value={locationValue}
                                onChange={(e) => setLocationValue(e.target.value)}
                                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                placeholder="如：广东 / 北京 / 日本"
                            />
                        </div>

                        {/* 联系方式 — 三列 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="phone">
                                    电话
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">敏感</span>
                                </label>
                                <input
                                    id="phone"
                                    value={phoneValue}
                                    onChange={(e) => setPhoneValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder="手机号"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="wechat">
                                    微信
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">敏感</span>
                                </label>
                                <input
                                    id="wechat"
                                    value={wechatValue}
                                    onChange={(e) => setWechatValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder="微信号"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="qq">
                                    QQ
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]">敏感</span>
                                </label>
                                <input
                                    id="qq"
                                    value={qqValue}
                                    onChange={(e) => setQqValue(e.target.value)}
                                    className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder="QQ号"
                                />
                            </div>
                        </div>
                        </div>

                        {/* 成员简介 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="memberBio">
                                成员简介 <span className="text-xs text-brand-text-muted">(社团成员页展示，如留空则使用上方个人介绍)</span>
                            </label>
                            <MentionEditor
                                id="memberBio"
                                name="memberBio"
                                defaultValue={member.bio ?? ""}
                                rows={4}
                                placeholder="在成员页面展示的简介..."
                                className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                            />
                        </div>

                        {/* 毕业情况、入社年份、年级 — 紧凑三列 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body">
                                    毕业情况
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none pt-2">
                                    <input
                                        type="checkbox"
                                        checked={graduatedVal}
                                        onChange={(e) => setGraduatedVal(e.target.checked)}
                                        className="w-4 h-4 rounded accent-brand-blue"
                                    />
                                    <span className="text-sm text-brand-text-heading">已毕业</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="joinYear">
                                    入社年份
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
                                    <span className="text-xs flex-shrink-0 text-brand-text-secondary">{joinYearVal != null ? `${joinYearVal}年` : "未设置"}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="grade">
                                    年级
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
                                    <span className="text-xs flex-shrink-0 text-brand-text-secondary">{gradeValue != null ? `${gradeValue}级` : "未设置"}</span>
                                </div>
                            </div>
                        </div>

                        {/* 真名、学院/工作所在地、专业/岗位 — 三列（仿手机号/微信/QQ） */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="realName">
                                    真名
                                    <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                          title="仅成员可见">敏感</span>
                                </label>
                                <input
                                    id="realName"
                                    value={realNameVal}
                                    onChange={(e) => setRealNameVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                    placeholder="真实姓名"
                                />
                            </div>
                            {!graduatedVal ? (
                                <>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="college">
                                            学院
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title="仅成员可见">敏感</span>
                                        </label>
                                        <input
                                            id="college"
                                            value={collegeVal}
                                            onChange={(e) => setCollegeVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder="如：计算机学院"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="major">
                                            专业
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title="仅成员可见">敏感</span>
                                        </label>
                                        <input
                                            id="major"
                                            value={majorVal}
                                            onChange={(e) => setMajorVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder="如：软件工程"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="workLocation">
                                            工作所在地
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title="仅成员可见">敏感</span>
                                        </label>
                                        <input
                                            id="workLocation"
                                            value={workLocationVal}
                                            onChange={(e) => setWorkLocationVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder="如：北京 / 深圳"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="workPosition">
                                            工作岗位
                                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                                  title="仅成员可见">敏感</span>
                                        </label>
                                        <input
                                            id="workPosition"
                                            value={workPositionVal}
                                            onChange={(e) => setWorkPositionVal(e.target.value)}
className="w-full rounded-lg bg-card border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                                            placeholder="如：前端工程师"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 职能标签 */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body">职能标签</label>
                            {/* 快捷预设 */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {["程序", "策划", "美术", "音效", "音乐", "测试", "宣发", "全栈"].filter(t => !skills.includes(t)).map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSkills([...skills, tag])}
                                        className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-brand-surface hover:border-brand-blue hover:text-brand-blue border-brand-border-subtle text-brand-text-muted"
                                    >
                                        + {tag}
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
                    {s} ×
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
                                    placeholder="输入自定义职能后回车添加"
                                />
                                <button
                                    type="button"
                                    onClick={addSkill}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-brand-orange"
                                >
                                    添加
                                </button>
                            </div>
                        </div>

                        {/* ══════════ 自定义链接 ══════════ */}
                        <div>
                            <label className="block text-sm mb-1.5 text-brand-text-body">
                                个人链接 <span className="text-xs text-brand-text-muted">(可添加多个，如 GitHub、B站、个人网站等)</span>
                            </label>

                            {/* 已添加的链接 */}
                            {socialLinks.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {socialLinks.map((link, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-brand-border-subtle bg-muted text-sm">
                      <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-brand-navy text-white">
                        {link.label}
                      </span>
                                            <span className="flex-1 truncate text-brand-text-secondary">{link.url}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeLink(i)}
                                                className="text-xs shrink-0 hover:underline text-brand-orange"
                                            >
                                                移除
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
                                            placeholder="自定义标签"
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
                                            <option value="">选择标签</option>
                                            {LINK_LABEL_PRESETS.map((l) => (
                                                <option key={l} value={l}>{l}</option>
                                            ))}
                                            <option value="__custom__">自定义...</option>
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
                                    添加
                                </button>
                            </div>
                        </div>

                        {/* ══════════ 经历（学习 + 工作）══════════ */}
                        <div className="border-t pt-5 border-[#E8F0F8]">
                          <label className="block text-sm mb-2 text-brand-text-body">
                            经历
                            <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-[var(--ui-bg-red-light)] text-[var(--ui-text-red)]"
                                  title="仅成员可见">敏感</span>
                            <span className="text-xs ml-1 text-brand-text-muted">(学习经历与工作经历)</span>
                          </label>

                          {/* 已有经历列表 */}
                          {workExperiences.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {workExperiences.map((exp) => {
                                const startStr = `${new Date(exp.startDate).getFullYear()}.${String(new Date(exp.startDate).getMonth() + 1).padStart(2, "0")}`;
                                const endStr = exp.endDate
                                  ? `${new Date(exp.endDate).getFullYear()}.${String(new Date(exp.endDate).getMonth() + 1).padStart(2, "0")}`
                                  : "至今";
                                const isStudy = exp.type === "学习";
                                return (
                                  <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border border-brand-border-subtle bg-muted text-sm">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${isStudy ? "bg-brand-surface text-brand-blue" : "bg-[#FFF3E0] text-brand-orange"}`}>
                                      {isStudy ? "学习" : "工作"}
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
                                      移除
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
                              <span className="text-xs text-brand-text-secondary">类型：</span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="expType"
                                  checked={newExpType === "工作"}
                                  onChange={() => setNewExpType("工作")}
                                  className="w-3.5 h-3.5 accent-brand-orange"
                                />
                                <span className="text-sm text-brand-text-heading">工作</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="expType"
                                  checked={newExpType === "学习"}
                                  onChange={() => setNewExpType("学习")}
                                  className="w-3.5 h-3.5 accent-brand-blue"
                                />
                                <span className="text-sm text-brand-text-heading">学习</span>
                              </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                              <input
                                value={newExpCompany}
                                onChange={(e) => setNewExpCompany(e.target.value)}
                                placeholder={newExpType === "学习" ? "学校/机构名称" : "公司/组织名称"}
                                className="rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                              />
                              <input
                                value={newExpPosition}
                                onChange={(e) => setNewExpPosition(e.target.value)}
                                placeholder={newExpType === "学习" ? "专业/学位" : "职位"}
                                className="rounded-lg bg-card border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent border-brand-border-subtle text-brand-text-heading"
                              />
                              <div>
                                <label className="block text-xs mb-0.5 text-brand-text-muted">
                                  {newExpType === "学习" ? "入学时间" : "入职时间"}
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
                                  {newExpType === "学习" ? "毕业时间（留空=在读）" : "离职时间（留空=至今）"}
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
                                {expSaving ? "保存中..." : "+ 添加经历"}
                              </button>
                              {expMsg && (
                                <span className={`text-xs ${expMsg.includes("失败") ? "text-brand-orange" : "text-brand-green"}`}>
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
                            邀请码兑换 <span className="text-xs text-brand-text-muted">(升级为社团成员或管理员)</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={inviteInput}
                                onChange={(e) => setInviteInput(e.target.value)}
                                placeholder="输入邀请码"
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
                                {invitePending ? "兑换中..." : "兑换"}
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
                    pendingText="保存中..."
                    className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {!hasChanged ? "无修改" : "保存修改"}
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
                                onCropComplete={(_, croppedAreaPixels) => setCroppedPixels(croppedAreaPixels)}
                            />
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">缩放</span>
                                <input
                                    type="range" min={1} max={3} step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={handleCropCancel} className="px-4 py-2 rounded-lg border text-sm">取消
                                </button>
                                <button
                                    type="button" onClick={handleCropConfirm}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-blue"
                                >
                                    确认裁剪
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
