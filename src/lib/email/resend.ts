/**
 * Resend 邮件服务客户端
 * 官网：https://resend.com
 * 免费额度：100封/天，验证域名后 3000封/月
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// 懒加载：没有配置 API Key 时不会报错，注册流程跳过发邮件
let _resend: Resend | null = null;

export function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

/** 发件人地址（必须在 Resend 控制台验证过域名） */
export const MAIL_FROM =
  process.env.MAIL_FROM || "布谷工作室 <noreply@bugu.studio>";

/** 前端站点 URL */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost";
