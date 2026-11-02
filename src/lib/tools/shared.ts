/**
 * 实用工具站导航 —— 纯数据/校验逻辑（无 prisma 依赖，客户端可安全引入）。
 * 服务端读写见 ./tools.ts。
 *
 * 存储形态（v2）：{ sections: ToolSection[], sites: ToolSite[] }
 * 兼容旧格式：裸 ToolSite[] 数组会被 normalizeToolsData 自动升级为 v2
 * （按 category 首次出现顺序还原分栏）。
 */

export interface ToolSite {
    id: string;
    name: string;
    url: string;
    /** 图标地址：站点 favicon（按网址自动获取）或管理员上传的图像；空则前端回退为品牌色字标 */
    iconUrl: string;
    /** 字标回退用（不再开放手选，保留字段以兼容旧数据） */
    color: string;
    letter: string;
    /** 所属分栏名（与 ToolSection.name 对应） */
    category: string;
    description: string;
}

export interface ToolSection {
    id: string;
    name: string;
}

export interface ToolsData {
    sections: ToolSection[];
    sites: ToolSite[];
}

export const TOOLS_SETTING_KEY = "tools:sites";

export const DEFAULT_TOOL_SECTIONS: ToolSection[] = [
    { id: "sec-game-engine", name: "游戏引擎" },
    { id: "sec-3d", name: "三维创作" },
    { id: "sec-game-platform", name: "游戏平台" },
];

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
        id: "unity",
        name: "Unity",
        url: "https://unity.com",
        iconUrl: faviconFor("https://unity.com"),
        color: "#4A4A4A",
        letter: "U",
        category: "游戏引擎",
        description: "全球装机量最大的游戏引擎之一，跨平台发布生态成熟，资源商店内容丰富。",
    },
    {
        id: "unreal-engine",
        name: "Unreal Engine",
        url: "https://www.unrealengine.com",
        iconUrl: faviconFor("https://www.unrealengine.com"),
        color: "#2A2A2A",
        letter: "U",
        category: "游戏引擎",
        description: "Epic 出品的次世代引擎，Blueprint 可视化编程与高画质渲染见长。",
    },
    {
        id: "cocos",
        name: "Cocos",
        url: "https://www.cocos.com",
        iconUrl: faviconFor("https://www.cocos.com"),
        color: "#22589E",
        letter: "C",
        category: "游戏引擎",
        description: "国产开源引擎家族，2D/3D 兼备，对小游戏与出海轻量产品尤其友好。",
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
    {
        id: "tripo-home",
        name: "Tripo AI",
        url: "https://www.tripo3d.ai",
        iconUrl: faviconFor("https://www.tripo3d.ai"),
        color: "#6C5CE7",
        letter: "T",
        category: "三维创作",
        description: "AI 三维生成平台官网：文本/图片一键生成 3D 模型、纹理与动画。",
    },
    {
        id: "tripo-3d",
        name: "3D模型生成prompt",
        url: "https://www.tripo3d.ai/zh/3d-prompts/models/gpt-6-astra?utm_source=github&utm_medium=referral&utm_campaign=awesome_astra_prompts&utm_content=catalog_bottom&category=3d-scenes&page=2#free-prompts",
        iconUrl: "",
        color: "#25547A",
        letter: "T",
        category: "三维创作",
        description: "AI 驱动的三维模型生成平台，文/图一键生 3D；此链接直达 Astra 模型的场景提示词库。",
    },
    {
        id: "itch-io",
        name: "itch.io",
        url: "https://itch.io",
        iconUrl: faviconFor("https://itch.io"),
        color: "#FA5C5C",
        letter: "i",
        category: "游戏平台",
        description: "全球最大的独立游戏发行平台：发布作品、参加 Game Jam、发现与支持独立游戏。",
    },
];

export const DEFAULT_TOOLS_DATA: ToolsData = { sections: DEFAULT_TOOL_SECTIONS, sites: DEFAULT_TOOL_SITES };

/** 按站点网址推导 favicon 地址（Google s2 服务，64px） */
export function faviconFor(url: string): string {
    try {
        const host = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch {
        return "";
    }
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

/**
 * 校验 + 规范化整份工具数据（分栏 + 条目）。
 * 接受 v2 对象与旧版裸数组（自动升级）；条目引用但分栏列表中缺失的分栏名会被补建，
 * 保证任何条目都有可归属的分栏；同名分栏去重（保留先出现的）。
 */
export function normalizeToolsData(raw: unknown): ToolsData {
    let rawSections: unknown = null;
    let rawSites: unknown = null;
    if (Array.isArray(raw)) {
        // 旧版存储：裸条目数组
        rawSites = raw;
    } else if (raw && typeof raw === "object") {
        const rec = raw as Record<string, unknown>;
        rawSections = rec.sections;
        rawSites = rec.sites;
    } else if (typeof raw === "string") {
        try {
            return normalizeToolsData(JSON.parse(raw));
        } catch {
            return { sections: [], sites: [] };
        }
    }

    const sites = normalizeToolSites(rawSites);

    const sections: ToolSection[] = [];
    const seenNames = new Set<string>();
    const pushSection = (id: string, name: string) => {
        if (!name || seenNames.has(name)) return;
        seenNames.add(name);
        sections.push({ id: id || `sec-${sections.length}`, name });
    };

    if (Array.isArray(rawSections)) {
        for (const item of rawSections) {
            if (!item || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            pushSection(String(rec.id || "").trim(), String(rec.name || "").trim());
        }
    }
    // 补建条目引用但缺失的分栏（含旧版数组升级路径），按首次出现顺序
    for (const site of sites) pushSection("", site.category);

    return { sections, sites };
}
