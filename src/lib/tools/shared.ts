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
    { id: "sec-collab", name: "协作工具" },
    { id: "sec-sketch", name: "快速画板" },
    { id: "sec-inspiration", name: "灵感积累" },
    { id: "sec-assets", name: "游戏素材" },
    { id: "sec-audio", name: "音频素材" },
    { id: "sec-tutorial", name: "教程学习" },
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
        url: "https://www.tripo3d.ai/zh/3d-prompts",
        iconUrl: faviconFor("https://www.tripo3d.ai/zh/3d-prompts"),
        color: "#25547A",
        letter: "T",
        category: "三维创作",
        description: "AI 驱动的三维模型生成平台，文/图一键生 3D；直达提示词库。",
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
    {
        id: "feishu-docs",
        name: "飞书文档",
        url: "https://docs.feishu.cn",
        iconUrl: faviconFor("https://docs.feishu.cn"),
        color: "#3370FF",
        letter: "飞",
        category: "协作工具",
        description: "多人实时协作文档，社团资料、策划案共建与评论批注首选。",
    },
    {
        id: "tencent-docs",
        name: "腾讯文档",
        url: "https://docs.qq.com",
        iconUrl: faviconFor("https://docs.qq.com"),
        color: "#4A8CFF",
        letter: "腾",
        category: "协作工具",
        description: "在线协作文档与表格，链接分享即用，收集表与权限管理方便。",
    },
    {
        id: "trello",
        name: "Trello",
        url: "https://trello.com",
        iconUrl: faviconFor("https://trello.com"),
        color: "#0079BF",
        letter: "T",
        category: "协作工具",
        description: "看板式任务管理：项目排期、分工与进度一目了然。",
    },
    {
        id: "magma",
        name: "Magma",
        url: "https://magma.com",
        iconUrl: faviconFor("https://magma.com"),
        color: "#FF6B4A",
        letter: "M",
        category: "快速画板",
        description: "多人实时共同绘画的在线画板，开个房间就能联机接龙开画。",
    },
    {
        id: "pixilart",
        name: "Pixilart",
        url: "https://www.pixilart.com",
        iconUrl: faviconFor("https://www.pixilart.com"),
        color: "#2196F3",
        letter: "P",
        category: "快速画板",
        description: "在线像素画绘制社区：内置动画帧、调色板与像素级工具。",
    },
    {
        id: "pinterest",
        name: "Pinterest",
        url: "https://www.pinterest.com",
        iconUrl: faviconFor("https://www.pinterest.com"),
        color: "#E60023",
        letter: "P",
        category: "灵感积累",
        description: "全球灵感图片库：素材收集、风格参考与情绪板搭建。",
    },
    {
        id: "lucide",
        name: "Lucide",
        url: "https://lucide.dev",
        iconUrl: faviconFor("https://lucide.dev"),
        color: "#F56565",
        letter: "L",
        category: "图标",
        description: "开源图标库：统一风格的 SVG 图标随取随用，支持调色与按需打包。",
    },
    {
        id: "iconfont",
        name: "iconfont",
        url: "https://www.iconfont.cn",
        iconUrl: faviconFor("https://www.iconfont.cn"),
        color: "#1B9DF3",
        letter: "i",
        category: "图标",
        description: "阿里巴巴矢量图标库：中文图标资源丰富，支持自建项目与图标管理。",
    },
    {
        id: "iconmonstr",
        name: "IconMonstr",
        url: "https://iconmonstr.com",
        iconUrl: faviconFor("https://iconmonstr.com"),
        color: "#3F51B5",
        letter: "M",
        category: "图标",
        description: "免费线性图标库：极简几何风格，无需署名即可商用。",
    },
    {
        id: "poly-pizza",
        name: "Poly Pizza",
        url: "https://poly.pizza/",
        iconUrl: faviconFor("https://poly.pizza/"),
        color: "#7C4DFF",
        letter: "P",
        category: "3D 模型",
        description: "免费低多边形 3D 模型库：CC0 授权为主，下载即用，搜索体验轻快。",
    },
    {
        id: "sketchfab",
        name: "Sketchfab",
        url: "https://sketchfab.com/",
        iconUrl: faviconFor("https://sketchfab.com/"),
        color: "#1CAAD9",
        letter: "S",
        category: "3D 模型",
        description: "海量 3D 模型市场与社区：网页内即时预览，含免费/付费与多种授权。",
    },
    {
        id: "free-paper-texture",
        name: "Free Paper Texture",
        url: "https://free-paper-texture.com/",
        iconUrl: faviconFor("https://free-paper-texture.com/"),
        color: "#A1887F",
        letter: "F",
        category: "贴图材质",
        description: "免费纸张纹理素材：手绘/拼贴/复古质感的底纹与材质贴图。",
    },
    {
        id: "kenney",
        name: "Kenney",
        url: "https://kenney.nl",
        iconUrl: faviconFor("https://kenney.nl"),
        color: "#7BC143",
        letter: "K",
        category: "综合素材包",
        description: "游戏素材界的公共图书馆：CC0 授权的 2D/3D 素材包与音效包，白嫖无忧。",
    },
    {
        id: "opengameart",
        name: "OpenGameArt",
        url: "https://opengameart.org",
        iconUrl: faviconFor("https://opengameart.org"),
        color: "#2E7D32",
        letter: "O",
        category: "综合素材包",
        description: "开源游戏素材仓库：模型、音效、音乐与贴图，逐条注明授权。",
    },
    {
        id: "ue-marketplace",
        name: "UE Marketplace",
        url: "https://www.unrealengine.com/marketplace/zh-CN/",
        iconUrl: faviconFor("https://www.unrealengine.com/marketplace/zh-CN/"),
        color: "#2A2A2A",
        letter: "U",
        category: "综合素材包",
        description: "虚幻引擎官方资产市场：大量免费资产每月更新，含模型与材质。",
    },
    {
        id: "quaternius",
        name: "Quaternius",
        url: "https://quaternius.com",
        iconUrl: faviconFor("https://quaternius.com"),
        color: "#5B8DEF",
        letter: "Q",
        category: "3D 模型",
        description: "免费风格化低模 3D 模型包：角色、道具与场景，定期更新。",
    },
    {
        id: "ambientcg",
        name: "AmbientCG",
        url: "https://ambientcg.com",
        iconUrl: faviconFor("https://ambientcg.com"),
        color: "#3E7CB1",
        letter: "A",
        category: "贴图材质",
        description: "CC0 PBR 材质贴图库：木质、金属、地面等质感素材最全。",
    },
    {
        id: "unity-asset-store",
        name: "Unity Asset Store",
        url: "https://assetstore.unity.com/zh?category=2d%2Ftextures-materials%2Fmetals&free=true&orderBy=1",
        iconUrl: faviconFor("https://assetstore.unity.com/zh?category=2d%2Ftextures-materials%2Fmetals&free=true&orderBy=1"),
        color: "#4A4A4A",
        letter: "U",
        category: "贴图材质",
        description: "Unity 官方资产商店：此链接直达免费金属材质贴图筛选结果。",
    },
    {
        id: "freesound",
        name: "Freesound",
        url: "https://freesound.org",
        iconUrl: faviconFor("https://freesound.org"),
        color: "#FF4E00",
        letter: "F",
        category: "音频素材",
        description: "全球最大的 CC 授权音效库：环境声、拟音与音效样本。",
    },
    {
        id: "pixabay-audio",
        name: "Pixabay 音乐音效",
        url: "https://pixabay.com/sound-effects/",
        iconUrl: faviconFor("https://pixabay.com/sound-effects/"),
        color: "#2CA05A",
        letter: "P",
        category: "音频素材",
        description: "免授权音乐与音效：商用免费，中文界面检索友好。",
    },
    {
        id: "incompetech",
        name: "Incompetech",
        url: "https://incompetech.com",
        iconUrl: faviconFor("https://incompetech.com"),
        color: "#555555",
        letter: "I",
        category: "音频素材",
        description: "Kevin MacLeod 的免费 BGM 库：大量经典游戏配乐可按署名使用。",
    },
    {
        id: "taira-komori",
        name: "小森平的免费音效",
        url: "https://taira-komori.jpn.org/anime01cn.html",
        iconUrl: faviconFor("https://taira-komori.jpn.org/anime01cn.html"),
        color: "#6D4C41",
        letter: "小",
        category: "音频素材",
        description: "免费动效音效合集：开门、脚步、战斗等日常拟音一站收集。",
    },
    {
        id: "adobe-sfx",
        name: "Adobe 免费音效包",
        url: "https://www.adobe.com/products/audition/offers/adobeauditiondlcsfx.html",
        iconUrl: faviconFor("https://www.adobe.com/products/audition/offers/adobeauditiondlcsfx.html"),
        color: "#FF0000",
        letter: "A",
        category: "音频素材",
        description: "Adobe Audition 官方免费音效 DLC：上万条专业录制音效可下载。",
    },
    {
        id: "artstation",
        name: "ArtStation",
        url: "https://www.artstation.com",
        iconUrl: faviconFor("https://www.artstation.com"),
        color: "#13AFF0",
        letter: "A",
        category: "灵感积累",
        description: "全球游戏美术作品集社区：角色、场景与概念设计参考。",
    },
    {
        id: "behance",
        name: "Behance",
        url: "https://www.behance.net",
        iconUrl: faviconFor("https://www.behance.net"),
        color: "#1769FF",
        letter: "B",
        category: "灵感积累",
        description: "Adobe 设计作品库：UI/平面与视觉方向灵感。",
    },
    {
        id: "excalidraw",
        name: "Excalidraw",
        url: "https://excalidraw.com",
        iconUrl: faviconFor("https://excalidraw.com"),
        color: "#6965DB",
        letter: "E",
        category: "快速画板",
        description: "手绘风协作白板：快速画关卡草图与流程示意，免费开源。",
    },
    {
        id: "tldraw",
        name: "tldraw",
        url: "https://www.tldraw.com",
        iconUrl: faviconFor("https://www.tldraw.com"),
        color: "#1E9EB8",
        letter: "T",
        category: "快速画板",
        description: "极简协作白板：开源画图工具，原型与示意快速上手。",
    },
    {
        id: "notion",
        name: "Notion",
        url: "https://www.notion.so",
        iconUrl: faviconFor("https://www.notion.so"),
        color: "#111111",
        letter: "N",
        category: "协作工具",
        description: "文档+数据库+看板一体：社团策划中枢与知识库。",
    },
    {
        id: "runoob-csharp",
        name: "菜鸟教程 C#",
        url: "https://www.runoob.com/csharp/csharp-tutorial.html",
        iconUrl: faviconFor("https://www.runoob.com/csharp/csharp-tutorial.html"),
        color: "#43A047",
        letter: "菜",
        category: "教程学习",
        description: "C# 从入门到进阶的系统教程：Unity 脚本语言的快速上手手册。",
    },
    {
        id: "redblobgames",
        name: "Red Blob Games",
        url: "https://www.redblobgames.com/",
        iconUrl: faviconFor("https://www.redblobgames.com/"),
        color: "#C0392B",
        letter: "R",
        category: "教程学习",
        description: "交互式游戏数学图解：寻路、六角网格、噪声等经典算法可视化讲解。",
    },
    {
        id: "flaticon",
        name: "Flaticon",
        url: "https://www.flaticon.com/",
        iconUrl: faviconFor("https://www.flaticon.com/"),
        color: "#0C63E4",
        letter: "F",
        category: "图标",
        description: "全球最大图标站之一：数百万 SVG/PNG 图标，注意授权与署名要求。",
    },
    {
        id: "emojiall",
        name: "EmojiAll 表情大全",
        url: "https://www.emojiall.com/zh-hans",
        iconUrl: faviconFor("https://www.emojiall.com/zh-hans"),
        color: "#F5A623",
        letter: "E",
        category: "图标",
        description: "全平台 Emoji 大全：按分类检索，含含义解释与一键复制。",
    },
    {
        id: "100font",
        name: "100font 免费字体",
        url: "https://www.100font.com/",
        iconUrl: faviconFor("https://www.100font.com/"),
        color: "#222222",
        letter: "字",
        category: "综合素材包",
        description: "免费商用字体集合：整理可商用的中文字体下载与授权说明。",
    },
    {
        id: "koukaongen",
        name: "効果音源",
        url: "https://koukaongen.com/",
        iconUrl: faviconFor("https://koukaongen.com/"),
        color: "#7E57C2",
        letter: "効",
        category: "音频素材",
        description: "日本免费音效素材站：游戏 UI 音、环境声与拟音素材可下载。",
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
