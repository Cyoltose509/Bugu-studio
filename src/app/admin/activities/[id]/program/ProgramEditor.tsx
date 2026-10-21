"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EngineCourseClassDraft, EngineCourseLessonDraft, EngineCourseShowcaseDraft } from "@/lib/activities/engine-course";
import { createProjectFromShowcase, saveEngineCourseProgram } from "./actions";
import ShowcaseTitleEditor from "@/components/activities/course/ShowcaseTitleEditor";
import ShowcaseAuthorPicker from "@/components/activities/course/ShowcaseAuthorPicker";
import CourseScheduleMenu from "@/components/activities/course/CourseScheduleMenu";
import CourseScheduleInput from "@/components/activities/course/CourseScheduleInput";
import CourseImagePicker from "@/components/activities/CourseImagePicker";
import { TagChipButton } from "@/components/tags/TagChip";

type TagOption = { id: string; slug: string; name: string; color: string; group: string | null };
type AuthorOption = { id: string; name: string };
const field = "w-full min-w-0 rounded-lg border border-brand-border-subtle bg-card px-3 py-2 text-sm text-brand-text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue";
const label = "min-w-0 text-xs font-medium text-brand-text-muted";
const blankClass = (): EngineCourseClassDraft => ({ name: "", description: "", coverImage: "", coverFocusX: 50, coverFocusY: 50, tagIds: [], lessons: [], showcase: [] });
const blankLesson = (): EngineCourseLessonDraft => ({ instructorName: "", topic: "", title: "", date: "", startTime: "", endTime: "", meetingUrl: "", videoUrl: "" });
const blankWork = (): EngineCourseShowcaseDraft => ({ title: "", imageUrl: "", projectId: null });
function SymbolButton({ label, remove = false, onClick }: { label: string; remove?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue active:scale-95 ${remove ? "border-transparent text-brand-text-muted hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500" : "border-brand-blue/20 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"}`}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={remove ? "M6 6l12 12M18 6 6 18" : "M12 5v14M5 12h14"} /></svg></button>;
}
function ClassNameEditor({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cancelled = useRef(false);
  return <div className="flex min-w-0 flex-1 items-center gap-2">
    {editing ? <input autoFocus aria-label="班级名称" maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()} onBlur={() => { if (!cancelled.current && draft.trim() && draft.trim() !== name) onChange(draft.trim()); setEditing(false); }}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { cancelled.current = true; setEditing(false); } }} className={`${field} max-w-sm font-semibold`} /> : <>
      <h2 className="min-w-0 break-words font-semibold text-brand-navy">{name || "新班级"}</h2>
      <button type="button" aria-label="编辑班级名称" title="编辑班级名称" onClick={() => { cancelled.current = false; setDraft(name); setEditing(true); }} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-blue transition hover:bg-brand-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></button>
    </>}
  </div>;
}
function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export default function ProgramEditor({ activityId, activityTitle, initialClasses, tags, authors = [], instructors, previewMode = false }: {
  previewMode?: boolean;
  activityId: string;
  activityTitle: string;
  initialClasses: EngineCourseClassDraft[];
  tags: TagOption[];
  authors?: AuthorOption[];
  instructors: string[];
}) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [activeClass, setActiveClass] = useState(0);
  const instructorOptions = [
    ...[...new Set(instructors)].map((name) => authors.find((author) => author.name === name) || { id: `instructor-${name}`, name }),
    ...authors.filter((author) => !instructors.includes(author.name)),
  ];
  const sorting = false;
  const drag = useRef<{ kind: "class" | "lesson" | "showcase"; classIndex: number; index: number } | null>(null);

  function updateClass(index: number, patch: Partial<EngineCourseClassDraft>) {
    setClasses((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setSaved(false);
  }
  function updateLesson(classIndex: number, index: number, patch: Partial<EngineCourseLessonDraft>) {
    const lessons = classes[classIndex].lessons.map((item, i) => i === index ? { ...item, ...patch } : item);
    updateClass(classIndex, { lessons });
  }
  function updateWork(classIndex: number, index: number, patch: Partial<EngineCourseShowcaseDraft>) {
    const showcase = classes[classIndex].showcase.map((item, i) => i === index ? { ...item, ...patch } : item);
    updateClass(classIndex, { showcase });
  }
  function drop(kind: "class" | "lesson" | "showcase", classIndex: number, index: number) {
    const source = drag.current;
    drag.current = null;
    if (!source || source.kind !== kind || (kind !== "class" && source.classIndex !== classIndex)) return;
    if (kind === "class") setClasses((current) => move(current, source.index, index));
    if (kind === "lesson") updateClass(classIndex, { lessons: move(classes[classIndex].lessons, source.index, index) });
    if (kind === "showcase") updateClass(classIndex, { showcase: move(classes[classIndex].showcase, source.index, index) });
    setSaved(false);
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      if (previewMode) { setSaved(true); return; }
      const result = await saveEngineCourseProgram(activityId, { classes });
      if ("error" in result) setError(result.error || "保存失败");
      else { setSaved(true); router.refresh(); }
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }
  async function turnIntoProject(classIndex: number, workIndex: number) {
    if (previewMode) { setError("交互预览不创建作品；请在真实活动后台使用此功能"); return; }
    if (converting) return;
    setConverting(true);
    try {
      if (!saved) {
        const result = await saveEngineCourseProgram(activityId, { classes });
        if ("error" in result) { setError(result.error || "保存失败"); return; }
        setSaved(true);
      }
      const work = classes[classIndex]?.showcase[workIndex];
      if (!work) { setError("作品位置无效"); return; }
      const result = await createProjectFromShowcase(activityId, classIndex, workIndex, work.imageUrl, work.title);
      if ("error" in result) { setError(result.error || "转入失败"); return; }
      window.location.href = result.editUrl;
    } catch { setError("转入失败，请稍后重试"); } finally { setConverting(false); }
  }

  return <div className="max-w-6xl space-y-4 pb-16">
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm"><Link href={previewMode ? "/dev/course-preview" : `/admin/activities/${activityId}/edit`} className="text-brand-blue hover:underline">← 活动信息</Link><Link href={previewMode ? "/dev/engine-course-preview" : `/activities/${activityId}`} target="_blank" className="text-brand-blue hover:underline">查看页面 ↗</Link></div>
      <div><h1 className="text-xl font-bold leading-snug text-brand-navy sm:text-2xl">{activityTitle}</h1></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
    <div className="flex items-center gap-2 border-b border-brand-border-subtle pb-2">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{classes.map((item, index) => <button type="button" key={index} onClick={() => setActiveClass(index)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${activeClass === index ? "bg-brand-blue/10 text-brand-blue" : "text-brand-text-muted hover:bg-brand-blue/5"}`}>{item.name || "新班级"}</button>)}<SymbolButton label="添加班级" onClick={() => { setActiveClass(classes.length); setClasses((rows) => [...rows, blankClass()]); setSaved(false); }} /></div>
    </div>
    {classes.map((courseClass, classIndex) => (sorting || activeClass === classIndex) && <section key={classIndex} className="rounded-2xl border border-brand-border-subtle bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center gap-2" draggable={sorting} onDragStart={(event) => { drag.current = { kind: "class", classIndex, index: classIndex }; if (!sorting || (event.target as HTMLElement).closest("input,textarea,select,button,a")) { event.preventDefault(); return; } event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); drop("class", classIndex, classIndex); }}>
        <span className="rounded-lg bg-brand-blue/10 px-2.5 py-1 text-sm font-bold text-brand-blue">{String(classIndex + 1).padStart(2, "0")}</span>
        <ClassNameEditor name={courseClass.name} onChange={(name) => updateClass(classIndex, { name })} />
        <SymbolButton label="删除班级" remove onClick={() => { setClasses((rows) => rows.filter((_, i) => i !== classIndex)); setActiveClass(Math.max(0, classIndex - 1)); setSaved(false); }} />
      </div>
      <div className="grid min-w-0 gap-3">
        <div className="min-w-0 space-y-2">
          <label className={`${label} block`}>班级说明<textarea rows={2} className={`${field} mt-1 resize-none`} value={courseClass.description} onChange={(event) => updateClass(classIndex, { description: event.target.value })} /></label>
        </div>
        <div className="min-w-0"><p className={`${label} mb-1`}>班级封面</p><CourseImagePicker previewOnly={previewMode} value={courseClass.coverImage} onChange={(url) => updateClass(classIndex, { coverImage: url, coverFocusX: 50, coverFocusY: 50 })} aspect={3 / 1} label="班级封面" className="aspect-[3/1] w-full" /></div>
      </div>
      <div className="mt-3"><p className={label}>关联游戏标签</p><div className="mt-1 flex flex-wrap gap-1.5">{tags.map((tag) => <TagChipButton key={tag.id} tag={tag} active={courseClass.tagIds.includes(tag.id)} onClick={() => updateClass(classIndex, { tagIds: courseClass.tagIds.includes(tag.id) ? courseClass.tagIds.filter((id) => id !== tag.id) : [...courseClass.tagIds, tag.id] })} />)}</div></div>

      <div className="mt-5 border-t border-brand-border-subtle pt-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-base font-semibold text-brand-navy">课程安排</h3><CourseScheduleMenu previewOnly={previewMode} image={courseClass.scheduleImage || ""} onImage={(scheduleImage) => updateClass(classIndex, { scheduleImage })} onAdd={() => updateClass(classIndex, { lessons: [...courseClass.lessons, blankLesson()] })} /></div>
        {courseClass.scheduleImage && <div className="relative mb-3"><img src={courseClass.scheduleImage} alt="课程表" draggable={false} className="max-h-[32rem] w-full object-contain" /><div className="absolute right-2 top-2 rounded-lg bg-card/95"><SymbolButton label="删除课程表" remove onClick={() => updateClass(classIndex, { scheduleImage: "" })} /></div></div>}
        <div className="space-y-3">{courseClass.lessons.map((lesson, lessonIndex) => <div key={lessonIndex} className="min-w-0 rounded-xl border border-brand-border-subtle bg-brand-blue/5 p-3" draggable={sorting} onDragStart={(event) => { drag.current = { kind: "lesson", classIndex, index: lessonIndex }; if (!sorting || (event.target as HTMLElement).closest("input,textarea,select,button,a")) { event.preventDefault(); return; } event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); drop("lesson", classIndex, lessonIndex); }}>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-brand-blue">第 {lessonIndex + 1} 课</span><SymbolButton label="删除课次" remove onClick={() => updateClass(classIndex, { lessons: courseClass.lessons.filter((_, i) => i !== lessonIndex) })} /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]"><div className="min-w-0"><p className={`${label} mb-1`}>讲师</p><ShowcaseAuthorPicker personLabel="讲师" name={lesson.instructorName} userId={null} options={instructorOptions} onChange={({ authorName }) => updateLesson(classIndex, lessonIndex, { instructorName: authorName })} /></div><label className={label}>课程主题<input className={`${field} mt-1`} value={lesson.topic} onChange={(event) => updateLesson(classIndex, lessonIndex, { topic: event.target.value, title: event.target.value })} placeholder="例如：完成角色移动与碰撞" /></label></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><CourseScheduleInput label="日期" kind="date" value={lesson.date} onChange={(date) => updateLesson(classIndex, lessonIndex, { date })} /><CourseScheduleInput label="开始时间" kind="time" value={lesson.startTime} onChange={(startTime) => updateLesson(classIndex, lessonIndex, { startTime })} /><CourseScheduleInput label="结束时间" kind="time" value={lesson.endTime} onChange={(endTime) => updateLesson(classIndex, lessonIndex, { endTime })} /></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className={label}>会议链接<input type="url" className={`${field} mt-1`} value={lesson.meetingUrl} onChange={(event) => updateLesson(classIndex, lessonIndex, { meetingUrl: event.target.value })} placeholder="https://" /></label><label className={label}>B 站分集链接<input type="url" className={`${field} mt-1`} value={lesson.videoUrl} onChange={(event) => updateLesson(classIndex, lessonIndex, { videoUrl: event.target.value })} placeholder="https://www.bilibili.com/video/…" /></label></div>
        </div>)}</div></div>

      <div className="mt-5 border-t border-brand-border-subtle pt-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-base font-semibold text-brand-navy">学员作品大赏</h3><SymbolButton label="添加作品" onClick={() => updateClass(classIndex, { showcase: [...courseClass.showcase, blankWork()] })} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{courseClass.showcase.map((work, workIndex) => <div key={workIndex} className="rounded-xl border border-brand-border-subtle" draggable={sorting} onDragStart={(event) => { drag.current = { kind: "showcase", classIndex, index: workIndex }; if (!sorting || (event.target as HTMLElement).closest("input,textarea,select,button,a")) { event.preventDefault(); return; } event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); drop("showcase", classIndex, workIndex); }}>
          <div className="relative overflow-hidden rounded-t-xl">
            <CourseImagePicker iconPlacement="corner" previewOnly={previewMode} value={work.imageUrl} onChange={(url) => updateWork(classIndex, workIndex, { imageUrl: url })} label="作品封面" className="aspect-video w-full !rounded-none !border-0" />
            <div className="absolute right-2 top-2 z-10 rounded-lg bg-card/95 shadow-sm"><SymbolButton label="删除作品" remove onClick={() => updateClass(classIndex, { showcase: courseClass.showcase.filter((_, i) => i !== workIndex) })} /></div>
            <ShowcaseTitleEditor title={work.title} onChange={(title) => updateWork(classIndex, workIndex, { title })} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 p-3"><div className="min-w-0 flex-1"><ShowcaseAuthorPicker name={work.authorName || ""} userId={work.authorUserId || null} options={authors} onChange={(author) => updateWork(classIndex, workIndex, author)} /></div>{work.imageUrl && <button type="button" disabled={converting} onClick={() => void turnIntoProject(classIndex, workIndex)} className="text-xs text-brand-blue">{work.projectId ? "编辑作品 ↗" : "创建为作品 ↗"}</button>}</div>
        </div>)}</div>
      </div>
    </section>)}
    <div className="sticky bottom-3 z-30 flex items-center justify-end gap-3 rounded-xl border border-brand-border-subtle bg-card/95 p-2 shadow-lg backdrop-blur"><span className="text-xs text-brand-text-muted">{previewMode ? (saved ? "交互预览 · 不写入数据库" : "交互预览 · 已修改") : (saved ? "已保存" : "有未保存的修改")}</span><button type="button" onClick={save} disabled={saving} className="btn-primary rounded-lg px-6 py-2.5 text-sm disabled:opacity-50">{saving ? "保存中…" : previewMode ? "确认预览" : "保存课程"}</button></div>
  </div>;
}
