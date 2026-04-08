import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { EnhancedWorkflowDetailPage } from "@/pages/EnhancedWorkflowDetailPage";
import type { WorkflowSummary } from "@/types/workflows";

const state = vi.hoisted(() => ({
  getWorkflowRunSummary: vi.fn<(runId: string, signal?: AbortSignal) => Promise<WorkflowSummary | null>>(),
  getWorkflowVCChain: vi.fn<(workflowId: string) => Promise<any>>(),
  refreshDAG: vi.fn<() => void>(),
  dagState: {
    data: null as any,
    loading: false,
    error: null as Error | null,
    isRefreshing: false,
  },
}));

vi.mock("@/services/workflowsApi", () => ({
  getWorkflowRunSummary: (runId: string, signal?: AbortSignal) =>
    state.getWorkflowRunSummary(runId, signal),
}));

vi.mock("@/services/vcApi", () => ({
  getWorkflowVCChain: (workflowId: string) => state.getWorkflowVCChain(workflowId),
}));

vi.mock("@/hooks/useWorkflowDAG", () => ({
  useWorkflowDAGSmart: () => ({
    data: state.dagState.data,
    loading: state.dagState.loading,
    error: state.dagState.error,
    isRefreshing: state.dagState.isRefreshing,
    refresh: state.refreshDAG,
  }),
}));

vi.mock("@/utils/webhook", () => ({
  summarizeWorkflowWebhook: (timeline: Array<{ webhook_registered?: boolean }>) => ({
    nodesWithWebhook: timeline.filter((node) => node.webhook_registered).length,
  }),
}));

