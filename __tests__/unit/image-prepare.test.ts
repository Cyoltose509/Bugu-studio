import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareImageVariants } from "@/lib/images/prepare";

describe("upload-time image preparation", () => {
  it("creates four decodable WebP files without modifying the original", async () => {
    const original = await sharp({ create: { width: 2400, height: 1200, channels: 4, background: "#ff880080" } }).png().toBuffer();
    const before = Buffer.from(original);
    const variants = await prepareImageVariants(original, "image/png");
    expect(variants.map((image) => image.width)).toEqual([320, 640, 1280, 1920]);
    for (const image of variants) {
      const metadata = await sharp(image.buffer).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(image.width);
      expect(metadata.height).toBe(image.width / 2);
      expect(metadata.hasAlpha).toBe(true);
    }
    expect(original.equals(before)).toBe(true);
  });
  it("does not enlarge small sources", async () => {
    const original = await sharp({ create: { width: 48, height: 32, channels: 3, background: "red" } }).png().toBuffer();
    const variants = await prepareImageVariants(original, "image/png");
    for (const image of variants) expect((await sharp(image.buffer).metadata()).width).toBe(48);
  });
  it("keeps GIF animation on its original path", async () => {
    expect(await prepareImageVariants(Buffer.from("GIF89a"), "image/gif")).toEqual([]);
  });
  it("rejects malformed static images before storage", async () => {
    await expect(prepareImageVariants(Buffer.from("invalid image"), "image/png")).rejects.toThrow();
  });
});

describe("animated WebP preservation",()=>{it("leaves a real two-frame WebP untouched",async()=>{const animated=Buffer.from("UklGRpQAAABXRUJQVlA4WAoAAAACAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GMAAAAAAAAAAAAAAAAAAAAGQAAAJWUDggGAAAADABAJ0BKgEAAQABQCYlpAADcAD+/PQAAEFOTUYwAAAAAAAAAAAAAAAAAAAAZAAAAFZQOCAYAAAANAEAnQEqAQABAAAAJiWkAANwAP79NmgA","base64");expect((await sharp(animated).metadata()).pages).toBe(2);expect(await prepareImageVariants(animated,"image/webp")).toEqual([]);});});
