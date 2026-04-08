import React, { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnhancedWorkflowFlow } from "@/components/workflow/EnhancedWorkflowFlow";
import { EnhancedWorkflowHeader } from "@/components/workflow/EnhancedWorkflowHeader";
import { EnhancedWorkflowOverview } from "@/components/workflow/EnhancedWorkflowOverview";
import { EnhancedWorkflowPerformance } from "@/components/workflow/EnhancedWorkflowPerformance";
import { EnhancedWorkflowWebhooks } from "@/components/workflow/EnhancedWorkflowWebhooks";
import type { WorkflowSummary, WorkflowTimelineNode } from "@/types/workflows";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  pauseExecution: vi.fn(),
  resumeExecution: vi.fn(),
  cancelExecution: vi.fn(),
  retryExecutionWebhook: vi.fn(),
  successNotification: vi.fn(),
  errorNotification: vi.fn(),
  dagControls: {
    focusOnNodes: vi.fn(),
    fitToView: vi.fn(),
    changeLayout: vi.fn(),
  },
  animatedTabsOnChange: undefined as undefined | ((value: string) => void),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className}>icon</span>;
  return {
    ArrowLeft: Icon,
    RotateCcw: Icon,
    CheckCircle: Icon,
    Database: Icon,
    PauseCircle: Icon,
    Activity: Icon,
    XCircle: Icon,
    X: Icon,
    Play: Icon,
    MoreHorizontal: Icon,
    Clock: Icon,
    Copy: Icon,
    GitBranch: Icon,
    Users: Icon,
    Maximize: Icon,
    Minimize: Icon,
    RadioTower: Icon,
    CheckCircle2: Icon,
    AlertTriangle: Icon,
    ArrowUpRight: Icon,
    Zap: Icon,
    GaugeCircle: Icon,
    Timer: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/components/layout/ResponsiveGrid", () => {
  const ResponsiveGrid = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  );
  ResponsiveGrid.Item = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { ResponsiveGrid };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: React.PropsWithChildren) => <>{children}</>,
  HoverCardTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  HoverCardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  AnimatedTabs: ({
    value,
    onValueChange,
    children,
  }: React.PropsWithChildren<{ value: string; onValueChange: (value: string) => void }>) => {
    state.animatedTabsOnChange = onValueChange;
    return <div data-value={value}>{children}</div>;
  },
  AnimatedTabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AnimatedTabsTrigger: ({
    value,
    children,
    ...props
  }: React.PropsWithChildren<{ value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" onClick={() => state.animatedTabsOnChange?.(value)} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/copy-identifier-chip", () => ({
  CopyIdentifierChip: ({ value }: { value: string }) => <button type="button">{value}</button>,
  truncateIdMiddle: (value: string) => value,
}));

vi.mock("@/components/ui/data-formatters", () => ({
  formatDurationHumanReadable: (value?: number) => (typeof value === "number" ? `${value} ms` : "—"),
}));

vi.mock("@/components/ui/notification", () => ({
  useSuccessNotification: () => state.successNotification,
  useErrorNotification: () => state.errorNotification,
}));

vi.mock("@/components/workflow/AgentHealthHeatmap", () => ({
  AgentHealthHeatmap: ({ timedNodes }: { timedNodes: unknown[] }) => <div>Agent Health {timedNodes.length}</div>,
}));

vi.mock("@/components/workflow/ExecutionScatterPlot", () => ({
  ExecutionScatterPlot: ({
    timedNodes,
    onNodeClick,
  }: {
    timedNodes: Array<{ execution_id: string }>;
    onNodeClick?: (id: string) => void;
  }) => (
    <div>
      <div>Scatter {timedNodes.length}</div>
      {timedNodes.map((node) => (
        <button key={node.execution_id} type="button" onClick={() => onNodeClick?.(node.execution_id)}>
          point-{node.execution_id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/WorkflowDAGViewer", () => ({
  WorkflowDAGViewer: ({
    onExecutionClick,
    onReady,
    onSearchResultsChange,
    onLayoutInfoChange,
    searchQuery,
  }: {
    onExecutionClick: (execution: WorkflowTimelineNode) => void;
    onReady: (controls: typeof state.dagControls) => void;
    onSearchResultsChange: (summary: { totalMatches: number; firstMatchId?: string }) => void;
    onLayoutInfoChange: (info: {
      availableLayouts: string[];
      currentLayout: string;
      isSlowLayout: boolean;
      isLargeGraph: boolean;
      isApplyingLayout: boolean;
    }) => void;
    searchQuery?: string;
  }) => {
    useEffect(() => {
      onReady(state.dagControls);
      onLayoutInfoChange({
        availableLayouts: ["dagre", "elk"],
        currentLayout: "dagre",
        isSlowLayout: false,
        isLargeGraph: false,
        isApplyingLayout: false,
      });
      onSearchResultsChange({
        totalMatches: searchQuery ? 1 : 0,
        firstMatchId: searchQuery ? "exec-2" : undefined,
      });
    }, [onLayoutInfoChange, onReady, onSearchResultsChange, searchQuery]);

    return (
      <div>
        <div>DAG viewer</div>
        <button
          type="button"
          onClick={() =>
            onExecutionClick({
              execution_id: "exec-click",
              workflow_id: "wf-1",
              agent_node_id: "agent-click",
              reasoner_id: "planner",
              status: "running",
              started_at: "2026-04-08T10:00:00Z",
              workflow_depth: 1,
              children: [],
              notes: [],
              notes_count: 0,
            } as unknown as WorkflowTimelineNode)
          }
        >
          Select from DAG
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/WorkflowDAG/GraphToolbar", () => ({
  GraphToolbar: ({
    onSearchToggle,
    onSmartCenter,
    onLayoutChange,
    onViewModeChange,
    onFocusModeChange,
  }: {
    onSearchToggle: () => void;
    onSmartCenter: () => void;
    onLayoutChange: (layout: string) => void;
    onViewModeChange: (mode: string) => void;
    onFocusModeChange?: (enabled: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={onSearchToggle}>
        Toggle search
      </button>
      <button type="button" onClick={onSmartCenter}>
        Smart center
      </button>
      <button type="button" onClick={() => onLayoutChange("elk")}>
        Layout elk
      </button>
      <button type="button" onClick={() => onViewModeChange("performance")}>
        Performance view
      </button>
      <button type="button" onClick={() => onFocusModeChange?.(true)}>
        Focus mode
      </button>
    </div>
  ),
}));

vi.mock("@/services/executionsApi", () => ({
  pauseExecution: (executionId: string) => state.pauseExecution(executionId),
  resumeExecution: (executionId: string) => state.resumeExecution(executionId),
  cancelExecution: (executionId: string) => state.cancelExecution(executionId),
  retryExecutionWebhook: (executionId: string) => state.retryExecutionWebhook(executionId),
}));

function createWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    run_id: "run-1",
    workflow_id: "wf-1",
    root_execution_id: "exec-1",
    status: "running",
    root_reasoner: "planner",
    current_task: "Plan",
    total_executions: 3,
    max_depth: 2,
    started_at: "2026-04-08T10:00:00Z",
    latest_activity: "2026-04-08T10:05:00Z",
    display_name: "Workflow Alpha",
    status_counts: { running: 1, succeeded: 1, failed: 1 },
    active_executions: 1,
    terminal: false,
    duration_ms: 4200,
    agent_name: "Ops Agent",
    session_id: "session-12345678",
    ...overrides,
  };
}

function createNode(overrides: Partial<WorkflowTimelineNode> = {}): WorkflowTimelineNode {
  return {
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agent_node_id: "agent-1",
    agent_name: "Planner",
    reasoner_id: "planner",
    status: "running",
    started_at: "2026-04-08T10:00:00Z",
    completed_at: "2026-04-08T10:00:05Z",
    workflow_depth: 0,
    input_data: { prompt: "hello" },
    output_data: { answer: "world" },
    duration_ms: 1500,
    webhook_registered: true,
    webhook_event_count: 1,
    webhook_success_count: 1,
    webhook_failure_count: 0,
    webhook_last_status: "delivered",
    webhook_last_http_status: 200,
    webhook_last_sent_at: "2026-04-08T10:05:00Z",
    children: [],
    notes: [],
    notes_count: 0,
    ...overrides,
  } as unknown as WorkflowTimelineNode;
}

const navigationTabs = [
  { id: "graph", label: "Graph", icon: () => <span>g</span>, description: "Graph", shortcut: "1", count: 3 },
  { id: "insights", label: "Insights", icon: () => <span>i</span>, description: "Insights", shortcut: "2", count: 1 },
];

describe("enhanced workflow panels", () => {
  beforeEach(() => {
    state.navigate.mockReset();
    state.pauseExecution.mockReset();
    state.resumeExecution.mockReset();
    state.cancelExecution.mockReset();
    state.retryExecutionWebhook.mockReset();
    state.successNotification.mockReset();
    state.errorNotification.mockReset();
    state.dagControls.focusOnNodes.mockReset();
    state.dagControls.fitToView.mockReset();
    state.dagControls.changeLayout.mockReset();
  });

  it("renders overview metrics and supports focusing agents and recent executions", () => {
    const onNodeSelection = vi.fn();
    const workflow = createWorkflow();
    const timeline = [
      createNode(),
      createNode({
        execution_id: "exec-2",
        agent_name: "Reviewer",
        reasoner_id: "review",
        status: "succeeded",
        duration_ms: 3000,
        started_at: "2026-04-08T10:01:00Z",
      }),
      createNode({
        execution_id: "exec-3",
        agent_name: "Reviewer",
        reasoner_id: "review",
        status: "failed",
        duration_ms: 500,
        started_at: "2026-04-08T10:02:00Z",
      }),
    ];

    render(
      <EnhancedWorkflowOverview
        workflow={workflow}
        dagData={{ timeline }}
        vcChain={{ component_vcs: [{}, {}] } as never}
        selectedNodeIds={[]}
        onNodeSelection={onNodeSelection}
      />
    );

    expect(screen.getByText("Run status")).toBeInTheDocument();
    expect(screen.getByText("Reliability")).toBeInTheDocument();
    expect(screen.getByText("Data coverage")).toBeInTheDocument();
    expect(screen.getByText("Workflow metadata")).toBeInTheDocument();
    expect(screen.getByText("VC chain available (2 credentials)")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Reviewer/i })[0]);
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-2", "exec-3"], false);

    fireEvent.click(screen.getAllByRole("button", { name: /Planner/i })[0]);
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-1"], false);
  });

  it("renders header actions, changes tabs, and runs lifecycle mutations", async () => {
    state.pauseExecution.mockResolvedValue(undefined);
    state.cancelExecution.mockResolvedValue(undefined);

    const onRefresh = vi.fn();
    const onTabChange = vi.fn();
    const onFullscreenChange = vi.fn();

    render(
      <MemoryRouter>
        <EnhancedWorkflowHeader
          workflow={createWorkflow()}
          dagData={{ timeline: [createNode({ webhook_failure_count: 1, webhook_last_error: "boom" })] }}
          isRefreshing={false}
          onRefresh={onRefresh}
          isFullscreen={false}
          onFullscreenChange={onFullscreenChange}
          selectedNodeCount={2}
          activeTab="graph"
          onTabChange={onTabChange}
          navigationTabs={navigationTabs}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Workflow Alpha").length).toBeGreaterThan(0);
    expect(screen.getByText("1 webhook issue")).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Pause execution" })[0]);
    await waitFor(() => expect(state.pauseExecution).toHaveBeenCalledWith("exec-1"));
    expect(state.successNotification).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Insights/i }));
    expect(onTabChange).toHaveBeenCalledWith("insights");

    fireEvent.click(screen.getAllByRole("button", { name: "Enter fullscreen" })[0]);
    expect(onFullscreenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Stop execution" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Stop execution" }).at(-1)!);
    await waitFor(() => expect(state.cancelExecution).toHaveBeenCalledWith("exec-1"));
  });

  it("renders flow state and supports search, focus, layout, and node clicks", async () => {
    const onNodeSelection = vi.fn();
    const onViewModeChange = vi.fn();
    const onFocusModeChange = vi.fn();

    render(
      <EnhancedWorkflowFlow
        workflow={createWorkflow()}
        dagData={{ timeline: [createNode(), createNode({ execution_id: "exec-2" })] }}
        loading={false}
        isRefreshing={true}
        error={null}
        selectedNodeIds={["exec-1"]}
        onNodeSelection={onNodeSelection}
        viewMode="standard"
        onViewModeChange={onViewModeChange}
        focusMode={true}
        onFocusModeChange={onFocusModeChange}
      />
    );

    expect(screen.getByText("Updating")).toBeInTheDocument();
    expect(state.dagControls.focusOnNodes).toHaveBeenCalledWith(["exec-1"], { padding: 0.35 });

    fireEvent.click(screen.getByRole("button", { name: "Toggle search" }));
    fireEvent.change(screen.getByPlaceholderText(/Search by agent/i), { target: { value: "review" } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Search by agent/i), { key: "Enter" });

    expect(screen.getByText("1 match")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Smart center" }));
    expect(state.dagControls.focusOnNodes).toHaveBeenCalledWith(["exec-1"], { padding: 0.3 });

    fireEvent.click(screen.getByRole("button", { name: "Layout elk" }));
    expect(state.dagControls.changeLayout).toHaveBeenCalledWith("elk");

    fireEvent.click(screen.getByRole("button", { name: "Performance view" }));
    expect(onViewModeChange).toHaveBeenCalledWith("performance");

    fireEvent.click(screen.getByRole("button", { name: "Focus mode" }));
    expect(onFocusModeChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Select from DAG" }));
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-click"]);
  });

  it("renders webhook summary, retries callbacks, and navigates to execution details", async () => {
    state.retryExecutionWebhook.mockResolvedValue(undefined);
    const onNodeSelection = vi.fn();
    const onRefresh = vi.fn();

    render(
      <MemoryRouter>
        <EnhancedWorkflowWebhooks
          workflow={createWorkflow()}
          dagData={{
            timeline: [
              createNode({
                execution_id: "exec-9",
                agent_name: "Notifier",
                webhook_success_count: 2,
                webhook_failure_count: 1,
                webhook_last_http_status: 502,
                webhook_last_error: "server error",
                webhook_last_status: "failed",
              }),
            ],
          }}
          onNodeSelection={onNodeSelection}
          onRefresh={onRefresh}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Webhook nodes")).toBeInTheDocument();
    expect(screen.getByText("Notifier")).toBeInTheDocument();
    expect(screen.getByText("HTTP 502")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Focus in DAG" }));
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-9"]);

    fireEvent.click(screen.getByRole("button", { name: /View execution/i }));
    expect(state.navigate).toHaveBeenCalledWith("/executions/exec-9?tab=webhook");

    fireEvent.click(screen.getByRole("button", { name: "Retry webhook" }));
    await waitFor(() => expect(state.retryExecutionWebhook).toHaveBeenCalledWith("exec-9"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders performance insights, node focus actions, and empty state", () => {
    const onNodeSelection = vi.fn();

    const { rerender } = render(
      <EnhancedWorkflowPerformance
        workflow={createWorkflow()}
        dagData={{
          timeline: [
            createNode({ execution_id: "exec-1", agent_name: "Planner", status: "succeeded", duration_ms: 1000, workflow_depth: 0 }),
            createNode({ execution_id: "exec-2", agent_name: "Planner", status: "failed", duration_ms: 2000, workflow_depth: 1, started_at: "2026-04-08T10:01:00Z" }),
            createNode({ execution_id: "exec-3", agent_name: "Reviewer", status: "succeeded", duration_ms: 4000, workflow_depth: 1, started_at: "2026-04-08T10:02:00Z" }),
          ],
        }}
        selectedNodeIds={["exec-2"]}
        onNodeSelection={onNodeSelection}
      />
    );

    expect(screen.getByText("Workflow Performance Insights")).toBeInTheDocument();
    expect(screen.getByText("Scatter 3")).toBeInTheDocument();
    expect(screen.getByText("Agent Health 3")).toBeInTheDocument();
    expect(screen.getByText("Top bottlenecks")).toBeInTheDocument();
    expect(screen.getByText("Selected nodes Analysis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "point-exec-2" }));
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-2"], true);

    fireEvent.click(screen.getAllByRole("button", { name: "Focus" })[0]);
    expect(onNodeSelection).toHaveBeenCalled();

    rerender(
      <EnhancedWorkflowPerformance
        workflow={createWorkflow()}
        dagData={{ timeline: [createNode({ execution_id: "exec-x", duration_ms: undefined })] }}
        selectedNodeIds={[]}
        onNodeSelection={onNodeSelection}
      />
    );

    expect(screen.getByText("No performance data yet")).toBeInTheDocument();
  });
});
