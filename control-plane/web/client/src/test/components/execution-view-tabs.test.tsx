import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExecutionViewTabs } from "@/components/ExecutionViewTabs";
import {
  getExecutionViewStats,
  getExecutionsByViewMode,
  searchExecutionData,
} from "@/services/workflowsApi";

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />;
  return {
    CaretDown: Icon,
    FunnelSimple: Icon,
    Pulse: Icon,
    SortAscending: Icon,
    SortDescending: Icon,
    Table: Icon,
    TreeStructure: Icon,
    User: Icon,
    FlowArrow: Icon,
  };
});

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SearchBar", () => ({
  SearchBar: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="execution-tabs-search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div>separator</div>,
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
    }: React.PropsWithChildren<{ value: string }>) => {
      const ctx = ReactModule.useContext(TabsContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange?.(value)}>
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

vi.mock("@/components/EnhancedExecutionsTable", () => ({
  EnhancedExecutionsTable: ({
    executions,
    onExecutionClick,
    onLoadMore,
    onSortChange,
  }: {
    executions: Array<{ execution_id: string }>;
    onExecutionClick?: (execution: { execution_id: string }) => void;
    onLoadMore?: () => void;
    onSortChange?: (field: string) => void;
  }) => (
    <div>
      <div>{`executions:${executions.length}`}</div>
      <button type="button" onClick={() => onSortChange?.("duration")}>
        table-sort
      </button>
      <button type="button" onClick={() => onLoadMore?.()}>
        load-more-executions
      </button>
      {executions.map((execution) => (
        <button
          key={execution.execution_id}
          type="button"
          onClick={() => onExecutionClick?.(execution)}
        >
          {execution.execution_id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/WorkflowsTable", () => ({
  WorkflowsTable: ({
    workflows,
    onWorkflowClick,
    onWorkflowsDeleted,
  }: {
    workflows: Array<{ run_id: string }>;
    onWorkflowClick?: (workflow: { run_id: string }) => void;
    onWorkflowsDeleted?: () => void;
  }) => (
    <div>
      <div>{`workflows:${workflows.length}`}</div>
      <button type="button" onClick={() => onWorkflowsDeleted?.()}>
        workflows-deleted
      </button>
      {workflows.map((workflow) => (
        <button
          key={workflow.run_id}
          type="button"
          onClick={() => onWorkflowClick?.(workflow)}
        >
          {workflow.run_id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/services/workflowsApi", () => ({
  getExecutionsByViewMode: vi.fn(),
  searchExecutionData: vi.fn(),
  getExecutionViewStats: vi.fn(),
}));

const mockedGetExecutionsByViewMode = vi.mocked(getExecutionsByViewMode);
const mockedSearchExecutionData = vi.mocked(searchExecutionData);
const mockedGetExecutionViewStats = vi.mocked(getExecutionViewStats);

function buildExecutionsResponse() {
  return {
    executions: [
      {
        execution_id: "exec-1",
        workflow_id: "wf-1",
        status: "running",
        task_name: "Planner",
        workflow_name: "wf",
        agent_name: "agent-1",
        relative_time: "now",
        duration_display: "1m",
        started_at: "2026-04-08T00:00:00Z",
      },
    ],
    total_count: 1,
    page: 1,
    page_size: 20,
    total_pages: 2,
    has_more: true,
  };
}

function buildWorkflowsResponse() {
  return {
    workflows: [
      {
        run_id: "run-1",
        workflow_id: "wf-1",
        status: "running",
        root_reasoner: "Planner",
        current_task: "Investigate",
        total_executions: 3,
        max_depth: 2,
        started_at: "2026-04-08T00:00:00Z",
        latest_activity: "2026-04-08T00:01:00Z",
        display_name: "Workflow 1",
        status_counts: { running: 1 },
        active_executions: 1,
        terminal: false,
      },
    ],
    total_count: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    has_more: false,
  };
}

describe("ExecutionViewTabs", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockedGetExecutionsByViewMode.mockReset();
    mockedSearchExecutionData.mockReset();
    mockedGetExecutionViewStats.mockReset();
    mockedGetExecutionViewStats.mockResolvedValue({
      total_count: 4,
      status_breakdown: {
        running: 2,
        completed: 1,
        failed: 1,
      },
    });
    mockedSearchExecutionData.mockResolvedValue(buildExecutionsResponse() as never);
    mockedGetExecutionsByViewMode.mockImplementation(async (viewMode, _filters, page) => {
      if (viewMode === "workflows") {
        return { ...buildWorkflowsResponse(), page } as never;
      }
      return { ...buildExecutionsResponse(), page } as never;
    });
  });

  it("fetches executions, renders stats, supports search, sort, filter, paging, and navigation", async () => {
    const user = userEvent.setup();
    render(<ExecutionViewTabs />);

    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenCalledWith(
        "executions",
        {},
        1,
        20,
        "started_at",
        "desc"
      );
    });

    expect(screen.getByText("Execution Monitor")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("executions:1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "exec-1" }));
    expect(navigate).toHaveBeenCalledWith("/executions/exec-1");

    fireEvent.change(screen.getByLabelText("execution-tabs-search"), {
      target: { value: "planner" },
    });
    await waitFor(() => {
      expect(mockedSearchExecutionData).toHaveBeenCalledWith(
        "planner",
        "executions",
        {},
        1,
        20
      );
    });

    await user.click(screen.getByRole("button", { name: "Running" }));
    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenLastCalledWith(
        "executions",
        { status: "running" },
        1,
        20,
        "started_at",
        "desc"
      );
    });

    await user.click(screen.getByRole("button", { name: "Duration" }));
    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenLastCalledWith(
        "executions",
        { status: "running" },
        1,
        20,
        "duration_ms",
        "desc"
      );
    });

    await user.click(screen.getByRole("button", { name: "load-more-executions" }));
    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenLastCalledWith(
        "executions",
        { status: "running" },
        2,
        20,
        "duration_ms",
        "desc"
      );
    });
  });

  it("switches to workflows, navigates to workflow detail, and refreshes after deletion", async () => {
    const user = userEvent.setup();
    render(<ExecutionViewTabs />);

    await screen.findByText("executions:1");
    await user.click(screen.getByRole("button", { name: "Workflows" }));

    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenLastCalledWith(
        "workflows",
        {},
        1,
        20,
        "updated_at",
        "desc"
      );
    });

    expect(screen.getByText("workflows:1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "run-1" }));
    expect(navigate).toHaveBeenCalledWith("/workflows/run-1");

    await user.click(screen.getByRole("button", { name: "workflows-deleted" }));
    await waitFor(() => {
      expect(mockedGetExecutionsByViewMode).toHaveBeenLastCalledWith(
        "workflows",
        {},
        1,
        20,
        "updated_at",
        "desc"
      );
    });
  });
});
