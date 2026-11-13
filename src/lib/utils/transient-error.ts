/**
 * 瞬态错误识别与自愈 —— 纯函数，无 "use client"（服务端/客户端均可 import）
 *
 * 生产错误报告里的两类高频"部署后白屏"其实都可自愈：
 * 1) ChunkLoadError：新版本部署后旧客户端仍在请求旧的 chunk 文件（404），
 *    刷新一次拿到新 HTML 即可恢复；
 * 2) RSC 流中断 / 网络抖动："Connection closed."（React RSC 客户端
 *    startReadingFromStream 在流未完成时关闭会抛）、"Failed to fetch"、"Load failed"、
 *    "network error"，均为客户端导航时的 RSC fetch 失败，刷新同样可恢复。
 *
 * 这里只做两件事：识别这些错误 + 带频率上限地刷新一次（20s 冷却、10 分钟内最多 3 次），
 * 避免真的遇到"每次加载都失败"时把用户困在无限刷新里。
 */

/** 可注入的存储接口（默认用 window.sessionStorage），便于单测 */
export interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** attemptTransientRecovery 的可注入选项（全部有默认值，单测时不真正 reload） */
export interface TransientRecoveryOptions {
  /** 当前时间戳（默认 Date.now） */
  now?: () => number;
  /** 存储实现（默认 window.sessionStorage；传 null 表示不可用） */
  storage?: RecoveryStorage | null;
  /** 刷新实现（默认 window.location.reload） */
  reload?: (() => void) | null;
  /** 是否在线（默认 navigator.onLine !== false） */
  isOnline?: () => boolean;
  /** 两次自动刷新之间的冷却（默认 20s） */
  cooldownMs?: number;
  /** 时间窗口内允许的最大自动刷新次数（默认 3 次） */
  maxReloads?: number;
  /** 统计窗口（默认 10 分钟） */
  windowMs?: number;
  /** sessionStorage 键前缀（默认 "bugu:transient-recovery"） */
  keyPrefix?: string;
}

const DEFAULT_COOLDOWN_MS = 20_000;
const DEFAULT_MAX_RELOADS = 3;
const DEFAULT_WINDOW_MS = 10 * 60_000;
const DEFAULT_KEY_PREFIX = "bugu:transient-recovery";

/** 非锚定的 chunk 加载失败特征（Webpack / Vite / 浏览器原生动态 import 各不相同） */
const CHUNK_LOAD_PATTERNS: readonly RegExp[] = [
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /ChunkLoadError/,
  /Failed to load chunk/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

/** 需要整体匹配的 RSC / 网络错误特征（避免误伤业务报错） */
const NETWORK_ANCHORED_PATTERNS: readonly RegExp[] = [
  /^Connection closed\.?$/i,
  /^Load failed\.?$/i,
  /^network error\.?$/i,
];

/** RSC / 网络错误的子串特征 */
const NETWORK_CONTAINS_PATTERNS: readonly RegExp[] = [
  /Failed to fetch/i,
  /NetworkError when attempting to fetch resource/i,
  /network connection was lost/i,
];

interface ErrorDescriptor {
  name: string;
  message: string;
}

/** 把任意抛出的值（Error / DOMException / string / 其它）安全地描述成 name + message */
function describeError(error: unknown): ErrorDescriptor {
  if (error === null || error === undefined) return { name: "", message: "" };
  if (typeof error === "string") return { name: "", message: error };
  if (typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const message = typeof candidate.message === "string" ? candidate.message : "";
    if (name || message) return { name, message };
  }
  return { name: "", message: String(error) };
}

/**
 * 是否为 chunk 加载失败（部署后旧 chunk 404 / 动态 import 失败）
 */
export function isChunkLoadError(error: unknown): boolean {
  const { name, message } = describeError(error);
  if (/^chunkloaderror$/i.test(name.trim())) return true;
  // 一些运行时把 "ChunkLoadError" 写进 message 前缀，name 可能是普通 Error
  const haystack = `${name}\n${message}`;
  return CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(haystack));
}

/**
 * 是否为 RSC 流中断 / 网络失败（客户端导航时 fetch RSC payload 失败）
 */
export function isTransientNetworkError(error: unknown): boolean {
  const { name, message } = describeError(error);
  const trimmedMessage = message.trim();
  if (NETWORK_ANCHORED_PATTERNS.some((pattern) => pattern.test(trimmedMessage))) return true;
  const haystack = `${name}\n${trimmedMessage}`;
  return NETWORK_CONTAINS_PATTERNS.some((pattern) => pattern.test(haystack));
}

/**
 * 是否为可自愈的瞬态错误（chunk 丢失或网络/RSC 中断，刷新一次通常即可恢复）
 */
export function isRecoverableTransientError(error: unknown): boolean {
  return isChunkLoadError(error) || isTransientNetworkError(error);
}

/** 默认存储：SSR 或隐私模式（sessionStorage 不可写）时返回 null */
function getDefaultStorage(): RecoveryStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** 默认在线判定：navigator 不可用（SSR/测试）时视为在线 */
function getDefaultOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/** 读取已记录的刷新时间戳；数据损坏时当作空记录（宁可多刷一次也不整页崩溃） */
function readStamps(storage: RecoveryStorage, key: string): number[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  } catch {
    return [];
  }
}

/** 写刷新时间戳；写不进去就放弃自动刷新（无法保证不循环） */
function writeStamps(storage: RecoveryStorage, key: string, stamps: number[]): boolean {
  try {
    storage.setItem(key, JSON.stringify(stamps));
    return true;
  } catch {
    return false;
  }
}

/**
 * 尝试自动恢复：满足条件时刷新一次页面。
 *
 * @returns true 表示已经触发刷新；false 表示未刷新（离线 / SSR / 冷却期 / 次数用尽 / 存储不可用），
 *          调用方应保留手动重试入口。
 */
export function attemptTransientRecovery(options: TransientRecoveryOptions = {}): boolean {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  // 离线或拿不到 sessionStorage（SSR / 隐私模式）时不刷新：既无意义也无法防循环
  if (!storage) return false;

  const isOnline = options.isOnline ?? getDefaultOnline;
  // 离线时刷新只会得到浏览器错误页，还白白消耗掉恢复次数
  if (!isOnline()) return false;

  const reload =
    options.reload !== undefined
      ? options.reload
      : typeof window !== "undefined"
        ? () => window.location.reload()
        : null;
  if (!reload) return false;

  const now = options.now ?? Date.now;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const maxReloads = options.maxReloads ?? DEFAULT_MAX_RELOADS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const storageKey = `${options.keyPrefix ?? DEFAULT_KEY_PREFIX}:state`;

  const nowMs = now();
  // 只保留时间窗口内的记录（窗口外的旧记录不再限制本次刷新）
  const stamps = readStamps(storage, storageKey).filter((stamp) => nowMs - stamp < windowMs);

  const lastStamp = stamps.length > 0 ? stamps[stamps.length - 1] : null;
  if (lastStamp !== null && nowMs - lastStamp < cooldownMs) return false; // 冷却期内：避免连续刷新
  if (stamps.length >= maxReloads) return false; // 窗口内次数用尽：交给用户手动处理

  // 先落盘再刷新，确保"刷新后再次抛错"时仍受次数限制
  if (!writeStamps(storage, storageKey, [...stamps, nowMs])) return false;

  try {
    reload();
  } catch {
    return false;
  }
  return true;
}
