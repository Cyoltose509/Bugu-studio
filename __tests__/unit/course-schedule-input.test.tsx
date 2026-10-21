// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseScheduleInput from "@/components/activities/course/CourseScheduleInput";

afterEach(cleanup);

function openPicker(label: string) {
  const trigger = screen.getByRole("button", { name: label });
  fireEvent.click(trigger);
  return trigger;
}

describe("CourseScheduleInput", () => {
  it("opens the date calendar and emits the chosen day before closing", () => {
    const onChange = vi.fn();
    render(<CourseScheduleInput label="开始日期" value="2026-10-01" onChange={onChange} kind="date" />);

    const trigger = openPicker("开始日期");
    expect(screen.getByRole("group", { name: "开始日期选择" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "2026-10-21" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-10-21");
    expect(screen.queryByRole("group", { name: "开始日期选择" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("shows an error for an invalid time and keeps the picker open without emitting", () => {
    const onChange = vi.fn();
    render(<CourseScheduleInput label="开始时间" value="" onChange={onChange} kind="time" />);

    openPicker("开始时间");
    fireEvent.change(screen.getByRole("textbox", { name: "输入时分" }), { target: { value: "25:88" } });
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请输入有效时间，如 19:00");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "开始时间选择" })).toBeVisible();
  });

  it("confirms a valid time, emits it and closes", () => {
    const onChange = vi.fn();
    render(<CourseScheduleInput label="开始时间" value="" onChange={onChange} kind="time" />);

    const trigger = openPicker("开始时间");
    fireEvent.change(screen.getByRole("textbox", { name: "输入时分" }), { target: { value: "19:45" } });
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("19:45");
    expect(screen.queryByRole("group", { name: "开始时间选择" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes the date calendar on Escape and restores focus to the trigger", () => {
    const onChange = vi.fn();
    render(<CourseScheduleInput label="开始日期" value="" onChange={onChange} kind="date" />);

    const trigger = openPicker("开始日期");
    const calendar = screen.getByRole("group", { name: "开始日期选择" });

    fireEvent.keyDown(calendar, { key: "Escape" });

    expect(screen.queryByRole("group", { name: "开始日期选择" })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
