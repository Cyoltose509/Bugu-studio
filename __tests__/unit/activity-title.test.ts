import { describe, expect, it } from "vitest";
import { localizeActivityTitle } from "@/lib/activities/title";

describe("activity title localization", () => {
  it("translates standard Chinese date meeting titles", () => {
    expect(localizeActivityTitle("2026年11月1日 例会", "en")).toBe("Regular Meeting · November 1, 2026");
    expect(localizeActivityTitle("2026/11/1 例会", "en")).toBe("Regular Meeting · November 1, 2026");
  });

  it("translates a bare standard date or meeting label", () => {
    expect(localizeActivityTitle("2026年11月1日", "en")).toBe("November 1, 2026");
    expect(localizeActivityTitle("例会", "en")).toBe("Regular Meeting");
  });

  it("preserves custom titles and all Chinese titles", () => {
    expect(localizeActivityTitle("【百团招新后首次】2026/10/18 例会", "en")).toBe("【百团招新后首次】2026/10/18 例会");
    expect(localizeActivityTitle("2026年11月1日 例会", "cn")).toBe("2026年11月1日 例会");
  });
});
