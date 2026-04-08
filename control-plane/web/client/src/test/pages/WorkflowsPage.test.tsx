// @ts-nocheck
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowsPage } from "@/pages/WorkflowsPage";

const navigate = vi.fn();
const getWorkflowsSummary = vi.fn();
const getNextTimeRange = vi.fn();
const pageHeaderPropsSpy = vi.fn();
const tablePropsSpy = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/services/workflowsApi", () => ({
  getWorkflowsSummary: (...args: unknown[]) => getWorkflowsSummary(...args),
}));

vi.mock("@/lib/timeRanges", () => ({
  getNextTimeRange: (value: string) => getNextTimeRange(value),
}));

vi.mock("@/components/PageHeader", () => {
  const options = [
    { label: "Last 24 Hours", value: "24h" },
    { label: "Last 7 Days", value: "7d" },
    { label: "All", value: "all" },
    { label: "Failed", value: "failed" },
  ];

  return {
    TIME_FILTER_OPTIONS: options,
    STATUS_FILTER_OPTIONS: options,
    PageHeader: ({
      title,
      description,
      filters,
    }: {
      title: string;
      description?: string;
      filters?: Array<{
        label: string;
        value: string;
        onChange: (value: string) => void;
      }>;
    }) => {
      pageHeaderPropsSpy({ title, description, filters });
      return (
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
          {filters?.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() =>
                filter.onChange(filter.label === "Time Range" ? "7d" : "failed")
              }
            >
              change-{filter.label}
            </button>
          ))}
        </div>
      );
    },
  };
});

vi.mock("@/components/CompactWorkflowsTable", () => ({
  CompactWorkflowsTable: (props: Record<string, unknown>) => {
    tablePropsSpy(props);
    return (
      <div>
        <div>table:{(props.workflows as Array<{ display_name: string }>).map((w) => w.display_name).join(",")}</div>
        <button type="button" onClick={() => (props.onLoadMore as (() => void) | undefined)?.()}>
          load-more
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onWorkflowClick as ((workflow: { run_id: string }) => void) | undefined)?.({
              run_id: "run-1",
            })
          }
        >
          open-workflow
        </button>
        <button
          type="button"
          onClick={() => (props.onSortChange as ((field: string, order?: "asc" | "desc") => void) | undefined)?.("latest_activity")}
        >
          toggle-sort
        </button>
        <button
          type="button"
          onClick={() => (props.onRefresh as (() => void) | undefined)?.()}
        >
          refresh
        </button>
        <button
          type="button"
          onClick={() => (props.onWorkflowsDeleted as (() => void) | undefined)?.()}
        >
          deleted
        </button>
      </div>
    );
  },
}));

function buildWorkflow(runId: string, displayName: string) {
  return {
    run_id: runId,
    workflow_id: `wf-${runId}`,
    status: "running",
    root_reasoner: "planner",
    current_task: "task",
    total_executions: 2,
    max_depth: 1,
    started_at: "2026-04-08T10:00:00Z",
    latest_activity: "2026-04-08T10:05:00Z",
    display_name: displayName,
    status_counts: {},
    active_executions: 1,
    terminal: false,
  };
}

describe("WorkflowsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNextTimeRange.mockReturnValue(undefined);
  });

  it("fetches workflows, loads more, refreshes, toggles sorting, and navigates", async () => {
    const user = userEvent.setup();
    getWorkflowsSummary
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-1", "Workflow One")],
        has_more: true,
      })
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-2", "Workflow Two")],
        has_more: false,
      })
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-1", "Workflow One")],
        has_more: false,
      })
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-1", "Workflow One")],
        has_more: false,
      });

    render(<WorkflowsPage />);

    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(1));
    expect(screen.getByText("table:Workflow One")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load-more/i }));
    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(2));
    expect(tablePropsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ hasMore: false }));

    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(3));

    await user.click(screen.getByRole("button", { name: /toggle-sort/i }));
    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(4));

    await user.click(screen.getByRole("button", { name: /open-workflow/i }));
    expect(navigate).toHaveBeenCalledWith("/workflows/run-1");
  });

  it("broadens the time range when the first page is empty", async () => {
    getNextTimeRange.mockReturnValue("7d");
    getWorkflowsSummary
      .mockResolvedValueOnce({
        workflows: [],
        has_more: false,
      })
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-7", "Broadened")],
        has_more: false,
      });

    render(<WorkflowsPage />);

    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(2));
    expect(getNextTimeRange).toHaveBeenCalledWith("24h");
    expect(getWorkflowsSummary.mock.calls[1]?.[0]).toEqual({ timeRange: "7d" });
    expect(screen.getByText("table:Broadened")).toBeInTheDocument();
  });

  it("applies filter changes and renders API errors", async () => {
    const user = userEvent.setup();
    getWorkflowsSummary
      .mockResolvedValueOnce({
        workflows: [buildWorkflow("run-1", "Initial")],
        has_more: false,
      })
      .mockRejectedValueOnce(new Error("load failed"));

    render(<WorkflowsPage />);

    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /change-status/i }));

    await waitFor(() => expect(getWorkflowsSummary).toHaveBeenCalledTimes(2));
    expect(getWorkflowsSummary.mock.calls[1]?.[0]).toEqual({ status: "failed", timeRange: "24h" });
    expect(screen.getByText("Error loading workflows")).toBeInTheDocument();
    expect(screen.getByText("load failed")).toBeInTheDocument();
  });
});