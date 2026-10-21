import Link from "next/link";
import { RichContent } from "@/components/ui/RichContent";
import CourseMaterials from "./CourseMaterials";
import { TagChipLink } from "@/components/tags/TagChip";
import { formatActivitySchedule } from "@/lib/activities/datetime";
import EngineCourseGallery from "./EngineCourseGallery";
import type { Lang } from "@/lib/i18n/config";
import ShareButton from "@/components/share/ShareButton";
import type { ShareCardData } from "@/lib/share";
type CourseClassView = {
  scheduleImage?: string | null; id: string; name: string; description: string | null; coverImage: string | null;
  coverFocusX: number; coverFocusY: number;
  tags: { tag: { id: string; name: string; slug: string; color: string; group: string | null } }[];
  lessons: { id: string; instructorName: string; topic: string; title: string; date: Date | string; startMinute: number | null; endMinute: number | null; meetingUrl: string | null; videoUrl: string | null }[];
  showcase: { authorName?: string; id: string; title: string; imageUrl: string; project: { slug: string; status: string } | null }[];
};
type ParticipantView = { role: string; externalName: string | null; member: { id: string; displayName: string; avatar: string | null; user: { image: string | null } | null } | null };
type AttachmentView = { id: string; name: string; url: string; mimeType: string | null; sizeBytes: number | null };

