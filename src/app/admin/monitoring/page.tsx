/**
 * 监控总览页 — 汇总 Supabase / R2 / Resend 状态概览
 */

import Link from "next/link";

const cards = [
  {
    href: "/admin/monitoring/supabase",
    icon: "🗄️",
    title: "Supabase 数据库",
    desc: "数据库统计、表空间占用、审计日志、备份管理、野表检测",
    colorClass: "text-[#3ECF8E]",
  },
  {
    href: "/admin/monitoring/r2",
    icon: "☁️",
    title: "R2 对象存储",
    desc: "查看存储桶使用量、文件数量、各类文件占用情况",
    colorClass: "text-[#F6821F]",
  },
  {
    href: "/admin/monitoring/resend",
    icon: "📧",
    title: "Resend 邮件服务",
    desc: "查看 API 配置状态、域名验证情况",
    colorClass: "text-[#7C3AED]",
  },
  {
    href: "/admin/monitoring/csp-reports",
    icon: "🛡️",
    title: "CSP 违规报告",
    desc: "查看 Content-Security-Policy 违规：被拦资源、违规指令、XSS 尝试",
    colorClass: "text-[#DC2626]",
  },
  {
    href: "/admin/monitoring/error-reports",
    icon: "🔥",
    title: "前端错误报告",
    desc: "查看用户遇到的前端错误：自动上报错误信息、堆栈、页面地址",
    colorClass: "text-[#E38043]",
  },
];

export default function MonitoringPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 text-brand-navy">📡 系统监控</h1>
      <p className="mb-8 text-brand-text-secondary">查看各项外部服务的运行状态和使用情况</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-card rounded-xl border p-6 shadow-sm hover:shadow-md transition-all group border-brand-border-subtle"
          >
            <div className="text-3xl mb-3">{c.icon}</div>
            <h2
              className={`text-lg font-semibold mb-2 group-hover:underline ${c.colorClass}`}
            >
              {c.title}
            </h2>
            <p className="text-sm text-brand-text-secondary">
              {c.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
