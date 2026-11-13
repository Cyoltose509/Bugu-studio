/**
 * 隐私设置页 —— 「修改密码」默认收起、点击卡片头展开/收起；
 * 「确认新密码」仅在已输入新密码时出现，清空新密码时连带收起并清空。
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn(async () => undefined) }));
vi.mock("@/lib/i18n/LangProvider", () => ({ useLang: () => ({ lang: "cn" }) }));

import PrivacyPage from "@/app/profile/privacy/page";

describe("隐私设置页", () => {
  it("修改密码默认收起，点击卡片头展开，再次点击收起", () => {
    render(React.createElement(PrivacyPage));
    // 收起态：没有密码输入框
    expect(screen.queryByLabelText("当前密码")).toBeNull();
    const toggle = screen.getByRole("button", { name: /修改密码/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("当前密码")).toBeTruthy();
    expect(screen.getByLabelText("新密码")).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("当前密码")).toBeNull();
  });

  it("确认新密码仅在输入新密码后展开；清空新密码时收起且残留值被清掉", () => {
    render(React.createElement(PrivacyPage));
    fireEvent.click(screen.getByRole("button", { name: /修改密码/ }));

    // 未输入新密码：确认框不出现
    expect(screen.queryByLabelText("确认新密码")).toBeNull();

    const newPwd = screen.getByLabelText("新密码") as HTMLInputElement;
    fireEvent.change(newPwd, { target: { value: "abcdefgh" } });
    const confirm = screen.getByLabelText("确认新密码") as HTMLInputElement;
    fireEvent.change(confirm, { target: { value: "abcdefgh" } });
    expect(confirm.value).toBe("abcdefgh");

    // 清空新密码 → 确认框收起；再次输入时确认框是空的（残留已清）
    fireEvent.change(newPwd, { target: { value: "" } });
    expect(screen.queryByLabelText("确认新密码")).toBeNull();
    fireEvent.change(newPwd, { target: { value: "x" } });
    expect((screen.getByLabelText("确认新密码") as HTMLInputElement).value).toBe("");
  });
});
