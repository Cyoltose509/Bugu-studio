/**
 * 结构化日志工具
 *
 * 输出 JSON 格式日志，便于生产环境聚合分析（Logtail / Better Stack / Grafana Loki 等）。
 * 通过 LOG_LEVEL 环境变量控制输出级别：trace | debug | info | warn | error | silent
 * 生产环境默认 info，开发环境默认 debug。
 */
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function getConfiguredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw in LEVEL_PRIORITY) return raw as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

interface LogEntry {
  t: string;        // ISO timestamp
  l: LogLevel;       // level
  m: string;         // message
  n: string;         // namespace
  e?: unknown;       // error (serialized)
  d?: unknown;       // data
  r?: string;        // requestId (if available in async context)
}

function serializeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack?.split("\n").slice(0, 5),
    };
  }
  return { raw: String(e) };
}

function log(level: LogLevel, namespace: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    t: new Date().toISOString(),
    l: level,
    m: message,
    n: namespace,
  };

  if (data instanceof Error) {
    entry.e = serializeError(data);
  } else if (data !== undefined) {
    entry.d = data;
  }

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "info":
      console.info(line);
      break;
    default:
      console.log(line);
  }
}

export interface Logger {
  trace(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export function createLogger(namespace: string): Logger {
  return {
    trace: (msg, data) => log("trace", namespace, msg, data),
    debug: (msg, data) => log("debug", namespace, msg, data),
    info: (msg, data) => log("info", namespace, msg, data),
    warn: (msg, data) => log("warn", namespace, msg, data),
    error: (msg, data) => log("error", namespace, msg, data),
  };
}

// 预建常用 logger 实例
export const logger = {
  /** 认证相关 */
  auth: createLogger("auth"),
  /** 数据库操作 */
  db: createLogger("db"),
  /** API 路由 */
  api: createLogger("api"),
  /** 缓存 */
  cache: createLogger("cache"),
  /** 通知 */
  notification: createLogger("notification"),
  /** 邮件 */
  email: createLogger("email"),
  /** R2 存储 */
  storage: createLogger("storage"),
  /** 安全相关 */
  security: createLogger("security"),
};
