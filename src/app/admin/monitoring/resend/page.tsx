/**
 * Resend 邮件服务监控页面
 * 检测 API Key 配置、域名验证状态
 */

import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

interface ResendStatus {
  configured: boolean;
  apiKey: string;
  mailFrom: string;
  siteUrl: string;
}

async function checkResendStatus(): Promise<ResendStatus> {
  const key = process.env.RESEND_API_KEY || "";
  return {
    configured: !!key,
    apiKey: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : "未配置",
    mailFrom: process.env.MAIL_FROM || "未配置",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "未配置",
  };
}

export default async function ResendMonitorPage() {
  const status = await checkResendStatus();

  // 统计用户邮箱验证情况
  let totalUsers = 0;
  let verifiedUsers = 0;
  let unverifiedUsers = 0;

  try {
    totalUsers = await prisma.user.count();
    verifiedUsers = await prisma.user.count({
      where: { emailVerified: { not: null } },
    });
    unverifiedUsers = totalUsers - verifiedUsers;
  } catch {}

  // 统计最近的 verificationToken
  let pendingTokens = 0;
  try {
    pendingTokens = await prisma.verificationToken.count();
  } catch {}

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/monitoring"
          className="text-sm hover:underline"
          style={{ color: "#3388BB" }}
        >
          ← 监控总览
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>
          📧 Resend 邮件服务
        </h1>
      </div>

      {/* API 配置状态 */}
      <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>
        API 配置
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ConfigRow
          label="API Key"
          value={status.configured ? "✅ 已配置" : "❌ 未配置"}
          detail={status.apiKey}
          ok={status.configured}
        />
        <ConfigRow
          label="发件地址"
          value={status.mailFrom !== "未配置" ? "✅ 已配置" : "❌ 未配置"}
          detail={status.mailFrom}
          ok={status.mailFrom !== "未配置"}
        />
        <ConfigRow
          label="站点 URL"
          value={status.siteUrl !== "未配置" ? "✅ 已配置" : "❌ 未配置"}
          detail={status.siteUrl}
          ok={status.siteUrl !== "未配置"}
        />
        <ConfigRow
          label="免费额度"
          value="ℹ️ 100封/天（验证域名后 3000封/月）"
          detail="Resend Free Tier"
          ok={true}
        />
      </div>

      {/* 用户邮箱统计 */}
      <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>
        用户邮箱统计
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="总用户数" value={String(totalUsers)} icon="👥" color="#3388BB" />
        <StatCard label="已验证" value={String(verifiedUsers)} icon="✅" color="#88C232" />
        <StatCard label="未验证" value={String(unverifiedUsers)} icon="⚠️" color="#E8A040" />
        <StatCard label="待处理令牌" value={String(pendingTokens)} icon="🎫" color="#7C3AED" />
      </div>

      {/* 说明 */}
      <div
        className="bg-white border rounded-lg p-5 text-sm space-y-2"
        style={{ borderColor: "#D0DEE8", color: "#555" }}
      >
        <h3 className="font-semibold mb-2" style={{ color: "#25547A" }}>
          ℹ️ 关于 Resend
        </h3>
        <p>
          Resend 提供邮件发送 API。当前使用免费套餐（100封/天），验证域名后可升级到
          3000封/月。
        </p>
        <p>
          管理控制台：
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener"
            className="ml-1 hover:underline"
            style={{ color: "#3388BB" }}
          >
            resend.com/domains →
          </a>
        </p>
        <p>
          本系统使用 Resend 发送：邮箱验证码、密码重置邮件。
        </p>
        {!status.configured && (
          <p style={{ color: "#C62828" }}>
            ⚠️ RESEND_API_KEY 未配置，邮件功能不可用。请在 .env 中设置。
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigRow({
  label,
  value,
  detail,
  ok,
}: {
  label: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-4 shadow-sm"
      style={{ borderColor: ok ? "#C8E6C9" : "#FFCDD2" }}
    >
      <div className="text-xs mb-1" style={{ color: "#777" }}>
        {label}
      </div>
      <div
        className="text-sm font-semibold mb-1"
        style={{ color: ok ? "#2E7D32" : "#C62828" }}
      >
        {value}
      </div>
      <div className="text-xs font-mono" style={{ color: "#999" }}>
        {detail}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-4 shadow-sm"
      style={{ borderColor: "#D0DEE8" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs" style={{ color: "#777" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
