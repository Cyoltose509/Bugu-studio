"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/adminGuard";
import { revalidatePath } from "next/cache";
import { normalizeToolSites, TOOLS_SETTING_KEY, type ToolSite } from "@/lib/tools/tools";

/** 管理员保存实用工具列表（整表覆盖，条目量小无并发压力） */
export async function saveToolSites(sites: unknown): Promise<{ error?: string; sites?: ToolSite[] }> {
    await requireAdmin();
    const normalized = normalizeToolSites(sites);
    if (normalized.length > 60) return { error: "工具条目过多" };
    await prisma.siteSetting.upsert({
        where: { key: TOOLS_SETTING_KEY },
        update: { value: JSON.stringify(normalized) },
        create: { key: TOOLS_SETTING_KEY, value: JSON.stringify(normalized) },
    });
    revalidatePath("/tools");
    return { sites: normalized };
}
