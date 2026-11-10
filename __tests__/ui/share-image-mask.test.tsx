// @vitest-environment happy-dom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import ImageMaskControl from "@/components/share/ImageMaskControl";

afterEach(cleanup);

function EditableMask() {
  const [zero, setZero] = useState(38);
  const [full, setFull] = useState(100);
  return <ImageMaskControl zero={zero} full={full} en={false} onChange={(stop, value) => {
    if (stop === "maskZero") setZero(value);
    else setFull(value);
  }} />;
}

describe("share image opacity mask", () => {
  it("moves both triangle handles by keyboard, including across each other", () => {
    const { getByRole, getByText } = render(<EditableMask />);
    const zero = getByRole("slider", { name: "0% 不透明度位置" });
    const full = getByRole("slider", { name: "100% 不透明度位置" });
    fireEvent.keyDown(zero, { key: "Home" });
    fireEvent.keyDown(full, { key: "Home" });
    fireEvent.keyDown(zero, { key: "ArrowRight", shiftKey: true });
    expect(zero).toHaveAttribute("aria-valuenow", "10");
    expect(full).toHaveAttribute("aria-valuenow", "0");
    expect(getByText("x0")).toBeTruthy();
    expect(getByText("x1")).toBeTruthy();
  });

  it("maps a pointer drag to the track's horizontal position", () => {
    const { getByRole } = render(<EditableMask />);
    const zero = getByRole("slider", { name: "0% 不透明度位置" });
    const track = zero.parentElement!;
    track.getBoundingClientRect = () => ({ left: 20, width: 200 } as DOMRect);
    zero.setPointerCapture = () => {};
    zero.hasPointerCapture = () => true;
    fireEvent.pointerDown(zero, { pointerId: 1, clientX: 120 });
    expect(zero).toHaveAttribute("aria-valuenow", "50");
  });
});
