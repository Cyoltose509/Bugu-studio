"use client";

import { useState } from "react";
import CourseMaterialsEditor from "@/components/activities/course/CourseMaterialsEditor";
import CourseMaterials from "@/components/activities/course/CourseMaterials";
import type { CourseAttachmentDraft, CourseParticipantDraft } from "@/lib/activities/course-materials";

type Member = { id: string; displayName: string; avatar: string | null };

export default function CoursePreview({ member }: { member: Member | null }) {
  const initial: CourseParticipantDraft[] = [
    ...(member ? [{ memberId: member.id, displayName: member.displayName, avatar: member.avatar, role: "INSTRUCTOR" as const }] : []),
    { externalName: "社外讲师示例", displayName: "社外讲师示例", role: "INSTRUCTOR" },
  ];
  const initialAttachments: CourseAttachmentDraft[] = [
    { name: "百团大战活动海报", url: "/images/activities/baituan-2026/event.webp", mimeType: "image/webp" },
    { name: "社团招新海报", url: "/images/activities/baituan-2026/club.webp", mimeType: "image/webp" },
  ];
  const [preview, setPreview] = useState({ participants: initial, attachments: initialAttachments });

  return <main className="mx-auto max-w-4xl px-5 py-12 space-y-8">
    <header>
      <p className="text-xs tracking-widest text-brand-orange">DEVELOPMENT PREVIEW</p>
      <h1 className="mt-3 text-3xl font-bold text-brand-navy">公开课讲师预览</h1>
      <p className="mt-3 text-sm text-brand-text-secondary">本地预览，修改会实时显示在下方，不写入数据库。</p>
    </header>
    <CourseMaterialsEditor participants={initial} attachments={initialAttachments} onChange={setPreview} />
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-brand-navy">活动页展示</h2>
      <CourseMaterials
        lang="cn"
        instructors={preview.participants.filter((person) => person.role === "INSTRUCTOR").map((person) => ({ id: person.memberId, displayName: person.displayName || person.externalName || "", avatar: person.avatar }))}
        students={preview.participants.filter((person) => person.role === "STUDENT").map((person) => ({ id: person.memberId, displayName: person.displayName || "", avatar: person.avatar }))}
        attachments={preview.attachments.map((file) => ({ ...file, id: file.url }))}
      />
    </div>
  </main>;
}
