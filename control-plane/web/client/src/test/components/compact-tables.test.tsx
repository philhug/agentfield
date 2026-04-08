import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompactExecutionsTable } from "@/components/CompactExecutionsTable";
import AgentNodesTable from "@/components/AgentNodesTable";
import { NodesVirtualList } from "@/components/NodesVirtualList";
import { getNodeDetails } from "@/services/api";

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />;
  return {
    Renew: Icon,
    Security: Icon,
    Terminal: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    ServerProxy: Icon,
    Time: Icon,
    Earth: Icon,
    Network_3: Icon,
    WarningFilled: Icon,
    ErrorFilled: Icon,
    CloudOffline: Icon,
  };
});

vi.mock("@/components/status/UnifiedStatusIndicator", () => ({
  __esModule: true,
  default: ({
    status,
    healthStatus,
  }: {
    status: string;
    healthStatus?: string;
  }) => <span>{healthStatus ? `${status}:${healthStatus}` : status}</span>,
  getLifecycleStatusPriority: (status: string, health?: string) => {
    if (status === "offline") return 0;
    if (status === "degraded" || health === "degraded") return 1;
    if (status === "starting") return 2;
    return 3;
  },
}));

vi.mock("@/components/vc/VerifiableCredentialBadge", () => ({
  VerifiableCredentialBadge: ({
    status,
    executionId,
  }: {
    status: string;
    executionId?: string;
  }) => <span>{`vc:${status}:${executionId ?? "none"}`}</span>,
}));

vi.mock("@/hooks/useVCVerification", () => ({
  useExecutionVCStatus: (executionId: string) => ({
    vcStatus:
      executionId === "exec-1"
        ? { has_vc: true, status: "verified" }
        : null,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/ui/data-formatters", () => ({
  formatDurationHumanReadable: (value: number) => `${value}ms`,
  LiveElapsedDuration: ({ startedAt }: { startedAt: string }) => (
    <span>{`live:${startedAt}`}</span>
  ),
}));

vi.mock("@/utils/status", () => ({
  normalizeExecutionStatus: (status: string) => status,
}));

vi.mock("@/components/ui/FastTableSearch", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/FastTableSearch")>(
    "@/components/ui/FastTableSearch"
  );
  return {
    ...actual,
    FastTableSearch: ({
      onSearch,
      placeholder,
      resultCount,
      totalCount,
    }: {
      onSearch: (value: string) => void;
      placeholder?: string;
      resultCount?: number;
      totalCount?: number;
    }) => (
      <div>
        <input
          aria-label="execution-search"
          placeholder={placeholder}
          onChange={(event) => onSearch(event.target.value)}
        />
        <span>{`counts:${resultCount}:${totalCount}`}</span>
      </div>
    ),
  };
});

vi.mock("@/components/ui/CompactTable", () => ({
  CompactTable: <T extends { execution_id?: string; id?: string }>({
    data,
    columns,
    emptyState,
    onRowClick,
    onSortChange,
  }: {
    data: T[];
    columns: Array<{
      key: string;
      header: React.ReactNode;
      render: (item: T, index: number) => React.ReactNode;
    }>;
    emptyState?: {
      title: string;
      description: string;
      action?: { label: string; onClick: () => void };
      secondaryAction?: { label: string; onClick: () => void };
    };
    onRowClick?: (item: T) => void;
    onSortChange: (field: string) => void;
  }) =>
    data.length === 0 ? (
      <div>
        <div>{emptyState?.title}</div>
        <div>{emptyState?.description}</div>
        {emptyState?.action ? (
          <button type="button" onClick={emptyState.action.onClick}>
            {emptyState.action.label}
          </button>
        ) : null}
        {emptyState?.secondaryAction ? (
          <button type="button" onClick={emptyState.secondaryAction.onClick}>
            {emptyState.secondaryAction.label}
          </button>
        ) : null}
      </div>
    ) : (
      <div>
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            onClick={() => onSortChange(column.key)}
          >
            {typeof column.header === "string" ? column.header : column.key}
          </button>
        ))}
        {data.map((item, index) => (
          <button
            key={item.execution_id ?? item.id ?? String(index)}
            type="button"
            onClick={() => onRowClick?.(item)}
          >
            {columns.map((column) => (
              <span key={column.key}>{column.render(item, index)}</span>
            ))}
          </button>
        ))}
      </div>
    ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
  TableBody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children, colSpan }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td colSpan={colSpan}>{children}</td>
  ),
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

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CollapsibleTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CollapsibleContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/components/ReasonersList", () => ({
  __esModule: true,
  default: ({ reasoners }: { reasoners: Array<{ name?: string; id?: string }> }) => (
    <div>{`reasoners:${reasoners.map((item) => item.name ?? item.id).join(",")}`}</div>
  ),
}));

