import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { ExecutionDetailPage } from "@/pages/ExecutionDetailPage";
import type { WorkflowExecution } from "@/types/executions";

const state = vi.hoisted(() => ({
  getExecutionDetails: vi.fn<(executionId: string) => Promise<WorkflowExecution>>(),
  getExecutionVCStatus: vi.fn<(executionId: string) => Promise<any>>(),
  writeText: vi.fn<(value: string) => Promise<void>>(),
}));

vi.mock("@/services/executionsApi", () => ({
  getExecutionDetails: (executionId: string) => state.getExecutionDetails(executionId),
}));

vi.mock("@/services/vcApi", () => ({
  getExecutionVCStatus: (executionId: string) => state.getExecutionVCStatus(executionId),
}));

vi.mock("@/components/layout/ResponsiveGrid", () => ({
  ResponsiveGrid: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/execution/ExecutionDetailsLayout", () => ({
  ExecutionDetailsLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/execution/ExecutionHeader", () => ({
  ExecutionHeader: ({ execution }: { execution: WorkflowExecution }) => <div>Header {execution.execution_id}</div>,
}));

vi.mock("@/components/execution/ExecutionObservabilityPanel", () => ({
  ExecutionObservabilityPanel: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Observability {execution.execution_id}</div>
  ),
}));

vi.mock("@/components/execution/InputDataPanel", () => ({
  InputDataPanel: ({ execution }: { execution: WorkflowExecution }) => <div>Input {execution.execution_id}</div>,
}));

vi.mock("@/components/execution/OutputDataPanel", () => ({
  OutputDataPanel: ({ execution }: { execution: WorkflowExecution }) => <div>Output {execution.execution_id}</div>,
}));

vi.mock("@/components/execution/RedesignedErrorPanel", () => ({
  RedesignedErrorPanel: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Error {execution.error_message}</div>
  ),
}));

vi.mock("@/components/execution/WorkflowBreadcrumb", () => ({
  WorkflowBreadcrumb: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Breadcrumb {execution.workflow_id}</div>
  ),
}));

vi.mock("@/components/execution/CollapsibleSection", () => ({
  CollapsibleSection: ({
    title,
    children,
  }: React.PropsWithChildren<{ title: string }>) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@/components/notes", () => ({
  NotesPanel: ({ executionId }: { executionId: string }) => <div>Notes {executionId}</div>,
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

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = () => <span>icon</span>;
  return {
    Info: Icon,
    Loader2: Icon,
    MessageSquare: Icon,
    Copy: Icon,
    Check: Icon,
  };
});

function buildExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 1,
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agentfield_request_id: "req-1",
    session_id: "session-1",
    actor_id: "actor-1",
    agent_node_id: "node-1",
    parent_workflow_id: "parent-1",
    root_workflow_id: "root-1",
    workflow_depth: 2,
    reasoner_id: "planner",
    input_data: { prompt: "hi" },
    output_data: { answer: "hello" },
    input_size: 1,
    output_size: 1,
    workflow_name: "Workflow One",
    workflow_tags: ["tag-a"],
    status: "succeeded",
    started_at: "2026-04-08T00:00:00Z",
    completed_at: "2026-04-08T00:00:05Z",
    duration_ms: 5000,
    retry_count: 1,
    created_at: "2026-04-08T00:00:00Z",
    updated_at: "2026-04-08T00:00:05Z",
    notes: [{ message: "note", tags: [], timestamp: "2026-04-08T00:00:00Z" }],
    error_message: "boom",
    ...overrides,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/executions/exec-1"]}>
      <Routes>
        <Route path="/executions/:executionId" element={<ExecutionDetailPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ExecutionDetailPage", () => {
  beforeEach(() => {
    state.getExecutionDetails.mockReset();
    state.getExecutionVCStatus.mockReset();
    state.writeText.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText: state.writeText,
      },
    });
  });

  it("renders loading, then populated execution metadata, and navigates via workflow/session links", async () => {
    let resolveExecution: ((value: WorkflowExecution) => void) | null = null;
    state.getExecutionDetails.mockImplementationOnce(
      () =>
        new Promise<WorkflowExecution>((resolve) => {
          resolveExecution = resolve;
        })
    );
    state.getExecutionVCStatus.mockResolvedValue({ has_vc: true, status: "verified" });

    renderPage();

    expect(screen.getByText("Loading execution details…")).toBeInTheDocument();

    resolveExecution?.(buildExecution());

    expect(await screen.findByText("Header exec-1")).toBeInTheDocument();
    expect(screen.getByText("Observability exec-1")).toBeInTheDocument();
    expect(screen.getByText("Notes exec-1")).toBeInTheDocument();
    expect(screen.getByText("tag-a")).toBeInTheDocument();

    fireEvent.click(screen.getByText("session-1"));
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/executions?session_id=session-1");
    });
  });
});
