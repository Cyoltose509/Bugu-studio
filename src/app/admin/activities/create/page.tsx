/**
 * 管理后台 - 创建活动
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createActivity } from "../actions";
import CoverUploadInput from "@/components/activities/CoverUploadInput";
import LocationPresetInput from "@/components/activities/LocationPresetInput";
import ActivityTimeChoice from "@/components/activities/ActivityTimeChoice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import TrophyIcon from "@/components/icons/TrophyIcon";
import MentionEditor from "@/components/ui/MentionEditor";

const TYPE_OPTIONS = [
  { value: "MEETING",     label: "例会",     hint: "议程与分享报名" },
  { value: "COURSE",      label: "公开课", hint: "策划分享或引擎教学" },
  { value: "ENGINE_COURSE", label: "引擎教学公开课", hint: "分班教学与作品大赏" },
  { value: "COMPETITION", label: "Game Jam", hint: "组队、题目与提交" },
  { value: "GENERAL",     label: "大事件",   hint: "海报与试玩目录" },
];

export default function CreateActivityPage() {
  const router = useRouter();
  const [type, setType] = useState("GENERAL");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timePending, setTimePending] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  function handleStartTimeChange(val: string) {
    setStartTime(val);
    if (val && !endTime) setEndTime(val.slice(0, 10));
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
    if (!(formData.get("title") as string).trim() && startTime && !timePending) {
      formData.set("title", getDefaultTitle());
    }
    const result = await createActivity(formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
    } else if (result && "success" in result && result.id) {
      // 例会创建后进入编辑页，方便录入分享条目
      router.push(
        type === "MEETING" || type === "COURSE" || type === "ENGINE_COURSE"
          ? `/admin/activities/${result.id}/edit`
          : "/admin/activities",
      );
      router.refresh();
    }
  }

  const field =
    "w-full rounded-lg border px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading bg-card";
  const label = "block text-sm mb-1.5 text-brand-text-body";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/activities" className="btn-secondary px-3 py-1.5 rounded-lg text-sm">← 返回列表</Link>
        <h1 className="text-2xl font-bold text-brand-navy">创建活动</h1>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <form action={handleSubmit} className="space-y-8">
        <input type="hidden" name="type" value={type} />

        <div>
          <p className={label}>活动类型 *</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {TYPE_OPTIONS.filter((option) => option.value !== "ENGINE_COURSE").map((opt) => {
              const active = type === opt.value || (opt.value === "COURSE" && type === "ENGINE_COURSE");
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm border transition-all ${
                    active
                      ? "border-brand-blue bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue"
                      : "border-brand-border-subtle hover:border-brand-blue/40 text-brand-text-secondary bg-card"
                  }`}
                >
                  <span className="block font-medium">{opt.label}</span>
                  <span className={`block text-xs mt-0.5 ${active ? "text-brand-blue/80" : "text-brand-text-muted"}`}>
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {(type === "COURSE" || type === "ENGINE_COURSE") && <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-brand-border-subtle bg-card p-2">
            {TYPE_OPTIONS.filter((option) => option.value === "COURSE" || option.value === "ENGINE_COURSE").map((option) => <button key={option.value} type="button" onClick={() => setType(option.value)} className={`rounded-lg px-3 py-2 text-left text-sm ${type === option.value ? "bg-brand-blue text-white" : "text-brand-text-body hover:bg-brand-blue/10"}`}><strong className="block">{option.value === "COURSE" ? "策划公开课" : option.label}</strong><span className="text-xs opacity-75">{option.value === "COURSE" ? "组队分享与评分" : option.hint}</span></button>)}
          </div>}
          {type === "MEETING" && (
            <p className="text-xs mt-2 text-brand-text-muted">只需选择日期，同一天开始和结束即可</p>
          )}
          {type === "GENERAL" && (
            <p className="text-xs mt-2 text-brand-text-muted">创建后可在编辑页启用海报与试玩目录</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] gap-8 lg:gap-10">
          <aside className="space-y-5 order-2 lg:order-1">
            <ActivityTimeChoice
              pending={timePending}
              onPendingChange={setTimePending}
              start={startTime}
              end={endTime}
              onStartChange={handleStartTimeChange}
              onEndChange={setEndTime}
              fieldClass={field}
              labelClass={label}
            />
            {(type === "COURSE" || type === "ENGINE_COURSE") && !timePending && <div className="space-y-3 rounded-lg border border-brand-border-subtle p-3">
              <label className="flex items-center gap-2 text-sm text-brand-text-body"><input type="checkbox" name="courseHasClock" className="accent-brand-blue" />精确到时分</label>
              <div className="grid grid-cols-2 gap-2"><label className={label}>开始时间<input type="time" name="startClock" className={field} /></label><label className={label}>结束时间（可选）<input type="time" name="endClock" className={field} /></label></div>
            </div>}

            <LocationPresetInput />

            <div>
              <label className={label} htmlFor="meetingUrl">线上链接 <span className="text-xs text-brand-text-muted">(腾讯会议等，可选)</span></label>
              <input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://meeting.tencent.com/…" className={field} />
            </div>

            <div>
              <label className={label} htmlFor="maxParticipants">最大参与人数（留空不限）</label>
              <input id="maxParticipants" name="maxParticipants" type="number" min={1} placeholder="不限" className={field} />
            </div>

            <label className="flex items-center gap-2 text-sm text-brand-text-body" htmlFor="talkSubmissionOpen">
              <input id="talkSubmissionOpen" name="talkSubmissionOpen" type="checkbox" className="w-4 h-4 accent-brand-blue" />
              开放报名分享
            </label>

            {type === "COMPETITION" && (
              <>
                <div>
                  <label className={label} htmlFor="theme">
                    <TrophyIcon size={14} className="mr-1 align-[-0.15em]" />
                    比赛题目 <span className="text-xs text-brand-text-muted">(开始后公布，可留空)</span>
                  </label>
                  <MentionEditor id="theme" name="theme" rows={3} richPreview={false} placeholder="如：主题是「时光倒流」—— 创作一个围绕时间回溯玩法的游戏" className="w-full" />
                </div>
                <div>
                  <label className={label} htmlFor="themeRevealedAt">题目公布日期 <span className="text-xs text-brand-text-muted">(默认为开始日期)</span></label>
                  <input id="themeRevealedAt" name="themeRevealedAt" type="date" className={field} />
                </div>
                <div>
                  <label className={label} htmlFor="maxTeamSize">每队最大人数 <span className="text-xs text-brand-text-muted">(默认 6)</span></label>
                  <input id="maxTeamSize" name="maxTeamSize" type="number" min={1} max={50} defaultValue={6} className={`${field} max-w-[8rem]`} />
                </div>
              </>
            )}
          </aside>

          <div className="space-y-5 order-1 lg:order-2 min-w-0">
            <div>
              <label className={label} htmlFor="title">
                标题 <span className="text-xs text-brand-text-muted">(不填则自动生成为「年月日 + 活动类型」)</span>
              </label>
              <input id="title" name="title" placeholder="输入活动标题或留空自动生成…" value={title} onChange={e => setTitle(e.target.value)} className={field} />
              {startTime && !title && !timePending && (
                <p className="text-xs mt-1 text-[#93B3C8]">将自动生成为：{getDefaultTitle()}</p>
              )}
            </div>

            <div>
              <label className={label} htmlFor="summary">简介</label>
              <input
                id="summary"
                name="summary"
                maxLength={200}
                placeholder="一句话介绍活动（显示在卡片上）"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className={field}
              />
            </div>

            <div>
              <label className={label} htmlFor="description">详细描述</label>
              <MentionEditor id="description" name="description" rows={8} placeholder="活动详细说明" className="w-full" />
            </div>

            <div>
              <label className={label}>封面</label>
              <CoverUploadInput
                previewClassName="max-w-none"
                title={title.trim() || getDefaultTitle()}
                summary={summary}
                activityType={type}
                allowFocalPoint={type === "COURSE" || type === "ENGINE_COURSE"}
                typeLabel={TYPE_OPTIONS.find(t => t.value === type)?.label}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            type="submit"
            name="status"
            value="PUBLISHED"
            className="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm"
            pendingText="发布中..."
          >
            创建活动
          </SubmitButton>
          <SubmitButton
            type="submit"
            name="status"
            value="DRAFT"
            className="btn-secondary px-6 py-2.5 rounded-lg font-medium text-sm"
            pendingText="保存中..."
          >
            存为草稿
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
