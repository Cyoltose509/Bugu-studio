// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
import { prepareImagesForExport } from "@/lib/image-export";
afterEach(() => { document.body.innerHTML=""; });
describe("responsive images in poster export", () => {
  it("proxies a CDN image and restores its original responsive attributes", async () => {
    const container=document.createElement("div"), img=document.createElement("img");
    img.src="https://cdn.bugoostudio.com/covers/original.png";
    img.srcset="https://cdn.bugoostudio.com/covers/original.png.w-640.webp 640w";
    img.sizes="400px";img.loading="lazy";
    Object.defineProperty(img,"complete",{ get:()=>true });
    Object.defineProperty(img,"naturalWidth",{ get:()=>640 });
    container.append(img);document.body.append(container);
    const attributes={ src:img.getAttribute("src"),srcset:img.getAttribute("srcset"),sizes:img.getAttribute("sizes") };
    const restore=await prepareImagesForExport(container);
    expect(img.getAttribute("src")).toContain("/api/image-proxy?url=");
    expect(img.hasAttribute("srcset")).toBe(false);
    restore();
    for(const [key,value] of Object.entries(attributes))expect(img.getAttribute(key)).toBe(value);
    expect(img.loading).toBe("lazy");
  });
});
