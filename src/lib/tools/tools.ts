import { prisma } from "@/lib/db/prisma";
import {
    DEFAULT_TOOLS_DATA,
    normalizeToolsData,
    TOOLS_SETTING_KEY,
    type ToolSite,
    type ToolsData,
} from "./shared";

export * from "./shared";

/**
 * 实用工具站导航数据（服务端读写）。
 * 持久化在 SiteSetting（key: tools:sites）的 JSON 里——条目量小、结构简单，
 * 不值得单独立表。未初始化时回退到默认数据。
 */

/** 服务端读取工具数据；未配置时返回默认数据 */
export async function getToolsData(): Promise<ToolsData> {
    let row: { value: string } | null = null;
    try {
        row = await prisma.siteSetting.findUnique({ where: { key: TOOLS_SETTING_KEY } });
    } catch (e) {
        // 读取失败不能静默装作"未配置"（否则管理员刚保存的列表会闪回默认）——打日志便于排查
        console.error("[tools] 读取工具列表失败，暂时回退默认条目:", e);
        return DEFAULT_TOOLS_DATA;
    }
    if (!row) return DEFAULT_TOOLS_DATA;
    const parsed = normalizeToolsData(row.value);
    return parsed.sites.length > 0 ? parsed : DEFAULT_TOOLS_DATA;
}

/** 兼容入口：只取条目列表 */
export async function getToolSites(): Promise<ToolSite[]> {
    return (await getToolsData()).sites;
}
