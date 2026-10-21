// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShowcaseAuthorPicker from "@/components/activities/course/ShowcaseAuthorPicker";

afterEach(cleanup);

describe("course person picker", () => {
  it("shows existing people on open and selects a site user", () => {
    const onChange = vi.fn();
    render(<ShowcaseAuthorPicker personLabel="讲师" name="" userId={null} options={[{ id: "user-1", name: "社内讲师" }]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "添加讲师" }));
    fireEvent.click(screen.getByRole("button", { name: "社内讲师" }));

    expect(onChange).toHaveBeenCalledWith({ authorName: "社内讲师", authorUserId: "user-1" });
  });

  it("accepts an external instructor name", () => {
    const onChange = vi.fn();
    render(<ShowcaseAuthorPicker personLabel="讲师" name="" userId={null} options={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "添加讲师" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索或输入讲师" }), { target: { value: "社外讲师" } });
    fireEvent.click(screen.getByRole("button", { name: "添加「社外讲师」" }));

    expect(onChange).toHaveBeenCalledWith({ authorName: "社外讲师", authorUserId: null });
  });
});
