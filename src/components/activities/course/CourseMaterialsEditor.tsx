"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import CourseAttachmentSorter from "./CourseAttachmentSorter";
import { UPLOAD_LIMIT_BYTES } from "@/lib/utils/uploadLimits";
import { courseParticipantKey, isCourseImage, moveCourseAttachment, type CourseAttachmentDraft, type CourseParticipantDraft, type CourseRole } from "@/lib/activities/course-materials";

type MemberHit = { id: string; displayName: string; avatar?: string | null };
type ActiveSearch = { role: CourseRole; query: string };

export default function CourseMaterialsEditor({
  participants: initialParticipants,
  attachments: initialAttachments,
  onChange,
  showStudents = true,
}: {
  participants: CourseParticipantDraft[];
  attachments: CourseAttachmentDraft[];
  onChange?: (value: { participants: CourseParticipantDraft[]; attachments: CourseAttachmentDraft[] }) => void;
  showStudents?: boolean;
}) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [search, setSearch] = useState<ActiveSearch | null>(null);
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const searchRequestRef = useRef(0);
  const searchRole = search?.role;
  const searchQuery = search?.query ?? "";

  useEffect(() => {
    onChange?.({ participants, attachments });
  }, [participants, attachments, onChange]);

  useEffect(() => {
    const requestId = ++searchRequestRef.current;
    const q = searchQuery.trim();
    if (!searchRole || !q) {
      setHits([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setHits([]);
    setSearching(true);

    const timer = window.setTimeout(() => {
      fetch(`/api/members/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => res.ok ? res.json() : [])
        .then((rows: MemberHit[]) => {
          if (requestId !== searchRequestRef.current || controller.signal.aborted) return;
          setHits(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (requestId !== searchRequestRef.current || controller.signal.aborted) return;
          setHits([]);
        })
        .finally(() => {
          if (requestId === searchRequestRef.current && !controller.signal.aborted) setSearching(false);
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchRole, searchQuery]);

  function toggleSearch(role: CourseRole) {
    searchRequestRef.current += 1;
    setSearch((current) => current?.role === role ? null : { role, query: "" });
    setHits([]);
    setSearching(false);
    setError("");
  }

  function closeSearch() {
    searchRequestRef.current += 1;
    setSearch(null);
    setHits([]);
    setSearching(false);
  }

  function changeQuery(value: string) {
    if (search?.query === value) return;
    // Invalidate any in-flight request immediately so a slower response for the
    // previous query cannot repopulate the list before the debounced effect runs.
    searchRequestRef.current += 1;
    setSearch((current) => current ? { ...current, query: value } : current);
    setHits([]);
    setSearching(value.trim().length > 0);
  }

  function addMember(member: MemberHit, role: CourseRole) {
    setParticipants((current) => {
      const existing = current.find((item) => item.memberId === member.id);
      if (existing?.role === role) return current;
      const rest = current.filter((item) => item.memberId !== member.id);
      return [...rest, { memberId: member.id, role, displayName: member.displayName, avatar: member.avatar || null }];
    });
    closeSearch();
    setError("");
  }

  function addExternalInstructor() {
    if (search?.role !== "INSTRUCTOR") return;
    const externalName = search.query.trim().replace(/\s+/g, " ");
    if (!externalName || externalName.length > 80 || /[\u0000-\u001f\u007f]/.test(externalName)) {
      setError("社外讲师姓名需在 1–80 字之间");
      return;
    }
    const key = courseParticipantKey({ externalName });
    if (participants.some((item) => courseParticipantKey(item) === key)) {
      setError("这位社外讲师已添加");
      return;
    }
    setParticipants((current) => [...current, { externalName, role: "INSTRUCTOR", displayName: externalName }]);
    closeSearch();
    setError("");
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(list)) {
        if (file.size > UPLOAD_LIMIT_BYTES) {
          setError(`「${file.name}」超过 ${Math.floor(UPLOAD_LIMIT_BYTES / 1024 / 1024)}MB`);
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload/attachment", { method: "POST", body });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.url) {
          setError(payload?.error || `「${file.name}」上传失败`);
          continue;
        }
        setAttachments((current) => [
          ...current,
          { name: payload.name || file.name, url: payload.url, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes ?? file.size },
        ]);
      }
    } finally {
      setUploading(false);
    }
  }

  const instructors = participants.filter((item) => item.role === "INSTRUCTOR");
  const students = participants.filter((item) => item.role === "STUDENT");
  const images = attachments.filter(isCourseImage);
  const files = attachments.filter((file) => !isCourseImage(file));

  return (
    <section className="bg-card rounded-xl border p-4 sm:p-6 shadow-sm border-brand-border-subtle space-y-5">
      <input type="hidden" name="courseJson" value={JSON.stringify({ participants, attachments })} />
      <div>
        <h2 className="text-lg font-semibold text-brand-navy">{showStudents ? "讲师、学员与附件" : "总讲师与附件"}</h2>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <PeopleList
        title="讲师"
        role="INSTRUCTOR"
        people={instructors}
        active={search?.role === "INSTRUCTOR"}
        query={search?.role === "INSTRUCTOR" ? search.query : ""}
        hits={hits}
        searching={searching}
        onToggle={() => toggleSearch("INSTRUCTOR")}
        onClose={closeSearch}
        onQueryChange={changeQuery}
        onSelectMember={(member) => addMember(member, "INSTRUCTOR")}
        onAddExternal={addExternalInstructor}
        onRemove={(key) => setParticipants((current) => current.filter((item) => courseParticipantKey(item) !== key))}
      />
      {showStudents && <PeopleList
        title="学员"
        role="STUDENT"
        people={students}
        active={search?.role === "STUDENT"}
        query={search?.role === "STUDENT" ? search.query : ""}
        hits={hits}
        searching={searching}
        onToggle={() => toggleSearch("STUDENT")}
        onClose={closeSearch}
        onQueryChange={changeQuery}
        onSelectMember={(member) => addMember(member, "STUDENT")}
        onAddExternal={addExternalInstructor}
        onRemove={(key) => setParticipants((current) => current.filter((item) => courseParticipantKey(item) !== key))}
      />}

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-brand-navy">附件</h3>
          <label className="text-xs px-3 py-1.5 rounded-lg border border-brand-blue text-brand-blue cursor-pointer">
            {uploading ? "上传中..." : "上传附件"}
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.zip,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,application/pdf"
              multiple
              disabled={uploading}
              onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
        <p className="text-xs text-brand-text-muted mb-4">PDF、Office、ZIP、文本或图片，单个不超过 {Math.floor(UPLOAD_LIMIT_BYTES / 1024 / 1024)}MB。直接拖动图片或文件排序。</p>
        <div className="space-y-5">
          <CourseAttachmentSorter
            title="图片"
            items={images}
            image
            onMove={(from, to) => setAttachments((current) => moveCourseAttachment(current, from, to))}
            onRemove={(url) => setAttachments((current) => current.filter((item) => item.url !== url))}
          />
          <CourseAttachmentSorter
            title="文件"
            items={files}
            onMove={(from, to) => setAttachments((current) => moveCourseAttachment(current, from, to))}
            onRemove={(url) => setAttachments((current) => current.filter((item) => item.url !== url))}
          />
        </div>
      </div>
    </section>
  );
}

function PeopleList({
  title,
  role,
  people,
  active,
  query,
  hits,
  searching,
  onToggle,
  onClose,
  onQueryChange,
  onSelectMember,
  onAddExternal,
  onRemove,
}: {
  title: string;
  role: CourseRole;
  people: CourseParticipantDraft[];
  active: boolean;
  query: string;
  hits: MemberHit[];
  searching: boolean;
  onToggle: () => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelectMember: (member: MemberHit) => void;
  onAddExternal: () => void;
  onRemove: (key: string) => void;
}) {
  const containerRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showDropdown = active && Boolean(query.trim());
  const exactMember = hits.find((member) => member.displayName.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const canAddExternal = role === "INSTRUCTOR" && !searching && !exactMember && Boolean(query.trim());

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active, onClose]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-navy mb-2">{title}</h3>
      <ul className="flex flex-wrap items-center gap-2">
        {people.map((person) => (
          <li key={courseParticipantKey(person)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2 py-1">
            <UserAvatar src={person.avatar} name={person.displayName} size={24} />
            <span className="text-sm text-brand-navy">{person.displayName || "成员"}</span>
            <button type="button" className="text-xs text-brand-text-muted px-1" aria-label={`移除${person.displayName || title}`} onClick={() => onRemove(courseParticipantKey(person))}>×</button>
          </li>
        ))}

        <li
          ref={containerRef}
          className={`relative h-8 shrink-0 overflow-visible border bg-card transition-[width,border-radius,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${active ? "w-64 max-w-full rounded-lg border-brand-blue shadow-[0_0_0_2px_rgba(58,150,204,0.12)]" : "w-8 rounded-full border-brand-border-subtle hover:border-brand-blue"}`}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
          }}
        >
          <button
            type="button"
            aria-label={`添加${title}`}
            title={`添加${title}`}
            tabIndex={active ? -1 : 0}
            className={`absolute inset-0 grid place-items-center text-brand-blue transition-[opacity,transform] duration-200 motion-reduce:transition-none ${active ? "pointer-events-none scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
            onClick={onToggle}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (!searching && exactMember) onSelectMember(exactMember);
                  else if (canAddExternal) onAddExternal();
                }
              }}
              placeholder={role === "INSTRUCTOR" ? "搜索社团成员或输入社外讲师姓名" : "搜索社团成员"}
              aria-label={`搜索${title}`}
              tabIndex={active ? 0 : -1}
              aria-hidden={!active}
              className={`h-full w-full min-w-0 bg-transparent px-3 text-sm text-brand-text-heading outline-none transition-opacity duration-200 motion-reduce:transition-none ${active ? "opacity-100 delay-75" : "pointer-events-none opacity-0"}`}
              autoComplete="off"
            />
            {showDropdown && (
              <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-brand-border-subtle bg-card shadow-lg">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-brand-text-muted">搜索中…</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                  {hits.length > 0 && <ul>
                    {hits.map((member) => (
                      <li key={member.id} className="border-b border-brand-border-subtle last:border-0">
                        <button
                          type="button"
                          aria-label={member.displayName}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-surface"
                          onClick={() => onSelectMember(member)}
                        >
                          <UserAvatar src={member.avatar} name={member.displayName} size={28} />
                          <span className="min-w-0 flex-1 text-sm text-brand-navy truncate">{member.displayName}</span>
                        </button>
                      </li>
                    ))}
                  </ul>}
                  {canAddExternal ? (
                    <button
                      type="button"
                      className="w-full border-t border-brand-border-subtle px-3 py-2 text-left text-sm text-brand-blue hover:bg-brand-surface"
                      onClick={onAddExternal}
                    >
                      添加「{query.trim()}」
                    </button>
                  ) : hits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-brand-text-muted">没有匹配的社团成员</p>
                  ) : null}
                  </div>
                )}
              </div>
            )}
        </li>
      </ul>
    </div>
  );
}
