import { describe, expect, it } from "vitest";
import { canViewCourseMeetingLinks, parseCourseMeetingVisibility, redactCourseMeetingLinks } from "@/lib/activities/course-meeting-visibility";
import { parseEngineCourseProgram } from "@/lib/activities/engine-course";

const lesson = {
  instructorName: "小明", topic: "引擎基础", title: "第一课", date: "2026-10-20",
  startTime: "19:00", endTime: "20:30", meetingUrl: "https://meeting.example.com/room",
  videoUrl: "https://www.bilibili.com/video/BV1234567890",
};
const valid = { classes: [{ name: "Unity 班", description: "入门", coverImage: "", tagIds: [], lessons: [lesson], showcase: [{ title: "作业", imageUrl: "https://cdn.example.com/assignment.png", projectId: null }] }] };

describe("course meeting visibility", () => {
  const guest = null;
  const registered = { id: "user", role: "USER", memberId: null };
  const member = { id: "member-user", role: "MEMBER", memberId: "member" };
  const admin = { id: "admin", role: "ADMIN", memberId: null };
  it("defaults unknown values to hidden", () => expect(parseCourseMeetingVisibility("unknown")).toBe("HIDDEN"));
  it("applies all four levels", () => {
    expect(canViewCourseMeetingLinks("HIDDEN", guest)).toBe(false);
    expect(canViewCourseMeetingLinks("HIDDEN", admin)).toBe(true);
    expect(canViewCourseMeetingLinks("MEMBERS", registered)).toBe(false);
    expect(canViewCourseMeetingLinks("MEMBERS", member)).toBe(true);
    expect(canViewCourseMeetingLinks("REGISTERED", registered)).toBe(true);
    expect(canViewCourseMeetingLinks("REGISTERED", guest)).toBe(false);
    expect(canViewCourseMeetingLinks("PUBLIC", guest)).toBe(true);
  });
  it("removes protected links from nested RSC props without mutating the source", () => {
    const activity = { type: "ENGINE_COURSE", meetingUrl: "https://secret.example", courseClasses: [{ lessons: [{ meetingUrl: "https://lesson.example" }] }] };
    const safe = redactCourseMeetingLinks(activity, false);
    expect(JSON.stringify(safe)).not.toContain("secret.example");
    expect(JSON.stringify(safe)).not.toContain("lesson.example");
    expect(activity.courseClasses[0].lessons[0].meetingUrl).toContain("lesson.example");
  });
});

describe("engine course program", () => {
  it("accepts classes, lessons and image-only showcases", () => {
    expect(parseEngineCourseProgram(valid)).toMatchObject(valid);
  });
  it("rejects reversed times and non-Bilibili videos", () => {
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [{ ...lesson, endTime: "18:00" }] }] })).toHaveProperty("error");
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [{ ...lesson, videoUrl: "https://evil.example.com/watch" }] }] })).toHaveProperty("error");
  });
  it("allows an empty time, a start-only time, or a complete time range", () => {
    const withoutTimes = { ...lesson, startTime: "", endTime: "" };
    const startOnly = { ...lesson, startTime: "19:00", endTime: "" };
    const complete = { ...lesson, startTime: "19:00", endTime: "20:30" };
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [withoutTimes] }] })).toMatchObject({ classes: [{ lessons: [{ startTime: "", endTime: "" }] }] });
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [startOnly] }] })).toMatchObject({ classes: [{ lessons: [{ startTime: "19:00", endTime: "" }] }] });
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [complete] }] })).toMatchObject({ classes: [{ lessons: [{ startTime: "19:00", endTime: "20:30" }] }] });
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [{ ...lesson, startTime: "", endTime: "20:30" }] }] })).toHaveProperty("error");
  });
  it("rejects impossible dates and unsafe URLs", () => {
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], lessons: [{ ...lesson, date: "2026-02-31" }] }] })).toHaveProperty("error");
    expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], showcase: [{ title: "A", imageUrl: "javascript:alert(1)", projectId: null }] }] })).toHaveProperty("error");
  });
});

it("preserves typed and linked showcase authors, rejecting links without a name", () => {
  const work = { ...valid.classes[0].showcase[0], authorName: "作者", authorUserId: "user-1" };
  expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], showcase: [work] }] })).toMatchObject({ classes: [{ showcase: [work] }] });
  expect(parseEngineCourseProgram({ classes: [{ ...valid.classes[0], showcase: [{ ...work, authorName: "" }] }] })).toHaveProperty("error");
});
