// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/admin/activities/showcase-actions", () => ({ saveActivityShowcase: mocks.save }));
import ShowcaseEditor from "@/components/activities/showcase/ShowcaseEditor";

beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue({ success: true }); });
afterEach(cleanup);
const projects = [{ id: "a", slug: "a", title: "东方魔女夜市" }, { id: "b", slug: "b", title: "铅雨2" }];

it("adds, reorders and removes works before persisting the final catalogue", async () => {
  render(<ShowcaseEditor activityId="event" projects={projects} initial={{ enabled: true, projectIds: ["a"], posters: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: /铅雨2.*添加/ }));
  fireEvent.click(screen.getByRole("button", { name: "上移作品：铅雨2" }));
  fireEvent.click(screen.getByRole("button", { name: "移除作品：东方魔女夜市" }));
  fireEvent.click(screen.getByRole("button", { name: "保存海报与试玩目录" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("event", { enabled: true, projectIds: ["b"], posters: [] }));
  expect(await screen.findByRole("status")).toHaveTextContent("已保存");
});

it("keeps administrator edits visible if saving fails", async () => {
  mocks.save.mockResolvedValue({ error: "保存失败，请稍后重试" });
  render(<ShowcaseEditor activityId="event" projects={projects} initial={{ enabled: true, projectIds: ["a"], posters: [{ title: "海报", url: "/poster.webp" }] }} />);
  fireEvent.click(screen.getByRole("button", { name: "移除海报：海报" }));
  fireEvent.click(screen.getByRole("button", { name: "保存海报与试玩目录" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
  expect(screen.getByRole("heading", { name: "活动海报（0/10）" })).toBeVisible();
  expect(screen.getByRole("button", { name: "移除作品：东方魔女夜市" })).toBeVisible();
});
