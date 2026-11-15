/**
 * 活动推荐（RECOMMENDATION）辅助函数防回归。
 * @vitest-environment happy-dom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { isRecoTag, recoTagLabel, RECO_TAGS } from "@/lib/activities/recommendation";
import ActivityTypeCorner from "@/components/activities/ActivityTypeCorner";

describe("活动推荐 recoTag", () => {
  it("预设细分类齐全：Game Jam / 黑客松 / 合作培训 / 其他", () => {
    expect([...RECO_TAGS]).toEqual(["GAME_JAM", "HACKATHON", "TRAINING", "OTHER"]);
  });

  it("isRecoTag 只认预设值", () => {
    expect(isRecoTag("GAME_JAM")).toBe(true);
    expect(isRecoTag("TRAINING")).toBe(true);
    expect(isRecoTag("game_jam")).toBe(false);
    expect(isRecoTag("")).toBe(false);
    expect(isRecoTag(null)).toBe(false);
    expect(isRecoTag(undefined)).toBe(false);
  });

  it("recoTagLabel 双语映射；未知/空值返回 null（不渲染标签）", () => {
    expect(recoTagLabel("cn", "GAME_JAM")).toBe("Game Jam");
    expect(recoTagLabel("cn", "HACKATHON")).toBe("黑客松");
    expect(recoTagLabel("en", "TRAINING")).toBe("Training");
    expect(recoTagLabel("cn", "WHATEVER")).toBeNull();
    expect(recoTagLabel("cn", null)).toBeNull();
    expect(recoTagLabel("en", undefined)).toBeNull();
  });

  it("ActivityTypeCorner 绶带支持推荐细分类样式渲染", () => {
    const { container, rerender } = render(React.createElement(ActivityTypeCorner, { type: "HACKATHON", label: "黑客松" }));
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("黑客松");
    expect(span?.className).toContain("rotate-[-45deg]");
    expect(span?.className).toContain("bg-[#C2447C]");

    rerender(React.createElement(ActivityTypeCorner, { type: "GAME_JAM", label: "Game Jam" }));
    const spanJam = container.querySelector("span");
    expect(spanJam?.textContent).toBe("Game Jam");
    expect(spanJam?.className).toContain("bg-brand-orange");
  });
});
