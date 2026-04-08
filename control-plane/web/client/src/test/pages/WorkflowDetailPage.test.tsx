import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { WorkflowDetailPage } from "@/pages/WorkflowDetailPage";
import type { WorkflowSummary } from "@/types/workflows";

const state = vi.hoisted(() => ({
  getWorkflowRunSummary: vi.fn<(runId: string) => Promise<WorkflowSummary | null>>(),
  refreshDAG: vi.fn<() => void>(),
  dagState: {
    data: null as any,
    loading: false,
    error: null as Error | null,
    hasRunningWorkflows: false,
    currentPollingInterval: 0,
  },
}));

vi.mock("@/services/workflowsApi", () => ({
  getWorkflowRunSummary: (runId: string) => state.getWorkflowRunSummary(runId),
}));

vi.mock("@/hooks/useWorkflowDAG", () => ({
  useWorkflowDAGSmart: () => ({
    data: state.dagState.data,
    loading: state.dagState.loading,
    error: state.dagState.error,
    hasRunningWorkflows: state.dagState.hasRunningWorkflows,
    currentPollingInterval: state.dagState.currentPollingInterval,
    refresh: state.refreshDAG,
  }),
}));

vi.mock("@/components/CompactWorkflowSummary", () => ({
  CompactWorkflowSummary: ({
    workflow,
    onClose,
    onRefresh,
  }: {
    workflow: WorkflowSummary;
    onClose: () => void;
    onRefresh: () => void;
  }) => (
    <div>
      <h1>{workflow.display_name}</h1>
      <button type="button" onClick={onRefresh}>
        Refresh summary
      </button>
      <button type="button" onClick={onClose}>
        Close workflow
      </button>
    </div>
  ),
}));

vi.mock("@/components/workflow/CompactWorkflowInputOutput", () => ({
  CompactWorkflowInputOutput: ({ dagData }: { dagData: { input?: string } | null }) => (
    <div>IO {dagData?.input ?? "none"}</div>
  ),
}));

vi.mock("@/components/layout/TwoColumnLayout", () => ({
  TwoColumnLayout: ({
    leftColumn,
    rightColumn,
  }: {
    leftColumn: React.ReactNode;
    rightColumn: React.ReactNode;
  }) => (
    <div>
      <div>{leftColumn}</div>
      <div>{rightColumn}</div>
    </div>
  ),
}));

vi.mock("@/components/WorkflowDAGViewer", () => ({
  WorkflowDAGViewer: ({
    workflowId,
    error,
  }: {
    workflowId: string;
    error: string | null;
  }) => <div>DAG {workflowId} {error ?? "ok"}</div>,
}));

vi.mock("@/components/workflow/WorkflowTimeline", () => ({
  WorkflowTimeline: ({
    nodes,
    onTagFilter,
  }: {
    nodes: Array<{ execution_id: string }>;
    onTagFilter: (tags: string[]) => void;
  }) => (
    <div>
      <div>Timeline {nodes.length}</div>
      <button type="button" onClick={() => onTagFilter(["ops"])}>
        Filter tag
      </button>
    </div>
  ),
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

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>loading</div>,
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  ChevronLeft: () => <span>left</span>,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage(initialPath = "/workflows/run-1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkflowDetailPage", () => {
  beforeEach(() => {
    state.getWorkflowRunSummary.mockReset();
    state.refreshDAG.mockReset();
    state.dagState = {
      data: null,
      loading: false,
      error: null,
      hasRunningWorkflows: true,
      currentPollingInterval: 2000,
    };
  });

  it("renders loading skeleton, then workflow details, and supports refresh/close", async () => {
    let resolveWorkflow: ((value: WorkflowSummary) => void) | null = null;
    state.getWorkflowRunSummary.mockImplementation(
      () =>
        new Promise<WorkflowSummary>((resolve) => {
          resolveWorkflow = resolve;
        })
    );
    state.dagState.data = {
      input: "payload",
      timeline: [{ execution_id: "exec-1" }],
    };

    renderPage();

    expect(screen.getAllByText("loading").length).toBeGreaterThan(0);

    resolveWorkflow?.({
      run_id: "run-1",
      workflow_id: "wf-1",
      root_execution_id: "exec-1",
      status: "running",
      root_reasoner: "planner",
      current_task: "plan",
      total_executions: 1,
      max_depth: 1,
      started_at: "2026-04-08T00:00:00Z",
      latest_activity: "2026-04-08T00:00:01Z",
      display_name: "Workflow Alpha",
      status_counts: { running: 1 },
      active_executions: 1,
      terminal: false,
    });

    expect(await screen.findByText("Workflow Alpha")).toBeInTheDocument();
    expect(screen.getByText("IO payload")).toBeInTheDocument();
    expect(screen.getByText("Timeline 1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Refresh summary"));
    expect(state.refreshDAG).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Close workflow"));
    expect(screen.getByTestId("location")).toHaveTextContent("/workflows");
  });

  it("shows DAG retry state and supports escape navigation", async () => {
    state.getWorkflowRunSummary.mockResolvedValue({
      run_id: "run-1",
      workflow_id: "wf-1",
      root_execution_id: "exec-1",
      status: "running",
      root_reasoner: "planner",
      current_task: "plan",
      total_executions: 1,
      max_depth: 1,
      started_at: "2026-04-08T00:00:00Z",
      latest_activity: "2026-04-08T00:00:01Z",
      display_name: "Workflow Beta",
      status_counts: { running: 1 },
      active_executions: 1,
      terminal: false,
    });
    state.dagState.data = { input: "payload", timeline: [] };
    state.dagState.error = new Error("DAG offline");

    renderPage();

    expect(await screen.findByText("Workflow Beta")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load workflow data: DAG offline/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry"));
    expect(state.refreshDAG).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workflows");
    });
  });
});
