import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RedesignedExecutionDetailPage } from "@/pages/RedesignedExecutionDetailPage";
import type { WorkflowExecution } from "@/types/executions";

const state = vi.hoisted(() => ({
  getExecutionDetails: vi.fn<(executionId: string) => Promise<WorkflowExecution>>(),
}));

vi.mock("@/services/executionsApi", () => ({
  getExecutionDetails: (executionId: string) => state.getExecutionDetails(executionId),
}));

vi.mock("@/components/layout/ResponsiveGrid", () => ({
  ResponsiveGrid: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/execution/ExecutionDetailsLayout", () => ({
  ExecutionDetailsLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/execution/CompactExecutionHeader", () => ({
  CompactExecutionHeader: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Compact header {execution.execution_id}</div>
  ),
}));

vi.mock("@/components/execution/EnhancedDataPanel", () => ({
  EnhancedDataPanel: ({
    execution,
    type,
  }: {
    execution: WorkflowExecution;
    type: string;
  }) => <div>{type} {execution.execution_id}</div>,
}));

vi.mock("@/components/execution/RedesignedErrorPanel", () => ({
  RedesignedErrorPanel: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Error {execution.error_message}</div>
  ),
}));

vi.mock("@/components/execution/EnhancedNotesSection", () => ({
  EnhancedNotesSection: ({
    execution,
    onRefresh,
  }: {
    execution: WorkflowExecution;
    onRefresh: () => void;
  }) => (
    <div>
      <div>Notes {execution.execution_id}</div>
      <button type="button" onClick={() => void onRefresh()}>
        Refresh execution
      </button>
    </div>
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

vi.mock("@/components/ui/icon-bridge", () => ({
  Settings: () => <span>icon</span>,
}));

function buildExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 1,
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agentfield_request_id: "req-1",
    agent_node_id: "node-1",
    workflow_depth: 2,
    reasoner_id: "planner",
    input_data: { prompt: "hi" },
    output_data: { answer: "hello" },
    input_size: 1,
    output_size: 1,
    input_uri: "s3://bucket/input.json",
    result_uri: "s3://bucket/result.json",
    workflow_tags: [],
    status: "failed",
    started_at: "2026-04-08T00:00:01Z",
    completed_at: "2026-04-08T00:00:05Z",
    error_message: "boom",
    retry_count: 0,
    created_at: "2026-04-08T00:00:00Z",
    updated_at: "2026-04-08T00:00:05Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/executions/exec-1"]}>
      <Routes>
        <Route path="/executions/:executionId" element={<RedesignedExecutionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RedesignedExecutionDetailPage", () => {
  beforeEach(() => {
    state.getExecutionDetails.mockReset();
  });

  it("renders loading, then populated details, and refreshes from notes", async () => {
    let resolveExecution: ((value: WorkflowExecution) => void) | null = null;
    state.getExecutionDetails.mockImplementationOnce(
      () =>
        new Promise<WorkflowExecution>((resolve) => {
          resolveExecution = resolve;
        })
    );
    state.getExecutionDetails.mockResolvedValue(buildExecution({ execution_id: "exec-1-refresh" }));

    renderPage();

    expect(screen.getByText("Loading execution details...")).toBeInTheDocument();

    resolveExecution?.(buildExecution());

    expect(await screen.findByText("Compact header exec-1")).toBeInTheDocument();
    expect(screen.getByText("input exec-1")).toBeInTheDocument();
    expect(screen.getByText("output exec-1")).toBeInTheDocument();
    expect(screen.getByText("Error boom")).toBeInTheDocument();
    expect(screen.getByText("s3://bucket/input.json")).toBeInTheDocument();
    expect(screen.getByText("s3://bucket/result.json")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /refresh execution/i }));

    await waitFor(() => {
      expect(state.getExecutionDetails).toHaveBeenCalledTimes(2);
    });
  });
});
