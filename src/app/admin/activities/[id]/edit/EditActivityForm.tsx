"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateActivity } from "../../actions";
import CoverUploadInput from "@/components/activities/CoverUploadInput";
import LocationPresetInput from "@/components/activities/LocationPresetInput";
import MeetingTalksEditor, { type TalkDraft } from "@/components/activities/meeting/MeetingTalksEditor";
import { SubmitButton } from "@/components/ui/SubmitButton";
import TrophyIcon from "@/components/icons/TrophyIcon";
import DescriptionEditor from "@/components/admin/DescriptionEditor";
import MentionEditor from "@/components/ui/MentionEditor";
import ShowcaseEditor from "@/components/activities/showcase/ShowcaseEditor";
import type { ActivityShowcase } from "@/lib/activities/showcase";

const TYPE_OPTIONS = [
  { value: "MEETING",     label: "例会",     hint: "议程与分享报名" },
  { value: "COURSE",      label: "公开课",   hint: "课程与讲题" },
  { value: "COMPETITION", label: "Game Jam", hint: "组队、题目与提交" },
  { value: "GENERAL",     label: "大事件",   hint: "海报与试玩目录" },
] as const;

const STATUS_STEPS = [
  { value: "DRAFT", label: "草稿" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "ARCHIVED", label: "已归档" },
] as const;

type ProjectOption = { id: string; title: string; slug: string };

export type EditActivityValues = {
  id: string;
  title: string;
  type: string;
  status: string;
  summary: string;
  description: string;
  location: string;
  meetingUrl: string;
  coverImage: string;
  startTime: string;
  endTime: string;
  maxParticipants: number | "";
  talkSubmissionOpen: boolean;
  theme: string;
  themeRevealedAt: string;
  maxTeamSize: number;
};

