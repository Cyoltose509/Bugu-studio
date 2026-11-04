import { describe, expect, it } from "vitest";
import { imageUrl, imageSrcSet, imageVariantPaths, isImageVariantKey } from "@/lib/images/delivery";
import loader from "@/lib/images/loader";
import { getImageProps } from "next/image";

const original = "https://cdn.bugoostudio.com/covers/v1/0123456789abcdef0123456789abcdef/original.jpg";

describe("prebuilt CDN image delivery", () => {
  it("selects fixed widths and clamps at the largest file", () => {
    expect(imageUrl(original, 400)).toBe(original.replace("original.jpg", "w-640.webp"));
    expect(imageUrl(original, 1921)).toContain("w-1920.webp");
    expect(imageUrl(original, 20)).toContain("w-320.webp");
  });
  it("creates a responsive srcset without a transformation endpoint", () => {
    const srcset = imageSrcSet(original)!;
    expect(srcset.split(", ")).toHaveLength(4);
    expect(srcset).toContain("w-1280.webp 1280w");
    expect(srcset).not.toMatch(/_next\/image|cdn-cgi|[?&](?:w|width|quality)=/);
  });
  it("uses actual intrinsic widths in descriptors without upscaling", () => {
    const small = original.replace("original.jpg", "original-w800.jpg");
    expect(imageSrcSet(small)).toContain("w-1280.webp 800w");
    expect(imageSrcSet(small)?.split(", ")).toHaveLength(3);
  });
  it.each(["https://example.com/covers/v1/0123456789abcdef0123456789abcdef/original.jpg",
    "https://cdn.bugoostudio.com/covers/old.jpg", "/images/logo.png", "blob:local", "data:image/png;base64,AA",
    original + "?token=signed", original + "#fragment", original.replace(".jpg", ".gif")])("keeps unmanaged URLs unchanged: %s", (src) => {
    expect(imageUrl(src, 640)).toBe(src);
    expect(imageSrcSet(src)).toBeUndefined();
  });
  it("generates only keys owned by managed originals", () => {
    expect(imageVariantPaths("covers/v1/0123456789abcdef0123456789abcdef/original.png")).toHaveLength(4);
    expect(imageVariantPaths("attachments/document.pdf")).toEqual([]);
    expect(imageVariantPaths("screenshots/v1/0123456789abcdef0123456789abcdef/original.webp")).toHaveLength(4);
  });
  it("renders responsive Next Image props with CDN URLs and no Vercel optimizer", () => {
    const { props } = getImageProps({ src: original, alt: "cover", width: 400, height: 300, loader });
    expect(props.src).toContain("cdn.bugoostudio.com");
    expect(props.srcSet).toContain(".webp");
    expect(JSON.stringify(props)).not.toContain("/_next/image");
  });
});

describe("derived image cleanup protection", () => {
  it("recognizes both legacy and new static derivatives", () => {
    expect(isImageVariantKey("covers/photo.png.w-640.webp")).toBe(true);
    expect(isImageVariantKey("screenshots/v1/0123456789abcdef0123456789abcdef/w-1920.webp")).toBe(true);
    expect(isImageVariantKey("covers/photo.png")).toBe(false);
    expect(isImageVariantKey("attachments/document.pdf")).toBe(false);
  });
});
