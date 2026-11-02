"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";
import { normalizeToolsData, TOOLS_SETTING_KEY, type ToolsData } from "@/lib/tools/tools";

/** 管理员保存实用工具数据（分栏 + 条目，整表覆盖，条目量小无并发压力） */
export async function saveToolsData(data: unknown): Promise<{ error?: string; data?: ToolsData }> {
    await requireAdmin();
    const normalized = normalizeToolsData(data);
    if (normalized.sites.length > 60) return { error: "工具条目过多" };
    if (normalized.sections.length > 20) return { error: "分栏过多" };
    await prisma.siteSetting.upsert({
        where: { key: TOOLS_SETTING_KEY },
        update: { value: JSON.stringify(normalized) },
        create: { key: TOOLS_SETTING_KEY, value: JSON.stringify(normalized) },
    });
    revalidatePath("/tools");
    return { data: normalized };
}