function StatusTimeline({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = Math.max(0, STATUS_STEPS.findIndex((s) => s.value === value));

  return (
    <div>
      <p className="block text-sm mb-3 text-brand-text-body">状态</p>
      <div className="grid grid-cols-3">
        {STATUS_STEPS.map((step, i) => {
          const reached = i <= current;
          const active = i === current;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onChange(step.value)}
              className="relative flex flex-col items-center gap-2 py-1"
            >
              {i > 0 && (
                <span
                  className={`pointer-events-none absolute top-[11px] right-1/2 left-0 h-0.5 ${
                    i <= current ? "bg-brand-blue" : "bg-brand-border-subtle"
                  }`}
                />
              )}
              {i < STATUS_STEPS.length - 1 && (
                <span
                  className={`pointer-events-none absolute top-[11px] left-1/2 right-0 h-0.5 ${
                    i < current ? "bg-brand-blue" : "bg-brand-border-subtle"
                  }`}
                />
              )}
              <span
                className={`relative z-10 w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  active
                    ? "bg-brand-blue border-brand-blue ring-4 ring-brand-blue/20"
                    : reached
                      ? "bg-brand-blue border-brand-blue"
                      : "bg-card border-brand-border-subtle"
                }`}
              />
              <span
                className={`text-xs leading-tight ${
                  active ? "font-semibold text-brand-navy" : "text-brand-text-muted"
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
      <input type="hidden" name="status" value={value} />
    </div>
  );
}

export default function EditActivityForm({
  activity,
  talks,
  showcase,
  projects,
}: {
  activity: EditActivityValues;
  talks: TalkDraft[];
  showcase: ActivityShowcase | null;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState(activity.type);
  const [status, setStatus] = useState(activity.status);
  const [title, setTitle] = useState(activity.title);
  const [summary, setSummary] = useState(activity.summary);
  const [error, setError] = useState("");

  const field =
    "w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue border-brand-border-subtle text-brand-text-heading bg-card";
  const label = "block text-sm mb-1.5 text-brand-text-body";

  async function handleSubmit(formData: FormData) {
    setError("");
    const result = await updateActivity(activity.id, formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/activities");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/activities" className="btn-secondary px-3 py-1.5 rounded-lg text-sm shrink-0">
          ← 返回列表
        </Link>
        <h1 className="text-2xl font-bold text-brand-navy min-w-0 flex-1">编辑活动</h1>
        <SubmitButton
          type="submit"
          className="btn-primary px-5 py-2 rounded-lg font-medium text-sm shrink-0"
          pendingText="保存中..."
        >
          保存
        </SubmitButton>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      <input type="hidden" name="type" value={type} />
      <div>
        <p className={label}>活动类型</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
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
      </div>

      <StatusTimeline value={status} onChange={setStatus} />

      <div className="bg-card rounded-xl border p-4 sm:p-6 shadow-sm border-brand-border-subtle">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] gap-8 lg:gap-10">
          <aside className="space-y-5 order-2 lg:order-1 lg:sticky lg:top-6 lg:self-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div>
                <label className={label}>开始时间</label>
                <input name="startTime" type="datetime-local" defaultValue={activity.startTime} required className={field} />
              </div>
              <div>
                <label className={label}>结束时间</label>
                <input name="endTime" type="datetime-local" defaultValue={activity.endTime} required className={field} />
              </div>
            </div>

            <LocationPresetInput defaultValue={activity.location} />

            <div>
              <label className={label}>
                线上链接 <span className="text-xs text-brand-text-muted">(腾讯会议等，可选)</span>
              </label>
              <input
                name="meetingUrl"
                type="url"
                defaultValue={activity.meetingUrl}
                placeholder="https://meeting.tencent.com/…"
                className={field}
              />
            </div>

            <div>
              <label className={label}>最大参与人数</label>
              <input
                name="maxParticipants"
                type="number"
                min={1}
                defaultValue={activity.maxParticipants}
                className={field}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-brand-text-body">
              <input
                name="talkSubmissionOpen"
                type="checkbox"
                defaultChecked={activity.talkSubmissionOpen}
                className="w-4 h-4 accent-brand-blue"
              />
              开放报名分享
            </label>

            {type !== "COMPETITION" && (
              <>
                <input type="hidden" name="theme" value={activity.theme} />
                <input type="hidden" name="themeRevealedAt" value={activity.themeRevealedAt} />
                <input type="hidden" name="maxTeamSize" value={activity.maxTeamSize} />
              </>
            )}

            {type === "COMPETITION" && (
              <>
                <div>
                  <label className={label}>
                    <TrophyIcon size={14} className="mr-1 align-[-0.15em]" />
                    比赛题目
                  </label>
                  <MentionEditor
                    name="theme"
                    defaultValue={activity.theme}
                    rows={3}
                    richPreview={false}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={label}>题目公布时间</label>
                  <input
                    name="themeRevealedAt"
                    type="datetime-local"
                    defaultValue={activity.themeRevealedAt}
                    className={field}
                  />
                </div>
                <div>
                  <label className={label}>
                    每队最大人数 <span className="text-xs text-brand-text-muted">(默认 6，缩小后将自动踢出超限成员)</span>
                  </label>
                  <input
                    name="maxTeamSize"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={activity.maxTeamSize}
                    className={`${field} max-w-[8rem]`}
                  />
                </div>
              </>
            )}
          </aside>

          <div className="space-y-5 order-1 lg:order-2 min-w-0">
            <div>
              <label className={label}>标题 *</label>
              <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={field} />
            </div>
            <div>
              <label className={label}>
                简介 <span className="text-xs text-brand-text-muted">(卡片上一句话，最多 200 字)</span>
              </label>
              <input
                name="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={200}
                className={field}
              />
            </div>
            <div>
              <label className={label}>详细描述</label>
              <DescriptionEditor defaultValue={activity.description} />
            </div>
            <div>
              <label className={label}>封面</label>
              <CoverUploadInput
                defaultValue={activity.coverImage || undefined}
                previewClassName="max-w-none"
                title={title}
                summary={summary}
                activityType={type}
                typeLabel={TYPE_OPTIONS.find((t) => t.value === type)?.label}
              />
            </div>
          </div>
        </div>
      </div>

      <MeetingTalksEditor activityId={activity.id} initialTalks={talks} embedded />

      {type === "GENERAL" && (
        <ShowcaseEditor activityId={activity.id} initial={showcase} projects={projects} />
      )}
    </form>
  );
}
