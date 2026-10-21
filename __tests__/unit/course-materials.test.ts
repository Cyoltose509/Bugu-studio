import { describe, expect, it } from "vitest";
import { isCourseAttachmentUrl, isCourseImage, moveCourseAttachment, parseCourseMaterials } from "@/lib/activities/course-materials";

const base = "https://cdn.example.com";

describe("course materials", () => {
  it("accepts instructors, students, and attachments stored on this site", () => {
    const parsed = parseCourseMaterials({
      participants: [
        { memberId: "m1", role: "INSTRUCTOR", displayName: "甲" },
        { memberId: "m2", role: "STUDENT" },
      ],
      attachments: [{ name: "讲义.pdf", url: `${base}/attachments/abc.pdf`, mimeType: "application/pdf", sizeBytes: 12 }],
    });
    expect(parsed).toMatchObject({
      participants: [
        { memberId: "m1", externalName: null, role: "INSTRUCTOR" },
        { memberId: "m2", externalName: null, role: "STUDENT" },
      ],
    });
    expect(isCourseAttachmentUrl(`${base}/attachments/abc.pdf`, `${base}/`)).toBe(true);
  });

  it("accepts an external instructor while rejecting external students and duplicate names", () => {
    const parsed = parseCourseMaterials({
      participants: [
        { memberId: "m1", role: "STUDENT" },
        { externalName: "  李 老师  ", role: "INSTRUCTOR" },
      ],
      attachments: [],
    });
    expect(parsed).toMatchObject({
      participants: [
        { memberId: "m1", externalName: null, role: "STUDENT" },
        { memberId: null, externalName: "李 老师", role: "INSTRUCTOR" },
      ],
    });
    expect(parseCourseMaterials({ participants: [{ externalName: "李老师", role: "STUDENT" }], attachments: [] }))
      .toEqual({ error: "社外讲师姓名无效（最多 80 字）" });
    expect(parseCourseMaterials({
      participants: [
        { externalName: "Alice", role: "INSTRUCTOR" },
        { externalName: " alice ", role: "INSTRUCTOR" },
      ],
      attachments: [],
    })).toEqual({ error: "社外讲师姓名重复" });
  });

  it("rejects a member in both roles and files outside the attachment store", () => {
    expect(parseCourseMaterials({
      participants: [
        { memberId: "m1", role: "INSTRUCTOR" },
        { memberId: "m1", role: "STUDENT" },
      ],
      attachments: [],
    })).toEqual({ error: "同一成员不能同时是讲师和学员" });

    expect(isCourseAttachmentUrl("https://evil.example/attachments/a.pdf", base)).toBe(false);
    expect(isCourseAttachmentUrl(`${base}/covers/a.pdf`, base)).toBe(false);
    expect(isCourseAttachmentUrl(`${base}/attachments/../covers/a.pdf`, base)).toBe(false);
  });

  it("separates images and reorders only within their attachment group", () => {
    const files = [
      { name: "one.png", url: "https://cdn.example.com/attachments/one.png", mimeType: "image/png" },
      { name: "notes.pdf", url: "https://cdn.example.com/attachments/notes.pdf", mimeType: "application/pdf" },
      { name: "two.webp", url: "https://cdn.example.com/attachments/two.webp", mimeType: null },
    ];
    expect(files.map(isCourseImage)).toEqual([true, false, true]);
    expect(moveCourseAttachment(files, files[2].url, files[0].url).map((file) => file.name))
      .toEqual(["two.webp", "one.png", "notes.pdf"]);
    expect(moveCourseAttachment(files, files[1].url, files[0].url)).toBe(files);
  });
});
