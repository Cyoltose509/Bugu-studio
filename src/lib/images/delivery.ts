import legacyKeys from "./legacy-variants.json";

/** Fixed files generated once at upload time; never a remote resize request. */
export const IMAGE_WIDTHS = [320, 640, 1280, 1920] as const;
const legacy = legacyKeys as Record<string, number>;

/** Recognize derived files so cleanup can check whether their original still exists. */
export function isImageVariantKey(key: string): boolean {
  return /^(covers|screenshots)\/v1\/[a-f0-9]{32}\/w-(320|640|1280|1920)\.webp$/.test(key)
    || /^(covers|screenshots)\/[^/]+\.(?:jpe?g|png|webp)\.w-(320|640|1280|1920)\.webp$/i.test(key);
}

export function imageVariantPaths(key: string): string[] {
  const modern = /^(covers|screenshots)\/v1\/[a-f0-9]{32}\/original(?:-w\d+)?\.(?:jpe?g|png|webp)$/.test(key);
  if (!modern && !Object.hasOwn(legacy, key)) return [];
  return IMAGE_WIDTHS.map((width) => modern
    ? key.replace(/original(?:-w\d+)?\.[^.]+$/, `w-${width}.webp`)
    : `${key}.w-${width}.webp`);
}

export function imageVariantOriginalKey(key: string, objectKeys: Iterable<string>): string | undefined {
  if (!isImageVariantKey(key)) return undefined;
  if (!key.includes("/v1/")) return key.replace(/\.w-(320|640|1280|1920)\.webp$/i, "");
  const prefix = key.slice(0, key.lastIndexOf("/") + 1);
  for (const candidate of objectKeys) {
    if (candidate.startsWith(prefix) && imageVariantPaths(candidate).includes(key)) return candidate;
  }
  return undefined;
}

function variantsForUrl(src: string): string[] {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.host !== "cdn.bugoostudio.com" || url.search || url.hash) return [];
    return imageVariantPaths(url.pathname.slice(1)).map((path) => `${url.origin}/${path}`);
  } catch {
    return [];
  }
}

export function hasImageVariants(src: string): boolean {
  return variantsForUrl(src).length > 0;
}

export function imageUrl(src: string, width: number): string {
  const variants = variantsForUrl(src);
  if (!variants.length) return src;
  const target = Number.isFinite(width) && width > 0 ? width : IMAGE_WIDTHS.at(-1)!;
  const index = IMAGE_WIDTHS.findIndex((size) => size >= target);
  return variants[index < 0 ? variants.length - 1 : index];
}

export function imageSrcSet(src: string): string | undefined {
  const variants = variantsForUrl(src);
  if (!variants.length) return undefined;
  const key = new URL(src).pathname.slice(1);
  const sourceWidth = Number(key.match(/\/original-w(\d+)\./)?.[1]) || legacy[key] || Infinity;
  const usedWidths = new Set<number>();
  return variants.flatMap((url, index) => {
    const width = Math.min(IMAGE_WIDTHS[index], sourceWidth);
    if (usedWidths.has(width)) return [];
    usedWidths.add(width);
    return [`${url} ${width}w`];
  }).join(", ");
}
