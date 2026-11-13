/**
 * 活动时间选择（ActivityTimeChoice + ClockPicker）—— jsdom。
 * 覆盖：日期框右侧时钟按钮的时/分面板、hidden 提交完整时分、
 * 例会「自动推算」填入 14:30–17:30 并锁定、点日期框退回指定日期且保留值。
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import ActivityTimeChoice, { type AutoScheduleRange } from "@/components/activities/ActivityTimeChoice";

function Harness({
  initialStart = "2026-11-27",
  initialEnd = "2026-11-27",
  onAutoSchedule,
}: {
  initialStart?: string;
  initialEnd?: string;
  onAutoSchedule?: () => Promise<AutoScheduleRange | null>;
}) {
  const [start, setStart] = React.useState(initialStart);
  const [end, setEnd] = React.useState(initialEnd);
  const [pending, setPending] = React.useState(false);
  return (
    <>
      <ActivityTimeChoice
        pending={pending}
        onPendingChange={setPending}
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        fieldClass="field"
        labelClass="label"
        onAutoSchedule={onAutoSchedule}
      />
      <span data-testid="start">{start}</span>
      <span data-testid="end">{end}</span>
    </>
  );
}

function hiddenValue(name: string) {
  return (document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement | null)?.value;
}

describe("ActivityTimeChoice", () => {
  it("点时钟按钮弹出时/分面板，选中后完整时分写入 hidden，日期框只显示日期", () => {
    render(React.createElement(Harness));

    expect(screen.queryByText("完成")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /设置开始时间/ }));
    expect(screen.getByText("完成")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "09" }));
    expect(screen.getByTestId("start").textContent).toBe("2026-11-27T09:30");

    fireEvent.click(screen.getByRole("button", { name: "45" }));
    expect(screen.getByTestId("start").textContent).toBe("2026-11-27T09:45");

    // hidden 带时分给后端，date input 只拿日期
    expect(hiddenValue("startTime")).toBe("2026-11-27T09:45");
    expect((document.getElementById("startTime") as HTMLInputElement).value).toBe("2026-11-27");
  });

  it("清除时间后回到纯日期", () => {
    render(React.createElement(Harness, { initialStart: "2026-11-27T09:45" }));
    fireEvent.click(screen.getByRole("button", { name: /设置开始时间/ }));
    fireEvent.click(screen.getByText("清除"));
    expect(screen.getByTestId("start").textContent).toBe("2026-11-27");
  });

  it("例会显示「自动推算」，点击填入两周后的 14:30–17:30 并锁定", async () => {
    const onAutoSchedule = vi.fn(async () => ({
      start: "2026-12-11T14:30",
      end: "2026-12-11T17:30",
    }));
    render(React.createElement(Harness, { onAutoSchedule }));

    const autoBtn = screen.getByRole("button", { name: "自动推算" });
    fireEvent.click(autoBtn);

    await screen.findByText(/按上一场例会 \+ 2 周推算/);
    expect(onAutoSchedule).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("start").textContent).toBe("2026-12-11T14:30");
    expect(screen.getByTestId("end").textContent).toBe("2026-12-11T17:30");
    expect(autoBtn.getAttribute("aria-pressed")).toBe("true");

    // 锁定态：日期框不接事件，时钟按钮禁用
    const startInput = document.getElementById("startTime") as HTMLInputElement;
    expect(startInput.className).toContain("pointer-events-none");
    expect((screen.getByRole("button", { name: /设置开始时间/ }) as HTMLButtonElement).disabled).toBe(true);

    // 点日期框所在区域 → 回到指定日期，已填值保留
    fireEvent.click(startInput.parentElement as HTMLElement);
    expect(autoBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("start").textContent).toBe("2026-12-11T14:30");
    expect((document.getElementById("startTime") as HTMLInputElement).className).not.toContain("pointer-events-none");
  });

  it("没有历史例会时提示手动指定，不切换模式", async () => {
    render(React.createElement(Harness, { onAutoSchedule: async () => null }));
    fireEvent.click(screen.getByRole("button", { name: "自动推算" }));
    await screen.findByText("还没有可参考的例会，请手动指定日期");
    expect(screen.getByRole("button", { name: "指定日期" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("不传 onAutoSchedule 时不出现「自动推算」（编辑页等其他场景）", () => {
    render(React.createElement(Harness));
    expect(screen.queryByRole("button", { name: "自动推算" })).toBeNull();
    expect(screen.getByRole("button", { name: "指定日期" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "待定" })).toBeTruthy();
  });
});
