// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PosterGallery from "@/components/activities/showcase/PosterGallery";

vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: any) => <img {...props} /> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps the lightbox valid when refreshed posters remove the selected item", () => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  const posters = [{ title: "社团介绍", url: "/club.webp" }, { title: "活动地图", url: "/event.webp" }];
  const { rerender } = render(<PosterGallery posters={posters} />);
  fireEvent.click(screen.getByRole("button", { name: "放大查看：活动地图" }));
  expect(screen.getByRole("dialog", { name: "活动地图" })).toBeVisible();
  rerender(<PosterGallery posters={[posters[0]]} />);
  expect(screen.getByRole("dialog", { name: "社团介绍" })).toBeVisible();
  expect(screen.getByRole("link", { name: "打开完整海报" })).toHaveAttribute("href", "/club.webp");
  rerender(<PosterGallery posters={[]} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
