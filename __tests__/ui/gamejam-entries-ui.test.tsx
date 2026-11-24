// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TrophyIcon from "@/components/icons/TrophyIcon";
import JamEntriesSection, {
  type JamSubmissionItem,
} from "@/components/activities/jam/JamEntriesSection";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  adminSetJamEntryTrophy: vi.fn().mockResolvedValue({ success: true }),
  adminUpdateJamRankings: vi.fn().mockResolvedValue({ success: true }),
  adminDeleteJamEntry: vi.fn().mockResolvedValue({ success: true }),
  adminSaveJamEntry: vi.fn().mockResolvedValue({ success: true, submissionId: "new-1" }),
  adminLinkJamSubmissionProject: vi.fn().mockResolvedValue({ success: true }),
  searchWorksForJamLink: vi.fn().mockResolvedValue({ projects: [] }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/i18n/LangProvider", () => ({
  useLang: () => ({ lang: "cn", t: (k: string) => k }),
}));

vi.mock("@/lib/actions/submissions", () => ({
  adminSetJamEntryTrophy: mocks.adminSetJamEntryTrophy,
  adminUpdateJamRankings: mocks.adminUpdateJamRankings,
  adminDeleteJamEntry: mocks.adminDeleteJamEntry,
  adminSaveJamEntry: mocks.adminSaveJamEntry,
  adminLinkJamSubmissionProject: mocks.adminLinkJamSubmissionProject,
  searchWorksForJamLink: mocks.searchWorksForJamLink,
  submitToWorksLibrary: vi.fn().mockResolvedValue({ success: true }),
}));

const sampleEntries: JamSubmissionItem[] = [
  {
    id: "entry-unranked",
    title: "未排序太空漫游",
    files: ["https://cdn.example.com/shot1.webp"],
    metadata: {
      coverImage: "https://cdn.example.com/cover1.webp",
      sortOrder: null,
      trophy: null,
      isAdminPlaceholder: true,
      creators: [{ name: "小张", roles: ["程序", "策划"] }],
    },
  },
  {
    id: "entry-ranked-2",
    title: "星际信号",
    files: [],
    projectId: "proj-1",
    project: {
      id: "proj-1",
      slug: "stellar-signal",
      title: "星际信号正式版",
    },
    metadata: {
      sortOrder: 1,
      trophy: "SILVER",
      isAdminPlaceholder: true,
      creators: [{ name: "小李", roles: ["美术"] }],
    },
  },
  {
    id: "entry-ranked-1",
    title: "时间回环",
    files: ["https://cdn.example.com/s1.webp", "https://cdn.example.com/s2.webp"],
    team: {
      id: "team-1",
      name: "重力蛙小队",
    },
    metadata: {
      sortOrder: 0,
      trophy: "GOLD",
      isAdminPlaceholder: false,
      creators: [{ name: "小王", roles: ["全栈"] }],
    },
  },
];

describe("Game Jam UI: TrophyIcon & JamEntriesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders distinct colored SVG trophy icons for gold, silver, and bronze", () => {
    const { container } = render(
      <div>
        <TrophyIcon variant="gold" title="金奖" />
        <TrophyIcon variant="silver" title="银奖" />
        <TrophyIcon variant="bronze" title="铜奖" />
      </div>
    );

    expect(container.querySelector('[data-trophy-variant="gold"]')).toBeTruthy();
    expect(container.querySelector('[data-trophy-variant="silver"]')).toBeTruthy();
    expect(container.querySelector('[data-trophy-variant="bronze"]')).toBeTruthy();
  });

  it("renders visitor view with trophy entries pinned to top, auto-numbered ranks, and linked works", () => {
    render(
      <JamEntriesSection
        activityId="act-jam-2026"
        submissions={sampleEntries}
        isAdmin={false}
      />
    );

    const visitorList = screen.getByTestId("jam-visitor-list");
    const cards = visitorList.querySelectorAll('[data-testid^="jam-entry-card-"]');
    expect(cards.length).toBe(3);

    // 金奖 #1 在最前，银奖 #2 其次，未排序在后
    expect(cards[0].getAttribute("data-testid")).toBe("jam-entry-card-entry-ranked-1");
    expect(cards[1].getAttribute("data-testid")).toBe("jam-entry-card-entry-ranked-2");
    expect(cards[2].getAttribute("data-testid")).toBe("jam-entry-card-entry-unranked");

    expect(screen.getByTestId("jam-rank-badge-entry-ranked-1").textContent).toBe("#1");
    expect(screen.getByTestId("jam-rank-badge-entry-ranked-2").textContent).toBe("#2");
    expect(screen.queryByTestId("jam-rank-badge-entry-unranked")).toBeNull();

    // 卡片左下角展示队名
    expect(screen.getByText("重力蛙小队")).toBeTruthy();

    // 关联作品库链接展示
    const workLinks = screen.getAllByRole("link", { name: /星际信号|作品库详情/ });
    expect(workLinks.some((a) => a.getAttribute("href") === "/works/stellar-signal")).toBe(true);
  });

  it("renders admin view with '+' button, ranked/unranked zones, and allows moving items to ranked zone", () => {
    render(
      <JamEntriesSection
        activityId="act-jam-2026"
        submissions={sampleEntries}
        isAdmin={true}
      />
    );

    // 管理员可见 "+" 添加按钮
    const addBtn = screen.getByRole("button", { name: "添加参赛作品条目" });
    expect(addBtn).toBeTruthy();

    // 排序栏与未排序栏均存在
    const rankedZone = screen.getByTestId("jam-ranked-zone");
    const unrankedZone = screen.getByTestId("jam-unranked-zone");
    expect(rankedZone.querySelectorAll('[data-testid^="jam-entry-card-"]').length).toBe(2);
    expect(unrankedZone.querySelectorAll('[data-testid^="jam-entry-card-"]').length).toBe(1);

    // 点击 "+ 加入排序栏" 将未排序条目移入排序栏并自动标为 #3
    const joinRankedBtn = screen.getByRole("button", { name: "+ 加入排序栏" });
    fireEvent.click(joinRankedBtn);

    expect(mocks.adminUpdateJamRankings).toHaveBeenCalledWith("act-jam-2026", {
      rankedIds: ["entry-ranked-1", "entry-ranked-2", "entry-unranked"],
      unrankedIds: [],
    });
  });
});