vi.mock("@/components/workflow/EnhancedWorkflowHeader", () => ({
  EnhancedWorkflowHeader: ({
    workflow,
    activeTab,
    onTabChange,
    onClose,
    onRefresh,
    onFullscreenChange,
    selectedNodeCount,
  }: {
    workflow: WorkflowSummary;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onClose: () => void;
    onRefresh: () => void;
    onFullscreenChange: (value: boolean) => void;
    selectedNodeCount: number;
  }) => (
    <div>
      <h1>{workflow.display_name}</h1>
      <div>Header tab {activeTab}</div>
      <div>Selected nodes {selectedNodeCount}</div>
      <button type="button" onClick={() => onTabChange("insights")}>
        Open insights
      </button>
      <button type="button" onClick={onRefresh}>
        Header refresh
      </button>
      <button type="button" onClick={() => onFullscreenChange(true)}>
        Fullscreen on
      </button>
      <button type="button" onClick={onClose}>
        Back workflows
      </button>
    </div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowFlow", () => ({
  EnhancedWorkflowFlow: ({
    selectedNodeIds,
    onNodeSelection,
    focusMode,
  }: {
    selectedNodeIds: string[];
    onNodeSelection: (nodeIds: string[], replace?: boolean) => void;
    focusMode: boolean;
  }) => (
    <div>
      <div>Flow selected {selectedNodeIds.join(",") || "none"}</div>
      <div>Focus {String(focusMode)}</div>
      <button type="button" onClick={() => onNodeSelection(["exec-2"])}>
        Select exec-2
      </button>
      <button type="button" onClick={() => onNodeSelection(["exec-3"], false)}>
        Add exec-3
      </button>
    </div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowData", () => ({
  EnhancedWorkflowData: ({ selectedNodeIds }: { selectedNodeIds: string[] }) => (
    <div>Data {selectedNodeIds.join(",") || "none"}</div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowEvents", () => ({
  EnhancedWorkflowEvents: () => <div>Workflow notes</div>,
}));

vi.mock("@/components/workflow/EnhancedWorkflowIdentity", () => ({
  EnhancedWorkflowIdentity: ({ vcChain }: { vcChain: { component_vcs?: unknown[] } | null }) => (
    <div>Identity {(vcChain?.component_vcs?.length ?? 0).toString()}</div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowWebhooks", () => ({
  EnhancedWorkflowWebhooks: ({ onRefresh }: { onRefresh: () => void }) => (
    <div>
      <div>Workflow webhooks</div>
      <button type="button" onClick={onRefresh}>
        Webhook refresh
      </button>
    </div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowOverview", () => ({
  EnhancedWorkflowOverview: ({ selectedNodeIds }: { selectedNodeIds: string[] }) => (
    <div>Overview {selectedNodeIds.join(",") || "none"}</div>
  ),
}));

vi.mock("@/components/workflow/EnhancedWorkflowPerformance", () => ({
  EnhancedWorkflowPerformance: () => <div>Performance panel</div>,
}));

vi.mock("@/components/layout/ResponsiveGrid", () => ({
  ResponsiveGrid: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/notification", () => ({
  NotificationProvider: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>loading</div>,
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  GitBranch: () => <span>git</span>,
  Database: () => <span>db</span>,
  BarChart3: () => <span>chart</span>,
  ShieldCheck: () => <span>shield</span>,
  RadioTower: () => <span>radio</span>,
  FileText: () => <span>file</span>,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage(initialPath = "/workflows/run-1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/workflows/:workflowId" element={<EnhancedWorkflowDetailPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("EnhancedWorkflowDetailPage", () => {
  beforeEach(() => {
    state.getWorkflowRunSummary.mockReset();
    state.getWorkflowVCChain.mockReset();
    state.refreshDAG.mockReset();
    state.dagState = {
      data: null,
      loading: false,
      error: null,
      isRefreshing: false,
    };
  });

  it("renders loading state, defaults to graph, and supports keyboard tab and refresh interactions", async () => {
    let resolveWorkflow: ((value: WorkflowSummary) => void) | null = null;
    state.getWorkflowRunSummary.mockImplementation(
      () =>
        new Promise<WorkflowSummary>((resolve) => {
          resolveWorkflow = resolve;
        })
    );
    state.getWorkflowVCChain.mockResolvedValue({ component_vcs: [{ id: "vc-1" }] });
    state.dagState.data = {
      workflow_status: "running",
      dag: { duration_ms: 500 },
      max_depth: 2,
      timeline: [
        { execution_id: "exec-1", status: "running", webhook_registered: true, notes: [{ message: "n1" }] },
        { execution_id: "exec-2", status: "succeeded", duration_ms: 200, notes: [] },
      ],
    };

    renderPage();
    expect(screen.getAllByText("loading").length).toBeGreaterThan(0);

    resolveWorkflow?.({
      run_id: "run-1",
      workflow_id: "wf-1",
      root_execution_id: "exec-1",
      status: "pending",
      root_reasoner: "planner",
      current_task: "plan",
      total_executions: 2,
      max_depth: 1,
      started_at: "2026-04-08T00:00:00Z",
      latest_activity: "2026-04-08T00:00:01Z",
      display_name: "Enhanced Workflow",
      status_counts: { pending: 2 },
      active_executions: 1,
      terminal: false,
    });

    expect(await screen.findByText("Enhanced Workflow")).toBeInTheDocument();
    expect(screen.getByText("Header tab graph")).toBeInTheDocument();
    expect(screen.getByText("Flow selected exec-1")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "2", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText("Header tab io")).toBeInTheDocument();
    });
    expect(screen.getByText("Data exec-1")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "r", ctrlKey: true });
    expect(state.refreshDAG).toHaveBeenCalledTimes(1);
  });

  it("handles node selection, insights tab, and escape navigation", async () => {
    state.getWorkflowRunSummary.mockResolvedValue({
      run_id: "run-1",
      workflow_id: "wf-1",
      root_execution_id: "exec-1",
      status: "running",
      root_reasoner: "planner",
      current_task: "plan",
      total_executions: 2,
      max_depth: 1,
      started_at: "2026-04-08T00:00:00Z",
      latest_activity: "2026-04-08T00:00:01Z",
      display_name: "Escape Workflow",
      status_counts: { running: 2 },
      active_executions: 1,
      terminal: false,
    });
    state.getWorkflowVCChain.mockResolvedValue({ component_vcs: [{ id: "vc-1" }, { id: "vc-2" }] });
    state.dagState.data = {
      workflow_status: "running",
      dag: { duration_ms: 500 },
      max_depth: 2,
      timeline: [
        { execution_id: "exec-1", status: "running", webhook_registered: true, notes: [{ message: "n1" }] },
        { execution_id: "exec-2", status: "queued", duration_ms: 200, notes: [] },
      ],
    };

    renderPage();

    expect(await screen.findByText("Escape Workflow")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Select exec-2"));
    expect(screen.getByText("Selected nodes 1")).toBeInTheDocument();
    expect(screen.getByText("Flow selected exec-2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByText("Selected nodes 0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open insights"));
    expect(await screen.findByText("Overview none")).toBeInTheDocument();
    expect(screen.getByText("Performance panel")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workflows");
    });
  });
});
