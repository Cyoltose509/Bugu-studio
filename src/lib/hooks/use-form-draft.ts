"use client";

/**
 * useFormDraft —— 把表单内容随时写进 localStorage，刷新、崩溃、误关后能捡回来。
 *
 * 和 useAutosave 的分工：
 * - useAutosave 写服务端，适用于「已存在的记录」，缺点是必须过校验、有副作用；
 * - useFormDraft 只写本地，适用于「新建表单」和「字段分散在多个子编辑器里的长表单」，
 *   新建状态下还没有数据库记录，服务端无从保存，本地草稿是唯一可行的兜底。
 *
 * 快照分两部分：
 * - state：调用方自己维护的 React 状态（受控字段），由 applySnapshot 写回；
 * - fields：容器内所有带 name 的表单控件（非受控字段），由 readFormFields / applyFormFields 读写。
 *
 * 只在用户真正动过之后才会产生草稿：挂载时不会写一份和初始值一样的副本。
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type DraftFields = Record<string, string | boolean>;

type StoredDraft<T> = {
  version: 1;
  at: number;
  state: T;
  fields: DraftFields;
};

export type UseFormDraftOptions<T> = {
  /** localStorage 键，建议带版本号，改结构时递增 */
  key: string;
  /** 返回可 JSON 序列化的受控状态 */
  getSnapshot: () => T;
  /** 把草稿写回 React 状态 */
  applySnapshot: (state: T, fields: DraftFields) => void;
  /** 表单容器，用于监听输入事件与读写非受控字段 */
  container?: HTMLElement | null;
  /** 受控状态的额外依赖，变化即视为有改动 */
  watch?: unknown;
  /** 关闭时停止写入（提交中） */
  enabled?: boolean;
  /** 停止输入多久后落盘，默认 800ms */
  delay?: number;
  /** 草稿超过这个时间视为过期，默认 7 天 */
  maxAgeMs?: number;
};

export type UseFormDraftResult = {
  /** 有可恢复的草稿时给出写盘时间，否则为 null */
  draft: { at: number } | null;
  restore: () => void;
  discard: () => void;
  /** 提交成功后调用：清掉草稿并停止后续写入 */
  clear: () => void;
};

const SKIP_INPUT_TYPES = new Set(["file", "submit", "button", "reset", "image"]);

/** 读出容器内所有带 name 的控件值；复选框记布尔，同名多选为最后一个 */
export function readFormFields(container: HTMLElement | null | undefined): DraftFields {
  const out: DraftFields = {};
  if (!container) return out;
  const nodes = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[name], textarea[name], select[name]",
  );
  nodes.forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    if (el instanceof HTMLInputElement) {
      if (SKIP_INPUT_TYPES.has(el.type)) return;
      if (el.type === "checkbox") {
        // 同名多复选框用「值列表」表达，单个布尔够用，这里取任一为真
        out[name] = el.checked || out[name] === true;
        return;
      }
      if (el.type === "radio") {
        if (el.checked) out[name] = el.value;
        return;
      }
    }
    out[name] = el.value;
  });
  return out;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  // React 在自己维护的 value tracker 上比对值，直接赋 value 会被判定为「没变」而不触发 onChange，
  // 必须走原型 setter 再派发 input 事件。
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** 找出容器内指定 name 的控件（不用 CSS.escape，避免依赖宿主环境实现） */
function namedControls(container: HTMLElement, name: string) {
  return Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input[name], textarea[name], select[name]",
    ),
  ).filter((el) => el.getAttribute("name") === name);
}

/** 把草稿里的非受控字段写回容器，尽量触发 React 的 onChange；skip 里的名字跳过 */
export function applyFormFields(
  container: HTMLElement | null | undefined,
  fields: DraftFields,
  skip: string[] = [],
) {
  if (!container) return;
  const skipSet = new Set(skip);
  Object.entries(fields).forEach(([name, value]) => {
    if (skipSet.has(name)) return;
    const nodes = namedControls(container, name);
    nodes.forEach((el) => {
      if (el instanceof HTMLInputElement) {
        if (SKIP_INPUT_TYPES.has(el.type)) return;
        if (el.type === "checkbox") {
          if (el.checked !== Boolean(value)) {
            el.click();
          }
          return;
        }
        if (el.type === "radio") {
          if (typeof value === "string" && el.value === value && !el.checked) el.click();
          return;
        }
      }
      if (el.value !== String(value)) setNativeValue(el, String(value));
    });
  });
}

