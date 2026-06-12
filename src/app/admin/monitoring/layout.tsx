/**
 * 监控页面布局 — 密码门控：所有 /admin/monitoring/* 页面统一验证
 */
import { cookies } from "next/headers";
import { verifyMonitoringToken } from "@/lib/monitoring-token";
import MonitorGate from "@/components/admin/MonitorGate";

export default async function MonitoringLayout({ children }: { children: React.ReactNode }) {
  // 检查已签名的 cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("monitoring_access")?.value;
  const isGranted = token ? verifyMonitoringToken(token) : false;

  // 读取环境变量用于自动填充密码框
  const autoFillPassword = process.env.MONITORING_PASSWORD || undefined;

  if (isGranted) {
    return <>{children}</>;
  }

  return <MonitorGate autoFillPassword={autoFillPassword}>{children}</MonitorGate>;
}
