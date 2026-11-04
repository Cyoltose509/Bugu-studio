"use client";

import Image, { type ImageProps } from "next/image";
import { hasImageVariants } from "@/lib/images/delivery";

/** Next's layout/lazy loading, with prebuilt CDN files instead of Vercel transforms. */
export default function SiteImage(props: ImageProps) {
  const managed = typeof props.src === "string" && hasImageVariants(props.src);
  return <Image {...props} unoptimized={!managed || props.unoptimized} />;
}
