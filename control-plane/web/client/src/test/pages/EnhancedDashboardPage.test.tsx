import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { EnhancedDashboardPage } from "@/pages/EnhancedDashboardPage";

const pageState = vi.hoisted(() => ({
  refresh: vi.fn(),
  clearError: vi.fn(),
  setPreset: vi.fn(),
  toggleCompare: vi.fn(),
  enhancedDashboardResult: {
    data: null,
    loading: false,
    error: null as null | Error,
    hasError: false,
    refresh: vi.fn(),
    clearError: vi.fn(),
    isRefreshing: false,
  },
  timeRangeResult: {
    timeRange: { preset: "24h", compare: false },
    setPreset: vi.fn(),
    toggleCompare: vi.fn(),
    getApiParams: () => ({
      preset: "24h",
      startTime: undefined,
      endTime: undefined,
      compare: false,
    }),
    label: "Last 24h",
  },
}));

vi.mock("@/hooks/useEnhancedDashboard", () => ({
  useEnhancedDashboard: () => pageState.enhancedDashboardResult,
}));

vi.mock("@/hooks/useDashboardTimeRange", () => ({
  useDashboardTimeRange: () => pageState.timeRangeResult,
}));

vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    title,
    description,
    aside,
  }: {
    title: string;
    description: string;
    aside?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{aside}</div>
    </header>
  ),
}));

vi.mock("@/components/layout/ResponsiveGrid", () => {
  const ResponsiveGrid = ({ children }: React.PropsWithChildren) => (
    <div data-testid="responsive-grid">{children}</div>
  );
  ResponsiveGrid.Item = ({ children }: React.PropsWithChildren) => (
    <div data-testid="responsive-grid-item">{children}</div>
  );
  return { ResponsiveGrid };
});

vi.mock("@/components/ui/TrendMetricCard", () => ({
  TrendMetricCard: ({
    label,
    value,
    subtitle,
  }: {
    label: string;
    value: string | number;
    subtitle?: string;
  }) => (
    <section>
      <h2>{label}</h2>
      <div>{value}</div>
      {subtitle ? <p>{subtitle}</p> : null}
    </section>
  ),
}));

vi.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({
    title,
    description,
    error,
    onRetry,
    onDismiss,
  }: {
    title: string;
    description: string;
    error?: string;
    onRetry?: () => void;
    onDismiss?: () => void;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {error ? <p>{error}</p> : null}
      {onRetry ? <button onClick={onRetry}>Retry load</button> : null}
      {onDismiss ? <button onClick={onDismiss}>Dismiss error</button> : null}
    </div>
  ),
}));

vi.mock("@/components/dashboard/TimeRangeSelector", () => ({
  TimeRangeSelector: ({
    value,
    compare,
    onChange,
    onCompareChange,
  }: {
    value: string;
    compare?: boolean;
    onChange: (value: "1h" | "24h" | "7d" | "30d") => void;
    onCompareChange?: (value: boolean) => void;
  }) => (
    <div>
      <div>Range {value}</div>
      <button onClick={() => onChange("7d")}>Select 7d</button>
      <button onClick={() => onCompareChange?.(!compare)}>Toggle compare</button>
    </div>
  ),
}));

vi.mock("@/components/dashboard/HotspotPanel", () => ({
  HotspotPanel: ({ hotspots }: { hotspots: Array<{ reasoner_id: string }> }) => (
    <section>
      <h2>Problem Hotspots</h2>
      {hotspots.map((hotspot) => (
        <div key={hotspot.reasoner_id}>{hotspot.reasoner_id}</div>
      ))}
    </section>
  ),
}));

vi.mock("@/components/dashboard/ActivityHeatmap", () => ({
  ActivityHeatmap: ({ heatmapData }: { heatmapData: unknown[] }) => (
    <section>
      <h2>Activity Patterns</h2>
      <div>Heatmap rows {heatmapData.length}</div>
    </section>
  ),
}));

vi.mock("recharts", () => {
  const Wrapper = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    ResponsiveContainer: Wrapper,
    ComposedChart: Wrapper,
    Area: () => <div>area</div>,
    Line: () => <div>line</div>,
    XAxis: () => <div>x-axis</div>,
    Tooltip: () => <div>tooltip</div>,
  };
});

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className}>icon</span>;
  return {
    BarChart3: Icon,
    Activity: Icon,
    RefreshCw: Icon,
    Gauge: Icon,
    Users: Icon,
    Zap: Icon,
    AlertTriangle: Icon,
    Timer: Icon,
    GitCommit: Icon,
    ReasonerIcon: Icon,
    AgentNodeIcon: Icon,
  };
});

