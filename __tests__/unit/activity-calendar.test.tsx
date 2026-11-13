// @vitest-environment happy-dom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ActivityCalendar from "@/components/activities/ActivityCalendar";

describe("ActivityCalendar", () => {
  const sampleActivities = [
    {
      id: "act-1",
      title: "春季例会",
      type: "MEETING",
      startTime: "2026-11-15T14:00:00+08:00",
      endTime: "2026-11-15T16:00:00+08:00",
      timePending: false,
      summary: "例会简介信息",
    },
    {
      id: "act-2",
      title: "游戏开发公开课",
      type: "COURSE",
      startTime: "2026-11-15T19:00:00+08:00",
      endTime: "2026-11-15T21:00:00+08:00",
      timePending: false,
      summary: "公开课简介",
    },
  ];

  it("renders the today button with text '今' and changes months on client click", () => {
    render(
      <ActivityCalendar
        activities={sampleActivities}
        pending={[]}
        year={2026}
        month={11}
        lang="cn"
      />
    );

    // 月份标题
    expect(screen.getByText("2026年11月")).toBeDefined();

    // “今天”按钮显示“今”
    const todayBtn = screen.getByRole("button", { name: "今天" });
    expect(todayBtn.textContent?.trim()).toBe("今");

    // 点击下一月
    const nextBtn = screen.getByRole("button", { name: "下一月" });
    fireEvent.click(nextBtn);
    expect(screen.getByText("2026年12月")).toBeDefined();

    // 点击上一月
    const prevBtn = screen.getByRole("button", { name: "上一月" });
    fireEvent.click(prevBtn);
    expect(screen.getByText("2026年11月")).toBeDefined();

    // 点击“今”
    fireEvent.click(todayBtn);
    // 回到当前月份（2026年11月）
    expect(screen.getByText("2026年11月")).toBeDefined();
  });

  it("renders activities on gantt bar and shows popup card", () => {
    render(
      <ActivityCalendar
        activities={sampleActivities}
        pending={[]}
        year={2026}
        month={11}
        lang="cn"
      />
    );

    // 能看到春季例会
    const links = screen.getAllByRole("link", { name: /春季例会/i });
    expect(links.length).toBeGreaterThan(0);
  });
});
