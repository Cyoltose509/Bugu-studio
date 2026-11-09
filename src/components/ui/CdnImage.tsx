import type { ComponentPropsWithRef } from "react";
import { imageSrcSet, imageUrl } from "@/lib/images/delivery";

/** Native image behavior, preserving original URLs in links/downloads. */
export default function CdnImage({ src, srcSet, sizes, original, ...props }: ComponentPropsWithRef<"img"> & { original?: boolean }) {
  const generated = !original && typeof src === "string" ? imageSrcSet(src) : undefined;
  const useGenerated = !srcSet && !!generated;
  return <img {...props} src={useGenerated ? imageUrl(src as string, 1280) : src}
    srcSet={srcSet || generated} sizes={sizes || (useGenerated ? "100vw" : undefined)} />;
}