function makeEnhancedData() {
  return {
    overview: {
      total_agents: 6,
      active_agents: 4,
      degraded_agents: 1,
      offline_agents: 1,
      executions_last_24h: 120,
      success_rate_24h: 97.5,
      average_duration_ms_24h: 1200,
      median_duration_ms_24h: 900,
    },
    execution_trends: {
      last_24h: {
        throughput_per_hour: 5.2,
        succeeded: 118,
      },
      last_7_days: [
        { date: "2026-04-01T00:00:00Z", total: 10, succeeded: 9, failed: 1 },
        { date: "2026-04-02T00:00:00Z", total: 20, succeeded: 19, failed: 1 },
      ],
    },
    comparison: {
      overview_delta: {
        executions_delta: 12,
        success_rate_delta: 1.2,
        avg_duration_delta_ms: -100,
      },
    },
    hotspots: {
      top_failing_reasoners: [
        {
          reasoner_id: "reasoner-hot",
          failed_executions: 5,
          total_executions: 20,
          error_rate: 25,
          contribution_pct: 50,
          top_errors: [{ message: "timeout", count: 3 }],
        },
      ],
    },
    incidents: [
      {
        execution_id: "exec-1",
        workflow_id: "workflow-1",
        name: "Import workflow",
        status: "failed",
        reasoner_id: "reasoner-hot",
        error: "timed out",
        started_at: "2026-04-08T10:00:00Z",
      },
    ],
    activity_patterns: {
      hourly_heatmap: Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ total: 1, failed: 0, error_rate: 0 })),
      ),
    },
    workflows: {
      top_workflows: [
        {
          workflow_id: "workflow-1",
          name: "Import workflow",
          total_executions: 50,
          success_rate: 98,
        },
      ],
      active_runs: [
        {
          execution_id: "exec-active-1",
          workflow_id: "workflow-2",
          name: "Streaming workflow",
          elapsed_ms: 9500,
        },
      ],
      longest_executions: [
        {
          execution_id: "exec-long-1",
          workflow_id: "workflow-3",
          name: "Slow workflow",
          duration_ms: 65000,
          completed_at: "2026-04-08T09:00:00Z",
        },
      ],
    },
    agent_health: {
      active: 4,
      degraded: 1,
      offline: 1,
      agents: [
        { id: "agent-a", status: "ready", last_heartbeat: "2026-04-08T11:00:00Z" },
      ],
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <EnhancedDashboardPage />
    </MemoryRouter>,
  );
}

describe("EnhancedDashboardPage", () => {
  beforeEach(() => {
    pageState.refresh.mockReset();
    pageState.clearError.mockReset();
    pageState.setPreset.mockReset();
    pageState.toggleCompare.mockReset();
    pageState.enhancedDashboardResult = {
      data: makeEnhancedData(),
      loading: false,
      error: null,
      hasError: false,
      refresh: pageState.refresh,
      clearError: pageState.clearError,
      isRefreshing: false,
    };
    pageState.timeRangeResult = {
      timeRange: { preset: "24h", compare: false },
      setPreset: pageState.setPreset,
      toggleCompare: pageState.toggleCompare,
      getApiParams: () => ({
        preset: "24h",
        startTime: undefined,
        endTime: undefined,
        compare: false,
      }),
      label: "Last 24h",
    };
  });

  it("renders enhanced dashboard sections and handles time range and refresh actions", () => {
    renderPage();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Agents online")).toBeInTheDocument();
    expect(screen.getByText("Velocity & reliability")).toBeInTheDocument();
    expect(screen.getByText("Problem Hotspots")).toBeInTheDocument();
    expect(screen.getByText("Incident log")).toBeInTheDocument();
    expect(screen.getByText("Workflow intelligence")).toBeInTheDocument();
    expect(screen.getByText("Reasoner activity")).toBeInTheDocument();
    expect(screen.getAllByText("Import workflow").length).toBeGreaterThan(0);
    expect(screen.getByText("Streaming workflow")).toBeInTheDocument();
    expect(screen.getAllByText("reasoner-hot").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Select 7d"));
    fireEvent.click(screen.getByText("Toggle compare"));
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(pageState.setPreset).toHaveBeenCalledWith("7d");
    expect(pageState.toggleCompare).toHaveBeenCalledWith(true);
    expect(pageState.refresh).toHaveBeenCalledTimes(1);
  });

  it("renders error states for initial load failures and cached refresh failures", () => {
    pageState.enhancedDashboardResult = {
      data: null,
      loading: false,
      error: new Error("dashboard failed"),
      hasError: true,
      refresh: pageState.refresh,
      clearError: pageState.clearError,
      isRefreshing: false,
    };

    const { rerender } = renderPage();

    expect(screen.getByText("Failed to load dashboard data")).toBeInTheDocument();
    expect(screen.getByText("dashboard failed")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry load"));
    fireEvent.click(screen.getByText("Dismiss error"));

    expect(pageState.refresh).toHaveBeenCalledTimes(1);
    expect(pageState.clearError).toHaveBeenCalledTimes(1);

    pageState.enhancedDashboardResult = {
      data: makeEnhancedData(),
      loading: false,
      error: new Error("stale cache"),
      hasError: true,
      refresh: pageState.refresh,
      clearError: pageState.clearError,
      isRefreshing: false,
    };

    rerender(
      <MemoryRouter>
        <EnhancedDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unable to refresh data")).toBeInTheDocument();
    expect(screen.getByText(/Showing cached data\. stale cache/)).toBeInTheDocument();
  });
});
