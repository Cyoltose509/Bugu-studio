import { notFound } from "next/navigation";
import ClaimsPanel from "@/app/admin/users/[id]/claims/ClaimsPanel";

export const metadata = { title: "关联认领预览", robots: { index: false, follow: false } };

export default function ClaimsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="min-h-screen bg-brand-surface-page px-4 py-10">
    <ClaimsPanel preview user={{ id: "preview", name: "林同学", email: "preview@example.invalid" }} name="林同学" candidates={[
      { key: "project:preview-1", kind: "作品成员", name: "林同学", title: "像素远航", subtitle: "独立游戏开发作品", coverImage: "/images/activities/baituan-2026/club.webp", href: "/works" },
      { key: "course:preview-2", kind: "公开课讲师", name: "林同学", title: "引擎教学公开课", subtitle: "Unity 与 Godot 入门", coverImage: "/images/activities/baituan-2026/event.webp", href: "/activities" },
      { key: "speaker:preview-3", kind: "例会主讲", name: "林同学", title: "秋季例会", subtitle: "分享：美术流程与角色设计", coverImage: "/images/activities/baituan-2026/beginner-2024.webp", href: "/activities" },
      { key: "showcase:preview-4", kind: "课程作品作者", name: "林同学", title: "第一周的游戏原型", subtitle: "引擎教学公开课 · Unity 班", coverImage: "/images/activities/baituan-2026/event.webp", href: "/activities" },
    ]} />
  </main>;
}
