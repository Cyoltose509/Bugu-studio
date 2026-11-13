"use client";

/**
 * useAutosave —— 停止输入后自动把快照写回服务端。
 *
 * 行为约定：
 * - 挂载时的第一份数据视为「已保存」，不会一进页面就打接口；
 * - 每次 data 变化重新计时（默认 1500ms），期间又改则只保留最后一次；
 * - 快照签名与上次成功保存的一致时直接跳过，避免原地抖动反复写库；
 * - 失败后按 retryDelay 重试（默认 5s），仍失败则停在 error 状态等下一次输入；
 * - enabled 为 false（必填项没填、手动保存进行中）时不排任何请求。
 *
 * 只负责「何时调、调几次、当前什么状态」，不关心请求细节。
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "waiting" | "saving" | "saved" | "error" | "blocked";

export type UseAutosaveOptions<T> = {
  data: T;
  save: (data: T) => Promise<unknown>;
  enabled?: boolean;
  delay?: number;
  retryDelay?: number;
  onSaved?: (data: T) => void;
};

export type UseAutosaveResult = {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  /** 立刻保存（关闭弹窗、切页、点「保存」前调用） */
  flush: () => Promise<void>;
  /** 是否有改动还没写进服务端 */
  dirty: boolean;
};

function signatureOf(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "自动保存失败";
}

export function useAutosave<T>({
  data,
  save,
  enabled = true,
  delay = 1500,
  retryDelay = 5000,
  onSaved,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const signature = signatureOf(data);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const saveRef = useRef(save);
  saveRef.current = save;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const retryDelayRef = useRef(retryDelay);
  retryDelayRef.current = retryDelay;

  // 挂载时把当前快照当成基线：不首屏就写库
  const savedSignatureRef = useRef(signature);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const run = useCallback(async () => {
    const seq = ++seqRef.current;
    setStatus("saving");
    setError(null);
    try {
      await saveRef.current(dataRef.current);
      // 期间又改了、或组件已卸载：丢弃这次结果，状态交给新一轮
      if (!mountedRef.current || seq !== seqRef.current) return;
      savedSignatureRef.current = signatureOf(dataRef.current);
      setStatus("saved");
      setLastSavedAt(new Date());
      onSavedRef.current?.(dataRef.current);
    } catch (err) {
      if (!mountedRef.current || seq !== seqRef.current) return;
      setStatus("error");
      setError(messageOf(err));
      const retry = retryDelayRef.current;
      if (retry > 0) {
        retryRef.current = setTimeout(() => {
          if (mountedRef.current && enabledRef.current) void run();
        }, retry);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setStatus("blocked");
      return;
    }
    if (signature === savedSignatureRef.current) {
      clearTimers();
      setStatus((prev) => (prev === "error" || prev === "blocked" ? "idle" : prev));
      return;
    }
    clearTimers();
    setStatus("waiting");
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void run();
    }, Math.max(0, delay));
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [signature, enabled, delay, run, clearTimers]);

  const flush = useCallback(async () => {
    clearTimers();
    if (!enabledRef.current) return;
    if (signatureOf(dataRef.current) === savedSignatureRef.current) return;
    await run();
  }, [clearTimers, run]);

  return {
    status,
    lastSavedAt,
    error,
    flush,
    dirty: status === "waiting" || status === "saving" || status === "error",
  };
}
