/**
 * saveMeetingTalks 差异化保存 — 真实数据库集成测试（直连 Supabase）
 * 运行方式：DATABASE_URL=... npx vitest run 本文件
 * 验证：重排/改写后已有议程项 id 保持不变，删除与新增按差异生效。
 */
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/adminGuard", () => ({
  requireAdmin: async () => ({ user: { id: "diff-test-admin" } }),
}));
vi.mock("@/lib/auth/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/i18n/getLang", () => ({ getLang: async () => "cn" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/cache", () => ({ invalidateCache: async () => {} }));

import { saveMeetingTalks } from "@/app/admin/activities/actions";
import { prisma } from "@/lib/db/prisma";

const MARKER = "ZCODE-DIFF-SAVE-TEST";

let activityId: string;

afterAll(async () => {
  // Activity → MeetingTalk 级联删除，清理全部测试数据
  await prisma.activity.deleteMany({ where: { title: { contains: MARKER } } });
  await prisma.$disconnect();
});

describe("saveMeetingTalks — 差异化保存（真实 DB）", () => {
  it("初建 → 重排改写 → 增删：已有行 id 保持不变", async () => {
    const activity = await prisma.activity.create({
      data: {
        title: `${MARKER} 活动`,
        slug: `${MARKER.toLowerCase()}-a-${Date.now()}`,
        type: "MEETING",
        status: "PUBLISHED",
        timePending: true,
      },
      select: { id: true },
    });
    activityId = activity.id;

    // 1) 初建 A/B/C
    const first = await saveMeetingTalks(activityId, [
      { speaker: "甲", title: `${MARKER}-A` },
      { speaker: "乙", title: `${MARKER}-B` },
      { speaker: "丙", title: `${MARKER}-C`, bvId: "BV1xx411c7mD" },
    ]);
    expect("error" in first && first.error).toBeFalsy();
    const ids1 = first.talks!.map((t) => t.id).sort();
    expect(ids1).toHaveLength(3);

    // 2) 重排 + 改写 C 的标题（带上原 id）
    const idOf = (title: string) => first.talks!.find((t) => t.title === title)!.id;
    const second = await saveMeetingTalks(activityId, [
      { id: idOf(`${MARKER}-C`), speaker: "丙", title: `${MARKER}-C2`, bvId: "BV1xx411c7mD" },
      { id: idOf(`${MARKER}-A`), speaker: "甲", title: `${MARKER}-A` },
      { id: idOf(`${MARKER}-B`), speaker: "乙", title: `${MARKER}-B` },
    ]);
    expect("error" in second && second.error).toBeFalsy();
    const ids2 = second.talks!.map((t) => t.id).sort();
    // 核心：id 集合完全一致（旧行未被换血）
    expect(ids2).toEqual(ids1);
    expect(second.talks!.map((t) => t.title)).toEqual([`${MARKER}-C2`, `${MARKER}-A`, `${MARKER}-B`]);

    // 3) 删 C、增 D，A/B id 依旧
    const abBefore = [idOf(`${MARKER}-A`), idOf(`${MARKER}-B`)].sort();
    const third = await saveMeetingTalks(activityId, [
      { id: idOf(`${MARKER}-A`), speaker: "甲", title: `${MARKER}-A` },
      { id: idOf(`${MARKER}-B`), speaker: "乙", title: `${MARKER}-B` },
      { speaker: "丁", title: `${MARKER}-D` },
    ]);
    expect("error" in third && third.error).toBeFalsy();
    const abAfter = third
      .talks!.filter((t) => t.title.includes("-A") || t.title.includes("-B"))
      .map((t) => t.id)
      .sort();
    expect(abAfter).toEqual(abBefore);
    expect(third.talks!).toHaveLength(3);
    expect(third.talks!.some((t) => t.title === `${MARKER}-D`)).toBe(true);
    expect(third.talks!.some((t) => t.title === `${MARKER}-C2`)).toBe(false);
  }, 120_000);

  it("空数组清空后可重建", async () => {
    const activity = await prisma.activity.create({
      data: {
        title: `${MARKER} 活动2`,
        slug: `${MARKER.toLowerCase()}-b-${Date.now()}`,
        type: "MEETING",
        status: "PUBLISHED",
        timePending: true,
      },
      select: { id: true },
    });
    activityId = activity.id;
    const first = await saveMeetingTalks(activityId, [{ speaker: "甲", title: `${MARKER}-X` }]);
    expect(first.talks).toHaveLength(1);
    const cleared = await saveMeetingTalks(activityId, []);
    expect(cleared.talks).toHaveLength(0);
  }, 60_000);
});
