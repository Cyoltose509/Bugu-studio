/**
 * 管理后台 - 编辑活动
 */

import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { updateActivity } from "../../actions";
import { ActivityType, ActivityStatus } from "@prisma/client";
import CoverUploadInput from "@/components/activities/CoverUploadInput";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const a = await prisma.activity.findUnique({ where: { id }, select: { title: true } });
  return { title: a ? `编辑 — ${a.title}` : "编辑活动" };
}

export default async function EditActivityPage({ params }: PageProps) {
  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) notFound();

  const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <a href="/admin/activities" className="btn-secondary px-3 py-1.5 rounded-lg text-sm">← 返回列表</a>
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>编辑活动</h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateActivity(id, formData);
          redirect("/admin/activities");
        }}
        className="bg-white rounded-xl border p-6 space-y-5 shadow-sm"
        style={{ borderColor: "#D0DEE8" }}
      >
        {/* 标题 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>标题 *</label>
          <input name="title" defaultValue={activity.title} required
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 类型 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>活动类型</label>
          <select name="type" defaultValue={activity.type}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333", background: "#fff" }}>
            <option value="MEETING">例会</option>
            <option value="COURSE">公开课</option>
            <option value="COMPETITION">比赛 / Game Jam</option>
            <option value="GENERAL">普通活动</option>
          </select>
        </div>

        {/* 状态 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>状态</label>
          <select name="status" defaultValue={activity.status}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333", background: "#fff" }}>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="ARCHIVED">已归档</option>
          </select>
        </div>

        {/* 简介 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>简介</label>
          <input name="summary" defaultValue={activity.summary || ""} maxLength={200}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>详细描述</label>
          <textarea name="description" defaultValue={activity.description || ""} rows={5}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB] resize-y"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 封面 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>封面</label>
          <CoverUploadInput defaultValue={activity.coverImage || undefined} />
        </div>

        {/* 地点 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>线下地点</label>
          <input name="location" defaultValue={activity.location || "总图书馆未来学习中心"}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 线上链接 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>线上链接 <span className="text-xs" style={{ color: "#999" }}>(腾讯会议等，可选)</span></label>
          <input name="meetingUrl" type="url" defaultValue={activity.meetingUrl || ""} placeholder="https://meeting.tencent.com/…"
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 开始 + 结束时间 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#555" }}>开始时间</label>
            <input name="startTime" type="datetime-local" defaultValue={fmt(activity.startTime)} required
              className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
              style={{ borderColor: "#D0DEE8", color: "#333" }} />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#555" }}>结束时间</label>
            <input name="endTime" type="datetime-local" defaultValue={fmt(activity.endTime)} required
              className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
              style={{ borderColor: "#D0DEE8", color: "#333" }} />
          </div>
        </div>

        {/* 最大人数 */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: "#555" }}>最大参与人数</label>
          <input name="maxParticipants" type="number" min={1} defaultValue={activity.maxParticipants || ""}
            className="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3388BB]"
            style={{ borderColor: "#D0DEE8", color: "#333" }} />
        </div>

        {/* 开放报名 */}
        <div className="flex items-center gap-2">
          <input name="registrationOpen" type="checkbox" defaultChecked={activity.registrationOpen}
            className="w-4 h-4 accent-[#3388BB]" />
          <label className="text-sm" style={{ color: "#555" }}>开放报名</label>
        </div>

        {/* Game Jam 设置（仅 COMPETITION 类型显示） */}
        <div className="p-4 rounded-lg border" style={{ borderColor: "#FFF3E0", background: "#FFFDF7" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#E38043" }}>🏆 Game Jam 设置</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "#777" }}>比赛题目</label>
              <textarea name="theme" rows={3} defaultValue={activity.theme || ""}
                className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-[#E38043]"
                style={{ borderColor: "#D0DEE8", color: "#333" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#777" }}>题目公布时间</label>
              <input name="themeRevealedAt" type="datetime-local" defaultValue={activity.themeRevealedAt ? fmt(activity.themeRevealedAt) : ""}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E38043]"
                style={{ borderColor: "#D0DEE8", color: "#333" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#777" }}>每队最大人数 <span className="text-xs" style={{ color: "#999" }}>(默认 6，缩小后将自动踢出超限成员)</span></label>
              <input name="maxTeamSize" type="number" min={1} max={50} defaultValue={activity.maxTeamSize ?? 6}
                className="w-32 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E38043]"
                style={{ borderColor: "#D0DEE8", color: "#333" }} />
            </div>
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <SubmitButton type="submit" className="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm" pendingText="保存中...">保存修改</SubmitButton>
          <a href="/admin/activities" className="btn-secondary px-6 py-2.5 rounded-lg text-sm">取消</a>
        </div>
      </form>
    </div>
  );
}
