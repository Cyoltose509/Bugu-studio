/**
 * 引擎标签展示：图标、品牌色、排序前置
 * slug 兼容 unreal / ue、game-maker / gamemaker
 */

export const ENGINE_SLUGS = [
  "godot",
  "unity",
  "gamemaker",
  "unreal",
  "ue",
] as const;

export type EngineSlug = (typeof ENGINE_SLUGS)[number];

/** 引擎品牌色（亮色模式；Unity 暗色见 globals.css） */
export const ENGINE_TAG_COLORS: Record<EngineSlug, string> = {
  godot: "#478CBF",
  unity: "#222222",
  gamemaker: "#69C93C",
  unreal: "#0E4C92",
  ue: "#0E4C92",
};

export const ENGINE_TAG_NAMES: Partial<Record<EngineSlug, string>> = {
  godot: "Godot",
  unity: "Unity",
  gamemaker: "GameMaker",
  unreal: "Unreal Engine",
  ue: "Unreal Engine",
};

/** 正式站等可能用的别名 → 规范 slug */
const ENGINE_ALIASES: Record<string, EngineSlug> = {
  "game-maker": "gamemaker",
  gamemaker: "gamemaker",
  godot: "godot",
  unity: "unity",
  unreal: "unreal",
  ue: "ue",
};

export function isEngineTagSlug(slug: string): boolean {
  return normalizeEngineSlug(slug) !== null;
}

export function normalizeEngineSlug(slug: string): EngineSlug | null {
  return ENGINE_ALIASES[slug.toLowerCase()] ?? null;
}

export function getEngineColor(slug: string): string | null {
  const key = normalizeEngineSlug(slug);
  return key ? ENGINE_TAG_COLORS[key] : null;
}

/** 用于暗色自适应（尤其 Unity） */
export function getEngineChipClass(slug: string): string {
  const key = normalizeEngineSlug(slug);
  if (!key) return "";
  const tone = key === "ue" ? "unreal" : key;
  return `engine-chip engine-chip-${tone}`;
}

/** 引擎永远排在最前，引擎内部按固定顺序，其余保持相对顺序 */
export function sortTagsEngineFirst<T extends { slug: string; sortOrder?: number }>(
  tags: T[],
): T[] {
  const engineOrder = ["godot", "unity", "gamemaker", "unreal", "ue"];
  const rank = (slug: string) => {
    const key = normalizeEngineSlug(slug);
    if (!key) return 1000;
    const i = engineOrder.indexOf(key === "ue" ? "ue" : key);
    return i === -1 ? 1000 : i;
  };
  return [...tags].sort((a, b) => {
    const ea = isEngineTagSlug(a.slug);
    const eb = isEngineTagSlug(b.slug);
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
    if (ea && eb) return rank(a.slug) - rank(b.slug);
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return 0;
  });
}

/** 对 project.tags 结构排序 */
export function sortProjectTagsEngineFirst<
  T extends { tag: { slug: string; sortOrder?: number } },
>(projectTags: T[]): T[] {
  return [...projectTags].sort((a, b) => {
    const ea = isEngineTagSlug(a.tag.slug);
    const eb = isEngineTagSlug(b.tag.slug);
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
    if (ea && eb) {
      const order = ["godot", "unity", "gamemaker", "unreal", "ue"];
      const ra = normalizeEngineSlug(a.tag.slug)!;
      const rb = normalizeEngineSlug(b.tag.slug)!;
      return order.indexOf(ra) - order.indexOf(rb);
    }
    return (a.tag.sortOrder ?? 0) - (b.tag.sortOrder ?? 0);
  });
}
