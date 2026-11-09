"use client";

import { imageUrl } from "./delivery";

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  return imageUrl(src, width);
}
