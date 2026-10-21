import { notFound } from "next/navigation";
import EngineCoursePage from "@/components/activities/course/EngineCoursePage";
import { redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";

export const metadata = { title: "引擎教学公开课预览", robots: { index: false, follow: false } };

export default function EngineCoursePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const activity = {
    id: "preview", type: "ENGINE_COURSE", title: "新手村 Project · 引擎教学公开课",
    summary: "从零开始，用 Unity 和 Godot 完成自己的第一款游戏。",
    description: "跟随讲师分班学习，按课次完成作品作业。课程录像会陆续发布到 B 站。",
    coverImage: "/images/activities/baituan-2026/event.webp",
    startTime: new Date("2026-10-20T00:00:00+08:00"), endTime: new Date("2026-10-25T23:59:59+08:00"),
    timePending: false, courseHasClock: false, meetingUrl: "https://meeting.example.com/private", courseCoverFocusX: 50, courseCoverFocusY: 50,
    courseParticipants: [{ role: "INSTRUCTOR", externalName: "引擎讲师", member: null }],
    courseAttachments: [],
    courseClasses: ["Unity", "Godot"].map((name, index) => ({
      id: `class-${index}`, activityId: "preview", name: `${name} 班`,
      description: index === 0 ? "学习场景搭建、角色控制与交互逻辑，逐步做出完整的游戏原型。" : "从节点与信号出发，让游戏设计快速变成可玩的作品。",
      coverImage: index === 0 ? "/images/activities/baituan-2026/club.webp" : "/images/activities/baituan-2026/beginner-2024.webp",
      coverFocusX: 50, coverFocusY: 50,
      sortOrder: index, createdAt: new Date(), updatedAt: new Date(),
      tags: [],
      lessons: [
        { id: `lesson-${index}-1`, classId: `class-${index}`, instructorName: "引擎讲师", topic: "入门", title: `${name} 初识与工程搭建`, date: new Date("2026-10-20"), startMinute: 1140, endMinute: 1260, meetingUrl: "https://meeting.example.com/private", videoUrl: "https://www.bilibili.com/", sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: `lesson-${index}-2`, classId: `class-${index}`, instructorName: "引擎讲师", topic: "实践", title: "动手完成第一份作业", date: new Date("2026-10-23"), startMinute: null, endMinute: null, meetingUrl: null, videoUrl: null, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
      showcase: [{ id: `work-${index}`, classId: `class-${index}`, title: `${name} 学员作业`, imageUrl: "/images/activities/baituan-2026/event.webp", projectId: null, project: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }],
    })),
  };
  return <EngineCoursePage activity={redactCourseMeetingLinks(activity, false)} canViewMeetingLinks={false} isAdmin={false} lang="cn" />;
}
