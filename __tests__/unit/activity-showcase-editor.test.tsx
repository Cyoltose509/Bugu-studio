// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ShowcaseEditor from "@/components/activities/showcase/ShowcaseEditor";

afterEach(cleanup);
const projects = [{ id: "a", slug: "a", title: "东方魔女夜市" }, { id: "b", slug: "b", title: "铅雨2" }];

it("adds, reorders and removes works in the parent form payload", () => {
  const { container } = render(<ShowcaseEditor activityId="event" projects={projects} initial={{ enabled: true, projectIds: ["a"], posters: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: /铅雨2.*添加/ }));
  fireEvent.click(screen.getByRole("button", { name: "上移作品：铅雨2" }));
  fireEvent.click(screen.getByRole("button", { name: "移除作品：东方魔女夜市" }));
  const payload = container.querySelector<HTMLInputElement>('input[name="showcaseJson"]');
  expect(JSON.parse(payload!.value)).toEqual({ enabled: true, projectIds: ["b"], posters: [] });
});

it("keeps poster removal in the parent form payload", () => {
  const { container } = render(<ShowcaseEditor activityId="event" projects={projects} initial={{ enabled: true, projectIds: ["a"], posters: [{ title: "海报", url: "/poster.webp" }] }} />);
  fireEvent.click(screen.getByRole("button", { name: "移除海报：海报" }));
  const payload = container.querySelector<HTMLInputElement>('input[name="showcaseJson"]');
  expect(JSON.parse(payload!.value)).toEqual({ enabled: true, projectIds: ["a"], posters: [] });
  expect(screen.getByRole("heading", { name: "活动海报（0/10）" })).toBeVisible();
  expect(screen.getByRole("button", { name: "移除作品：东方魔女夜市" })).toBeVisible();
});
