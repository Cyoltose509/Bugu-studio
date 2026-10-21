import { notFound } from "next/navigation";
import ProgramEditor from "@/app/admin/activities/[id]/program/ProgramEditor";

export const metadata = { title: "引擎公开课编排预览", robots: { index: false, follow: false } };

export default function EngineCourseEditorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="mx-auto max-w-6xl px-4 py-10"><ProgramEditor
    previewMode
    activityId="preview"
    activityTitle="新手村 Project · 引擎教学公开课"
    instructors={["社内讲师", "社外讲师"]}
    tags={[{ id: "unity", slug: "unity", name: "Unity", color: "#3B82C4", group: "引擎" }, { id: "godot", slug: "godot", name: "Godot", color: "#478CBF", group: "引擎" }]}
    authors={[{ id: "preview-author", name: "演示作者" }]}
    initialClasses={[
      { name: "Unity 班", description: "从零完成自己的第一款游戏。", coverImage: "/images/activities/baituan-2026/club.webp", coverFocusX: 50, coverFocusY: 50, tagIds: ["unity"], lessons: [{ instructorName: "社内讲师", topic: "引擎入门", title: "场景与角色控制", date: "2026-10-20", startTime: "19:00", endTime: "20:30", meetingUrl: "", videoUrl: "" }], showcase: [{ title: "学员作业", imageUrl: "/images/activities/baituan-2026/event.webp", projectId: null }] },
      { name: "Godot 班", description: "用节点与信号搭建可玩的游戏原型。", coverImage: "/images/activities/baituan-2026/beginner-2024.webp", coverFocusX: 50, coverFocusY: 50, tagIds: ["godot"], lessons: [], showcase: [] },
    ]}
  /></main>;
}
