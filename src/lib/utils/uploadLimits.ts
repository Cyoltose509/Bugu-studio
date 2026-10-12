/**
 * 上传体积上限的唯一来源（客户端与服务端共用，不要各写一份）
 *
 * 背景：站点部署在 Vercel，Serverless Function 的请求体有硬上限。
 * 超过后请求根本到不了 Next.js，Vercel 边缘直接返回纯文本 413：
 *
 *     Request Entity Too Large
 *     FUNCTION_PAYLOAD_TOO_LARGE
 *     hnd1::xxxx
 *
 * 前端 `res.json()` 解析这段非 JSON 文本就会抛
 * `Unexpected token 'R', "Request En"... is not valid JSON`（'R' 即 Request 首字母）。
 *
 * 实测（2026-10-12，对生产站 https://www.bugoostudio.com/api/upload 做字节级二分，
 * 用「401 未登录 = 到达函数」vs「413 = 被边缘拦下」判定）：
 *     请求体上限落在 4,491,679 ~ 4,492,093 字节之间（≈ 4.284 MiB）
 * 即 Vercel 文档的「4.5MB」是十进制 4,500,000 字节，实测还再低约 8KB。
 *
 * 所以所有限额必须 < 4,491,679 字节，且要留出 multipart 头开销。
 */

/** Vercel 侧实测硬限（字节），仅用于注释/校验，不要拿它当业务阈值 */
export const VERCEL_BODY_LIMIT_BYTES = 4_491_679;

/** 通用图片（封面 / 截图 / 海报 / 历史图片）发送上限 */
export const UPLOAD_LIMIT_BYTES = 4.2 * 1024 * 1024;

/** 头像接口上限（比通用小，头像本来也不需要那么大） */
export const AVATAR_LIMIT_BYTES = 1.9 * 1024 * 1024;

/** 报错文案里展示的服务器硬限（MB，十进制口径） */
export const UPLOAD_LIMIT_MB = 4.5;

export function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
