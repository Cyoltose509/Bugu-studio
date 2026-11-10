// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import CourseScheduleMenu from "@/components/activities/course/CourseScheduleMenu";

const uploadImage = vi.hoisted(() => vi.fn(async () => ({ url: "/uploaded-schedule.png" })));
vi.mock("@/lib/utils/clientUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/clientUpload")>()),
  uploadImage,
}));

afterEach(() => { cleanup(); uploadImage.mockClear(); });

const image = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "schedule.png", { type: "image/png" });

function pasteImage(target: Element) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { items: [{ kind: "file", type: "image/png", getAsFile: () => image }] },
  });
  target.dispatchEvent(event);
  return event;
}

describe("课程表图片上传入口", () => {
  it("点击选择、拖拽高亮并上传、聚焦后粘贴均使用同一上传流程", async () => {
    const onImage = vi.fn();
    const { container, getByRole, getByText } = render(
      <CourseScheduleMenu image="" onImage={onImage} onAdd={vi.fn()} />,
    );
    fireEvent.click(getByRole("button", { name: /添加课程安排/ }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [image] } });
    await waitFor(() => expect(onImage).toHaveBeenCalledTimes(1));

    const zone = container.querySelector('[data-image-dropzone]')!;
    const dataTransfer = { types: ["Files"], files: [image], dropEffect: "none" };
    fireEvent.dragEnter(zone, { dataTransfer });
    expect(getByText("松开以上传课程表")).toBeTruthy();
    fireEvent.drop(zone, { dataTransfer });
    await waitFor(() => expect(onImage).toHaveBeenCalledTimes(2));
    expect(container.textContent).not.toContain("松开以上传课程表");

    (zone as HTMLElement).focus();
    expect(pasteImage(zone).defaultPrevented).toBe(true);
    await waitFor(() => expect(onImage).toHaveBeenCalledTimes(3));
    expect(uploadImage).toHaveBeenCalledTimes(3);
  });
});
