/**
 * favicon 的 ICO 解码测试。
 *
 * 背景：sharp(libvips) 不认 ICO，`/favicon.ico` 兜底以前对所有站点都失败，
 * 只能靠 Google s2 出图。这里的手写 ICO 覆盖 32bpp BMP、全透明 alpha、
 * 以及内嵌 PNG 三种形态。
 */
import { describe, expect, it } from "vitest";
import { decodeIco } from "@/lib/tools/favicon";

/** 组装一张单帧、2×2、32bpp 的 BMP 形式 ICO；rows 按「显示顺序从下到上」给 */
function makeIco32(rowsBottomFirst: number[][][], opts: { alphaZero?: boolean; maskRows?: number[] } = {}) {
  const width = 2;
  const height = rowsBottomFirst.length;
  const headerSize = 40;
  const xorSize = width * height * 4;
  // AND 掩码：1 位/像素，行按 4 字节对齐；2px 宽一行占 4 字节
  const maskRowBytes = Math.ceil(width / 32) * 4;
  const hasMask = !!opts.maskRows;
  const payloadSize = headerSize + xorSize + (hasMask ? maskRowBytes * height : 0);
  const offset = 6 + 16;
  const buf = Buffer.alloc(offset + payloadSize);

  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);
  buf[6] = width;
  buf[7] = height;
  buf.writeUInt16LE(1, 10); // planes
  buf.writeUInt16LE(32, 12); // bpp
  buf.writeUInt32LE(payloadSize, 14);
  buf.writeUInt32LE(offset, 18);

  buf.writeUInt32LE(headerSize, offset);
  buf.writeInt32LE(width, offset + 4);
  buf.writeInt32LE(height * 2, offset + 8); // ICO 里高度含 AND 掩码，写 2 倍
  buf.writeUInt16LE(1, offset + 12);
  buf.writeUInt16LE(32, offset + 14);

  let p = offset + headerSize;
  for (const row of rowsBottomFirst) {
    for (const [r, g, b] of row) {
      buf[p++] = b; // BGRA 顺序
      buf[p++] = g;
      buf[p++] = r;
      buf[p++] = opts.alphaZero ? 0 : 255;
    }
  }
  if (hasMask) {
    for (let y = 0; y < height; y++) {
      buf[p++] = opts.maskRows![y] ?? 0;
      // 掩码行补齐到 4 字节对齐
      for (let k = 1; k < maskRowBytes; k++) buf[p++] = 0;
    }
  }
  return buf;
}

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];

describe("decodeIco", () => {
  it("32bpp BMP 形式：自下而上还原成 RGBA", () => {
    // 文件里第一行是显示的最底行
    const ico = makeIco32([
      [RED, GREEN],
      [BLUE, RED],
    ]);
    const out = decodeIco(ico);
    expect(out?.kind).toBe("raw");
    if (out?.kind !== "raw") return;
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    // 显示左上角应是文件里的最后一行 → 蓝
    expect([...out.data.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
    // 显示右下角是文件第一行的第二像素 → 绿
    expect([...out.data.subarray(12, 16)]).toEqual([0, 255, 0, 255]);
  });

  it("alpha 全为 0 且无掩码时视为不透明，不糊成全透明", () => {
    const out = decodeIco(makeIco32([[RED, RED]], { alphaZero: true }));
    if (out?.kind !== "raw") throw new Error("应解出 raw");
    expect([...out.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it("alpha 全为 0 时按 AND 掩码还原透明底（掩码位 1 = 透明）", () => {
    // 显示第 0 行：左透明、右不透明；显示第 1 行两个都不透明
    const ico = makeIco32(
      [
        [RED, GREEN],
        [BLUE, RED],
      ],
      { alphaZero: true, maskRows: [0b00000000, 0b10000000] },
    );
    const out = decodeIco(ico);
    if (out?.kind !== "raw") throw new Error("应解出 raw");
    expect(out.data[3]).toBe(0); // 显示左上 → 透明
    expect(out.data[7]).toBe(255); // 显示右上 → 不透明
    expect(out.data[11]).toBe(255); // 显示左下
  });

  it("真实 alpha 通道存在时不被掩码覆盖", () => {
    // 有 alpha 值就不看掩码，避免把逐像素渐变/边缘抠掉
    const ico = makeIco32([[RED, GREEN]], { maskRows: [0b11000000, 0] });
    const out = decodeIco(ico);
    if (out?.kind !== "raw") throw new Error("应解出 raw");
    expect(out.data[3]).toBe(255);
    expect(out.data[7]).toBe(255);
  });

  it("4bpp 调色板 ICO：按索引取色（老旧网站常见）", () => {
    // 2×2，clrUsed=2：0 号红、1 号绿；每行 1 字节有效、补齐到 4 字节
    const width = 2;
    const height = 2;
    const headerSize = 40;
    const paletteBytes = 2 * 4;
    const rowBytes = 4;
    const payloadSize = headerSize + paletteBytes + rowBytes * height;
    const buf = Buffer.alloc(22 + payloadSize);
    buf.writeUInt16LE(0, 0);
    buf.writeUInt16LE(1, 2);
    buf.writeUInt16LE(1, 4);
    buf[6] = width;
    buf[7] = height;
    buf.writeUInt16LE(1, 10);
    buf.writeUInt16LE(4, 12); // bpp
    buf.writeUInt32LE(payloadSize, 14);
    buf.writeUInt32LE(22, 18);
    buf.writeUInt32LE(headerSize, 22);
    buf.writeInt32LE(width, 26);
    buf.writeInt32LE(height * 2, 30);
    buf.writeUInt16LE(1, 34);
    buf.writeUInt16LE(4, 36);
    buf.writeUInt32LE(2, 54); // biClrUsed
    // 调色板 BGRA
    buf[62] = 0; // B
    buf[63] = 0; // G
    buf[64] = 255; // R → 红
    buf[67] = 255; // G → 绿
    // 位图：文件第一行 = 显示最后一行（0x10 → 左绿右红）
    buf[70] = 0x10;
    buf[74] = 0x01; // 显示第一行：左红右绿

    const out = decodeIco(buf);
    if (out?.kind !== "raw") throw new Error("应解出 raw");
    expect([...out.data.subarray(0, 3)]).toEqual([255, 0, 0]); // 左上红
    expect([...out.data.subarray(4, 7)]).toEqual([0, 255, 0]); // 右上绿
  });

  it("内嵌 PNG 的 ICO 直接透出 PNG 字节", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const buf = Buffer.alloc(22 + png.length);
    buf.writeUInt16LE(0, 0);
    buf.writeUInt16LE(1, 2);
    buf.writeUInt16LE(1, 4);
    buf[6] = 16;
    buf[7] = 16;
    buf.writeUInt32LE(png.length, 14);
    buf.writeUInt32LE(22, 18);
    png.copy(buf, 22);
    const out = decodeIco(buf);
    expect(out?.kind).toBe("buffer");
    if (out?.kind !== "buffer") return;
    expect(out.buffer.subarray(0, 4).equals(png.subarray(0, 4))).toBe(true);
  });

  it("不是 ICO / 目录越界时返回 null（交给字标兜底）", () => {
    expect(decodeIco(Buffer.from("not an ico at all"))).toBeNull();
    const broken = makeIco32([[RED, RED]]);
    broken.writeUInt32LE(9_999_999, 18); // 目录里声明的尺寸远超文件
    expect(decodeIco(broken)).toBeNull();
  });
});