vi.mock("@/components/SkillsList", () => ({
  __esModule: true,
  default: ({ skills }: { skills: Array<{ name?: string; id?: string }> }) => (
    <div>{`skills:${skills.map((item) => item.name ?? item.id).join(",")}`}</div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <span>loading</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div>separator</div>,
}));

vi.mock("@/components/NodeCard", () => ({
  NodeCard: ({
    nodeSummary,
    searchQuery,
  }: {
    nodeSummary: { id: string };
    searchQuery?: string;
  }) => <div>{`${nodeSummary.id}${searchQuery ? `:${searchQuery}` : ""}`}</div>,
}));

vi.mock("@/utils/node-status", () => ({
  getNodeStatusPresentation: () => ({
    theme: {
      indicatorClass: "indicator",
      pillClass: "pill",
      textClass: "text",
    },
  }),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/card", () => ({
  cardVariants: () => "card",
}));

vi.mock("@/components/ui/empty", () => ({
  Empty: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  EmptyHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  EmptyMedia: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  EmptyTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  EmptyDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/services/api", () => ({
  getNodeDetails: vi.fn(),
}));

const mockedGetNodeDetails = vi.mocked(getNodeDetails);

function buildExecution(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: "exec-1",
    workflow_id: "wf-1",
    status: "running",
    task_name: "Planner",
    workflow_name: "Workflow",
    agent_name: "agent-a",
    relative_time: "2m ago",
    duration_display: "2m",
    started_at: "2026-04-08T00:00:00Z",
    duration_ms: 1200,
    ...overrides,
  };
}

function buildNodeSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: "node-1",
    base_url: "https://node-1.example.com",
    version: "1.0.0",
    team_id: "team-a",
    health_status: "ready",
    lifecycle_status: "ready",
    last_heartbeat: "2026-04-08T11:59:30Z",
    reasoner_count: 2,
    skill_count: 1,
    ...overrides,
  };
}

