import { describe, expect, it, vi } from "vitest";
import { baituanShowcase, parseShowcase, showcaseSchema, isShowcaseImageUrl } from "@/lib/activities/showcase";
import { formatActivityDateTime, parseActivityDateTime } from "@/lib/activities/datetime";
import { prepareBaituanDraft } from "@/lib/activities/baituan";

describe("activity showcase", () => {
  it("links the five existing works in event order", () => {
    const projects = ["active", "2", "saga-of-deadwood", "project-i3lij3", "step-or-sink-2"].map(slug => ({ id: slug, slug }));
    expect(baituanShowcase(projects).projectIds).toEqual(["project-i3lij3", "2", "step-or-sink-2", "saga-of-deadwood", "active"]);
  });
  it("does not invent missing work references", () => {
    expect(baituanShowcase([]).projectIds).toEqual([]);
  });
  it.each(["javascript:alert(1)", "//evil.example/img.png", "https://evil.example/a.png", "https://cdn.bugoostudio.com.evil.example/a", "/\\evil.example/image", "https://user:pass@cdn.bugoostudio.com/a"])("rejects unsafe poster URL %s", url => {
    expect(isShowcaseImageUrl(url)).toBe(false);
  });
  it.each(["/images/poster.webp", "https://cdn.bugoostudio.com/cover/a.png", "https://example.r2.dev/poster.png"])("allows supported poster URL %s", url => {
    expect(isShowcaseImageUrl(url)).toBe(true);
  });
  it("rejects duplicate IDs and excessive catalogue sizes", () => {
    expect(showcaseSchema.safeParse({ enabled: true, projectIds: ["a", "a"], posters: [] }).success).toBe(false);
    expect(showcaseSchema.safeParse({ enabled: true, projectIds: Array.from({ length: 51 }, (_, i) => `${i}`), posters: [] }).success).toBe(false);
  });
  it("supports intentionally empty catalogues and disabled layouts", () => {
    expect(parseShowcase(JSON.stringify({ enabled: false, projectIds: [], posters: [] }))).toEqual({ enabled: false, projectIds: [], posters: [] });
    expect(parseShowcase("{broken")).toBeNull();
    expect(parseShowcase(JSON.stringify({ enabled: true }))).toBeNull();
  });
  it("roundtrips the event time independently of server timezone", () => {
    const date = parseActivityDateTime("2026-10-11T09:00");
    expect(date.toISOString()).toBe("2026-10-11T01:00:00.000Z");
    expect(formatActivityDateTime(date)).toBe("2026-10-11T09:00");
    expect(parseActivityDateTime("2026-10-11T01:00:00Z").getTime()).toBe(date.getTime());
  });
  it("preserves an existing event and edited configuration on repeat setup", async () => {
    const existing = { id: "existing", status: "PUBLISHED" };
    const tx = { activity: { findUnique: vi.fn().mockResolvedValue(existing), upsert: vi.fn() }, siteSetting: { upsert: vi.fn() } };
    expect(await prepareBaituanDraft(tx as never)).toBe(existing);
    expect(tx.activity.upsert).not.toHaveBeenCalled();
    expect(tx.siteSetting.upsert).not.toHaveBeenCalled();
  });
});
