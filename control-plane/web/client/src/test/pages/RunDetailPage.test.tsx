import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RunDetailPage } from "@/pages/RunDetailPage";
import type { WorkflowDAGLightweightResponse } from "@/types/workflows";

const state = vi.hoisted(() => ({
  runDag: {
    data: undefined as WorkflowDAGLightweightResponse | undefined,
    isLoading: false,
    isError: false,
    error: null as Error | null,
  },
  queryData: undefined as any,
  invalidateQueries: vi.fn<(args: unknown) => Promise<void>>(),
  cancelMutateAsync: vi.fn<(executionId: string) => Promise<void>>(),
  pauseMutateAsync: vi.fn<(executionId: string) => Promise<void>>(),
  resumeMutateAsync: vi.fn<(executionId: string) => Promise<void>>(),
  showRunNotification: vi.fn<(message: string) => void>(),
  getExecutionDetails: vi.fn<(executionId: string) => Promise<{ input_data: unknown }>>(),
  retryExecutionWebhook: vi.fn<(executionId: string) => Promise<void>>(),
  getWorkflowVCChain: vi.fn<(workflowId: string) => Promise<any>>(),
  downloadWorkflowVCAuditFile: vi.fn<(workflowId: string) => Promise<void>>(),
  navigateSpy: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn, enabled = true }: { queryFn: () => Promise<unknown>; enabled?: boolean }) => {
    if (enabled && state.queryData === undefined) {
      void queryFn();
    }
    return { data: state.queryData };
  },
  useQueryClient: () => ({
    invalidateQueries: state.invalidateQueries,
  }),
}));

vi.mock("@/hooks/queries", () => ({
  useRunDAG: () => state.runDag,
  useCancelExecution: () => ({ mutateAsync: state.cancelMutateAsync, isPending: false }),
  usePauseExecution: () => ({ mutateAsync: state.pauseMutateAsync, isPending: false }),
  useResumeExecution: () => ({ mutateAsync: state.resumeMutateAsync, isPending: false }),
}));

vi.mock("@/components/ui/notification", () => ({
  useRunNotification: () => state.showRunNotification,
}));

vi.mock("@/services/executionsApi", () => ({
  retryExecutionWebhook: (executionId: string) => state.retryExecutionWebhook(executionId),
  getExecutionDetails: (executionId: string) => state.getExecutionDetails(executionId),
}));

vi.mock("@/services/vcApi", () => ({
  getWorkflowVCChain: (workflowId: string) => state.getWorkflowVCChain(workflowId),
  downloadWorkflowVCAuditFile: (workflowId: string) => state.downloadWorkflowVCAuditFile(workflowId),
}));

vi.mock("@/components/runs/RunLifecycleMenu", () => ({
  CANCEL_RUN_COPY: {
    title: (count: number) => `Cancel ${count} run`,
    description: "Cancel description",
    confirmLabel: (count: number) => `Cancel ${count} run`,
    keepLabel: "Keep running",
    success: "Cancelled",
    error: "Cancel failed",
  },
}));

vi.mock("@/components/RunTrace", () => ({
  buildTraceTree: (timeline: Array<{ execution_id: string }>) => ({ execution_id: timeline[0]?.execution_id ?? "none" }),
  formatDuration: (duration: number) => `${duration}ms`,
  RunTrace: ({
    selectedId,
    onSelect,
  }: {
    selectedId: string | null;
    onSelect: (value: string) => void;
  }) => (
    <div>
      <div>Trace {selectedId ?? "none"}</div>
      <button type="button" onClick={() => onSelect("exec-2")}>
        Select trace exec-2
      </button>
    </div>
  ),
}));

vi.mock("@/components/StepDetail", () => ({
  StepDetail: ({ executionId }: { executionId: string }) => <div>Step {executionId}</div>,
}));

vi.mock("@/components/WorkflowDAG", () => ({
  WorkflowDAGViewer: ({
    selectedNodeIds,
    onExecutionClick,
  }: {
    selectedNodeIds?: string[];
    onExecutionClick?: (execution: { execution_id: string }) => void;
  }) => (
    <div>
      <div>Graph {selectedNodeIds?.join(",") ?? "none"}</div>
      <button type="button" onClick={() => onExecutionClick?.({ execution_id: "exec-2" })}>
        Graph select exec-2
      </button>
    </div>
  ),
}));

vi.mock("@/components/execution", () => ({
  ExecutionObservabilityPanel: ({ execution }: { execution: { execution_id: string } }) => (
    <div>Logs {execution.execution_id}</div>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
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

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");
  const TabsContext = ReactModule.createContext<{
    value: string;
    onValueChange?: (value: string) => void;
  }>({ value: "" });

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
    }: React.PropsWithChildren<{ value: string; onValueChange?: (value: string) => void }>) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
      ...props
    }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>) => {
      const ctx = ReactModule.useContext(TabsContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange?.(value)} {...props}>
          {children}
        </button>
      );
    },
    TabsContent: ({
      children,
      value,
    }: React.PropsWithChildren<{ value: string }>) => {
      const ctx = ReactModule.useContext(TabsContext);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: React.PropsWithChildren<{ open?: boolean }>) => <div>{children}</div>,
  AlertDialogAction: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button type="button" {...props}>{children}</button>,
  AlertDialogCancel: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button type="button" {...props}>{children}</button>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => <button type="button" onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div>separator</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>loading</div>,
}));

