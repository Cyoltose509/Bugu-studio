/**
 * 服务端 favicon 抓取：给工具站条目保存时使用。
 *
 * 为什么在服务端抓而不是热链：Google s2 / 目标站 favicon 在访客网络
 * （尤其国内）经常不可达，热链会成片失败回退字标。保存时由服务器
 * （Vercel 海外节点 / 本地开发机）抓取一次，转 PNG 上传到自家 R2，
 * 之后所有访客都走自家 CDN，稳定可达。
 *
 * 抓取链：Google s2（64px）→ 目标站 /favicon.ico。
 * 任一来源失败（超时/非图/转换失败）就换下一个，全部失败返回空串
 * （前端回退品牌色字标）。
 */
import sharp from "sharp";
import { uploadToR2 } from "@/lib/utils/upload";

const FETCH_TIMEOUT_MS = 6000;
const MIN_BYTES = 100;
const MAX_BYTES = 2_000_000;

export async function resolveFavicon(siteUrl: string): Promise<string> {
    let host: string;
    try {
        host = new URL(siteUrl).hostname;
    } catch {
        return "";
    }

    const sources = [
        `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
        `https://${host}/favicon.ico`,
        `https://${host}/apple-touch-icon.png`,
    ];

    for (const src of sources) {
        try {
            const res = await fetch(src, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: { "User-Agent": "Mozilla/5.0 (compatible; BugooStudio/1.0; favicon-fetch)" },
            });
            if (!res.ok) continue;
            const raw = Buffer.from(await res.arrayBuffer());
            if (raw.length < MIN_BYTES || raw.length > MAX_BYTES) continue;

            // 统一转 64px PNG：ICO/超大图都能规范化，且 R2 侧只收白名单格式
            const png = await sharp(raw)
                .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer();

            const safeHost = host.replace(/[^a-z0-9.-]/gi, "_");
            const result = await uploadToR2(png, `favicon-${safeHost}.png`, "image/png", "tools");
            return result.url;
        } catch {
            continue; // 换下一个来源
        }
    }
    return "";
}