export default function EngineCoursePage({ activity, canViewMeetingLinks, isAdmin, lang, shareData }: {
  activity: {
    id: string; title: string; summary: string | null; description: string | null; coverImage: string | null;
    startTime: Date | null; endTime: Date | null; timePending: boolean; meetingUrl: string | null;
    courseCoverFocusX: number; courseCoverFocusY: number;
    courseHasClock: boolean;
    courseClasses: CourseClassView[]; courseParticipants: ParticipantView[]; courseAttachments: AttachmentView[];
  };
  canViewMeetingLinks: boolean;
  isAdmin: boolean;
  lang: Lang;
  shareData?: ShareCardData | null;
}) {
  const instructors = activity.courseParticipants.filter((item) => item.role === "INSTRUCTOR").map((item) => ({
    id: item.member?.id || null,
    displayName: item.member?.displayName || item.externalName || "",
    avatar: item.member?.avatar || item.member?.user?.image || null,
  }));
  const students = activity.courseParticipants.filter((item) => item.role === "STUDENT").map((item) => ({
    id: item.member?.id || null,
    displayName: item.member?.displayName || item.externalName || "",
    avatar: item.member?.avatar || item.member?.user?.image || null,
  }));
  return <main className="pb-20 animate-fade-in">
    <header className="relative isolate min-h-[27rem] overflow-hidden bg-brand-navy text-white sm:min-h-[34rem]">
      {activity.coverImage && <img src={activity.coverImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{ objectPosition: `${activity.courseCoverFocusX}% ${activity.courseCoverFocusY}%` }} />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0c1b2d] via-[#0c1b2d]/65 to-[#0c1b2d]/15" />
      <div className="mx-auto flex min-h-[27rem] max-w-6xl flex-col justify-end px-5 pb-12 pt-24 sm:min-h-[34rem] sm:pb-16">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#acd5f4]">Bugoo Studio / Engine Course</p>
        <h1 className="max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl">{activity.title}</h1>
        <p className="mt-5 text-sm text-white/80">{formatActivitySchedule(activity.startTime, activity.endTime, lang, activity.timePending, activity.courseHasClock)}</p>
        {activity.summary && <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{activity.summary}</p>}
        {shareData && <div className="mt-6"><ShareButton data={shareData} /></div>}
        {isAdmin && <div className="mt-7 flex flex-wrap gap-3"><Link href={`/admin/activities/${activity.id}/edit`} className="w-fit rounded-full border border-white/70 px-4 py-2 text-sm text-white hover:bg-white/15">编辑公开课信息</Link><Link href={`/admin/activities/${activity.id}/program`} className="w-fit rounded-full border border-white/70 px-4 py-2 text-sm text-white hover:bg-white/15">编辑课程编排 →</Link></div>}
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-14 px-4 pt-12 sm:px-6">
      {(activity.description || instructors.length > 0 || students.length > 0 || activity.courseAttachments.length > 0 || (canViewMeetingLinks && activity.meetingUrl)) && <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">{activity.description && <div className="prose max-w-none text-brand-text-heading"><RichContent text={activity.description} /></div>}
          {canViewMeetingLinks && activity.meetingUrl && <a href={activity.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-brand-blue px-5 py-2 text-sm font-semibold text-white">进入线上课堂 ↗</a>}
        </div>
        <CourseMaterials lang={lang} instructors={instructors} students={students} attachments={activity.courseAttachments} />
      </section>}
      {activity.courseClasses.map((courseClass, index) => <section key={courseClass.id} className="space-y-7 border-t border-brand-border-subtle pt-9">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(15rem,30%)] md:items-center">
          <div><p className="text-sm font-bold tracking-widest text-brand-blue">CLASS {String(index + 1).padStart(2, "0")}</p><h2 className="mt-2 text-3xl font-bold text-brand-navy sm:text-4xl">{courseClass.name}</h2>
            {courseClass.description && <p className="mt-4 max-w-2xl whitespace-pre-wrap leading-relaxed text-brand-text-body">{courseClass.description}</p>}
            {courseClass.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{courseClass.tags.map(({ tag }) => <TagChipLink key={tag.id} tag={tag} href={`/works?tag=${encodeURIComponent(tag.slug)}`} className="rounded-full px-3 py-1" />)}</div>}
          </div>
          {courseClass.coverImage && <img src={courseClass.coverImage} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" style={{ objectPosition: `${courseClass.coverFocusX}% ${courseClass.coverFocusY}%` }} />}
        </div>
        {courseClass.scheduleImage && <div><h3 className="mb-4 text-xl font-bold text-brand-navy">课程表</h3><EngineCourseGallery fullWidth items={[{ id: `${courseClass.id}-schedule`, title: `${courseClass.name} · 课程表`, imageUrl: courseClass.scheduleImage, projectSlug: null }]} /></div>}
        {courseClass.lessons.length > 0 && <div><h3 className="mb-4 text-xl font-bold text-brand-navy">课程安排</h3><div className="space-y-2">{courseClass.lessons.map((lesson, lessonIndex) => <div key={lesson.id} className="grid gap-2 rounded-xl border border-brand-border-subtle bg-card p-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
          <span className="text-xl font-bold text-brand-blue">{String(lessonIndex + 1).padStart(2, "0")}</span>
          <div><p className="text-xs text-brand-text-muted">{lesson.topic} · {lesson.instructorName}</p><h4 className="font-semibold text-brand-navy">{lesson.title}</h4><p className="mt-1 text-xs text-brand-text-muted">{new Date(lesson.date).toISOString().slice(0, 10)}{lesson.startMinute != null ? ` · ${String(Math.floor(lesson.startMinute / 60)).padStart(2, "0")}:${String(lesson.startMinute % 60).padStart(2, "0")}` : ""}{lesson.endMinute != null ? `–${String(Math.floor(lesson.endMinute / 60)).padStart(2, "0")}:${String(lesson.endMinute % 60).padStart(2, "0")}` : ""}</p></div>
          <div className="flex gap-3 text-sm font-medium">{lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-brand-blue">观看录像 ↗</a>}{canViewMeetingLinks && lesson.meetingUrl && <a href={lesson.meetingUrl} target="_blank" rel="noreferrer" className="text-brand-blue">会议链接 ↗</a>}</div>
        </div>)}</div></div>}
        {courseClass.showcase.length > 0 && <div><div className="mb-4 flex items-baseline gap-3"><h3 className="text-xl font-bold text-brand-navy">学员作品大赏</h3><span className="text-xs text-brand-text-muted">{courseClass.name}</span></div><EngineCourseGallery items={courseClass.showcase.map((work) => ({ id: work.id, authorName: work.authorName, title: work.title, imageUrl: work.imageUrl, projectSlug: work.project?.status === "PUBLISHED" ? work.project.slug : null }))} /></div>}
      </section>)}
    </div>
  </main>;
}
