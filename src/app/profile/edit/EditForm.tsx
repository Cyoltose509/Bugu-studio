"use client";

import { useActionState, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { saveProfile, redeemInviteCode } from "./actions";
import Cropper from "react-easy-crop";
import { getCroppedImg, readFileAsDataURL } from "@/lib/utils/imageCrop";

type UserSnippet = { id: string; name: string | null; image: string | null };
type MemberSnippet = {
  id: string;
  displayName: string;
  bio: string | null;
  grade: string | null;
  skills: string[];
  githubUrl: string | null;
  itchUrl: string | null;
  website: string | null;
};
type CooldownInfo = { canEdit: boolean; remainingDays: number };

export default function EditForm({
  user,
  member,
  isAdmin,
  avatarCooldown,
  nameCooldown,
}: {
  user: UserSnippet;
  member: MemberSnippet | null;
  isAdmin: boolean;
  avatarCooldown: CooldownInfo;
  nameCooldown: CooldownInfo;
}) {
  const { update: updateSession } = useSession();

  const [state, formAction, pending] = useActionState(
    async (_prev: any, formData: FormData) => {
      return saveProfile(formData);
    },
    null
  );

  // 表单原始值（用于检测是否有修改）
  const originalName = user.name ?? "";
  const originalBio = member?.bio ?? "";
  const originalSkills = member?.skills ?? [];
  const originalGithub = member?.githubUrl ?? "";
  const originalItch = member?.itchUrl ?? "";
  const originalWebsite = member?.website ?? "";

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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);

  // 邀请码
  const [inviteInput, setInviteInput] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

  // 检测表单是否有修改
  const [nameValue, setNameValue] = useState(originalName);
  const [bioValue, setBioValue] = useState(originalBio);
  const [githubValue, setGithubValue] = useState(originalGithub);
  const [itchValue, setItchValue] = useState(originalItch);
  const [websiteValue, setWebsiteValue] = useState(originalWebsite);

  const hasChanged =
    nameValue !== originalName ||
    (member && bioValue !== originalBio) ||
    (member && githubValue !== originalGithub) ||
    (member && itchValue !== originalItch) ||
    (member && websiteValue !== originalWebsite) ||
    JSON.stringify(skills) !== JSON.stringify(originalSkills);

  const canSave = hasChanged && !pending;

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
      const { blob } = await getCroppedImg(cropSrc, croppedPixels, 400, 0.85);
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      setAvatarPreview(json.url);
      setAvatarSuccess("头像已更新");

      // 刷新 session，让导航栏等位置立刻显示新头像
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
          fd.set("skills", skills.join(","));
          formAction(fd);
        }}
        className="space-y-6 bg-white p-6 rounded-xl border"
        style={{ borderColor: "#D0DEE8" }}
      >
        {/* ══════════ 头像 ══════════ */}
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="头像预览"
                className="w-20 h-20 rounded-full object-cover border-2"
                style={{ borderColor: "#3388BB" }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: "#25547A" }}
              >
                {(user.name ?? "用")[0]}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm" style={{ color: "#555" }}>
              头像{" "}
              {avatarCooldown.canEdit ? (
                <span className="text-xs" style={{ color: "#999" }}>(7天内只能更换一次)</span>
              ) : (
                <span className="text-xs font-medium" style={{ color: "#E38043" }}>
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
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: avatarCooldown.canEdit ? "#3388BB" : "#999" }}
              >
                {avatarUploading ? "处理中..." : "更换头像"}
              </button>
              {avatarSuccess && (
                <span className="text-xs" style={{ color: "#88C232" }}>✓ {avatarSuccess}</span>
              )}
            </div>
            {avatarError && (
              <p className="text-xs" style={{ color: "#E38043" }}>{avatarError}</p>
            )}
          </div>
        </div>

        {/* 姓名 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="name">
            显示名称{" "}
            {nameCooldown.canEdit ? (
              <span className="text-xs" style={{ color: "#999" }}>(7天内只能修改一次)</span>
            ) : (
              <span className="text-xs font-medium" style={{ color: "#E38043" }}>
                冷却中 — {nameCooldown.remainingDays} 天后可修改
              </span>
            )}
          </label>
          <input
            id="name"
            name="name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            required
            disabled={!nameCooldown.canEdit}
            className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            style={{ borderColor: nameCooldown.canEdit ? "#D0DEE8" : "#E38043", color: nameCooldown.canEdit ? "#333" : "#999" }}
          />
        </div>

        {/* 社团成员专属字段 */}
        {member && (
          <>
            {/* 个人简介 */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="bio">
                个人简介
              </label>
              <textarea
                id="bio"
                name="bio"
                value={bioValue}
                onChange={(e) => setBioValue(e.target.value)}
                rows={4}
                className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent resize-y"
                style={{ borderColor: "#D0DEE8", color: "#333" }}
                placeholder="介绍一下自己..."
              />
            </div>

            {/* 年级 */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="grade">
                年级
                {!isAdmin && <span className="text-xs ml-1" style={{ color: "#999" }}>(管理员设置)</span>}
              </label>
              {isAdmin ? (
                <select
                  id="grade"
                  name="grade"
                  defaultValue={member.grade ?? ""}
                  className="w-full rounded-lg bg-white border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent text-sm"
                  style={{ borderColor: "#D0DEE8", color: "#333" }}
                >
                  <option value="">请选择年级</option>
                  {Array.from(
                    { length: new Date().getFullYear() - 2017 + 2 },
                    (_, i) => 2018 + i
                  ).map((y) => (
                    <option key={y} value={`${y}级`}>{y}级</option>
                  ))}
                </select>
              ) : (
                <div
                  className="w-full rounded-lg bg-gray-50 border px-4 py-2.5 text-sm"
                  style={{ borderColor: "#D0DEE8", color: "#666" }}
                >
                  {member.grade || "未设置（联系管理员）"}
                </div>
              )}
            </div>

            {/* 职能标签 */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }}>职能标签</label>
              {/* 快捷预设 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {["程序", "策划", "美术", "音效", "制作人"].filter(t => !skills.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSkills([...skills, tag])}
                    className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-[#E6F0F8] hover:border-[#3388BB] hover:text-[#3388BB]"
                    style={{ borderColor: "#D0DEE8", color: "#888" }}
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
                    className="text-xs px-2 py-0.5 rounded cursor-pointer select-none"
                    style={{ background: "#E6F0F8", color: "#3388BB" }}
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
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  className="flex-1 rounded-lg bg-white border px-4 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent text-sm"
                  style={{ borderColor: "#D0DEE8", color: "#333" }}
                  placeholder="输入自定义职能后回车添加"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "#E38043" }}
                >
                  添加
                </button>
              </div>
            </div>

            {/* GitHub */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="githubUrl">
                GitHub 主页
              </label>
              <input
                id="githubUrl"
                name="githubUrl"
                type="url"
                value={githubValue}
                onChange={(e) => setGithubValue(e.target.value)}
                className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
                style={{ borderColor: "#D0DEE8", color: "#333" }}
                placeholder="https://github.com/..."
              />
            </div>

            {/* Itch.io */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="itchUrl">
                Itch.io 主页
              </label>
              <input
                id="itchUrl"
                name="itchUrl"
                type="url"
                value={itchValue}
                onChange={(e) => setItchValue(e.target.value)}
                className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
                style={{ borderColor: "#D0DEE8", color: "#333" }}
                placeholder="https://yourname.itch.io/..."
              />
            </div>

            {/* 个人网站 */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#555" }} htmlFor="website">
                个人网站
              </label>
              <input
                id="website"
                name="website"
                type="url"
                value={websiteValue}
                onChange={(e) => setWebsiteValue(e.target.value)}
                className="w-full rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
                style={{ borderColor: "#D0DEE8", color: "#333" }}
                placeholder="https://..."
              />
            </div>
          </>
        )}

        {/* ══════════ 邀请码兑换 ══════════ */}
        <div className="border-t pt-4" style={{ borderColor: "#E8F0F8" }}>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>
            邀请码兑换 <span className="text-xs" style={{ color: "#999" }}>(升级为社团成员或管理员)</span>
          </label>
          <div className="flex gap-2">
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="输入邀请码"
              className="flex-1 rounded-lg bg-white border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent"
              style={{ borderColor: "#D0DEE8", color: "#333" }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRedeemInvite(); } }}
            />
            <button
              type="button"
              onClick={handleRedeemInvite}
              disabled={invitePending || !inviteInput.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 whitespace-nowrap"
              style={{ background: "#E38043" }}
            >
              {invitePending ? "兑换中..." : "兑换"}
            </button>
          </div>
          {inviteMsg && (
            <p className="text-xs mt-1" style={{ color: "#88C232" }}>{inviteMsg}</p>
          )}
          {inviteError && (
            <p className="text-xs mt-1" style={{ color: "#E38043" }}>{inviteError}</p>
          )}
        </div>

        {/* 错误提示 */}
        {state?.error && (
          <div className="text-sm px-4 py-2.5 rounded-lg" style={{ background: "#FDE8E8", color: "#C62828" }}>
            {state.error}
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={!canSave}
          className="btn-primary w-full py-2.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "保存中..." : !hasChanged ? "无修改" : "保存修改"}
        </button>
      </form>

      {/* ══════════ 裁剪弹窗 ══════════ */}
      {showCrop && cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleCropCancel}>
          <div
            className="bg-white rounded-2xl w-[420px] max-w-[95vw] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-80 bg-gray-900">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
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
                <button type="button" onClick={handleCropCancel} className="px-4 py-2 rounded-lg border text-sm">取消</button>
                <button
                  type="button" onClick={handleCropConfirm}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "#3388BB" }}
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