describe("CompactExecutionsTable", () => {
  it("renders execution rows, filters via search, and triggers row and sort actions", async () => {
    const user = userEvent.setup();
    const onExecutionClick = vi.fn();
    const onSortChange = vi.fn();

    render(
      <CompactExecutionsTable
        executions={[
          buildExecution(),
          buildExecution({
            execution_id: "exec-2",
            task_name: "Reviewer",
            agent_name: "agent-b",
            status: "completed",
            duration_ms: 0,
            duration_display: "—",
          }),
        ] as never[]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="when"
        sortOrder="desc"
        onSortChange={onSortChange}
        onExecutionClick={onExecutionClick}
      />
    );

    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("vc:verified:exec-1")).toBeInTheDocument();
    expect(screen.getByText("vc:none:none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reasoner" }));
    expect(onSortChange).toHaveBeenCalledWith("task_name");

    await user.click(screen.getByRole("button", { name: /Planner/ }));
    expect(onExecutionClick).toHaveBeenCalledWith(
      expect.objectContaining({ execution_id: "exec-1" })
    );

    fireEvent.change(screen.getByLabelText("execution-search"), {
      target: { value: "reviewer" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Planner")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
  });

  it("shows empty-state refresh and clear-search actions", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    const { rerender } = render(
      <CompactExecutionsTable
        executions={[]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="when"
        sortOrder="desc"
        onSortChange={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh data" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <CompactExecutionsTable
        executions={[buildExecution() as never]}
        loading={false}
        hasMore={false}
        isFetchingMore={false}
        sortBy="when"
        sortOrder="desc"
        onSortChange={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    fireEvent.change(screen.getByLabelText("execution-search"), {
      target: { value: "missing" },
    });

    await waitFor(() => {
      expect(screen.getByText("No matching executions")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => {
      expect(screen.getByText("Planner")).toBeInTheDocument();
    });
  });
});

describe("AgentNodesTable", () => {
  beforeEach(() => {
    mockedGetNodeDetails.mockReset();
  });

  it("renders loading, error, and empty states", () => {
    const { rerender } = render(
      <AgentNodesTable nodes={[]} isLoading={true} error={null} />
    );
    expect(screen.getAllByText("loading").length).toBeGreaterThan(1);

    rerender(<AgentNodesTable nodes={[]} isLoading={false} error="boom" />);
    expect(screen.getByText("boom")).toBeInTheDocument();

    rerender(<AgentNodesTable nodes={[]} isLoading={false} error={null} />);
    expect(screen.getByText("No Agent Nodes")).toBeInTheDocument();
  });

  it("expands a node row and loads details", async () => {
    const user = userEvent.setup();
    mockedGetNodeDetails.mockResolvedValue({
      id: "node-1",
      base_url: "https://node-1.example.com",
      version: "1.0.0",
      team_id: "team-a",
      health_status: "ready",
      lifecycle_status: "ready",
      registered_at: "2026-04-08T10:00:00Z",
      last_heartbeat: "2026-04-08T11:59:00Z",
      reasoners: [{ id: "reasoner-1", name: "Planner" }],
      skills: [{ id: "skill-1", name: "Search" }],
    } as never);

    render(
      <AgentNodesTable
        nodes={[buildNodeSummary() as never]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText("node-1")).toBeInTheDocument();
    expect(screen.getByText("ready:ready")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    await waitFor(() => {
      expect(mockedGetNodeDetails).toHaveBeenCalledWith("node-1");
    });
    expect(await screen.findByText("https://node-1.example.com")).toBeInTheDocument();
    expect(screen.getByText("reasoners:Planner")).toBeInTheDocument();
    expect(screen.getByText("skills:Search")).toBeInTheDocument();
  });
});

describe("NodesVirtualList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
  });

  it("renders grouped sections, expands offline nodes, and loads more running nodes", async () => {
    const freshNodes = Array.from({ length: 21 }, (_, index) =>
      buildNodeSummary({
        id: `fresh-${index + 1}`,
        reasoner_count: index,
        skill_count: 1,
        last_heartbeat: "2026-04-08T11:59:30Z",
      })
    );

    render(
      <NodesVirtualList
        nodes={[
          ...freshNodes,
          buildNodeSummary({
            id: "stale-1",
            last_heartbeat: "2026-04-08T11:56:30Z",
          }),
          buildNodeSummary({
            id: "very-stale-1",
            last_heartbeat: "2026-04-08T11:50:00Z",
          }),
          buildNodeSummary({
            id: "degraded-1",
            lifecycle_status: "degraded",
            health_status: "degraded",
          }),
          buildNodeSummary({
            id: "starting-1",
            lifecycle_status: "starting",
            health_status: "starting",
          }),
          buildNodeSummary({
            id: "offline-1",
            lifecycle_status: "offline",
            health_status: "offline",
          }),
        ] as never[]}
        searchQuery=""
        isLoading={false}
      />
    );

    expect(screen.getByText("Ready & responsive")).toBeInTheDocument();
    expect(screen.getByText("Running (Stale)")).toBeInTheDocument();
    expect(screen.getByText("Running (Very Stale)")).toBeInTheDocument();
    expect(screen.getByText("Running (Degraded)")).toBeInTheDocument();
    expect(screen.getByText("Starting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show 1 more running nodes/i }));
    expect(screen.getByText("fresh-21")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Offline/i }));
    expect(screen.getByText("offline-1")).toBeInTheDocument();
  });

  it("renders loading, empty, and search-result states", () => {
    const { rerender } = render(
      <NodesVirtualList nodes={[]} searchQuery="" isLoading={true} />
    );
    expect(screen.getAllByText("loading").length).toBeGreaterThan(1);

    rerender(<NodesVirtualList nodes={[]} searchQuery="" isLoading={false} />);
    expect(screen.getByText("No agent nodes")).toBeInTheDocument();

    rerender(
      <NodesVirtualList
        nodes={[
          buildNodeSummary({ id: "node-a", team_id: "alpha-team" }),
          buildNodeSummary({ id: "node-b", team_id: "beta-team" }),
        ] as never[]}
        searchQuery="beta"
        isLoading={false}
      />
    );

    expect(screen.getByText("node-b:beta")).toBeInTheDocument();
    expect(screen.queryByText("node-a:beta")).not.toBeInTheDocument();
  });
});
