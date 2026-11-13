import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAG_GROUP_ORDER,
  tagDisplayName,
  tagGroupDisplayName,
} from "@/lib/tags/tag-names";
import { t } from "@/lib/i18n/dict";

describe("同人 tag group and 东方Project tag", () => {
  it("DEFAULT_TAG_GROUP_ORDER 包含「同人」且排在「要素」后「活动&赛事」前", () => {
    expect(DEFAULT_TAG_GROUP_ORDER).toContain("同人");
    const elementIdx = DEFAULT_TAG_GROUP_ORDER.indexOf("要素");
    const fanworkIdx = DEFAULT_TAG_GROUP_ORDER.indexOf("同人");
    const eventIdx = DEFAULT_TAG_GROUP_ORDER.indexOf("活动&赛事");

    expect(fanworkIdx).toBeGreaterThan(elementIdx);
    expect(eventIdx).toBeGreaterThan(fanworkIdx);
  });

  it("tagGroupDisplayName 正确支持「同人」的中英文显示", () => {
    expect(tagGroupDisplayName("同人", "cn")).toBe("同人");
    expect(tagGroupDisplayName("同人", "en")).toBe("Fan-made");
  });

  it("dict.ts 包含 form.group.fanwork 国际化字典", () => {
    expect(t("cn", "form.group.fanwork")).toBe("同人");
    expect(t("en", "form.group.fanwork")).toBe("Fan-made");
  });

  it("tagDisplayName 正确支持「东方Project」的中英文显示及 legacy project slug 兼容", () => {
    expect(tagDisplayName("touhou", "东方Project", "cn")).toBe("东方Project");
    expect(tagDisplayName("touhou", "东方Project", "en")).toBe("Touhou Project");
    expect(tagDisplayName("project", "东方Project", "cn")).toBe("东方Project");
    expect(tagDisplayName("project", "东方Project", "en")).toBe("Touhou Project");
  });
});
