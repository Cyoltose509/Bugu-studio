/**
 * 通用标签胶囊的昼夜配色
 *
 * 引擎 / 活动&赛事标签在 globals.css 里手写了 .engine-chip / .event-chip 的暗色变体，
 * 其余标签（平台、大类、成员自建）颜色存在数据库里，没法逐个写 CSS。而深色标签
 * 直接放到暗色卡片上几乎看不见 —— 平台 Steam 是 #1B2838、要素「恐怖」是 #292524，
 * 在暗底 #1f2430 上与背景几乎同色。
 *
 * 这里按 HSL 亮度把深色标签提亮到可读区间（保留色相与饱和度，只抬亮度），
 * 亮色与暗色两套值都写进 CSS 变量，由 .tag-soft / .dark .tag-soft 切换。
 * 值只由颜色本身决定，服务端和客户端算出来完全一致，不会出现 hydration 抖动。
 */
import type { CSSProperties } from "react";

export type Rgb = { r: number; g: number; b: number };

const FALLBACK_COLOR = "#88C232";
/** 暗色模式下标签色的最低亮度（HSL 的 L）。和 .dark 里 --color-brand-blue 的提亮幅度对齐 */
const DARK_MIN_LIGHTNESS = 0.62;
/** 胶囊底色不透明度：亮色偏淡，暗色略重，才压得住深底 */
const BG_ALPHA_LIGHT = 0.1;
const BG_ALPHA_DARK = 0.16;

export function parseHexColor(input?: string | null): Rgb | null {
    if (!input) return null;
    const hex = input.trim().replace(/^#/, "");
    if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
    };
}

function toHex({ r, g, b }: Rgb): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r1, g1, b1] =
        hp < 1
            ? [c, x, 0]
            : hp < 2
              ? [x, c, 0]
              : hp < 3
                ? [0, c, x]
                : hp < 4
                  ? [0, x, c]
                  : hp < 5
                    ? [x, 0, c]
                    : [c, 0, x];
    const m = l - c / 2;
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** 亮色模式原样返回；深色模式把过暗的颜色抬到 DARK_MIN_LIGHTNESS，色相不变 */
export function darkToneHex(color?: string | null): string {
    const rgb = parseHexColor(color) ?? parseHexColor(FALLBACK_COLOR)!;
    const { h, s, l } = rgbToHsl(rgb);
    if (l >= DARK_MIN_LIGHTNESS) return toHex(rgb);
    return toHex(hslToRgb(h, s, DARK_MIN_LIGHTNESS));
}

function rgba(color: string, alpha: number): string {
    const rgb = parseHexColor(color) ?? parseHexColor(FALLBACK_COLOR)!;
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

/**
 * 给 .tag-soft 元素注入四个变量；颜色为空 / 非法时回落到品牌绿。
 * 元素上不要再用内联 color/background-color，否则会盖掉 .dark 的切换。
 */
export function chipToneVars(color?: string | null): CSSProperties {
    // 统一走 toHex 归一化（大小写、三位写法），变量值才稳定
    const light = toHex(parseHexColor(color) ?? parseHexColor(FALLBACK_COLOR)!);
    const dark = darkToneHex(light);
    return {
        "--tag-fg": light,
        "--tag-bg": rgba(light, BG_ALPHA_LIGHT),
        "--tag-fg-dark": dark,
        "--tag-bg-dark": rgba(dark, BG_ALPHA_DARK),
    } as CSSProperties;
}
