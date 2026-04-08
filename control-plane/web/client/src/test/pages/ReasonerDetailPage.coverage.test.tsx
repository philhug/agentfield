import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ReasonerDetailPage } from "@/pages/ReasonerDetailPage";
import type { ExecutionHistory, PerformanceMetrics } from "@/types/execution";
import type { ReasonerWithNode } from "@/types/reasoners";

const state = vi.hoisted(() => ({
  getReasonerDetails: vi.fn<(id: string) => Promise<ReasonerWithNode>>(),
  getPerformanceMetrics: vi.fn<(id: string) => Promise<PerformanceMetrics>>(),
  getExecutionHistory: vi.fn<(id: string, page: number, limit: number) => Promise<ExecutionHistory>>(),
  addExecution: vi.fn(),
  latestExecutionHandler:
    null as null | ((execution: {
      id: string;
      inputSummary: string;
      status: string;
      result?: unknown;
      duration?: number;
      error?: string;
    }) => void),
}));

vi.mock("@/services/reasonersApi", () => ({
  reasonersApi: {
    getReasonerDetails: (id: string) => state.getReasonerDetails(id),
    getPerformanceMetrics: (id: string) => state.getPerformanceMetrics(id),
    getExecutionHistory: (id: string, page: number, limit: number) =>
      state.getExecutionHistory(id, page, limit),
  },
}));

vi.mock("@/utils/schemaUtils", () => ({
  generateExampleData: () => ({ prompt: "hello" }),
  validateFormData: () => ({ isValid: true, errors: [] }),
}));

vi.mock("@/utils/status", () => ({
  normalizeExecutionStatus: (status: string) =>
    status === "completed" ? "succeeded" : status,
}));

vi.mock("@/components/reasoners/ExecutionForm", () => ({
  ExecutionForm: ({
    formData,
    onChange,
  }: {
    formData: { input?: unknown };
    onChange: (value: { input?: unknown }) => void;
  }) => (
    <div>
      <div>Form {JSON.stringify(formData.input ?? {})}</div>
      <button
        type="button"
        onClick={() => onChange({ input: { prompt: "updated" } })}
      >
        Update form
      </button>
    </div>
  ),
}));

vi.mock("@/components/reasoners/ExecutionQueue", async () => {
  const ReactModule = await import("react");
  return {
    ExecutionQueue: ReactModule.forwardRef(
      (
        {
          onExecutionComplete,
          onExecutionSelect,
        }: {
          onExecutionComplete?: (execution: {
            id: string;
            inputSummary: string;
            status: string;
            result?: unknown;
            duration?: number;
            error?: string;
          }) => void;
          onExecutionSelect?: (execution: {
            id: string;
            inputSummary: string;
            status: string;
            result?: unknown;
            duration?: number;
            error?: string;
          } | null) => void;
        },
        ref: React.ForwardedRef<{ addExecution: (input: unknown) => void }>
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          addExecution: (input: unknown) => {
            state.addExecution(input);
            const execution = {
              id: "exec-1",
              inputSummary: "updated",
              status: "completed",
              result: { ok: true },
              duration: 42,
            };
            onExecutionComplete?.(execution);
            onExecutionSelect?.(execution);
          },
        }));
        return <div>Execution queue</div>;
      }
    ),
  };
});

vi.mock("@/components/reasoners/ExecutionHistoryList", () => ({
  ExecutionHistoryList: ({ history }: { history: ExecutionHistory | null }) => (
    <div>History {(history?.items || []).length}</div>
  ),
}));

vi.mock("@/components/reasoners/FormattedOutput", () => ({
  FormattedOutput: ({
    data,
    onToggleView,
  }: {
    data: unknown;
    onToggleView?: () => void;
  }) => (
    <div>
      <div>Output {JSON.stringify(data)}</div>
      <button type="button" onClick={onToggleView}>
        Toggle output view
      </button>
    </div>
  ),
}));

vi.mock("@/components/reasoners/PerformanceChart", () => ({
  PerformanceChart: ({ metrics }: { metrics: PerformanceMetrics | null }) => (
    <div>Metrics chart {metrics?.total_executions ?? 0}</div>
  ),
}));

