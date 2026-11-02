/**
 * 活动推荐（RECOMMENDATION）辅助函数防回归。
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { isRecoTag, recoTagLabel, RECO_TAGS } from "@/lib/activities/recommendation";

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
});
