import { describe, expect, it } from "vitest";
import { chipToneVars, darkToneHex, parseHexColor } from "@/lib/tags/chip-tone";

/** 与实现同口径的 HSL 亮度，用来断言提亮结果 */
function lightnessOf(hex: string): number {
  const rgb = parseHexColor(hex)!;
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  return (max + min) / 2;
}

function hueOf(hex: string): number {
  const { r, g, b } = parseHexColor(hex)!;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

describe("darkToneHex", () => {
  it("把深色标签（Steam #1B2838）提亮到可读区间，色相不变", () => {
    const out = darkToneHex("#1B2838");
    expect(lightnessOf(out)).toBeGreaterThanOrEqual(0.6);
    expect(Math.abs(hueOf(out) - hueOf("#1B2838"))).toBeLessThan(6);
  });

  it("近黑的「恐怖」#292524 也会被提亮，而不是留成一块黑", () => {
    const out = darkToneHex("#292524");
    expect(lightnessOf(out)).toBeGreaterThanOrEqual(0.6);
    expect(lightnessOf(out)).toBeGreaterThan(lightnessOf("#292524"));
  });

  it("本来就够亮的标签原样返回", () => {
    expect(darkToneHex("#FA5C5C")).toBe("#fa5c5c");
  });

  it("非法色值回落到品牌绿", () => {
    expect(darkToneHex("not-a-color")).toBe(darkToneHex("#88C232"));
  });
});

describe("parseHexColor", () => {
  it("支持三位与六位写法", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("3388bb")).toEqual({ r: 51, g: 136, b: 187 });
  });

  it("空值与非 hex 返回 null", () => {
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor("rgba(1,2,3,0.5)")).toBeNull();
  });
});

describe("chipToneVars", () => {
  it("同时给出昼夜两套颜色，供 .tag-soft 切换", () => {
    const vars = chipToneVars("#1B2838") as Record<string, string>;
    expect(vars["--tag-fg"]).toBe("#1b2838");
    expect(vars["--tag-fg-dark"]).not.toBe(vars["--tag-fg"]);
    expect(vars["--tag-bg"]).toContain("rgba(");
    expect(vars["--tag-bg-dark"]).toContain("rgba(");
  });

  it("空颜色回落到品牌绿", () => {
    const a = chipToneVars(null) as Record<string, string>;
    const b = chipToneVars("#88C232") as Record<string, string>;
    expect(a["--tag-fg"]).toBe(b["--tag-fg"]);
  });
});
