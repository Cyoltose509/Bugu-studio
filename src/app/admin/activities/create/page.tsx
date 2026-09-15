/**
 * 管理后台 - 创建活动
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createActivity } from "../actions";
import { ActivityType } from "@prisma/client";
import CoverUploadInput from "@/components/activities/CoverUploadInput";
import LocationPresetInput from "@/components/activities/LocationPresetInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import MentionEditor from "@/components/ui/MentionEditor";
import { DEFAULT_ACTIVITY_LOCATION } from "@/lib/activities/constants";

const TYPE_OPTIONS = [
  { value: "MEETING",    label: "例会" },
  { value: "COURSE",     label: "公开课" },
  { value: "COMPETITION", label: "比赛 / Game Jam" },
  { value: "GENERAL",    label: "普通活动" },
];

export default function CreateActivityPage() {
  const router = useRouter();
  const [type, setType] = useState("GENERAL");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // 辅助：解析 datetime-local 字符串 "YYYY-MM-DDTHH:mm" 为本地时间
  function parseLocal(val: string): Date {
    const [datePart, timePart] = val.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }

  // 辅助：格式化 Date 为 datetime-local 值（本地时间，不带时区）
  function formatLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 例会：开始时间变更时自动设置结束时间 = 开始时间 + 2 小时
  function handleStartTimeChange(val: string) {
    setStartTime(val);
    if (type === "MEETING" && val) {
      const start = parseLocal(val);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      setEndTime(formatLocal(end));
    }
  }

  // 生成默认标题
  function getDefaultTitle(): string {
    if (!startTime) return "";
    const [datePart] = startTime.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const label = TYPE_OPTIONS.find(t => t.value === type)?.label || "活动";
    return `${year}年${month}月${day}日 ${label}`;
  }

  async function handleSubmit(formData: FormData) {
    // 标题为空时自动生成
    if (!(formData.get("title") as string).trim() && startTime) {
      formData.set("title", getDefaultTitle());
    }
    // 地点默认为预设值
    if (!(formData.get("location") as string).trim()) {
      formData.set("location", DEFAULT_ACTIVITY_LOCATION);
    }
    const result = await createActivity(formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
    } else if (result && "success" in result && result.id) {
      // 例会创建后进入编辑页，方便录入分享条目
      router.push(
        type === "MEETING"
          ? `/admin/activities/${result.id}/edit`
          : "/admin/activities",
      );
      router.refresh();
    }
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/activities" className="btn-secondary px-3 py-1.5 rounded-lg text-sm">← 返回列表</Link>
        <h1 className="text-2xl font-bold text-brand-navy">创建活动</h1>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <form action={handleSubmit} className="bg-card rounded-xl border p-6 space-y-5 shadow-sm border-brand-border-subtle">
        {/* 标题 */}
        <div>
          <label className="block text-sm mb-2 text-brand-text-body" htmlFor="title">
            标题 <span className="text-xs text-brand-text-muted">(不填则自动生成为"年月日 + 活动类型")</span>
          </label>
          <input id="title" name="title" placeholder="输入活动标题或留空自动生成…" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
          {startTime && !title && (
            <p className="text-xs mt-1 text-[#93B3C8]">将自动生成为：{getDefaultTitle()}</p>
          )}
        </div>

        {/* 类型 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="type">活动类型 *</label>
          <select id="type" name="type" value={type} onChange={e => setType(e.target.value)}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading bg-card">
            {TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {type === "MEETING" && (
            <p className="text-xs mt-1 text-[#93B3C8]">修改开始时间时，结束时间将自动设为 +2 小时</p>
          )}
          {type === "COMPETITION" && (
            <div className="mt-4 space-y-4 p-4 rounded-lg border border-[#FFF3E0] bg-[#FFFDF7]">
              <p className="text-sm font-medium text-brand-orange">🏆 Game Jam 设置</p>
              <div>
                <label className="block text-xs mb-1 text-brand-text-secondary" htmlFor="theme">比赛题目 <span className="text-xs text-brand-text-muted">(比赛开始后公布，留空则无需题目)</span></label>
                <textarea id="theme" name="theme" rows={3} placeholder="如：主题是「时光倒流」—— 创作一个围绕时间回溯玩法的游戏"
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-y placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange border-brand-border-subtle text-brand-text-heading" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-brand-text-secondary" htmlFor="themeRevealedAt">题目公布时间 <span className="text-xs text-brand-text-muted">(默认为活动开始时间)</span></label>
                <input id="themeRevealedAt" name="themeRevealedAt" type="datetime-local"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border-brand-border-subtle text-brand-text-heading" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-brand-text-secondary" htmlFor="maxTeamSize">每队最大人数 <span className="text-xs text-brand-text-muted">(默认 6)</span></label>
                <input id="maxTeamSize" name="maxTeamSize" type="number" min={1} max={50} defaultValue={6}
                  className="w-32 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border-brand-border-subtle text-brand-text-heading" />
              </div>
            </div>
          )}
        </div>

        {/* 简介 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="summary">简介</label>
          <input id="summary" name="summary" maxLength={200} placeholder="一句话介绍活动（显示在卡片上）"
            className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="description">详细描述</label>
          <MentionEditor id="description" name="description" rows={5} placeholder="活动详细说明"
            className="w-full rounded-lg border placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue" />
        </div>

        {/* 封面 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body">封面</label>
          <CoverUploadInput />
        </div>

        {/* 地点 */}
        <LocationPresetInput defaultValue={DEFAULT_ACTIVITY_LOCATION} />

        {/* 线上链接 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="meetingUrl">线上链接 <span className="text-xs text-brand-text-muted">(腾讯会议等，可选)</span></label>
          <input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://meeting.tencent.com/…"
            className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
        </div>

        {/* 开始时间 + 结束时间 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="startTime">开始时间 *</label>
            <input id="startTime" name="startTime" type="datetime-local" required value={startTime} onChange={e => handleStartTimeChange(e.target.value)}
              className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="endTime">结束时间 *</label>
            <input id="endTime" name="endTime" type="datetime-local" required value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
          </div>
        </div>

        {/* 最大参与人数 */}
        <div>
          <label className="block text-sm mb-1.5 text-brand-text-body" htmlFor="maxParticipants">最大参与人数（留空不限）</label>
          <input id="maxParticipants" name="maxParticipants" type="number" min={1} placeholder="不限"
            className="w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading" />
        </div>

        {/* 开放报名 */}
        <div className="flex items-center gap-2">
          <input id="registrationOpen" name="registrationOpen" type="checkbox" className="w-4 h-4 accent-brand-blue" />
          <label className="text-sm text-brand-text-body" htmlFor="registrationOpen">开放报名</label>
        </div>

        {/* 提交 */}
        <div className="pt-2">
          <SubmitButton type="submit"
            className="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm" pendingText="创建中...">
            创建活动（草稿）
          </SubmitButton>
          <p className="text-xs mt-2 text-brand-text-muted">创建后为「草稿」状态，可在列表中发布。</p>
        </div>
      </form>
    </div>
  );
}
