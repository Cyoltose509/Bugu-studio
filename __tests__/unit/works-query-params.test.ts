import { describe, expect, it } from "vitest";
import {
  isProjectType,
  normalizeWorksParams,
  parseDevelopYear,
  parseProjectTypes,
  PROJECT_TYPE_VALUES,
} from "@/lib/works/query-params";

/**
 * 回归：2026-11-25 的报错高峰是 `types=MINI_GAME`（枚举已收缩）直接进 Prisma，
 * Postgres 抛 22P02 让 /works 整页 500。这里锁住「认不得的值一律丢掉」。
 */
describe("parseProjectTypes", () => {
  it("丢掉数据库枚举里已不存在的类型", () => {
    expect(parseProjectTypes("MINI_GAME")).toEqual([]);
    expect(parseProjectTypes("MINI_GAME,OFFICIAL_RELEASE")).toEqual(["OFFICIAL_RELEASE"]);
    expect(parseProjectTypes("MINI_GAME,ANYTHING,123")).toEqual([]);
  });

  it("保留合法类型，去重并保持顺序", () => {
    expect(parseProjectTypes("TRIAL_DEMO,OFFICIAL_RELEASE,TRIAL_DEMO")).toEqual([
      "TRIAL_DEMO",
      "OFFICIAL_RELEASE",
    ]);
  });

  it("大小写与空白不影响判定", () => {
    expect(parseProjectTypes(" in_development , Official_Release ")).toEqual([
      "IN_DEVELOPMENT",
      "OFFICIAL_RELEASE",
    ]);
  });

  it("老链接的别名翻译到新值", () => {
    expect(parseProjectTypes("STEAM")).toEqual(["OFFICIAL_RELEASE"]);
    expect(parseProjectTypes("DEMO,ITCH")).toEqual(["TRIAL_DEMO"]);
  });

  it("空值不产生筛选条件", () => {
    expect(parseProjectTypes("")).toEqual([]);
    expect(parseProjectTypes(null)).toEqual([]);
    expect(parseProjectTypes(undefined)).toEqual([]);
    expect(parseProjectTypes(",,")).toEqual([]);
  });
});

describe("parseDevelopYear", () => {
  it("只接受四位整数年份", () => {
    expect(parseDevelopYear("2026")).toBe(2026);
    expect(parseDevelopYear("abc")).toBeNull();
    expect(parseDevelopYear("26")).toBeNull();
    expect(parseDevelopYear("1999")).toBeNull();
    expect(parseDevelopYear("2101")).toBeNull();
    expect(parseDevelopYear(null)).toBeNull();
  });
});

describe("normalizeWorksParams", () => {
  it("把非法 types 洗成 undefined，页面退化成不筛类型而不是 500", () => {
    expect(normalizeWorksParams({ types: "MINI_GAME" }).types).toBeUndefined();
    expect(normalizeWorksParams({ types: "MINI_GAME,TRIAL_DEMO" }).types).toBe("TRIAL_DEMO");
  });

  it("非法年份与未知排序一并丢掉，其余参数原样保留", () => {
    const out = normalizeWorksParams({
      types: "OFFICIAL_RELEASE",
      year: "20x6",
      sort: "whatever",
      tag: "unity",
      q: "裁缝",
    });
    expect(out).toEqual({
      types: "OFFICIAL_RELEASE",
      year: undefined,
      sort: undefined,
      tag: "unity",
      q: "裁缝",
    });
  });

  it("合法参数保持原样", () => {
    expect(normalizeWorksParams({ types: "TRIAL_DEMO", year: "2026", sort: "likes" })).toMatchObject({
      types: "TRIAL_DEMO",
      year: "2026",
      sort: "likes",
    });
  });
});

describe("PROJECT_TYPE_VALUES", () => {
  it("与作品类型三档一致（新增类型时同步这里和数据库枚举）", () => {
    expect([...PROJECT_TYPE_VALUES]).toEqual(["IN_DEVELOPMENT", "TRIAL_DEMO", "OFFICIAL_RELEASE"]);
    expect(isProjectType("MINI_GAME")).toBe(false);
    expect(isProjectType("OFFICIAL_RELEASE")).toBe(true);
    expect(isProjectType(null)).toBe(false);
  });
});
