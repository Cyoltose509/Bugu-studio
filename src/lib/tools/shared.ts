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
    { id: "sec-engine-store", name: "引擎资产商店" },
    { id: "sec-3d-model", name: "3D 模型" },
    { id: "sec-texture", name: "贴图材质" },
    { id: "sec-icons", name: "图标与字体" },
    { id: "sec-pack", name: "综合素材包" },
    { id: "sec-audio", name: "音频素材" },
    { id: "sec-3d", name: "三维创作" },
    { id: "sec-game-platform", name: "游戏平台" },
    { id: "sec-sketch", name: "快速画板" },
    { id: "sec-inspiration", name: "灵感积累" },
    { id: "sec-collab", name: "协作工具" },
    { id: "sec-tutorial", name: "教程学习" },
];

export const DEFAULT_TOOL_SITES: ToolSite[] = [
    {
        id: "godot",
        name: "Godot Engine",
        url: "https://godotengine.org",
        iconUrl: "https://cdn.bugoostudio.com/toolss/e3eb0a2c8d4d4ca046312b42279daa71.png",
        color: "#478CBF",
        letter: "G",
        category: "游戏引擎",
        description: "开源免费的游戏引擎，2D/3D 一体化，轻量易上手，适合独立开发。",
    },
    {
        id: "unity",
        name: "Unity",
        url: "https://unity.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/d073a3b843d8b2cd6e8a6b8ea3d1814d.png",
        color: "#4A4A4A",
        letter: "U",
        category: "游戏引擎",
        description: "全球装机量最大的游戏引擎之一，跨平台发布生态成熟，资源商店内容丰富。",
    },
    {
        id: "unreal-engine",
        name: "Unreal Engine",
        url: "https://www.unrealengine.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/451737b01d973b92687d60544e75acdb.png",
        color: "#2A2A2A",
        letter: "U",
        category: "游戏引擎",
        description: "Epic 出品的次世代引擎，Blueprint 可视化编程与高画质渲染见长。",
    },
    {
        id: "cocos",
        name: "Cocos",
        url: "https://www.cocos.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/526cabfe219181f2d9eee8656ae9dc79.png",
        color: "#22589E",
        letter: "C",
        category: "游戏引擎",
        description: "国产开源引擎家族，2D/3D 兼备，对小游戏与出海轻量产品尤其友好。",
    },
    {
        id: "blender",
        name: "Blender",
        url: "https://www.blender.org",
        iconUrl: "https://cdn.bugoostudio.com/toolss/db58d8cc223853a5ed2b32067c59e5a9.png",
        color: "#EA7600",
        letter: "B",
        category: "三维创作",
        description: "开源三维创作套件：建模、雕刻、绑定动画、渲染与视频剪辑一站式完成。",
    },
    {
        id: "tripo-home",
        name: "Tripo AI",
        url: "https://www.tripo3d.ai",
        iconUrl: "https://cdn.bugoostudio.com/toolss/1153eb9a848a3687a0723cfccf31d040.png",
        color: "#6C5CE7",
        letter: "T",
        category: "三维创作",
        description: "AI 三维生成平台官网：文本/图片一键生成 3D 模型、纹理与动画。",
    },
    {
        id: "tripo-3d",
        name: "3D模型生成prompt",
        url: "https://www.tripo3d.ai/zh/3d-prompts",
        iconUrl: "https://cdn.bugoostudio.com/toolss/9023a92d8bb10b43eeaea6b19076a384.png",
        color: "#25547A",
        letter: "T",
        category: "三维创作",
        description: "AI 驱动的三维模型生成平台，文/图一键生 3D；此链接直达 Astra 模型的场景提示词库。",
    },
    {
        id: "itch-io",
        name: "itch.io",
        url: "https://itch.io",
        iconUrl: "https://cdn.bugoostudio.com/toolss/8d1e0d1159cb07693ac33c3aa8fbbb5a.png",
        color: "#FA5C5C",
        letter: "I",
        category: "游戏平台",
        description: "全球最大的独立游戏发行平台：发布作品、参加 Game Jam、发现与支持独立游戏。",
    },
    {
        id: "feishu-docs",
        name: "飞书文档",
        url: "https://docs.feishu.cn",
        iconUrl: "https://cdn.bugoostudio.com/toolss/18001d5746eae20f8c24d38536cf873f.png",
        color: "#3370FF",
        letter: "飞",
        category: "协作工具",
        description: "多人实时协作文档，社团资料、策划案共建与评论批注首选。",
    },
    {
        id: "tencent-docs",
        name: "腾讯文档",
        url: "https://docs.qq.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/ee66d4bc49cf3f087fb0337247479d05.png",
        color: "#4A8CFF",
        letter: "腾",
        category: "协作工具",
        description: "在线协作文档与表格，链接分享即用，收集表与权限管理方便。",
    },
    {
        id: "trello",
        name: "Trello",
        url: "https://trello.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/69681fceef9eda6e63f4c34ab29b50b9.png",
        color: "#0079BF",
        letter: "T",
        category: "协作工具",
        description: "看板式任务管理：项目排期、分工与进度一目了然。",
    },
    {
        id: "magma",
        name: "Magma",
        url: "https://magma.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/14b066fa74884276f947a34c0341e962.png",
        color: "#FF6B4A",
        letter: "M",
        category: "快速画板",
        description: "多人实时共同绘画的在线画板，开个房间就能联机接龙开画。",
    },
    {
        id: "pixilart",
        name: "Pixilart",
        url: "https://www.pixilart.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/56b0e7cc79c02e7323a0ef3b997b239c.png",
        color: "#2196F3",
        letter: "P",
        category: "快速画板",
        description: "在线像素画绘制社区：内置动画帧、调色板与像素级工具。",
    },
    {
        id: "pinterest",
        name: "Pinterest",
        url: "https://www.pinterest.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/f0672c7d1b74758227fa7c81c7f66eca.png",
        color: "#E60023",
        letter: "P",
        category: "灵感积累",
        description: "全球灵感图片库：素材收集、风格参考与情绪板搭建。",
    },
    {
        id: "lucide",
        name: "Lucide",
        url: "https://lucide.dev",
        iconUrl: "https://cdn.bugoostudio.com/toolss/a5a380d772dfdeaf70919eeb7b74ff38.png",
        color: "#F56565",
        letter: "L",
        category: "图标与字体",
        description: "开源图标库：统一风格的 SVG 图标随取随用，支持调色与按需打包。",
    },
    {
        id: "iconfont",
        name: "iconfont",
        url: "https://www.iconfont.cn",
        iconUrl: "https://cdn.bugoostudio.com/toolss/932de66c244f374bca5ed1819efec922.png",
        color: "#1B9DF3",
        letter: "I",
        category: "图标与字体",
        description: "阿里巴巴矢量图标库：中文图标资源丰富，支持自建项目与图标管理。",
    },
    {
        id: "iconmonstr",
        name: "IconMonstr",
        url: "https://iconmonstr.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c17488c5fb56d07fea87eda33488aeac.png",
        color: "#3F51B5",
        letter: "M",
        category: "图标与字体",
        description: "免费线性图标库：极简几何风格，无需署名即可商用。",
    },
    {
        id: "poly-pizza",
        name: "Poly Pizza",
        url: "https://poly.pizza/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/7c7f14aef2441e020115b83506039ec1.png",
        color: "#7C4DFF",
        letter: "P",
        category: "3D 模型",
        description: "免费低多边形 3D 模型库：CC0 授权为主，下载即用，搜索体验轻快。",
    },
    {
        id: "sketchfab",
        name: "Sketchfab",
        url: "https://sketchfab.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/b238ff14da5d73043f911a0d123d7862.png",
        color: "#1CAAD9",
        letter: "S",
        category: "3D 模型",
        description: "海量 3D 模型市场与社区：网页内即时预览，含免费/付费与多种授权。",
    },
    {
        id: "free-paper-texture",
        name: "Free Paper Texture",
        url: "https://free-paper-texture.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/cf33c14acf149600ae04b0b8e686ed5f.png",
        color: "#A1887F",
        letter: "F",
        category: "贴图材质",
        description: "免费纸张纹理素材：手绘/拼贴/复古质感的底纹与材质贴图。",
    },
    {
        id: "kenney",
        name: "Kenney",
        url: "https://kenney.nl",
        iconUrl: "https://cdn.bugoostudio.com/toolss/87a806d0603cbe90d9a12d4fe9dee601.png",
        color: "#7BC143",
        letter: "K",
        category: "综合素材包",
        description: "游戏素材界的公共图书馆：CC0 授权的 2D/3D 素材包与音效包，白嫖无忧。",
    },
    {
        id: "opengameart",
        name: "OpenGameArt",
        url: "https://opengameart.org",
        iconUrl: "https://cdn.bugoostudio.com/toolss/fd14a2ae1f69932c668b7dd3ac1a2d36.png",
        color: "#2E7D32",
        letter: "O",
        category: "综合素材包",
        description: "开源游戏素材仓库：模型、音效、音乐与贴图，逐条注明授权。",
    },
    {
        id: "quaternius",
        name: "Quaternius",
        url: "https://quaternius.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/82dd4bbadf47aaefdcf09184b0d4947c.png",
        color: "#5B8DEF",
        letter: "Q",
        category: "3D 模型",
        description: "免费风格化低模 3D 模型包：角色、道具与场景，定期更新。",
    },
    {
        id: "ambientcg",
        name: "AmbientCG",
        url: "https://ambientcg.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/2eba3a6bd623645be003ffaddabdb668.png",
        color: "#3E7CB1",
        letter: "A",
        category: "贴图材质",
        description: "CC0 PBR 材质贴图库：木质、金属、地面等质感素材最全。",
    },
    {
        id: "freesound",
        name: "Freesound",
        url: "https://freesound.org",
        iconUrl: "https://cdn.bugoostudio.com/toolss/b4befc90bd291a82324bf7caa9889e71.png",
        color: "#FF4E00",
        letter: "F",
        category: "音频素材",
        description: "全球最大的 CC 授权音效库：环境声、拟音与音效样本。",
    },
    {
        id: "pixabay-audio",
        name: "Pixabay 音乐音效",
        url: "https://pixabay.com/sound-effects/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/73bd71a16488ed5d96564e812d4d8a0a.png",
        color: "#2CA05A",
        letter: "P",
        category: "音频素材",
        description: "免授权音乐与音效：商用免费，中文界面检索友好。",
    },
    {
        id: "incompetech",
        name: "Incompetech",
        url: "https://incompetech.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/0502aed44bd9b42323cbb63baa41f9fa.png",
        color: "#555555",
        letter: "I",
        category: "音频素材",
        description: "Kevin MacLeod 的免费 BGM 库：大量经典游戏配乐可按署名使用。",
    },
    {
        id: "artstation",
        name: "ArtStation",
        url: "https://www.artstation.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/eed7a969e72f1b58fa68bee1a2c1f403.png",
        color: "#13AFF0",
        letter: "A",
        category: "灵感积累",
        description: "全球游戏美术作品集社区：角色、场景与概念设计参考。",
    },
    {
        id: "behance",
        name: "Behance",
        url: "https://www.behance.net",
        iconUrl: "https://cdn.bugoostudio.com/toolss/3b92646b9fd920ecde8c0e01ecb4f1ff.png",
        color: "#1769FF",
        letter: "B",
        category: "灵感积累",
        description: "Adobe 设计作品库：UI/平面与视觉方向灵感。",
    },
    {
        id: "excalidraw",
        name: "Excalidraw",
        url: "https://excalidraw.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c7e65d357fbfaf93a670e28092855aaf.png",
        color: "#6965DB",
        letter: "E",
        category: "快速画板",
        description: "手绘风协作白板：快速画关卡草图与流程示意，免费开源。",
    },
    {
        id: "tldraw",
        name: "tldraw",
        url: "https://www.tldraw.com",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c8e00a25b348dc666eeca034168afd5e.png",
        color: "#1E9EB8",
        letter: "T",
        category: "快速画板",
        description: "极简协作白板：开源画图工具，原型与示意快速上手。",
    },
    {
        id: "notion",
        name: "Notion",
        url: "https://www.notion.so",
        iconUrl: "https://cdn.bugoostudio.com/toolss/d58245ce7adf29020f2c7b881664e317.png",
        color: "#111111",
        letter: "N",
        category: "协作工具",
        description: "文档+数据库+看板一体",
    },
    {
        id: "runoob-csharp",
        name: "菜鸟教程 C#",
        url: "https://www.runoob.com/csharp/csharp-tutorial.html",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c4648f0500779bc58dcc9d6635351d18.png",
        color: "#43A047",
        letter: "菜",
        category: "教程学习",
        description: "C# 从入门到进阶的系统教程：Unity 脚本语言的快速上手手册。",
    },
    {
        id: "redblobgames",
        name: "Red Blob Games",
        url: "https://www.redblobgames.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/47ec614d7383cf10e745f432a49fd582.png",
        color: "#C0392B",
        letter: "R",
        category: "教程学习",
        description: "交互式游戏数学图解：寻路、六角网格、噪声等经典算法可视化讲解。",
    },
    {
        id: "flaticon",
        name: "Flaticon",
        url: "https://www.flaticon.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/21aa42c20d2dfa3f51b183ae09b3657e.png",
        color: "#0C63E4",
        letter: "F",
        category: "图标与字体",
        description: "全球最大图标站之一：数百万 SVG/PNG 图标，注意授权与署名要求。",
    },
    {
        id: "emojiall",
        name: "EmojiAll 表情大全",
        url: "https://www.emojiall.com/zh-hans",
        iconUrl: "https://cdn.bugoostudio.com/toolss/1e58332b2a9b178cfc509d5d55bf90fb.png",
        color: "#F5A623",
        letter: "E",
        category: "图标与字体",
        description: "全平台 Emoji 大全：按分类检索，含含义解释与一键复制。",
    },
    {
        id: "100font",
        name: "100font 免费字体",
        url: "https://www.100font.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/36f534c0ad9dbb5defb2d8d392827f02.png",
        color: "#222222",
        letter: "字",
        category: "图标与字体",
        description: "免费商用字体集合：整理可商用的中文字体下载与授权说明。",
    },
    {
        id: "koukaongen",
        name: "効果音源",
        url: "https://koukaongen.com/",
        iconUrl: "",
        color: "#7E57C2",
        letter: "効",
        category: "音频素材",
        description: "日本免费音效素材站：游戏 UI 音、环境声与拟音素材可下载。",
    },
    {
        id: "unity-asset-store",
        name: "Unity Asset Store",
        url: "https://assetstore.unity.com/zh?category=2d%2Ftextures-materials%2Fmetals&free=true&orderBy=1",
        iconUrl: "https://cdn.bugoostudio.com/toolss/36293ae84d070a0cf2f0b9bf185ec4fb.png",
        color: "#4A4A4A",
        letter: "U",
        category: "引擎资产商店",
        description: "Unity 官方资产商店：此链接直达免费金属材质贴图筛选结果。",
    },
    {
        id: "ue-marketplace",
        name: "UE Marketplace",
        url: "https://www.unrealengine.com/marketplace/zh-CN/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c66f5989efe7715c7cb58f4fdb23efe0.png",
        color: "#2A2A2A",
        letter: "U",
        category: "引擎资产商店",
        description: "虚幻引擎官方资产市场：大量免费资产每月更新，含模型与材质。",
    },
    {
        id: "taira-komori",
        name: "小森平的免费音效",
        url: "https://taira-komori.jpn.org/anime01cn.html",
        iconUrl: "https://cdn.bugoostudio.com/toolss/d0191341b26489c07b364086ed7ef059.png",
        color: "#6D4C41",
        letter: "小",
        category: "音频素材",
        description: "免费动效音效合集：开门、脚步、战斗等日常拟音一站收集。",
    },
    {
        id: "adobe-sfx",
        name: "Adobe 免费音效包",
        url: "https://www.adobe.com/products/audition/offers/adobeauditiondlcsfx.html",
        iconUrl: "https://cdn.bugoostudio.com/toolss/3f8324a27827b69560d5929df4ccda4a.png",
        color: "#FF0000",
        letter: "A",
        category: "音频素材",
        description: "Adobe Audition 官方免费音效 DLC：上万条专业录制音效可下载。",
    },
    {
        id: "sounds-resource",
        name: "The Sounds Resource",
        url: "https://sounds.spriters-resource.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/8996176580c067bedd4fe4b318ac0148.png",
        color: "#2F6DB5",
        letter: "S",
        category: "音频素材",
        description: "游戏原声与音效资源站：按主机与作品索引，收录从游戏里直接提取的 BGM、音效与配音。",
    },
    {
        id: "vsthouse",
        name: "VST House",
        url: "https://vsthouse.ru/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/d6393c70b177e78b94d612eaef585f21.png",
        color: "#8E44AD",
        letter: "V",
        category: "音频素材",
        description: "俄语 VST 插件与虚拟乐器索引站：按类型检索免费/商业音源与音色库，附试听与下载入口。",
    },
    {
        id: "spriters-resource",
        name: "The Spriters Resource",
        url: "https://www.spriters-resource.com/browse/",
        iconUrl: "https://cdn.bugoostudio.com/tools/3872c0269b453b25f07764845bd82fd5.png",
        color: "#C1443C",
        letter: "S",
        category: "综合素材包",
        description: "精灵图资源库：按平台与作品浏览 2D 角色、场景、UI 拆图，做像素素材参考或直接取用。",
    },
    {
        id: "bmfont-web",
        name: "BMFont Web",
        url: "https://bmfont-web.hahahoho.studio/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/3e8d68e009c38b59ab04dbbbff822cd6.png",
        color: "#5B6AE0",
        letter: "B",
        category: "图标与字体",
        description: "在线生成 BMFont 兼容的位图字体：调字号与描边后直接导出，可用于 Unity3D、Cocos Creator、PhaserJS 等。",
    },
    {
        id: "easyicon",
        name: "EasyIcon",
        url: "https://www.easyicon.cc/",
        iconUrl: "https://cdn.bugoostudio.com/tools/a9568b091051841a12e07bd63942f425.png",
        color: "#2E9E5B",
        letter: "E",
        category: "图标与字体",
        description: "中文图标下载站：PNG/ICO/SVG 多尺寸打包，支持关键词与配色筛选，适合临时补图标。",
    },
    {
        id: "designdoll",
        name: "DesignDoll",
        url: "https://terawell.net/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/42511e72bddbf81597b67c0b2e6d3de2.png",
        color: "#4A6FA5",
        letter: "D",
        category: "三维创作",
        description: "3D 人体模型摆姿软件：直观调整姿势与构图，适合角色原画与建模参考。",
    },
    {
        id: "connect-clo",
        name: "CONNECT (CLO-SET)",
        url: "https://connect.clo-set.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/7db11324c1fb89fff275a3cc96505667.png",
        color: "#2E7D6B",
        letter: "C",
        category: "3D 模型",
        description: "免费与付费 3D 服装模型，可用于 CLO、Marvelous Designer 与 Blender。",
    },
    {
        id: "kleki",
        name: "KleKi",
        url: "https://kleki.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/8bd9652e033e7495ae64f563702b0b4f.png",
        color: "#E8794A",
        letter: "K",
        category: "快速画板",
        description: "免费开源在线绘图工具，打开网页即可画，无需注册。",
    },
    {
        id: "zhongguose",
        name: "中国色",
        url: "https://zhongguose.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c2dd93fd5bc11b39c6f6706c9784a50b.png",
        color: "#B03A2E",
        letter: "色",
        category: "灵感积累",
        description: "中国传统颜色色卡，国风项目的配色参考。",
    },
    {
        id: "colorhunt",
        name: "Color Hunt",
        url: "https://colorhunt.co/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/90b504fdafa00fb89794a651d1125c3b.png",
        color: "#2C3E50",
        letter: "C",
        category: "灵感积累",
        description: "现成配色卡集合，按主题与热度浏览，快速定下画面色调。",
    },
    {
        id: "udongman-assets",
        name: "优动漫素材",
        url: "https://www.udongman.cn/resource/material/all",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c267d4c0e6b56e6276db3338900c0b7b.png",
        color: "#E67E22",
        letter: "优",
        category: "综合素材包",
        description: "正版可商用原创素材库：笔刷、3D 模型、背景、姿势等绘画资源。",
    },
    {
        id: "transparent-textures",
        name: "Transparent Textures",
        url: "https://www.transparenttextures.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/4beaa359c769742bd71ba037d2f09004.png",
        color: "#7F8C8D",
        letter: "T",
        category: "贴图材质",
        description: "可选颜色的免费透明纹理，适合 UI 底纹与 2D 画面叠加。",
    },
    {
        id: "adobe-color",
        name: "Adobe Color",
        url: "https://color.adobe.com/zh/create/color-wheel/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/1a82bff8d1b2e0fc902d53c517b9eb59.png",
        color: "#E1251B",
        letter: "A",
        category: "灵感积累",
        description: "Adobe 官方色轮：按互补、类比等配色规则生成并保存方案。",
    },
    {
        id: "maoken",
        name: "猫啃网",
        url: "https://www.maoken.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/8583715ab97d4f12e618fb96d7f970a2.png",
        color: "#F39C12",
        letter: "猫",
        category: "图标与字体",
        description: "免费商用中文字体下载，按 CC0、CC-BY 等授权类型筛选。",
    },
    {
        id: "fontesk",
        name: "fontesk",
        url: "https://fontesk.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/6624b988497f5443db8f5ced1ad61af1.png",
        color: "#34495E",
        letter: "f",
        category: "图标与字体",
        description: "精选免费字体库，带 free for commercial use 授权筛选。",
    },
    {
        id: "minchirue",
        name: "みんちりえ",
        url: "https://min-chi.material.jp/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/c3f509735744125024aacc33f01d3ed8.png",
        color: "#7FB3D5",
        letter: "み",
        category: "综合素材包",
        description: "免费背景插画（房间、店铺、街道），明确可商用且支持视觉小说游戏。",
    },
    {
        id: "texturelabs",
        name: "Texturelabs",
        url: "https://texturelabs.org/",
        iconUrl: "",
        color: "#8E6E4E",
        letter: "T",
        category: "贴图材质",
        description: "免费原创纹理与教程，条款明确允许用于游戏场景、菜单和关卡。",
    },
    {
        id: "clip-studio-assets",
        name: "CLIP STUDIO ASSETS",
        url: "https://assets.clip-studio.com/zh-tw/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/701c751c75e884626e5af96f49dc3619.png",
        color: "#1F7AEC",
        letter: "C",
        category: "综合素材包",
        description: "笔刷、3D 模型、背景、姿势素材，官方 FAQ 明确可商用且包含游戏。",
    },
    {
        id: "purepng",
        name: "PurePNG",
        url: "https://purepng.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/581008006d7a8104435f8b461479bc83.png",
        color: "#16A085",
        letter: "P",
        category: "综合素材包",
        description: "3 万余张透明背景 PNG，CC0 授权，可商用且无需署名。",
    },
    {
        id: "old-book-illustrations",
        name: "Old Book Illustrations",
        url: "https://www.oldbookillustrations.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/3e641a98b6d71f76041f5d45f68ed021.png",
        color: "#8B6B4A",
        letter: "O",
        category: "综合素材包",
        description: "公有领域的古籍插图扫描，适合复古风格的游戏美术参考。",
    },
    {
        id: "pixel-converter",
        name: "Sora's Pixel Converter",
        url: "https://pixel-converter.ameniwa.com/",
        iconUrl: "https://cdn.bugoostudio.com/toolss/646cd078c6a1465243c7ee02212e8c76.png",
        color: "#9B59B6",
        letter: "P",
        category: "快速画板",
        description: "上传图片一键转像素风，像素美术快速起稿。",
    },
];

