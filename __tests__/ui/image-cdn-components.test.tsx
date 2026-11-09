// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }: any) => <img {...props} data-unoptimized={String(unoptimized)} /> }));
import CdnImage from "@/components/ui/CdnImage";
import SiteImage from "@/components/ui/SiteImage";
const src="https://cdn.bugoostudio.com/covers/v1/0123456789abcdef0123456789abcdef/original-w2400.png";
afterEach(cleanup);
describe("CDN component compatibility", () => {
  it("keeps native lazy loading, responsive URLs and event handlers", () => {
    const onLoad=vi.fn();render(<CdnImage src={src} alt="cover" loading="lazy" onLoad={onLoad} />);
    const image=screen.getByAltText("cover");
    expect(image).toHaveAttribute("loading","lazy");
    fireEvent.load(image);
    expect(onLoad).toHaveBeenCalledOnce();
    expect(image.getAttribute("srcset")).toContain("w-640.webp 640w");
  });
  it("preserves a full resolution original in the lightbox", () => {
    render(<CdnImage original src={src} alt="original" />);
    expect(screen.getByAltText("original")).toHaveAttribute("src",src);
    expect(screen.getByAltText("original")).not.toHaveAttribute("srcset");
  });
  it("opts unmanaged external and local images out of remote transformations", () => {
    render(<SiteImage src="/images/logo.png" alt="logo" width={64} height={64} />);
    expect(screen.getByAltText("logo")).toHaveAttribute("data-unoptimized","true");
  });
});

describe("gallery zoom reference",()=>{it("forwards the underlying image reference used by lightbox zoom",()=>{const ref=React.createRef<HTMLImageElement>();render(<CdnImage original src={src} alt="zoom" ref={ref} />);expect(ref.current).toBe(screen.getByAltText("zoom"));});});
