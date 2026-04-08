// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { ExecutionsPage } from "@/pages/ExecutionsPage";
import type { EnhancedExecution } from "@/types/workflows";

const state = vi.hoisted(() => ({
  getEnhancedExecutions: vi.fn<(filters: any, sortBy: string, sortOrder: string, page: number) => Promise<any>>(),
  streamExecutionEvents: vi.fn<() => any>(),
  getNextTimeRange: vi.fn<(value: string) => string | null>(),
  eventSource: {
    onmessage: null as ((event: MessageEvent<string>) => void) | null,
    onerror: null as ((event: unknown) => void) | null,
    close: vi.fn(),
  },
}));

vi.mock("@/services/executionsApi", () => ({
  getEnhancedExecutions: (
    filters: any,
    sortBy: string,
    sortOrder: string,
    page: number,
    _pageSize: number,
    _signal: AbortSignal
  ) => state.getEnhancedExecutions(filters, sortBy, sortOrder, page),
  streamExecutionEvents: () => state.streamExecutionEvents(),
}));

vi.mock("@/lib/timeRanges", () => ({
  getNextTimeRange: (value: string) => state.getNextTimeRange(value),
}));

vi.mock("@/components/PageHeader", () => ({
  STATUS_FILTER_OPTIONS: [],
  TIME_FILTER_OPTIONS: [],
  PageHeader: ({
    title,
    filters,
  }: {
    title: string;
    filters: Array<{ label: string; value: string; onChange: (value: string) => void }>;
  }) => (
    <div>
      <h1>{title}</h1>
      {filters.map((filter) => (
        <button key={filter.label} type="button" onClick={() => filter.onChange("failed")}>
          {filter.label}:{filter.value}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/CompactExecutionsTable", () => ({
  CompactExecutionsTable: ({
    executions,
    loading,
    hasMore,
    sortBy,
    sortOrder,
    onSortChange,
    onLoadMore,
    onExecutionClick,
    onRefresh,
  }: {
    executions: EnhancedExecution[];
    loading: boolean;
    hasMore: boolean;
    sortBy: string;
    sortOrder: string;
    onSortChange: (field: string, order?: "asc" | "desc") => void;
    onLoadMore: () => void;
    onExecutionClick: (execution: EnhancedExecution) => void;
    onRefresh: () => void;
  }) => (
    <div>
      <div>loading:{String(loading)}</div>
      <div>rows:{executions.length}</div>
      <div>sort:{sortBy}:{sortOrder}</div>
      <div>hasMore:{String(hasMore)}</div>
      <button type="button" onClick={() => onSortChange("status", "asc")}>
        sort status
      </button>
      <button type="button" onClick={onLoadMore}>
        load more
      </button>
      <button type="button" onClick={onRefresh}>
        refresh
      </button>
      {executions.map((execution) => (
        <button
          key={execution.execution_id}
          type="button"
          onClick={() => onExecutionClick(execution)}
        >
          open {execution.execution_id}
        </button>
      ))}
    </div>
  ),
}));

function buildExecution(overrides: Partial<EnhancedExecution> = {}): EnhancedExecution {
  return {
    execution_id: "exec-1",
    workflow_id: "wf-1",
    status: "succeeded",
    task_name: "task",
    workflow_name: "Workflow",
    agent_name: "Agent",
    relative_time: "just now",
    duration_display: "2s",
    started_at: "2026-04-08T00:00:00Z",
    ...overrides,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/executions"]}>
      <Routes>
        <Route path="/executions" element={<ExecutionsPage />} />
        <Route path="/executions/:executionId" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ExecutionsPage", () => {
  beforeEach(() => {
    state.getEnhancedExecutions.mockReset();
    state.streamExecutionEvents.mockReset();
    state.getNextTimeRange.mockReset();
    state.eventSource.onmessage = null;
    state.eventSource.onerror = null;
    state.eventSource.close.mockReset();
    state.getNextTimeRange.mockReturnValue(null);
    state.streamExecutionEvents.mockReturnValue(state.eventSource);
  });

  it("renders loading, then populated rows, and navigates on execution click", async () => {
    let resolveExecutions: ((value: any) => void) | null = null;
    state.getEnhancedExecutions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveExecutions = resolve;
        })
    );

    renderPage();

    expect(screen.getByText("loading:true")).toBeInTheDocument();

    resolveExecutions?.({
      executions: [buildExecution()],
      has_more: false,
    });

    expect(await screen.findByText("rows:1")).toBeInTheDocument();
    expect(screen.getByText("hasMore:false")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open exec-1/i }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/executions/exec-1");
  });

  it("refreshes when a stream event arrives", async () => {
    state.getEnhancedExecutions.mockResolvedValue({
      executions: [buildExecution()],
      has_more: false,
    });

    renderPage();
    await screen.findByText("rows:1");

    state.eventSource.onmessage?.({
      data: JSON.stringify({ execution: { execution_id: "exec-2" } }),
    } as MessageEvent<string>);

    await waitFor(() => {
      expect(state.getEnhancedExecutions).toHaveBeenCalledTimes(2);
    });
  });
});