// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GradeYearPicker from "@/components/profile/GradeYearPicker";

describe("GradeYearPicker", () => {
  it("allows one-click selection of undergraduate enrollment year presets and custom year", () => {
    const onChange = vi.fn();
    const onSelectPreset = vi.fn();

    render(
      <GradeYearPicker
        value={null}
        onChange={onChange}
        onSelectPreset={onSelectPreset}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(6);

    fireEvent.click(radios[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "其他年份" }));
    const input = screen.getByPlaceholderText("例如 2020");
    fireEvent.change(input, { target: { value: "2019" } });
    expect(onChange).toHaveBeenCalledWith(2019);
  });
});
