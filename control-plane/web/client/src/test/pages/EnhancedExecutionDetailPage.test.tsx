// @ts-nocheck
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { EnhancedExecutionDetailPage } from "@/pages/EnhancedExecutionDetailPage";
import type { WorkflowExecution } from "@/types/executions";

const state = vi.hoisted(() => ({
  getExecutionDetails: vi.fn<(executionId: string) => Promise<WorkflowExecution>>(),
  retryExecutionWebhook: vi.fn<(executionId: string) => Promise<void>>(),
  getExecutionVCStatus: vi.fn<(executionId: string) => Promise<any>>(),
}));

vi.mock("@/services/executionsApi", () => ({
  getExecutionDetails: (executionId: string) => state.getExecutionDetails(executionId),
  retryExecutionWebhook: (executionId: string) => state.retryExecutionWebhook(executionId),
}));

vi.mock("@/services/vcApi", () => ({
  getExecutionVCStatus: (executionId: string) => state.getExecutionVCStatus(executionId),
}));

vi.mock("@/components/execution/CompactExecutionHeader", () => ({
  CompactExecutionHeader: ({
    execution,
    activeTab,
    onTabChange,
    onRefresh,
    onClose,
  }: {
    execution: WorkflowExecution;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onRefresh: () => void;
    onClose: () => void;
  }) => (
    <div>
      <h1>{execution.execution_id}</h1>
      <div>Execution tab {activeTab}</div>
      <button type="button" onClick={() => onTabChange("webhook")}>
        Webhook tab
      </button>
      <button type="button" onClick={onRefresh}>
        Refresh execution
      </button>
      <button type="button" onClick={onClose}>
        Close execution
      </button>
    </div>
  ),
}));

vi.mock("@/components/execution/ExecutionDataColumns", () => ({
  ExecutionDataColumns: ({ execution }: { execution: WorkflowExecution }) => (
    <div>IO {execution.execution_id}</div>
  ),
}));

vi.mock("@/components/execution/ExecutionWebhookActivity", () => ({
  ExecutionWebhookActivity: ({
    execution,
    onRetry,
    isRetrying,
    retryError,
  }: {
    execution: WorkflowExecution;
    onRetry: () => Promise<void>;
    isRetrying: boolean;
    retryError: string | null;
  }) => (
    <div>
      <div>Webhook {execution.webhook_events?.length ?? 0}</div>
      <div>Retrying {String(isRetrying)}</div>
      <div>{retryError ?? "no-error"}</div>
      <button type="button" onClick={() => void onRetry()}>
        Retry webhook
      </button>
    </div>
  ),
}));

vi.mock("@/components/execution/ExecutionApprovalPanel", () => ({
  ExecutionApprovalPanel: () => <div>Approval panel</div>,
}));

vi.mock("@/components/execution/RedesignedErrorPanel", () => ({
  RedesignedErrorPanel: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Error {execution.error_message}</div>
  ),
}));

vi.mock("@/components/execution/ExecutionRetryPanel", () => ({
  ExecutionRetryPanel: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Retry panel {execution.execution_id}</div>
  ),
}));

vi.mock("@/components/execution/ExecutionIdentityPanel", () => ({
  ExecutionIdentityPanel: ({
    vcStatus,
    vcLoading,
  }: {
    vcStatus: { status: string } | null;
    vcLoading: boolean;
  }) => <div>Identity {vcLoading ? "loading" : vcStatus?.status ?? "none"}</div>,
}));

vi.mock("@/components/execution/EnhancedNotesSection", () => ({
  EnhancedNotesSection: ({ execution }: { execution: WorkflowExecution }) => (
    <div>Notes {execution.notes?.length ?? 0}</div>
  ),
}));