export const DEFAULT_TOOLS_DATA: ToolsData = { sections: DEFAULT_TOOL_SECTIONS, sites: DEFAULT_TOOL_SITES };

/** 按站点网址推导 favicon 地址（Google s2 服务，64px） */
/** 校验 + 规范化：url 必须 http(s)，name 必填；iconUrl 为空时保留空，由前端回退字标 */
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
        const iconUrl = String(rec.iconUrl || "").trim();
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

/** 拖放落点：插入到某个分栏内、某条目之前；beforeId 为 null 表示追加到该分栏末尾 */
export interface ToolSiteDropTarget {
    sectionName: string;
    beforeId: string | null;
}

/**
 * 把条目移动到目标位置（允许跨分栏）。
 *
 * 存储是「分栏数组 + 扁平条目数组」，栏内顺序由条目数组的相对顺序决定，
 * 所以跨栏移动必须同时改 category 和数组位置。这里先按分栏重新分组、
 * 摘出被拖条目、按落点插回，再按分栏顺序铺平——保证数组顺序与分栏顺序
 * 不会互相打架（否则下次读库渲染会出现「看着跳了一格」的错位）。
 */
export function moveToolSite(data: ToolsData, dragId: string, target: ToolSiteDropTarget): ToolsData {
    const dragged = data.sites.find((s) => s.id === dragId);
    if (!dragged) return data;
    const sectionNames = data.sections.map((s) => s.name);
    if (!sectionNames.includes(target.sectionName)) return data;
    if (target.beforeId === dragId) return data;

    const groups = new Map<string, ToolSite[]>();
    for (const name of sectionNames) groups.set(name, []);
    // 分栏列表里没有的归属（理论上 normalize 后不会出现）单独兜底，避免条目丢失
    const orphans: ToolSite[] = [];
    for (const site of data.sites) {
        const bucket = groups.get(site.category);
        if (bucket) bucket.push(site);
        else orphans.push(site);
    }
    for (const bucket of groups.values()) {
        const i = bucket.findIndex((s) => s.id === dragId);
        if (i >= 0) bucket.splice(i, 1);
    }

    const moved: ToolSite = { ...dragged, category: target.sectionName };
    const dest = groups.get(target.sectionName)!;
    const insertAt = target.beforeId ? dest.findIndex((s) => s.id === target.beforeId) : -1;
    if (insertAt >= 0) dest.splice(insertAt, 0, moved);
    else dest.push(moved);

    const sites: ToolSite[] = [];
    for (const name of sectionNames) sites.push(...groups.get(name)!);
    sites.push(...orphans);
    return { sections: data.sections, sites };
}

/** 分栏重排：把 dragId 分栏移到 beforeId 之前；beforeId 为 null 表示移到末尾 */
export function moveToolSection(data: ToolsData, dragId: string, beforeId: string | null): ToolsData {
    const dragged = data.sections.find((s) => s.id === dragId);
    if (!dragged || beforeId === dragId) return data;
    const rest = data.sections.filter((s) => s.id !== dragId);
    const insertAt = beforeId ? rest.findIndex((s) => s.id === beforeId) : -1;
    if (insertAt >= 0) rest.splice(insertAt, 0, dragged);
    else rest.push(dragged);
    return { ...data, sections: rest };
}
