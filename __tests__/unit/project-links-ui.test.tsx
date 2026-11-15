// @vitest-environment happy-dom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProjectLinksEditor from "@/components/projects/ProjectLinksEditor";
import ProjectQuickLinks from "@/components/works/ProjectQuickLinks";

describe("ProjectLinksEditor", () => {
  it("renders empty state and allows quick selecting a preset", () => {
    const onChange = vi.fn();
    render(<ProjectLinksEditor links={[]} onChange={onChange} />);

    // Quick select buttons should be visible
    const steamQuickBtn = screen.getByRole("button", { name: "Steam" });
    expect(steamQuickBtn).toBeDefined();

    // Netdisk password box should not appear initially when no netdisk is selected
    expect(screen.queryByPlaceholderText("提取码")).toBeNull();

    // Click Baidu Netdisk quick select button
    const baiduQuickBtn = screen.getByRole("button", { name: "百度网盘" });
    fireEvent.click(baiduQuickBtn);

    // Now password box should appear!
    const pwdInput = screen.getByPlaceholderText("提取码");
    expect(pwdInput).toBeDefined();

    // Fill URL and password
    const urlInput = screen.getByPlaceholderText("https://...");
    fireEvent.change(urlInput, { target: { value: "https://pan.baidu.com/s/123456" } });
    fireEvent.change(pwdInput, { target: { value: "abcd" } });

    // Click Add
    const addBtn = screen.getByRole("button", { name: "添加" });
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { label: "百度网盘", url: "https://pan.baidu.com/s/123456?pwd=abcd" },
    ]);
  });

  it("automatically splits pasted URL containing pwd parameter into password box", () => {
    const onChange = vi.fn();
    render(<ProjectLinksEditor links={[]} onChange={onChange} />);

    // Select Lanzou
    const lanzouQuickBtn = screen.getByRole("button", { name: "蓝奏云" });
    fireEvent.click(lanzouQuickBtn);

    // Paste URL with ?pwd=9999
    const urlInput = screen.getByPlaceholderText("https://...");
    fireEvent.change(urlInput, {
      target: { value: "https://www.lanzoui.com/b12345?pwd=9999" },
    });

    // Password input should automatically be populated with "9999" and cleanUrl set
    const pwdInput = screen.getByPlaceholderText("提取码") as HTMLInputElement;
    expect(pwdInput.value).toBe("9999");
    expect((urlInput as HTMLInputElement).value).toBe("https://www.lanzoui.com/b12345");
  });

  it("opens grouped dropdown and selects itch.io", () => {
    const onChange = vi.fn();
    render(<ProjectLinksEditor links={[]} onChange={onChange} />);

    // Open dropdown
    const trigger = screen.getByText("请选择类型");
    fireEvent.click(trigger);

    // Groups should be rendered
    expect(screen.getByText("游戏平台")).toBeDefined();
    expect(screen.getByText("网盘下载")).toBeDefined();
    expect(screen.getByText("项目源码")).toBeDefined();
    expect(screen.getByText("视频网站")).toBeDefined();
    expect(screen.getAllByText("个人网站").length).toBeGreaterThanOrEqual(1);

    // Select itch.io inside the dropdown
    const itchOption = screen.getAllByText("itch.io").find((el) => el.tagName === "SPAN");
    expect(itchOption).toBeDefined();
    fireEvent.click(itchOption!.closest("button")!);

    // Now itch.io is selected, and netdisk password input should NOT be shown
    expect(screen.queryByPlaceholderText("提取码")).toBeNull();
  });
});

describe("ProjectQuickLinks", () => {
  it("renders external link and displays password on hover / popover", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(
      <ProjectQuickLinks
        links={[
          {
            label: "百度网盘",
            url: "https://pan.baidu.com/s/1mRT2HR4KpGqYZQ1nmes1-w?pwd=hrnx",
          },
        ]}
      />
    );

    // The link should render
    const linkEl = screen.getByRole("link", { name: /百度网盘/i });
    expect(linkEl).toBeDefined();
    expect(linkEl.getAttribute("href")).toBe(
      "https://pan.baidu.com/s/1mRT2HR4KpGqYZQ1nmes1-w?pwd=hrnx"
    );

    // Password badge / tooltip
    expect(screen.getByText("hrnx")).toBeDefined();
    const copyBtn = screen.getByRole("button", { name: "复制" });
    expect(copyBtn).toBeDefined();

    // Clicking copy should copy code without opening link
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hrnx");
  });
});
