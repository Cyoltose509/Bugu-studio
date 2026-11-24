import { describe, it, expect } from "vitest";
import {
  getLatestUndergradYear,
  getUndergradGradePresets,
  isLikelyGraduated,
  getProfileMissingItems,
} from "@/lib/profile/onboarding";

describe("onboarding helpers", () => {
  it("computes latest undergrad enrollment year across academic boundary", () => {
    expect(getLatestUndergradYear(new Date("2026-11-23T00:00:00Z"))).toBe(2026);
    expect(getLatestUndergradYear(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
    expect(getLatestUndergradYear(new Date("2026-06-30T00:00:00Z"))).toBe(2025);
  });

  it("generates descending undergraduate enrollment year presets", () => {
    const presets = getUndergradGradePresets(new Date("2026-11-23T00:00:00Z"), 6);
    expect(presets).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
  });

  it("estimates likely graduated status for 4-year cohorts", () => {
    const now = new Date("2026-11-23T00:00:00Z");
    expect(isLikelyGraduated(2026, now)).toBe(false);
    expect(isLikelyGraduated(2023, now)).toBe(false);
    expect(isLikelyGraduated(2022, now)).toBe(true);
    expect(isLikelyGraduated(2021, now)).toBe(true);
  });

  it("computes missing profile items and completion percent for club members", () => {
    const empty = getProfileMissingItems({
      isMember: true,
      grade: null,
      image: null,
      skills: [],
      bio: "",
    });
    expect(empty.percent).toBe(0);
    expect(empty.missing.map((m) => m.key)).toEqual(["grade", "avatar", "skills", "bio"]);

    const partial = getProfileMissingItems({
      isMember: true,
      grade: 2026,
      image: "https://cdn.example.com/a.png",
      skills: [],
      bio: null,
    });
    expect(partial.percent).toBe(50);
    expect(partial.missing.map((m) => m.key)).toEqual(["skills", "bio"]);

    const full = getProfileMissingItems({
      isMember: true,
      grade: 2025,
      image: "/uploads/avatars/1.png",
      skills: ["程序"],
      bio: "喜欢做肉鸽",
    });
    expect(full.percent).toBe(100);
    expect(full.missing).toEqual([]);
  });

  it("only checks avatar and bio for non-member registered users", () => {
    const res = getProfileMissingItems({
      isMember: false,
      grade: null,
      image: null,
      skills: [],
      bio: "hello",
    });
    expect(res.totalCount).toBe(2);
    expect(res.percent).toBe(50);
    expect(res.missing.map((m) => m.key)).toEqual(["avatar"]);
  });
});
