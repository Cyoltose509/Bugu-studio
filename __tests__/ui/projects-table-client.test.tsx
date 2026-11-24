// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProjectsTableClient from "@/components/admin/ProjectsTableClient";
import type { ProjectStatus } from "@prisma/client";

const mockRefresh = vi.fn();
const mockUpdateProjectStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/projects/actions", () => ({
  updateProjectStatus: (...args: any[]) => mockUpdateProjectStatus(...args),
}));

vi.mock("@/components/admin/DeleteProjectButton", () => ({
  default: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      删除
    </button>
  ),
}));

describe("ProjectsTableClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unlocks after approving a project instead of staying stuck in 处理中...", async () => {
    let resolveAction!: () => void;
    mockUpdateProjectStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <ProjectsTableClient
        projects={[
          {
            id: "p1",
            slug: "test-game",
            title: "末班突围",
            type: "TRIAL_DEMO",
            developYear: 2026,
            status: "PENDING" as ProjectStatus,
          },
        ]}
        currentStatus="PENDING"
        currentPage={1}
        totalPages={1}
        statusCounts={[{ status: "PENDING" as ProjectStatus, _count: { status: 1 } }]}
        allCount={1}
      />,
    );

    const approveBtn = screen.getByRole("button", { name: "通过" });
    fireEvent.click(approveBtn);

    expect(screen.getAllByRole("button", { name: "处理中..." }).length).toBeGreaterThan(0);
    expect(mockUpdateProjectStatus).toHaveBeenCalledWith("p1", "PUBLISHED");

    resolveAction();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "通过" })).not.toBeDisabled();
    });
  });
});
