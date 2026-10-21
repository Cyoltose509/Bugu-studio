export type EngineCourseLessonDraft = {
  instructorName: string;
  topic: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  videoUrl: string;
};

export type EngineCourseShowcaseDraft = {
  authorName?: string;
  authorUserId?: string | null;
  title: string;
  imageUrl: string;
  projectId: string | null;
};

export type EngineCourseClassDraft = {
  scheduleImage?: string;
  name: string;
  description: string;
  coverImage: string;
  coverFocusX: number;
  coverFocusY: number;
  tagIds: string[];
  lessons: EngineCourseLessonDraft[];
  showcase: EngineCourseShowcaseDraft[];
};

const safeUrl = (value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
};

export function parseClock(value: string): number | null {
  if (!value) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function formatClock(value: number | null): string {
  if (value == null) return "";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function parseEngineCourseProgram(raw: unknown): { classes: EngineCourseClassDraft[] } | { error: string } {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { classes?: unknown }).classes)) return { error: "班级数据无效" };
  const rows = (raw as { classes: unknown[] }).classes;
  if (rows.length > 12) return { error: "最多添加 12 个班级" };
  const classes: EngineCourseClassDraft[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return { error: "班级数据无效" };
    const item = row as Partial<EngineCourseClassDraft>;
    const name = String(item.name || "").trim();
    const description = String(item.description || "").trim();
    const scheduleImage = String(item.scheduleImage || "").trim();
    if (!safeUrl(scheduleImage)) return { error: "课程表图片无效" };
    const coverImage = String(item.coverImage || "").trim();
    const coverFocusX = item.coverFocusX ?? 50;
    const coverFocusY = item.coverFocusY ?? 50;
    if (!name || name.length > 100 || description.length > 5000 || !safeUrl(coverImage) ||
      !Number.isInteger(coverFocusX) || coverFocusX < 0 || coverFocusX > 100 ||
      !Number.isInteger(coverFocusY) || coverFocusY < 0 || coverFocusY > 100) return { error: "班级名称、说明或封面无效" };
    if (!Array.isArray(item.tagIds) || item.tagIds.length > 20 || item.tagIds.some((id) => typeof id !== "string")) return { error: "班级标签无效" };
    if (!Array.isArray(item.lessons) || item.lessons.length > 80) return { error: "课次数据无效" };
    if (!Array.isArray(item.showcase) || item.showcase.length > 100) return { error: "作品大赏数据无效" };
    const lessons: EngineCourseLessonDraft[] = [];
    for (const lesson of item.lessons) {
      if (!lesson || typeof lesson !== "object") return { error: "课次数据无效" };
      const entry = lesson as Partial<EngineCourseLessonDraft>;
      const normalized = {
        instructorName: String(entry.instructorName || "").trim(),
        topic: String(entry.topic || "").trim(),
        title: String(entry.title || entry.topic || "").trim(),
        date: String(entry.date || "").trim(),
        startTime: String(entry.startTime || "").trim(),
        endTime: String(entry.endTime || "").trim(),
        meetingUrl: String(entry.meetingUrl || "").trim(),
        videoUrl: String(entry.videoUrl || "").trim(),
      };
      const start = parseClock(normalized.startTime);
      const end = parseClock(normalized.endTime);
      if (!normalized.instructorName || !normalized.topic ||
        normalized.instructorName.length > 80 || normalized.topic.length > 120 || normalized.title.length > 180 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(normalized.date) || Number.isNaN(new Date(`${normalized.date}T00:00:00Z`).getTime()) || new Date(`${normalized.date}T00:00:00Z`).toISOString().slice(0, 10) !== normalized.date ||
        Number.isNaN(start) || Number.isNaN(end) || (end !== null && (start === null || end <= start)) ||
        !safeUrl(normalized.meetingUrl) || !safeUrl(normalized.videoUrl) ||
        (normalized.videoUrl && !/(^|\.)bilibili\.com$|(^|\.)b23\.tv$/i.test(new URL(normalized.videoUrl).hostname))) {
        return { error: "课次的讲师、主题、日期、时间或链接无效" };
      }
      lessons.push(normalized);
    }
    const showcase: EngineCourseShowcaseDraft[] = [];
    for (const work of item.showcase) {
      if (!work || typeof work !== "object") return { error: "作品大赏数据无效" };
      const entry = work as Partial<EngineCourseShowcaseDraft>;
      const title = String(entry.title || "").trim();
      const imageUrl = String(entry.imageUrl || "").trim();
      const projectId = entry.projectId ? String(entry.projectId).trim() : null;
      if (!title || title.length > 160 || !imageUrl || !safeUrl(imageUrl) || (projectId !== null && !projectId)) return { error: "作品大赏名称或图片无效" };
      const authorName = String(entry.authorName || "").trim();
      const authorUserId = entry.authorUserId ? String(entry.authorUserId).trim() : null;
      if (authorName.length > 100 || (authorUserId && !authorName)) return { error: "作品作者无效" };
      showcase.push({ title, imageUrl, projectId, authorName, authorUserId });
    }
    classes.push({ scheduleImage, name, description, coverImage, coverFocusX, coverFocusY, tagIds: [...new Set(item.tagIds)], lessons, showcase });
  }
  return { classes };
}
