/**
 * 回归：导航站条目数增长后，后台保存不能被旧的 60 条上限拦下。
 * 只 mock 鉴权 / 落库 / favicon 抓取，不触碰真实数据库。
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/adminGuard", () => ({ requireAdmin: async () => ({ user: { id: "test" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
    prisma: { siteSetting: { upsert: vi.fn(async () => ({})) } },
}));
vi.mock("@/lib/tools/favicon", () => ({ resolveFavicon: async () => "" }));

import { saveToolsData } from "@/app/tools/actions";
import { DEFAULT_TOOLS_DATA } from "@/lib/tools/shared";

describe("saveToolsData 容量上限", () => {
    it("当前默认清单（超过 60 条）能完整保存", async () => {
        expect(DEFAULT_TOOLS_DATA.sites.length).toBeGreaterThan(60);
        const result = await saveToolsData(DEFAULT_TOOLS_DATA);
        expect(result.error).toBeUndefined();
        expect(result.data?.sites).toHaveLength(DEFAULT_TOOLS_DATA.sites.length);
        expect(result.data?.sections).toHaveLength(DEFAULT_TOOLS_DATA.sections.length);
    });
});
