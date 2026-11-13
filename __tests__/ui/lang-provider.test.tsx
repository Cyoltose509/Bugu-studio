// @vitest-environment happy-dom
/**
 * LangProvider 取词健壮性测试
 *
 * 生产错误报告里曾出现多条 "Cannot read properties of undefined (reading 'en'/'cn')"：
 * 客户端 t() 直接 dict[key][lang]，一旦 key 未收录（新旧版本词条错位等）就整页崩溃。
 * 这里锁定「缺 key 时回退为 key 本身」的行为。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { dict } from "@/lib/i18n/dict";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

import { LangProvider, useLang } from "@/lib/i18n/LangProvider";

function Probe({ missingKey }: { missingKey?: boolean }) {
  const { t, lang } = useLang();
  if (missingKey) {
    return <span data-testid="out">{t("__missing.key__" as never)}</span>;
  }
  return <span data-testid="out">{t("brand.name")}</span>;
}

describe("LangProvider t()", () => {
  it("缺失词条时回退为 key 本身，而不是抛错", () => {
    render(
      <LangProvider initialLang="cn">
        <Probe missingKey />
      </LangProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("__missing.key__");
  });

  it("Provider 外使用 useLang 的兜底实现同样不崩", () => {
    render(<Probe missingKey />);
    expect(screen.getByTestId("out").textContent).toBe("__missing.key__");
  });

  it("正常词条仍按语言取值", () => {
    const { unmount } = render(
      <LangProvider initialLang="cn">
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe(dict["brand.name"].cn);
    unmount();

    render(
      <LangProvider initialLang="en">
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe(dict["brand.name"].en);
  });
});
