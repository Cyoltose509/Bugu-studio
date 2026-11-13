// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import ShowcaseEditor from "@/components/activities/showcase/ShowcaseEditor";

const uploadImage = vi.hoisted(() => vi.fn(async () => ({
  url: "/poster.png", compressed: false, originalSize: 4, uploadedSize: 4,
})));
vi.mock("@/lib/utils/clientUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/clientUpload")>()),
  uploadImage,
}));
vi.mock("@/components/ui/CdnImage", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(() => { cleanup(); uploadImage.mockClear(); });

describe("大事件海报上传区", () => {
  it("默认收起表单，通过右上角加号添加海报，编辑键管理现有内容", async () => {
    const { container, getByRole, getByText } = render(
      <ShowcaseEditor activityId="preview" initial={{ enabled: true, projectIds: [], posters: [] }} projects={[]} />,
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[data-image-dropzone]')).not.toBeNull();
    fireEvent.click(getByRole("button", { name: "新增海报或试玩作品" }));
    fireEvent.click(getByRole("menuitem", { name: "＋ 添加海报" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.classList.contains("hidden")).toBe(true);
    const click = vi.spyOn(input, "click");
    fireEvent.click(getByRole("button", { name: /点击选择海报/ }));
    expect(click).toHaveBeenCalledOnce();

    const file = new File(["png"], "活动海报.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(file, { endpoint: "/api/upload/cover", type: "cover" }));
    await waitFor(() => expect(getByText("活动海报（1/10）")).toBeTruthy());
    await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeNull());
    fireEvent.click(getByRole("button", { name: "编辑海报与试玩目录" }));
    expect(getByRole("textbox", { name: /海报 1 标题/ })).toBeTruthy();
    expect(getByRole("button", { name: "完成编辑" })).toBeTruthy();
  });
});
