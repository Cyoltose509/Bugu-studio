/**
 * 作品「按名称」排序
 *
 * 数据库里 title/subtitle 混着中文和英文，直接 ORDER BY title 走的是 Postgres
 * 默认 collation —— 英文按字母正常，中文却按 Unicode 码点排（东、刻、勇、卖…），
 * 看起来是乱的。
 *
 * 这里改成：中文标题转拼音、英文原名保留，两者落进同一个字母序里混排。
 * 副标题是纯英文时优先用副标题（通常是作品的英文名，如「留步 / One Step Away」）。
 */
import { pinyin } from "pinyin-pro";

const HAS_HAN = /[\u4e00-\u9fff]/;
const HAS_LATIN = /[A-Za-z]/;

/** 生成可比较的排序键：全小写、只保留 a-z 0-9 和空格 */
export function nameSortKey(title: string, subtitle?: string | null): string {
    const raw =
        subtitle && !HAS_HAN.test(subtitle) && HAS_LATIN.test(subtitle) ? subtitle : title;
    const converted = pinyin(raw, { toneType: "none", nonZh: "consecutive" });
    return (
        converted
            // ü → u，去掉拼音里的变音符号，否则混在 ASCII 里排序位置很怪
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
    );
}

type NameRow = { id: string; title: string; subtitle?: string | null };

const compare = (a: NameRow, b: NameRow): number => {
    const ka = nameSortKey(a.title, a.subtitle);
    const kb = nameSortKey(b.title, b.subtitle);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;   // 同键时用 id 保底，分页稳定
};

/**
 * 按名称排序后切片。
 *
 * 名称排序没法交给数据库（拿不到拼音序），所以在内存里排；作品量级是百级以内，
 * 一次取全量再切片比来回分页更省事，也能复用 cursor（上一页最后一项的 id）。
 * cursor 找不到时返回空数组，表示没有更多。
 */
export function sortByNameAndSlice<T extends NameRow>(
    rows: T[],
    cursor: string | null,
    take: number,
): T[] {
    const sorted = [...rows].sort(compare);
    if (!cursor) return sorted.slice(0, take);
    const idx = sorted.findIndex((r) => r.id === cursor);
    if (idx === -1) return [];
    return sorted.slice(idx + 1, idx + 1 + take);
}
