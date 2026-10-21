import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { t } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { isCourseImage } from "@/lib/activities/course-materials";

type Person = {
  id?: string | null;
  displayName: string;
  avatar?: string | null;
};

type FileItem = {
  id: string;
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function People({ title, people }: { title: string; people: Person[] }) {
  if (people.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-navy mb-2">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {people.map((person) => (
          <li key={person.id || `external:${person.displayName.toLocaleLowerCase()}`}>
            {person.id ? (
              <Link href={`/members/${person.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1 text-sm text-brand-navy hover:text-brand-blue">
                <UserAvatar src={person.avatar} name={person.displayName} size={24} />
                {person.displayName}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1 text-sm text-brand-navy">
                <UserAvatar src={null} name={person.displayName} size={24} />
                {person.displayName}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CourseMaterials({
  instructors,
  students,
  attachments,
  lang,
}: {
  instructors: Person[];
  students: Person[];
  attachments: FileItem[];
  lang: Lang;
}) {
  if (instructors.length === 0 && students.length === 0 && attachments.length === 0) return null;
  const images = attachments.filter(isCourseImage);
  const files = attachments.filter((file) => !isCourseImage(file));
  return (
    <section className="bg-card rounded-xl border p-6 border-brand-border-subtle space-y-5">
      <People title={t(lang, "activityDetail.courseInstructors")} people={instructors} />
      <People title={t(lang, "activityDetail.courseStudents")} people={students} />
      {images.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-navy">{t(lang, "activityDetail.courseImages")}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((file) => (
              <li key={file.id} className="min-w-0">
                <a href={file.url} target="_blank" rel="noreferrer" aria-label={file.name} className="group relative block aspect-[4/3] overflow-hidden rounded-lg border border-brand-border-subtle bg-brand-surface hover:border-brand-blue">
                  <img src={file.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-8 text-sm text-white">{file.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {files.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-brand-navy mb-2">{t(lang, "activityDetail.courseAttachments")}</h3>
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-brand-border-subtle px-3 py-2 text-sm text-brand-blue hover:underline">
                  <span className="min-w-0 truncate">{file.name}</span>
                  {file.sizeBytes ? <span className="shrink-0 text-xs text-brand-text-muted no-underline">{formatBytes(file.sizeBytes)}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
