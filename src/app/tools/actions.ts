"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";
import { normalizeToolsData, TOOLS_SETTING_KEY, type ToolsData } from "@/lib/tools/tools";
import { resolveFavicon } from "@/lib/tools/favicon";

/** 热链 favicon（s2 服务 / 裸 favicon.ico）——访客网络经常不可达，保存时由服务端抓取转存 R2 */
const HOTLINK_ICON = /(google\.com\/s2|\/favicon\.ico$)/;

/** 管理员保存实用工具数据（分栏 + 条目，整表覆盖，条目量小无并发压力） */
export async function saveToolsData(data: unknown): Promise<{ error?: string; data?: ToolsData }> {
    await requireAdmin();
    const normalized = normalizeToolsData(data);
    if (normalized.sites.length > 60) return { error: "工具条目过多" };
    if (normalized.sections.length > 20) return { error: "分栏过多" };

    // 服务端抓取 favicon 并转存 R2：热链（s2/裸 favicon.ico）或缺失图标的条目
    // 在保存时补齐；管理员手动上传的图标不动。并行 + 各自 6s 超时，全部失败则
    // 保留空 iconUrl（前端回退品牌色字标），不阻塞保存。
    await Promise.allSettled(
        normalized.sites.map(async (site) => {
            if (site.iconUrl && !HOTLINK_ICON.test(site.iconUrl)) return;
            const resolved = await resolveFavicon(site.url);
            if (resolved) site.iconUrl = resolved;
        }),
    );

    await prisma.siteSetting.upsert({
        where: { key: TOOLS_SETTING_KEY },
        update: { value: JSON.stringify(normalized) },
        create: { key: TOOLS_SETTING_KEY, value: JSON.stringify(normalized) },
    });
    revalidatePath("/tools");
    return { data: normalized };
}
