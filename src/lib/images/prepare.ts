import sharp from "sharp";
import { IMAGE_WIDTHS } from "./delivery";

export type ImageVariant = { width: number; sourceWidth: number; buffer: Buffer };

/** Originals remain untouched, including animated GIF/WebP images. */
export async function prepareImageVariants(buffer: Buffer, mimeType: string): Promise<ImageVariant[]> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return [];
  const input = sharp(buffer, { limitInputPixels: 80_000_000, failOn: "error" });
  const metadata = await input.metadata();
  if ((metadata.pages || 1) > 1) return [];
  const sourceWidth = (metadata.orientation || 1) >= 5 ? metadata.height! : metadata.width!;
  // Process sequentially to keep upload-time peak memory bounded.
  const variants: ImageVariant[] = [];
  for (const width of IMAGE_WIDTHS) {
    const output = await input.clone().rotate().resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).toBuffer();
    variants.push({ width, sourceWidth, buffer: output });
  }
  return variants;
}
