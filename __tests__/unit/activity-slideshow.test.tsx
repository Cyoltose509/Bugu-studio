// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShowcaseSlides, type ShowcaseSlideshowProject } from "@/lib/activities/slideshow";
import GameSlideshow from "@/components/activities/showcase/GameSlideshow";

const projects: ShowcaseSlideshowProject[] = [
  { id: "a", slug: "a", title: "东方魔女夜市", description: "收集技能，挑战敌人。", tags: [{ slug: "rogue", name: "Roguelike" }],
    coverImage: "/a-cover.png", images: [{ url: "/a-cover.png" }, { url: "/a-shot.png", altText: "夜市战斗画面" }] },
  { id: "b", slug: "b", title: "铅雨2", description: "高速横版动作游戏", tags: [{ slug: "action", name: "动作" }], coverImage: "/b-cover.png", images: [] },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("game slideshow", () => {
  it("includes ordered screenshots, deduplicates within a work and keeps catalogue order", () => {
    expect(buildShowcaseSlides(projects).map(s => [s.src, s.project.id])).toEqual([
      ["/a-cover.png", "a"], ["/a-shot.png", "a"], ["/b-cover.png", "b"],
    ]);
    expect(buildShowcaseSlides([{ ...projects[0], coverImage: null, images: [] }])[0].src).toBe("/images/logo.png");
  });
  it("plays automatically and updates name, tags and description with each work", () => {
    render(<GameSlideshow projects={projects} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByAltText("夜市战斗画面")).toBeVisible();
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByRole("heading", { name: "铅雨2" })).toBeVisible();
    expect(screen.getByText("动作")).toBeVisible();
    expect(screen.getByText("高速横版动作游戏")).toBeVisible();
  });
  it("pauses, wraps using arrow keys and supports thumbnail selection", () => {
    render(<GameSlideshow projects={projects} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停轮播" }));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByAltText("东方魔女夜市 · 封面")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "铅雨2" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "浏览图片" }));
    fireEvent.click(screen.getByRole("button", { name: "查看 夜市战斗画面" }));
    expect(screen.getByAltText("夜市战斗画面")).toBeVisible();
    expect(screen.getByRole("button", { name: "继续播放" })).toBeVisible();
  });
  it("closes on Escape and restores scrolling and timers", () => {
    document.body.style.overflow = "auto";
    render(<GameSlideshow projects={projects} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("supports browsers that deny the native fullscreen request", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Fullscreen unavailable"));
    Object.defineProperty(HTMLDivElement.prototype, "requestFullscreen", { configurable: true, value: request });
    render(<GameSlideshow projects={projects} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" })); });
    expect(request).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    delete (HTMLDivElement.prototype as Partial<HTMLDivElement>).requestFullscreen;
  });
  it("hides playback for an empty catalogue", () => {
    render(<GameSlideshow projects={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps thumbnails out of navigation until the bottom drawer is hovered or opened", () => {
    render(<GameSlideshow projects={projects} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" }));
    const trigger = screen.getByRole("button", { name: "浏览图片" });
    const edge = screen.getByLabelText("底边图片浏览区");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "查看 夜市战斗画面" })).toBeNull();
    fireEvent.pointerEnter(edge, { pointerType: "mouse" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "查看 夜市战斗画面" })).toBeVisible();
    fireEvent.pointerLeave(edge, { pointerType: "mouse" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("uses the work's cover when a screenshot fails to load", () => {
    render(<GameSlideshow projects={projects} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏播放作品" }));
    fireEvent.click(screen.getByRole("button", { name: "下一张" }));
    fireEvent.error(screen.getByAltText("夜市战斗画面"));
    expect(screen.getByAltText("夜市战斗画面")).toHaveAttribute("src", "/a-cover.png");
  });
});
