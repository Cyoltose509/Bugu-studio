import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import { promisify } from "util";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

/**
 * 图片代理 API
 * 解决 html-to-image (SVG foreignObject) 无法加载跨域图片的问题。
 * 客户端将图片 URL 通过此代理转为同源请求，避免 CORS 限制。
 *
 * 用法: /api/image-proxy?url=<encoded-image-url>
 *
 * 安全措施：
 * - 仅允许 http/https 协议
 * - 阻止内网/链路本地/云元数据 IP
 * - 阻止 DNS 重绑定攻击（hostname → IP 再次检查）
 * - 仅代理图片类 MIME 类型
 * - 禁止跟随重定向
 */

// ── 内网 / 敏感 IP 黑名单 ──
function isPrivateOrSensitiveIP(ip: string): boolean {
  // IPv4 私有地址
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  // 回环
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  // 链路本地
  if (/^169\.254\./.test(ip)) return true;
  if (/^fe80:/i.test(ip)) return true;
  // 云元数据（AWS/GCP/Azure/DigitalOcean）
  if (ip === "169.254.169.254") return true;
  // IPv6 私有 / 唯一本地
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(ip)) return true;
  return false;
}

// ── 域名白名单（仅允许这些域名，注释掉则为全允许但禁内网） ──
const ALLOWED_HOSTS: RegExp[] = [
  // 布谷 Studio 自身（CDN/R2）
  /^.*\.r2\.cloudflarestorage\.com$/,
  /^pub-[a-f0-9]+\.r2\.dev$/,
  // 常见图片 CDN/平台
  /^.*\.cloudflare\.com$/,
  /^.*\.githubusercontent\.com$/,
  /^.*\.itch\.io$/,
  /^.*\.steampowered\.com$/,
  /^.*\.steamstatic\.com$/,
  /^.*\.googleapis\.com$/,
  /^.*\.google\.com$/,
  /^.*\.unsplash\.com$/,
  /^images\.unsplash\.com$/,
  /^.*\.imgur\.com$/,
  /^i\.imgur\.com$/,
  /^.*\.discordapp\.(com|net)$/,
  /^.*\.twimg\.com$/,
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((r) => r.test(hostname));
}

export async function GET(req: NextRequest) {
  // 速率限制：每 IP 每分钟 30 次
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { windowSeconds: 60, maxRequests: 30, prefix: "imgproxy" });
  if (!rl.allowed) {
    return new NextResponse("Rate limited", { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // ── 步骤 1: 基础校验 ──
  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return new NextResponse("Invalid protocol", { status: 400 });
  }

  const hostname = imageUrl.hostname.toLowerCase();

  // ── 步骤 2: 域名白名单检查 ──
  if (!isAllowedHost(hostname)) {
    console.warn("[image-proxy] blocked host:", hostname);
    return new NextResponse("Host not allowed", { status: 403 });
  }

  // ── 步骤 3: 阻止直接使用 IP 地址 ──
  const isIPLiteral =
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname.includes(":");
  if (isIPLiteral) {
    return new NextResponse("IP literal not allowed", { status: 403 });
  }

  try {
    // ── 步骤 4: DNS 解析并检查目标 IP ──
    let resolvedIPs: string[] = [];
    try {
      const v4 = await dns.resolve4(hostname);
      resolvedIPs.push(...v4);
    } catch { /* IPv4 解析失败，继续 */ }
    try {
      const v6 = await dns.resolve6(hostname);
      resolvedIPs.push(...v6);
    } catch { /* IPv6 解析失败，继续 */ }

    for (const ip of resolvedIPs) {
      if (isPrivateOrSensitiveIP(ip)) {
        console.warn(`[image-proxy] blocked private IP: ${hostname} → ${ip}`);
        return new NextResponse("Internal IP blocked", { status: 403 });
      }
    }

    // ── 步骤 5: 发起请求（禁止自动跟随重定向） ──
    const res = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BuguStudio/1.0)",
      },
      redirect: "manual", // 禁止跟随重定向
    });

    // 拒绝重定向（防 SSRF 绕过）
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return new NextResponse("Redirect not allowed", { status: 403 });
    }

    if (!res.ok) {
      return new NextResponse("Upstream error", { status: 502 });
    }

    // ── 步骤 6: MIME 类型白名单 ──
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "image/avif", "image/svg+xml", "image/bmp", "image/tiff",
      "image/x-icon", "image/vnd.microsoft.icon",
    ];
    if (!allowedTypes.some((t) => contentType.startsWith(t))) {
      console.warn(`[image-proxy] blocked mime type: ${contentType} from ${hostname}`);
      return new NextResponse("Content type not allowed", { status: 403 });
    }

    const buffer = await res.arrayBuffer();

    // ── 步骤 7: 限制响应大小（最大 10MB） ──
    if (buffer.byteLength > 10 * 1024 * 1024) {
      return new NextResponse("Response too large", { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[image-proxy] fetch failed:", rawUrl, err);
    return new NextResponse("Proxy fetch failed", { status: 502 });
  }
}
