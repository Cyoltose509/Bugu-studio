export type CourseRole = "INSTRUCTOR" | "STUDENT";

export type CourseParticipantDraft = {
  memberId?: string | null;
  externalName?: string | null;
  role: CourseRole;
  displayName?: string;
  avatar?: string | null;
};

export type CourseParticipantInput =
  | { memberId: string; externalName: null; role: CourseRole }
  | { memberId: null; externalName: string; role: "INSTRUCTOR" };

export function courseParticipantKey(person: Pick<CourseParticipantDraft, "memberId" | "externalName">): string {
  return person.memberId
    ? `member:${person.memberId}`
    : `external:${(person.externalName || "").trim().toLocaleLowerCase()}`;
}

export type CourseAttachmentDraft = {
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export function isCourseImage(file: Pick<CourseAttachmentDraft, "url" | "mimeType">): boolean {
  if (file.mimeType) return file.mimeType.toLowerCase().startsWith("image/");
  try {
    return /\.(?:png|jpe?g|webp|gif|avif)$/i.test(new URL(file.url, "https://example.invalid").pathname);
  } catch {
    return false;
  }
}

export function moveCourseAttachment(
  files: CourseAttachmentDraft[],
  sourceUrl: string,
  targetUrl: string,
): CourseAttachmentDraft[] {
  const images = files.filter(isCourseImage);
  const others = files.filter((file) => !isCourseImage(file));
  const group = images.some((file) => file.url === sourceUrl) ? images : others;
  const from = group.findIndex((file) => file.url === sourceUrl);
  const to = group.findIndex((file) => file.url === targetUrl);
  if (from < 0 || to < 0 || from === to) return files;
  const reordered = [...group];
  reordered.splice(to, 0, ...reordered.splice(from, 1));
  return group === images ? [...reordered, ...others] : [...images, ...reordered];
}

const ROLES = new Set<CourseRole>(["INSTRUCTOR", "STUDENT"]);

export function isCourseAttachmentUrl(url: string, publicBase: string): boolean {
  if (!publicBase) return false;
  let parsed: URL;
  let baseUrl: URL;
  try {
    parsed = new URL(url);
    baseUrl = new URL(publicBase);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
  if (parsed.origin !== baseUrl.origin) return false;
  let path = parsed.pathname;
  try {
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }
  return path.startsWith("/attachments/") && !path.split("/").includes("..");
}

export function parseCourseMaterials(raw: unknown): { error: string } | {
  participants: CourseParticipantInput[];
  attachments: { name: string; url: string; mimeType: string | null; sizeBytes: number | null }[];
} {
  if (!raw || typeof raw !== "object") return { error: "公开课资料无效" };
  const body = raw as { participants?: unknown; attachments?: unknown };
  if (!Array.isArray(body.participants) || !Array.isArray(body.attachments)) return { error: "公开课资料无效" };
  if (body.participants.length > 80) return { error: "讲师和学员最多 80 人" };
  if (body.attachments.length > 20) return { error: "附件最多 20 个" };

  const participants: CourseParticipantInput[] = [];
  const seen = new Set<string>();
  for (const item of body.participants) {
    if (!item || typeof item !== "object") return { error: "公开课资料无效" };
    const memberId = String((item as { memberId?: unknown }).memberId || "").trim();
    const externalRaw = (item as { externalName?: unknown }).externalName;
    if (externalRaw != null && typeof externalRaw !== "string") return { error: "公开课资料无效" };
    const externalName = typeof externalRaw === "string" ? externalRaw.trim().replace(/\s+/g, " ") : "";
    const role = (item as { role?: unknown }).role;
    if (!ROLES.has(role as CourseRole) || Boolean(memberId) === Boolean(externalName)) return { error: "每位讲师或学员只能选择一种身份" };
    if (externalName && (role !== "INSTRUCTOR" || externalName.length > 80 || /[\u0000-\u001f\u007f]/.test(externalName))) {
      return { error: "社外讲师姓名无效（最多 80 字）" };
    }
    const participant = memberId
      ? { memberId, externalName: null, role: role as CourseRole }
      : { memberId: null, externalName, role: "INSTRUCTOR" as const };
    const key = courseParticipantKey(participant);
    if (seen.has(key)) return { error: memberId ? "同一成员不能同时是讲师和学员" : "社外讲师姓名重复" };
    seen.add(key);
    participants.push(participant);
  }

  const attachments: { name: string; url: string; mimeType: string | null; sizeBytes: number | null }[] = [];
  for (const item of body.attachments) {
    if (!item || typeof item !== "object") return { error: "公开课资料无效" };
    const name = String((item as { name?: unknown }).name || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
    const url = String((item as { url?: unknown }).url || "").trim();
    const mimeRaw = (item as { mimeType?: unknown }).mimeType;
    const sizeRaw = (item as { sizeBytes?: unknown }).sizeBytes;
    const mimeType = typeof mimeRaw === "string" && mimeRaw.length <= 120 ? mimeRaw : null;
    const sizeBytes = typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0 ? Math.round(sizeRaw) : null;
    if (!name || !url) return { error: "附件缺少名称或地址" };
    attachments.push({ name, url, mimeType, sizeBytes });
  }

  return { participants, attachments };
}
