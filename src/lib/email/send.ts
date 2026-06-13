/**
 * 邮件发送封装
 * 支持：验证邮件 / 密码重置 / 通知
 */

import { getResend, MAIL_FROM, SITE_URL } from "./resend";
import { VerificationEmail } from "@/emails/verification";
import { ResetPasswordEmail } from "@/emails/reset-password";

/**
 * 发送邮箱验证码邮件
 * @returns true=发送成功, false=未配置Resend/发送失败
 */
export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured, skipping verification email");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject: "验证你的邮箱 - 布谷工作室",
      react: VerificationEmail({ code }),
    });

    if (error) {
      console.error("[email] Verification email send error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Verification email exception:", e);
    return false;
  }
}

/**
 * 发送密码重置邮件
 * @returns true=发送成功
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured, skipping reset email");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject: "重置密码 - 布谷工作室",
      react: ResetPasswordEmail({ resetUrl }),
    });

    if (error) {
      console.error("[email] Password reset email send error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Password reset email exception:", e);
    return false;
  }
}
