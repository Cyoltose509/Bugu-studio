// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ImageDropZone } from "@/components/ui/ImageDropZone";

afterEach(() => cleanup());

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "pasted.png", { type: "image/png" });

/** 构造带 clipboardData 的 paste 事件（happy-dom 的 ClipboardEvent 不带数据） */
function firePaste(target: Document | Element, file: File | null) {
  const dt: any = {
    items: file
      ? [{ kind: "file", type: file.type, getAsFile: () => file }]
      : [{ kind: "string", type: "text/plain" }],
    files: file ? [file] : [],
  };
  const evt = new Event("paste", { bubbles: true, cancelable: true }) as any;
  Object.defineProperty(evt, "clipboardData", { value: dt });
  target.dispatchEvent(evt);
  return evt;
}

/** onFile 经 assertImageFile 的微任务链异步回调——排空微任务后再断言 */
async function tick() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function Harness({ onFile, onInvalid, globalPaste, disabled, label }: any) {
  return (
    <div data-label={label}>
      <ImageDropZone onFile={onFile} onInvalid={onInvalid} globalPaste={globalPaste} disabled={disabled}>
        <input aria-label={`${label}-input`} />
      </ImageDropZone>
    </div>
  );
}

describe("ImageDropZone 粘贴支持", () => {
  it("globalPaste：页面任意处粘贴图片触发 onFile", async () => {
    const onFile = vi.fn();
    render(<Harness onFile={onFile} globalPaste label="zone" />);
    const evt = firePaste(document, PNG);
    expect(evt.defaultPrevented).toBe(true);
    await tick();
    expect(onFile).toHaveBeenCalledWith(PNG);
  });

  it("非 globalPaste：焦点在区域内才生效", async () => {
    const onFile = vi.fn();
    const { container, getByLabelText } = render(<Harness onFile={onFile} label="zone" />);
    // 焦点在区域外 → 不接管
    const outside = firePaste(document, PNG);
    expect(outside.defaultPrevented).toBe(false);
    await tick();
    expect(onFile).not.toHaveBeenCalled();
    // 焦点进入区域内 → 生效
    getByLabelText("zone-input").focus();
    const zone = container.querySelector('[data-image-dropzone]')!;
    const inside = firePaste(zone, PNG);
    expect(inside.defaultPrevented).toBe(true);
    await tick();
    expect(onFile).toHaveBeenCalledWith(PNG);
  });

  it("跨区域让位：焦点在某上传区内时，globalPaste 区不抢", async () => {
    const scopedFile = vi.fn();
    const globalFile = vi.fn();
    render(
      <>
        <Harness onFile={scopedFile} label="scoped" />
        <Harness onFile={globalFile} globalPaste label="global" />
      </>,
    );
    const scopedZone = document.querySelector(`[data-label="scoped"] [data-image-dropzone]`) as HTMLElement;
    scopedZone.focus();
    firePaste(scopedZone, PNG);
    await tick();
    expect(scopedFile).toHaveBeenCalledWith(PNG);
    expect(globalFile).not.toHaveBeenCalled();
  });

  it("纯文本粘贴不接管、不取消默认行为", async () => {
    const onFile = vi.fn();
    render(<Harness onFile={onFile} globalPaste label="zone" />);
    const evt = firePaste(document, null);
    expect(evt.defaultPrevented).toBe(false);
    await tick();
    expect(onFile).not.toHaveBeenCalled();
  });

  it("disabled 时不接管粘贴", async () => {
    const onFile = vi.fn();
    render(<Harness onFile={onFile} globalPaste disabled label="zone" />);
    const evt = firePaste(document, PNG);
    await tick();
    expect(evt.defaultPrevented).toBe(false);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("非图片文件经 assertImageFile 校验后走 onInvalid", async () => {
    const onFile = vi.fn();
    const onInvalid = vi.fn();
    render(<Harness onFile={onFile} onInvalid={onInvalid} globalPaste label="zone" />);
    firePaste(document, new File(["x"], "a.heic", { type: "image/heic" }));
    await tick();
    expect(onFile).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalled();
  });
});
