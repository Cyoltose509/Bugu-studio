/**
 * 前端错误上报过滤 —— 纯函数，无副作用（服务端 / 客户端都可 import）
 *
 * 后台「前端错误」列表长期被两类**不可处理**的条目淹没，这里在上报前就把它们拦掉：
 *
 * 1) 瞬态错误：ChunkLoadError（部署后旧客户端请求旧 chunk）、"Connection closed."、
 *    "network error"、"Load failed" 等 RSC 流中断 / 网络抖动。这些错误由
 *    ChunkLoadRecovery + attemptTransientRecovery 自动刷新自愈，刷新成功即消失，
 *    留在列表里既无法复现也无法修，只会掩盖真正的 bug。
 * 2) 非生产环境：localhost / 127.0.0.1 / 私有网段 / *.local。本地开发时的热更新
 *    报错会经由同一接口写入生产库，属于纯噪声（列表里曾占到一半以上）。
 *
 * 注意：只过滤「客户端上报」。服务端 onRequestError 记录的 RSC 错误不经过这里，
 * 否则会连带把服务端真实异常一起丢掉。
 */
import { isRecoverableTransientError } from "@/lib/utils/transient-error";

/** 过滤结果；reason 仅用于日志排查 */
export interface ClientReportFilterResult {
  skip: boolean;
  reason?: "transient" | "non-production-host";
}

/** 本机 / 内网主机名（本地开发会被同一套错误上报接口写进生产库） */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "host.docker.internal"]);
const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan"];
/** 私有网段 IPv4 前缀（10.x / 192.168.x / 172.16-31.x） */
const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * 判断 hostname 是否属于非生产环境。
 * 传入的是 hostname（已去掉协议/端口），不是完整 URL。
 */
export function isNonProductionHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (LOCAL_HOSTNAMES.has(host)) return true;
  if (PRIVATE_IPV4.test(host)) return true;
  return LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** 从页面 URL 里安全取出 hostname；解析失败返回 null（不因此过滤掉真实错误） */
export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * 是否跳过这条客户端错误上报。
 *
 * @param message 错误信息（取 Error.message 或浏览器给的字符串）
 * @param pageUrl 出错页面 URL（完整 URL 或仅 href）
 */
export function shouldSkipClientReport(
  message: string | null | undefined,
  pageUrl: string | null | undefined,
): ClientReportFilterResult {
  // 1) 瞬态错误：已被自动刷新自愈，不可复现，不落库
  if (message && isRecoverableTransientError(message)) {
    return { skip: true, reason: "transient" };
  }

  // 2) 本地 / 内网来源：开发环境噪声，永远不该进生产错误列表
  if (isNonProductionHostname(hostnameFromUrl(pageUrl))) {
    return { skip: true, reason: "non-production-host" };
  }

  return { skip: false };
}
