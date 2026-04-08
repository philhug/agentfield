import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowsTable } from "@/components/WorkflowsTable";
import type { WorkflowSummary } from "@/types/workflows";

const state = vi.hoisted(() => ({
  vcStatuses: {} as Record<string, { has_vcs: boolean; verification_status: string }>,
  vcLoading: false,
  deleteWorkflows: vi.fn<(workflowIds: string[]) => Promise<Array<{ workflow_id: string; success: boolean; error_message?: string }>>>(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: `row-${index}`,
        start: index * estimateSize(),
        size: estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
  }),
}));

vi.mock("@/hooks/useVCVerification", () => ({
  useWorkflowVCStatuses: () => ({
    statuses: state.vcStatuses,
    loading: state.vcLoading,
  }),
}));

vi.mock("@/services/workflowsApi", () => ({
  deleteWorkflows: (workflowIds: string[]) => state.deleteWorkflows(workflowIds),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/data-formatters", () => ({
  formatDurationHumanReadable: (value: number) => `duration:${value}`,
  LiveElapsedDuration: ({ startedAt }: { startedAt: string }) => <span>live:{startedAt}</span>,
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  HoverCardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>loading</div>,
}));

vi.mock("@/components/ui/status-pill", () => ({
  StatusPill: ({ status }: { status: string }) => <span>Status:{status}</span>,
}));

vi.mock("@/components/vc/VerifiableCredentialBadge", () => ({
  VerifiableCredentialBadge: ({
    workflowId,
    status,
  }: {
    workflowId: string;
    status: string;
  }) => <span>{`VC:${workflowId}:${status}`}</span>,
}));

vi.mock("@/components/workflows/WorkflowDeleteDialog", () => ({
  WorkflowDeleteDialog: ({
    isOpen,
    workflows,
    onConfirm,
  }: {
    isOpen: boolean;
    workflows: Array<{ run_id: string }>;
    onConfirm: (workflowIds: string[]) => Promise<unknown>;
  }) =>
    isOpen ? (
      <div>
        <span>Delete dialog open</span>
        <button type="button" onClick={() => void onConfirm(workflows.map((workflow) => workflow.run_id))}>
          Confirm delete
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  CaretDown: () => <span>down</span>,
  CaretRight: () => <span>chevron</span>,
  CaretUp: () => <span>up</span>,
  ShieldCheck: () => <span>shield</span>,
  SpinnerGap: () => <span>spinner</span>,
  Trash: () => <span>trash</span>,
}));

function createWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    run_id: "run-1",
    workflow_id: "wf-1",
    root_execution_id: "exec-1",
    status: "running",
    root_reasoner: "planner",
    current_task: "Collect context",
    total_executions: 6,
    max_depth: 3,
    started_at: "2026-04-08T09:58:00Z",
    latest_activity: "2026-04-08T10:00:00Z",
    duration_ms: 1200,
    display_name: "Workflow Alpha",
    agent_id: "agent-1",
    agent_name: "Agent One",
    session_id: "session-abcdefgh123456",
    status_counts: { running: 1, succeeded: 4, failed: 1 },
    active_executions: 1,
    terminal: false,
    ...overrides,
  };
}

describe("WorkflowsTable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:00:00Z"));
    state.vcStatuses = {
      "wf-1": { has_vcs: true, verification_status: "verified" },
      "wf-2": { has_vcs: false, verification_status: "none" },
    };
    state.vcLoading = false;
    state.deleteWorkflows.mockReset();
    state.deleteWorkflows.mockResolvedValue([{ workflow_id: "run-1", success: true }]);
  });

  it("renders workflow headers, status details, and handles selection and deletion", async () => {
    const onSortChange = vi.fn();
    const onLoadMore = vi.fn();
    const onWorkflowClick = vi.fn();
    const onWorkflowsDeleted = vi.fn();
    const workflows = [
      createWorkflow(),
      createWorkflow({
        run_id: "run-2",
        workflow_id: "wf-2",
        display_name: "Workflow Beta",
        agent_name: "Agent Two",
        status: "succeeded",
        current_task: "Finalize",
        total_executions: 2,
        active_executions: 0,
        status_counts: { succeeded: 2 },
        duration_ms: undefined,
        latest_activity: "2026-04-08T09:00:00Z",
      }),
    ];

    render(
      <WorkflowsTable
        workflows={workflows}
        loading={false}
        hasMore={true}
        isFetchingMore={false}
        sortBy="latest_activity"
        sortOrder="desc"
        onSortChange={onSortChange}
        onLoadMore={onLoadMore}
        onWorkflowClick={onWorkflowClick}
        onWorkflowsDeleted={onWorkflowsDeleted}
      />
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Workflow")).toBeInTheDocument();
    expect(screen.getByText("Last Reasoner")).toBeInTheDocument();
    expect(screen.getByText("Nodes")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    expect(screen.getAllByText("Workflow Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Agent One").length).toBeGreaterThan(0);
    expect(screen.getByText("Status:running")).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByText("1 issues")).toBeInTheDocument();
    expect(screen.getByText("duration:1200")).toBeInTheDocument();
    expect(screen.getByText("VC:wf-1:verified")).toBeInTheDocument();
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Status"));
    expect(onSortChange).toHaveBeenCalledWith("status");
    expect(onLoadMore).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText("Workflow Alpha")[0]);
    expect(onWorkflowClick).toHaveBeenCalledWith(expect.objectContaining({ run_id: "run-1" }));

    fireEvent.click(screen.getByLabelText("Select workflow Workflow Alpha"));
    expect(screen.getByText("1 workflow selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Delete Selected"));
    expect(screen.getByText("Delete dialog open")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confirm delete"));
    await Promise.resolve();
    await Promise.resolve();

    expect(state.deleteWorkflows).toHaveBeenCalledWith(["run-1"]);
    expect(onWorkflowsDeleted).toHaveBeenCalledTimes(1);
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <WorkflowsTable
        workflows={[]}
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
      <WorkflowsTable
        workflows={[]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="status"
        sortOrder="asc"
        onSortChange={vi.fn()}
      />
    );

    expect(screen.getByText("No workflows yet")).toBeInTheDocument();
    expect(screen.getByText("Workflows will appear here as they execute.")).toBeInTheDocument();
  });
});