vi.mock("@/components/reasoners/ReasonerStatusDot", () => ({
  ReasonerStatusDot: ({ status }: { status: string }) => <div>Status {status}</div>,
}));

vi.mock("@/components/ui/json-syntax-highlight", () => ({
  JsonHighlightedPre: ({ data }: { data: unknown }) => (
    <pre>{JSON.stringify(data)}</pre>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");
  const TabsContext = ReactModule.createContext("activity");

  return {
    Tabs: ({
      children,
      defaultValue,
    }: React.PropsWithChildren<{ defaultValue?: string }>) => (
      <TabsContext.Provider value={defaultValue ?? "activity"}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    TabsTrigger: ({ children }: React.PropsWithChildren) => (
      <button type="button">{children}</button>
    ),
    TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  };
});

vi.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onValueChange?.(value === "formatted" ? "json" : "formatted")}
    >
      Switch result view
    </button>
  ),
}));

vi.mock("@/components/layout/ResponsiveGrid", () => ({
  ResponsiveGrid: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props} />
  );
  return {
    Activity: Icon,
    Analytics: Icon,
    CheckmarkFilled: Icon,
    Code: Icon,
    Copy: Icon,
    InProgress: Icon,
    Play: Icon,
    Time: Icon,
    View: Icon,
  };
});

const makeReasoner = (): ReasonerWithNode => ({
  reasoner_id: "node-1.reasoner-a",
  name: "Reasoner A",
  description: "does work",
  node_id: "node-1",
  node_status: "active",
  node_version: "1.0.0",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  memory_config: {
    auto_inject: [],
    memory_retention: "short",
    cache_results: false,
  },
  tags: ["alpha"],
  last_updated: "2026-04-08T00:00:00Z",
});

const makeMetrics = (): PerformanceMetrics =>
  ({
    avg_response_time_ms: 12,
    success_rate: 0.9,
    total_executions: 5,
    executions_last_24h: 2,
    executions_by_hour: [],
    response_times: [],
    error_rate: 0.1,
  }) as PerformanceMetrics;

const makeHistory = (): ExecutionHistory =>
  ({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    has_more: false,
  }) as ExecutionHistory;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reasoners/node-1.reasoner-a"]}>
      <Routes>
        <Route
          path="/reasoners/:fullReasonerId"
          element={<ReasonerDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ReasonerDetailPage coverage", () => {
  beforeEach(() => {
    state.getReasonerDetails.mockReset();
    state.getPerformanceMetrics.mockReset();
    state.getExecutionHistory.mockReset();
    state.addExecution.mockReset();
    state.latestExecutionHandler = null;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it("renders loading then populated state and handles copy and execute flows", async () => {
    let resolveReasoner: ((value: ReasonerWithNode) => void) | undefined;
    state.getReasonerDetails.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReasoner = resolve;
        })
    );
    state.getPerformanceMetrics.mockResolvedValue(makeMetrics());
    state.getExecutionHistory.mockResolvedValue(makeHistory());

    renderPage();

    expect(screen.getByText("Loading reasoner details...")).toBeInTheDocument();

    resolveReasoner?.(makeReasoner());

    expect(await screen.findByText("Reasoner A")).toBeInTheDocument();
    expect(screen.getByText("Execution queue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy cURL" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Update form" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute Reasoner" }));

    await waitFor(() =>
      expect(state.addExecution).toHaveBeenCalledWith({ prompt: "updated" })
    );
    expect(
      await screen.findByText("Result from execution: updated")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch result view" }));
  });

  it("renders error state when details fail", async () => {
    state.getReasonerDetails.mockRejectedValue(new Error("Reasoner not found"));
    state.getPerformanceMetrics.mockResolvedValue(makeMetrics());
    state.getExecutionHistory.mockResolvedValue(makeHistory());

    renderPage();

    expect(await screen.findByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Reasoner not found")).toBeInTheDocument();
  });
});
