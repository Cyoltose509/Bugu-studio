import { prisma } from "@/lib/db/prisma";

/**
 * 实用工具站导航数据。
 * 持久化在 SiteSetting（key: tools:sites）的 JSON 数组里——条目量小、结构简单，
 * 不值得单独立表。未初始化时回退到下面的默认条目。
 */

export interface ToolSite {
    id: string;
    name: string;
    url: string;
    /** 图标地址（favicon）；空则前端回退为品牌色字标 */
    iconUrl: string;
    /** 字标回退用 */
    color: string;
    letter: string;
    category: string;
    description: string;
}

export const TOOLS_SETTING_KEY = "tools:sites";

export const DEFAULT_TOOL_SITES: ToolSite[] = [
    {
        id: "godot",
        name: "Godot Engine",
        url: "https://godotengine.org",
        iconUrl: "/images/tools/godot.png",
        color: "#478CBF",
        letter: "G",
        category: "游戏引擎",
        description: "开源免费的游戏引擎，2D/3D 一体化，轻量易上手，适合独立开发与社团项目。",
    },
    {
        id: "blender",
        name: "Blender",
        url: "https://www.blender.org",
        iconUrl: "/images/tools/blender.png",
        color: "#EA7600",
        letter: "B",
        category: "三维创作",
        description: "开源三维创作套件：建模、雕刻、绑定动画、渲染与视频剪辑一站式完成。",
    },
];

function faviconFor(url: string): string {
    try {
        const host = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch {
        return "";
    }
}

/** 服务端读取工具列表；未配置时返回默认条目 */
export async function getToolSites(): Promise<ToolSite[]> {
    let row: { value: string } | null = null;
    try {
        row = await prisma.siteSetting.findUnique({ where: { key: TOOLS_SETTING_KEY } });
    } catch (e) {
        // 读取失败不能静默装作"未配置"（否则管理员刚保存的列表会闪回默认）——打日志便于排查
        console.error("[tools] 读取工具列表失败，暂时回退默认条目:", e);
        return DEFAULT_TOOL_SITES;
    }
    if (!row) return DEFAULT_TOOL_SITES;
    const parsed = normalizeToolSites(row.value);
    return parsed.length > 0 ? parsed : DEFAULT_TOOL_SITES;
}

/** 校验 + 规范化：url 必须 http(s)，name 必填；iconUrl 缺省时按域名自动取 favicon */
export function normalizeToolSites(raw: unknown): ToolSite[] {
    if (!Array.isArray(raw)) return [];
    const out: ToolSite[] = [];
    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const name = String(rec.name || "").trim();
        const url = String(rec.url || "").trim();
        if (!name || !/^https?:\/\//.test(url)) continue;
        const color = /^#[0-9a-fA-F]{6}$/.test(String(rec.color || "")) ? String(rec.color) : "#25547A";
        const iconUrl = String(rec.iconUrl || "").trim() || faviconFor(url);
        out.push({
            id: String(rec.id || "").trim() || `tool-${out.length}`,
            name,
            url,
            iconUrl,
            color,
            letter: (String(rec.letter || "").trim() || name[0] || "?").toUpperCase(),
            category: String(rec.category || "").trim() || "工具",
            description: String(rec.description || "").trim(),
        });
    }
    return out;
}
