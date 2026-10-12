import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), activity: vi.fn(), count: vi.fn(), save: vi.fn(), path: vi.fn(),
  setting: vi.fn(), works: vi.fn(), mockEnabled: vi.fn(),
}));
vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  activity: { findUnique: mocks.activity }, project: { count: mocks.count, findMany: mocks.works },
  siteSetting: { upsert: mocks.save, findUnique: mocks.setting },
} }));
vi.mock("@/lib/mock/frontend-data", () => ({ isMockDataEnabled: mocks.mockEnabled }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: vi.fn() }));

import { saveActivityShowcase } from "@/app/admin/activities/showcase-actions";
import { getShowcaseProjects } from "@/lib/activities/showcase-data";

describe("showcase administration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.admin.mockResolvedValue({ user: { role: "ADMIN" } });
    mocks.activity.mockResolvedValue({ slug: "baituan-2026", type: "GENERAL" });
    mocks.count.mockResolvedValue(2);
    mocks.save.mockResolvedValue({});
  });
  const config = { enabled: true, projectIds: ["b", "a"], posters: [] };
  it("checks administrator permissions before querying or writing", async () => {
    mocks.admin.mockRejectedValue(new Error("权限不足"));
    await expect(saveActivityShowcase("event", config)).rejects.toThrow("权限不足");
    expect(mocks.activity).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects unpublished or deleted works", async () => {
    mocks.count.mockResolvedValue(1);
    expect(await saveActivityShowcase("event", config)).toHaveProperty("error");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("restricts configuration to existing general activities", async () => {
    mocks.activity.mockResolvedValue({ type: "MEETING" });
    expect(await saveActivityShowcase("event", config)).toHaveProperty("error");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("persists removal of all posters and works and refreshes ID and slug routes", async () => {
    mocks.count.mockResolvedValue(0);
    expect(await saveActivityShowcase("event", { ...config, projectIds: [] })).toEqual({ success: true });
    const saved = JSON.parse(mocks.save.mock.calls[0][0].update.value);
    expect(saved.projectIds).toEqual([]);
    expect(saved.posters).toEqual([]);
    expect(mocks.path).toHaveBeenCalledWith("/activities/event");
    expect(mocks.path).toHaveBeenCalledWith("/activities/baituan-2026");
  });
  it("returns projects in catalogue order, excluding works no longer published", async () => {
    mocks.works.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    expect(await getShowcaseProjects(["b", "deleted", "a"])).toEqual([{ id: "b" }, { id: "a" }]);
    expect(mocks.works.mock.calls[0][0].where.status).toBe("PUBLISHED");
  });
});
