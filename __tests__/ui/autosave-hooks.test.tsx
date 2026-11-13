/**
 * 自动保存与本地草稿两个 hook 的行为约定：
 * 挂载不写库、连续输入只发一次、原地抖动跳过、关闭前 flush；
 * 草稿只在改过之后落盘，恢复时把受控状态与非受控字段一起写回。
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { applyFormFields, useFormDraft } from "@/lib/hooks/use-form-draft";

function AutosaveHarness({
  save,
  delay = 100,
}: {
  save: (data: { text: string }) => Promise<unknown>;
  delay?: number;
}) {
  const [text, setText] = useState("");
  const { status, flush } = useAutosave({ data: { text }, save, delay, retryDelay: 0 });
  return (
    <div>
      <input aria-label="文本" value={text} onChange={(e) => setText(e.target.value)} />
      <span data-testid="status">{status}</span>
      <button type="button" onClick={() => void flush()}>
        立刻保存
      </button>
    </div>
  );
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("挂载时不打接口", async () => {
    const save = vi.fn(async (_data: { text: string }) => undefined);
    render(<AutosaveHarness save={save} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("连续输入只在停手后保存一次，且带最后一次的值", async () => {
    const save = vi.fn(async (_data: { text: string }) => undefined);
    render(<AutosaveHarness save={save} />);
    const input = screen.getByLabelText("文本");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByTestId("status").textContent).toBe("waiting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ text: "abc" });
    expect(screen.getByTestId("status").textContent).toBe("saved");
  });

  it("保存成功后签名更新，不会因为计时器重新走一遍而重复发送", async () => {
    const save = vi.fn(async (_data: { text: string }) => undefined);
    render(<AutosaveHarness save={save} />);
    const input = screen.getByLabelText("文本");

    fireEvent.change(input, { target: { value: "x" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush 立即写掉排队中的改动", async () => {
    const save = vi.fn(async (_data: { text: string }) => undefined);
    render(<AutosaveHarness save={save} delay={5000} />);
    fireEvent.change(screen.getByLabelText("文本"), { target: { value: "即刻" } });

    await act(async () => {
      fireEvent.click(screen.getByText("立刻保存"));
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ text: "即刻" });
  });

  it("保存失败时进入 error 状态并带出原因", async () => {
    const save = vi.fn(async () => {
      throw new Error("网络错误");
    });
    render(<AutosaveHarness save={save} />);
    fireEvent.change(screen.getByLabelText("文本"), { target: { value: "boom" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(screen.getByTestId("status").textContent).toBe("error");
  });
});

function DraftHarness({ storageKey }: { storageKey: string }) {
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const [title, setTitle] = useState("");
  const draft = useFormDraft({
    key: storageKey,
    container: formEl,
    watch: title,
    delay: 50,
    getSnapshot: () => ({ title }),
    applySnapshot: (state, fields) => {
      setTitle(state.title);
      applyFormFields(formEl, fields);
    },
  });

  return (
    <div>
      {draft.draft && (
        <button type="button" onClick={draft.restore}>
          恢复草稿
        </button>
      )}
      {draft.draft && (
        <button type="button" onClick={draft.discard}>
          丢弃
        </button>
      )}
      <form ref={setFormEl}>
        <input aria-label="标题" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input aria-label="地点" name="location" defaultValue="" />
        <input aria-label="附件" name="attachment" type="file" />
      </form>
    </div>
  );
}

describe("useFormDraft", () => {
  const KEY = "test:draft:v1";

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("只改过之后才写草稿，且跳过文件控件", async () => {
    render(<DraftHarness storageKey={KEY} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(window.localStorage.getItem(KEY)).toBeNull();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "社团历史" } });
    fireEvent.change(screen.getByLabelText("地点"), { target: { value: "武大" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    const stored = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    expect(stored.state.title).toBe("社团历史");
    expect(stored.fields.location).toBe("武大");
    expect(stored.fields).toHaveProperty("title");
    expect(stored.fields).not.toHaveProperty("attachment");
  });

  it("重开页面能找回草稿并写回受控与非受控字段", async () => {
    const first = render(<DraftHarness storageKey={KEY} />);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "2002 年成立" } });
    fireEvent.change(screen.getByLabelText("地点"), { target: { value: "工学部" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    first.unmount();

    render(<DraftHarness storageKey={KEY} />);
    const restore = screen.getByText("恢复草稿");
    await act(async () => {
      fireEvent.click(restore);
      await vi.advanceTimersByTimeAsync(10);
    });

    expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("2002 年成立");
    expect((screen.getByLabelText("地点") as HTMLInputElement).value).toBe("工学部");
  });

  it("丢弃后草稿消失，不再提示", async () => {
    const first = render(<DraftHarness storageKey={KEY} />);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "临时" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    first.unmount();

    render(<DraftHarness storageKey={KEY} />);
    await act(async () => {
      fireEvent.click(screen.getByText("丢弃"));
    });

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByText("恢复草稿")).toBeNull();
  });
});
