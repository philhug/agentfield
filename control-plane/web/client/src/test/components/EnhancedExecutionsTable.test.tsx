import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnhancedExecutionsTable } from "@/components/EnhancedExecutionsTable";

const state = vi.hoisted(() => ({
  useExecutionVCStatus: vi.fn(),
  useVirtualizer: vi.fn(),
}));

vi.mock("@/hooks/useVCVerification", () => ({
  useExecutionVCStatus: (executionId: string) => state.useExecutionVCStatus(executionId),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: unknown) => state.useVirtualizer(options),
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  CaretDown: () => <span>caret-down</span>,
  CaretRight: () => <span>caret-right</span>,
  CaretUp: () => <span>caret-up</span>,
  ShieldCheck: () => <span>shield-check</span>,
  SpinnerGap: () => <span>spinner</span>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/data-formatters", () => ({
  formatDurationHumanReadable: (durationMs: number) => `${Math.round(durationMs / 1000)}s`,
  LiveElapsedDuration: ({ startedAt }: { startedAt: string }) => <span>live {startedAt}</span>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading</div>,
}));

vi.mock("@/components/ui/status-pill", () => ({
  StatusPill: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/vc/VerifiableCredentialBadge", () => ({
  VerifiableCredentialBadge: ({
    hasVC,
    status,
    executionId,
  }: {
    hasVC: boolean;
    status: string;
    executionId?: string;
  }) => (
    <span>
      vc:{hasVC ? "yes" : "no"}:{status}:{executionId ?? "none"}
    </span>
  ),
}));

function buildVirtualizer(items: Array<{ index: number; key: string; start: number; size: number }>) {
  return {
    getVirtualItems: () => items,
    getTotalSize: () => 400,
  };
}

function buildExecution(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: "exec-12345678",
    status: "succeeded",
    task_name: "planner",
    agent_name: "agent",
    relative_time: "2m ago",
    duration_ms: 5000,
    started_at: "2026-04-08T00:00:00Z",
    duration_display: "5s",
    ...overrides,
  };
}

describe("EnhancedExecutionsTable", () => {
  beforeEach(() => {
    state.useExecutionVCStatus.mockReset();
    state.useVirtualizer.mockReset();
    state.useExecutionVCStatus.mockReturnValue({
      vcStatus: { has_vc: true, status: "verified" },
    });
    state.useVirtualizer.mockReturnValue(
      buildVirtualizer([{ index: 0, key: "0", start: 0, size: 52 }])
    );
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <EnhancedExecutionsTable
        executions={[]}
        loading={true}
        hasMore={false}
        isFetchingMore={false}
        sortBy="status"
        sortOrder="asc"
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getAllByText("loading").length).toBeGreaterThan(0);

    rerender(
      <EnhancedExecutionsTable
        executions={[]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="status"
        sortOrder="asc"
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
  });

  it("renders rows, sorts, clicks rows, and loads more when reaching the last item", () => {
    const onSortChange = vi.fn();
    const onExecutionClick = vi.fn();
    const onLoadMore = vi.fn();
    const execution = buildExecution();

    state.useVirtualizer.mockReturnValue(
      buildVirtualizer([{ index: 0, key: "0", start: 0, size: 52 }])
    );

    render(
      <EnhancedExecutionsTable
        executions={[execution as never]}
        loading={false}
        hasMore={true}
        isFetchingMore={false}
        sortBy="status"
        sortOrder="asc"
        onSortChange={onSortChange}
        onLoadMore={onLoadMore}
        onExecutionClick={onExecutionClick}
      />
    );

    expect(screen.getByText("planner")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.getByText("2m ago")).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("vc:yes:verified:exec-12345678")).toBeInTheDocument();
    expect(screen.getByText("…12345678")).toBeInTheDocument();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /status/i }));
    expect(onSortChange).toHaveBeenCalledWith("status");

    fireEvent.mouseEnter(screen.getByText("planner").closest("div[class*='grid']") ?? screen.getByText("planner"));
    fireEvent.click(screen.getByText("planner"));
    expect(onExecutionClick).toHaveBeenCalledWith(execution);
  });

  it("renders running duration fallback and fetching-more footer", () => {
    state.useExecutionVCStatus.mockReturnValue({ vcStatus: null });
    state.useVirtualizer.mockReturnValue(
      buildVirtualizer([{ index: 0, key: "0", start: 0, size: 52 }])
    );

    render(
      <EnhancedExecutionsTable
        executions={[
          buildExecution({
            execution_id: "exec-running",
            status: "running",
            duration_ms: 0,
          }) as never,
        ]}
        loading={false}
        hasMore={false}
        isFetchingMore={true}
        sortBy="when"
        sortOrder="desc"
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByText("live 2026-04-08T00:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("vc:no:none:none")).toBeInTheDocument();
    expect(screen.getByText("Loading more executions…")).toBeInTheDocument();
  });
});