vi.mock("@/components/execution/CollapsibleSection", () => ({
  CollapsibleSection: ({
    title,
    children,
  }: React.PropsWithChildren<{ title: string }>) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
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
  Database: () => <span>db</span>,
  Bug: () => <span>bug</span>,
  Shield: () => <span>shield</span>,
  Wrench: () => <span>wrench</span>,
  FileText: () => <span>file</span>,
  RadioTower: () => <span>radio</span>,
  Cog: () => <span>cog</span>,
  PauseCircle: () => <span>pause</span>,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function buildExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 1,
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agentfield_request_id: "req-1",
    agent_node_id: "node-1",
    workflow_depth: 1,
    reasoner_id: "planner",
    input_data: { input: true },
    output_data: { output: true },
    input_size: 1,
    output_size: 1,
    workflow_tags: ["tag"],
    status: "failed",
    started_at: "2026-04-08T00:00:00Z",
    completed_at: "2026-04-08T00:01:00Z",
    duration_ms: 60000,
    retry_count: 0,
    created_at: "2026-04-08T00:00:00Z",
    updated_at: "2026-04-08T00:01:00Z",
    webhook_registered: true,
    webhook_events: [{ id: 1, execution_id: "exec-1", event_type: "completed", status: "failed", created_at: "2026-04-08T00:01:00Z" }],
    notes: [{ message: "note", tags: [], timestamp: "2026-04-08T00:00:00Z" }],
    error_message: "boom",
    approval_request_id: "approval-1",
    approval_status: "pending",
    ...overrides,
  };
}

function renderPage(initialPath = "/executions/exec-1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/executions/:executionId" element={<EnhancedExecutionDetailPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("EnhancedExecutionDetailPage", () => {
  beforeEach(() => {
    state.getExecutionDetails.mockReset();
    state.retryExecutionWebhook.mockReset();
    state.getExecutionVCStatus.mockReset();
  });

  it("renders loading state, switches tabs, and retries webhook with refresh", async () => {
    let firstResolve: ((value: WorkflowExecution) => void) | null = null;
    state.getExecutionDetails
      .mockImplementationOnce(
        () =>
          new Promise<WorkflowExecution>((resolve) => {
            firstResolve = resolve;
          })
      )
      .mockResolvedValue(buildExecution({ execution_id: "exec-1-refreshed" }));
    state.getExecutionVCStatus.mockResolvedValue({ has_vc: true, status: "verified" });
    state.retryExecutionWebhook.mockResolvedValue();

    renderPage();
    expect(screen.getAllByText("loading").length).toBeGreaterThan(0);

    firstResolve?.(buildExecution());
    expect(await screen.findByText("exec-1")).toBeInTheDocument();
    expect(screen.getByText("Execution tab io")).toBeInTheDocument();
    expect(screen.getByText("IO exec-1")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "2", ctrlKey: true });
    expect(await screen.findByText("Execution tab webhook")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry webhook"));
    await waitFor(() => {
      expect(state.retryExecutionWebhook).toHaveBeenCalledWith("exec-1");
    });
    await waitFor(() => {
      expect(state.getExecutionDetails).toHaveBeenCalledTimes(2);
    });
  });

  it("renders meta/identity state and escape navigates back", async () => {
    state.getExecutionDetails.mockResolvedValue(
      buildExecution({
        input_uri: "s3://bucket/input.json",
        result_uri: "s3://bucket/result.json",
        actor_id: "actor-1",
        root_workflow_id: "root-1",
        parent_workflow_id: "parent-1",
      })
    );
    state.getExecutionVCStatus.mockResolvedValue({ has_vc: true, status: "verified" });

    renderPage();

    expect(await screen.findByText("exec-1")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "5", ctrlKey: true });
    expect(await screen.findByText("Execution tab identity")).toBeInTheDocument();
    expect(screen.getByText("Identity verified")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "6", ctrlKey: true });
    expect(await screen.findByText("Execution tab meta")).toBeInTheDocument();
    expect(screen.getByText("Technical Details")).toBeInTheDocument();
    expect(screen.getByText("s3://bucket/input.json")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/executions");
    });
  });
});