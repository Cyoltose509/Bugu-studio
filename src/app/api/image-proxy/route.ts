import { NextRequest, NextResponse } from "next/server";

/**
 * 图片代理 API
 * 解决 html-to-image (SVG foreignObject) 无法加载跨域图片的问题。
 * 客户端将图片 URL 通过此代理转为同源请求，避免 CORS 限制。
 *
 * 用法: /api/image-proxy?url=<encoded-image-url>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // 基础安全校验：只允许 http/https
  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return new NextResponse("Invalid protocol", { status: 400 });
  }

  try {
    const res = await fetch(rawUrl, {
      headers: {
        // 某些图片 CDN 要求带 User-Agent
        "User-Agent": "Mozilla/5.0 (compatible; BuguStudio/1.0)",
      },
      // 复用 Next.js 缓存（图片通常不常变）
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, {
        status: res.status,
      });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        // 允许 SVG foreignObject / Canvas 读取此响应（同源，无 CORS 问题）
      },
    });
  } catch (err) {
    console.error("[image-proxy] fetch failed:", rawUrl, err);
    return new NextResponse("Proxy fetch failed", { status: 502 });
  }
}
