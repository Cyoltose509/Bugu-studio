import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn(), fetch: vi.fn() }));
vi.mock("dns/promises", () => ({ default: { resolve4: mocks.resolve4, resolve6: mocks.resolve6 } }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }), getClientIp: () => "test" }));
import { GET } from "@/app/api/image-proxy/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve4.mockResolvedValue(["104.16.1.1"]);mocks.resolve6.mockResolvedValue([]);
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
const request = (url: string) => new NextRequest(`https://www.bugoostudio.com/api/image-proxy?url=${encodeURIComponent(url)}`);
describe("CDN image export proxy", () => {
  it.each(["https://cdn.bugoostudio.com/covers/old.png.w-640.webp", "https://lh3.googleusercontent.com/avatar"])("allows known image host: %s", async (url) => {
    const response=await GET(request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(mocks.fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "manual" }));
  });
  it("does not accept lookalike domains", async () => {
    expect((await GET(request("https://cdn.bugoostudio.com.evil.example/file.png"))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("still blocks private addresses and redirects", async () => {
    mocks.resolve4.mockResolvedValue(["127.0.0.1"]);
    expect((await GET(request("https://cdn.bugoostudio.com/file.png"))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.resolve4.mockResolvedValue(["104.16.1.1"]);
    mocks.fetch.mockResolvedValue(new Response(null,{ status: 302, headers: { location: "http://127.0.0.1/private" } }));
    expect((await GET(request("https://cdn.bugoostudio.com/file.png"))).status).toBe(403);
  });
});