vi.mock("@/components/ui/copy-identifier-chip", () => ({
  CopyIdentifierChip: ({ label, value }: { label: string; value: string }) => <span>{label}:{value}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/status-pill", () => ({
  StatusPill: ({ status }: { status: string }) => <span>Status {status}</span>,
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />;
  return {
    ...actual,
    Activity: Icon,
    BadgeCheck: Icon,
    ChevronDown: Icon,
    FileJson: Icon,
    FileCheck2: Icon,
    Info: Icon,
    Link2: Icon,
    PauseCircle: Icon,
    Play: Icon,
    RefreshCw: Icon,
    RotateCcw: Icon,
    XCircle: Icon,
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/runs/run-1"]}>
      <Routes>
        <Route path="/runs/:runId" element={<RunDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function buildDag(): WorkflowDAGLightweightResponse {
  return {
    root_workflow_id: "wf-1",
    workflow_status: "running",
    workflow_name: "Run Alpha",
    session_id: "session-1",
    actor_id: "actor-1",
    total_nodes: 2,
    max_depth: 1,
    mode: "lightweight",
    unique_agent_node_ids: ["node-1", "node-2"],
    timeline: [
      {
        execution_id: "exec-1",
        agent_node_id: "node-1",
        reasoner_id: "planner",
        status: "running",
        started_at: "2026-04-08T00:00:00Z",
        duration_ms: 500,
        workflow_depth: 0,
      },
      {
        execution_id: "exec-2",
        parent_execution_id: "exec-1",
        agent_node_id: "node-2",
        reasoner_id: "worker",
        status: "failed",
        started_at: "2026-04-08T00:00:01Z",
        completed_at: "2026-04-08T00:00:02Z",
        duration_ms: 300,
        workflow_depth: 1,
      },
    ],
    webhook_summary: {
      steps_with_webhook: 1,
      total_deliveries: 1,
      failed_deliveries: 1,
    },
    webhook_failures: [
      {
        execution_id: "exec-2",
        agent_node_id: "node-2",
        reasoner_id: "worker",
        event_type: "completed",
        http_status: 500,
      },
    ],
    workflow_issuer_did: "did:example:issuer",
  };
}

describe("RunDetailPage", () => {
  beforeEach(() => {
    state.runDag = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    };
    state.queryData = undefined;
    state.invalidateQueries.mockReset();
    state.cancelMutateAsync.mockReset();
    state.pauseMutateAsync.mockReset();
    state.resumeMutateAsync.mockReset();
    state.showRunNotification.mockReset();
    state.getExecutionDetails.mockReset();
    state.retryExecutionWebhook.mockReset();
    state.getWorkflowVCChain.mockReset();
    state.downloadWorkflowVCAuditFile.mockReset();
  });

  it("renders loading state then populated trace/log surfaces and replay action", async () => {
    state.runDag = {
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    };
    state.queryData = { workflow_vc: { issuer_did: "did:example:issuer" } };
    state.getWorkflowVCChain.mockResolvedValue({ workflow_vc: { issuer_did: "did:example:issuer" } });
    state.getExecutionDetails.mockResolvedValue({ input_data: { replay: true } });

    const view = renderPage();
    expect(screen.getAllByText("loading").length).toBeGreaterThan(0);

    state.runDag = {
      data: buildDag(),
      isLoading: false,
      isError: false,
      error: null,
    };
    view.rerender(
      <MemoryRouter initialEntries={["/runs/run-1"]}>
        <Routes>
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Run Alpha")).toBeInTheDocument();
    expect(screen.getByText("Trace exec-1")).toBeInTheDocument();
    expect(screen.getByText("Step exec-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Logs"));
    expect(await screen.findByText("Logs exec-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Replay"));
    await waitFor(() => {
      expect(state.getExecutionDetails).toHaveBeenCalledWith("exec-1");
    });
  });

  it("supports graph selection and webhook retry strip interactions", async () => {
    state.runDag = {
      data: buildDag(),
      isLoading: false,
      isError: false,
      error: null,
    };
    state.queryData = { workflow_vc: { issuer_did: "did:example:issuer" } };
    state.retryExecutionWebhook.mockResolvedValue();

    renderPage();

    expect(await screen.findByText("Run Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Graph"));
    expect(await screen.findByText("Graph exec-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Graph select exec-2"));
    expect(await screen.findByText("Graph exec-2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => {
      expect(state.retryExecutionWebhook).toHaveBeenCalledWith("exec-2");
    });
    await waitFor(() => {
      expect(state.invalidateQueries).toHaveBeenCalled();
    });
  });
});