export function useFormDraft<T>({
  key,
  getSnapshot,
  applySnapshot,
  container,
  watch,
  enabled = true,
  delay = 800,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
}: UseFormDraftOptions<T>): UseFormDraftResult {
  const [draft, setDraft] = useState<{ at: number } | null>(null);

  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const applySnapshotRef = useRef(applySnapshot);
  applySnapshotRef.current = applySnapshot;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const touchedRef = useRef(false);
  // clear() 之后彻底停写：enabled 是外部传的，重渲染会把 ref 覆盖回去
  const stoppedRef = useRef(false);
  // 记住最后一次挂上的容器：卸载时 React 会先把 ref 置空，若直接读 props 会拿到 null
  const containerElRef = useRef<HTMLElement | null>(container ?? null);
  if (container) containerElRef.current = container;

  const writeNow = useCallback(() => {
    if (stoppedRef.current || !enabledRef.current || !touchedRef.current) return;
    // 容器还没挂上（或从没挂上过）：没有非受控字段可读，写下去只会把真草稿覆盖成空壳
    if (!containerElRef.current) return;
    try {
      const payload: StoredDraft<T> = {
        version: 1,
        at: Date.now(),
        state: getSnapshotRef.current(),
        fields: readFormFields(containerElRef.current),
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
      pendingRef.current = false;
    } catch {
      // 隐私模式 / 配额满：草稿是增益功能，写不进去就算了
    }
  }, [key]);

  const schedule = useCallback(() => {
    if (stoppedRef.current || !enabledRef.current) return;
    touchedRef.current = true;
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeNow();
    }, delay);
  }, [delay, writeNow]);

  // 读一次历史草稿
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      if (!parsed || parsed.version !== 1 || typeof parsed.at !== "number") {
        window.localStorage.removeItem(key);
        return;
      }
      if (Date.now() - parsed.at > maxAgeMs) {
        window.localStorage.removeItem(key);
        return;
      }
      setDraft({ at: parsed.at });
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key, maxAgeMs]);

  // 监听容器内的输入
  useEffect(() => {
    const el = container;
    if (!el) return;
    const onInput = () => schedule();
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
    };
  }, [container, schedule]);

  // 受控状态变化（非受控字段靠上面的 input 事件）。
  // 这里刻意不把 schedule 放进依赖：容器 ref 挂上后 schedule 会换实例，
  // 一旦因此重跑 effect，就会把「和初始值一样」的空表单也写成草稿。
  // 用「和挂载时的值比对」而不是布尔开关，是因为开发模式 StrictMode 会把 effect 跑两遍。
  const initialWatchRef = useRef(watch);
  const firstWatchRef = useRef(true);
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  useEffect(() => {
    if (firstWatchRef.current) {
      firstWatchRef.current = false;
      initialWatchRef.current = watch;
      return;
    }
    if (Object.is(watch, initialWatchRef.current)) return;
    scheduleRef.current();
  }, [watch]);

  // 卸载时把没落盘的改动补上
  useEffect(() => {
    return () => {
      if (pendingRef.current) writeNow();
    };
  }, [writeNow]);

  const restore = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      // 非受控字段的写回交给 applySnapshot：封面、地点、富文本编辑器这类
      // 把值存在自己组件内部的，必须换 key 重新初始化，不能直接改 DOM
      applySnapshotRef.current(parsed.state, parsed.fields ?? {});
      setDraft(null);
    } catch {
      window.localStorage.removeItem(key);
      setDraft(null);
    }
  }, [container, key]);

  const discard = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setDraft(null);
    pendingRef.current = false;
    touchedRef.current = false;
  }, [key]);

  const clear = useCallback(() => {
    stoppedRef.current = true;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setDraft(null);
    pendingRef.current = false;
    touchedRef.current = false;
  }, [key]);

  return { draft, restore, discard, clear };
}
