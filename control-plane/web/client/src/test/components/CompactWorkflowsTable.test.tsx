import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompactWorkflowsTable } from "@/components/CompactWorkflowsTable";
import type { WorkflowSummary } from "@/types/workflows";

const state = vi.hoisted(() => ({
  vcStatuses: {} as Record<string, { has_vcs: boolean; verification_status: string }>,
  vcLoading: false,
  deleteWorkflows: vi.fn<(workflowIds: string[]) => Promise<Array<{ workflow_id: string; success: boolean; error_message?: string }>>>(),
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
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
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

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>loading</div>,
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  HoverCardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/status/UnifiedStatusIndicator", () => ({
  default: ({ status }: { status: string }) => <span>{`indicator:${status}`}</span>,
}));

vi.mock("@/components/vc/VerifiableCredentialBadge", () => ({
  VerifiableCredentialBadge: ({
    workflowId,
    status,
  }: {
    workflowId: string;
    status: string;
  }) => <span>{`vc:${workflowId}:${status}`}</span>,
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
        <span>Compact delete dialog</span>
        <button type="button" onClick={() => void onConfirm(workflows.map((workflow) => workflow.run_id))}>
          Confirm compact delete
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/FastTableSearch", () => ({
  FastTableSearch: ({
    onSearch,
    resultCount,
    totalCount,
  }: {
    onSearch: (query: string) => void;
    resultCount: number;
    totalCount: number;
  }) => (
    <div>
      <input aria-label="workflow-search" onChange={(event) => onSearch(event.target.value)} />
      <span>{`results:${resultCount}/${totalCount}`}</span>
    </div>
  ),
  createSearchMatcher: (fields: string[]) => (item: Record<string, unknown>, query: string) =>
    fields.some((field) => String(item[field] ?? "").toLowerCase().includes(query.toLowerCase())),
}));

vi.mock("@/components/ui/CompactTable", () => ({
  CompactTable: ({
    data,
    columns,
    onRowClick,
    onSortChange,
    emptyState,
  }: {
    data: WorkflowSummary[];
    columns: Array<{
      key: string;
      header: React.ReactNode;
      sortable?: boolean;
      render: (item: WorkflowSummary, index: number) => React.ReactNode;
    }>;
    onRowClick?: (item: WorkflowSummary) => void;
    onSortChange: (field: string) => void;
    emptyState?: {
      title: string;
      description: string;
      action?: { label: string; onClick: () => void };
      secondaryAction?: { label: string; onClick: () => void };
    };
  }) =>
    data.length === 0 ? (
      <div>
        <div>{emptyState?.title}</div>
        <div>{emptyState?.description}</div>
        {emptyState?.action ? (
          <button type="button" onClick={emptyState.action.onClick}>
            {emptyState.action.label}
          </button>
        ) : null}
        {emptyState?.secondaryAction ? (
          <button type="button" onClick={emptyState.secondaryAction.onClick}>
            {emptyState.secondaryAction.label}
          </button>
        ) : null}
      </div>
    ) : (
      <div>
        <div>
          {columns.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => column.sortable && onSortChange(column.key)}
            >
              {typeof column.header === "string" ? column.header : column.key}
            </button>
          ))}
        </div>
        {data.map((item, index) => (
          <div key={item.run_id} onClick={() => onRowClick?.(item)}>
            {columns.map((column) => (
              <div key={column.key}>{column.render(item, index)}</div>
            ))}
          </div>
        ))}
      </div>
    ),
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  Renew: () => <span>renew</span>,
  Security: ({ className }: { className?: string }) => <span className={className}>security</span>,
  TrashCan: () => <span>trash</span>,
}));

vi.mock("@/components/ui/data-formatters", () => ({
  formatDurationHumanReadable: (value: number) => `duration:${value}`,
  LiveElapsedDuration: ({ startedAt }: { startedAt: string }) => <span>live:{startedAt}</span>,
}));

function createWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    run_id: "run-1",
    workflow_id: "wf-1",
    root_execution_id: "exec-1",
    status: "running",
    root_reasoner: "planner",
    current_task: "Collect context",
    total_executions: 1000,
    max_depth: 3,
    started_at: "2026-04-08T09:58:00Z",
    latest_activity: "2026-04-08T10:00:00Z",
    duration_ms: 2400,
    display_name: "Workflow Alpha",
    agent_id: "agent-1",
    agent_name: "Agent One",
    status_counts: { running: 1, failed: 1, succeeded: 2 },
    active_executions: 1,
    terminal: false,
    ...overrides,
  };
}

describe("CompactWorkflowsTable", () => {
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

  it("renders compact workflow rows, filters search results, and deletes selected workflows", async () => {
    const onSortChange = vi.fn();
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
        total_executions: 4,
        active_executions: 0,
        status_counts: { succeeded: 4 },
        duration_ms: 4800,
        latest_activity: "not-a-date",
      }),
    ];

    render(
      <CompactWorkflowsTable
        workflows={workflows}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="latest_activity"
        sortOrder="desc"
        onSortChange={onSortChange}
        onWorkflowClick={onWorkflowClick}
        onWorkflowsDeleted={onWorkflowsDeleted}
      />
    );

    expect(screen.getByText("results:2/2")).toBeInTheDocument();
    expect(screen.getAllByText("Workflow Alpha").length).toBeGreaterThan(0);
    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByText("1 issue")).toBeInTheDocument();
    expect(screen.getByText("indicator:running")).toBeInTheDocument();
    expect(screen.getByText("duration:2400")).toBeInTheDocument();
    expect(screen.getByText("vc:wf-1:verified")).toBeInTheDocument();
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText("invalid date")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Status"));
    expect(onSortChange).toHaveBeenCalledWith("status");

    fireEvent.click(screen.getAllByText("Workflow Alpha")[0]);
    expect(onWorkflowClick).toHaveBeenCalledWith(expect.objectContaining({ run_id: "run-1" }));

    fireEvent.click(screen.getByLabelText("Select workflow Workflow Alpha"));
    expect(screen.getByText("1 workflow selected")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete Selected"));
    fireEvent.click(screen.getByText("Confirm compact delete"));
    await Promise.resolve();
    await Promise.resolve();

    expect(state.deleteWorkflows).toHaveBeenCalledWith(["run-1"]);
    expect(onWorkflowsDeleted).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("workflow-search"), {
      target: { value: "beta" },
    });

    expect(screen.getByText("results:1/2")).toBeInTheDocument();
    expect(screen.queryAllByText("Workflow Alpha")).toHaveLength(0);
    expect(screen.getAllByText("Workflow Beta").length).toBeGreaterThan(0);
  });

  it("renders the empty state and refresh action", () => {
    const onRefresh = vi.fn();

    render(
      <CompactWorkflowsTable
        workflows={[]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="latest_activity"
        sortOrder="desc"
        onSortChange={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("No workflows yet")).toBeInTheDocument();
    expect(screen.getByText("Workflows will appear here as they execute.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Refresh data"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
