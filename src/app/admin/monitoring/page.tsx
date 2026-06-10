/**
 * 监控总览页 — 汇总 Supabase / R2 / Resend 状态概览
 */

import Link from "next/link";

const cards = [
  {
    href: "/admin/monitoring/supabase",
    icon: "🗄️",
    title: "Supabase 数据库",
    desc: "查看数据库大小、表空间占用、连接数等 PostgreSQL 指标",
    color: "#3ECF8E",
  },
  {
    href: "/admin/monitoring/r2",
    icon: "☁️",
    title: "R2 对象存储",
    desc: "查看存储桶使用量、文件数量、各类文件占用情况",
    color: "#F6821F",
  },
  {
    href: "/admin/monitoring/resend",
    icon: "📧",
    title: "Resend 邮件服务",
    desc: "查看 API 配置状态、域名验证情况",
    color: "#7C3AED",
  },
];

export default function MonitoringPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#25547A" }}>📡 系统监控</h1>
      <p className="mb-8" style={{ color: "#777" }}>查看各项外部服务的运行状态和使用情况</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-all group"
            style={{ borderColor: "#D0DEE8" }}
          >
            <div className="text-3xl mb-3">{c.icon}</div>
            <h2
              className="text-lg font-semibold mb-2 group-hover:underline"
              style={{ color: c.color }}
            >
              {c.title}
            </h2>
            <p className="text-sm" style={{ color: "#777" }}>
              {c.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
