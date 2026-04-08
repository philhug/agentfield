import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnhancedWorkflowTabs } from "@/components/workflow/EnhancedWorkflowTabs";
import type { WorkflowSummary, WorkflowTimelineNode } from "@/types/workflows";

const state = vi.hoisted(() => ({
  isMobile: false,
  onValueChange: undefined as undefined | ((value: string) => void),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => state.isMobile,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/tabs", () => ({
  AnimatedTabs: ({
    value,
    onValueChange,
    children,
  }: React.PropsWithChildren<{ value: string; onValueChange: (value: string) => void }>) => (
    (() => {
      state.onValueChange = onValueChange;
      return (
        <div data-value={value} data-on-change={onValueChange ? "yes" : "no"}>
          {children}
        </div>
      );
    })()
  ),
  AnimatedTabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AnimatedTabsTrigger: ({
    value,
    children,
    ...props
  }: React.PropsWithChildren<{ value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button
      type="button"
      data-value={value}
      onClick={() => state.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className}>icon</span>;
  return {
    BarChart3: Icon,
    Database: Icon,
    FileText: Icon,
    GitBranch: Icon,
    Layers: Icon,
    RadioTower: Icon,
    ShieldCheck: Icon,
  };
});

function createWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    run_id: "run-1",
    workflow_id: "wf-1",
    root_execution_id: "exec-1",
    status: "running",
    root_reasoner: "planner",
    current_task: "Collect context",
    total_executions: 6,
    max_depth: 3,
    started_at: "2026-04-08T10:00:00Z",
    latest_activity: "2026-04-08T10:05:00Z",
    display_name: "Workflow Alpha",
    status_counts: { running: 1, succeeded: 5 },
    active_executions: 1,
    terminal: false,
    ...overrides,
  };
}

function createTimelineNode(overrides: Partial<WorkflowTimelineNode> = {}): WorkflowTimelineNode {
  return {
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agent_node_id: "agent-1",
    reasoner_id: "planner",
    status: "running",
    started_at: "2026-04-08T10:00:00Z",
    workflow_depth: 0,
    input_data: { input: true },
    output_data: { output: true },
    duration_ms: 1200,
    webhook_registered: true,
    webhook_event_count: 1,
    webhook_success_count: 1,
    webhook_failure_count: 0,
    notes: [{ message: "note", tags: ["ops"], timestamp: "2026-04-08T10:02:00Z" }],
    ...overrides,
  };
}

describe("EnhancedWorkflowTabs", () => {
  beforeEach(() => {
    state.isMobile = false;
  });

  it("renders tab counts, workflow status, and active tab context", () => {
    const onTabChange = vi.fn();
    const workflow = createWorkflow();
    const timeline = [
      createTimelineNode(),
      createTimelineNode({
        execution_id: "exec-2",
        reasoner_id: "review",
        notes: [{ message: "note-2", tags: ["qa"], timestamp: "2026-04-08T10:03:00Z" }],
        webhook_success_count: 0,
        webhook_failure_count: 1,
        webhook_last_status: "500",
      }),
    ];

    render(
      <EnhancedWorkflowTabs
        activeTab="webhooks"
        onTabChange={onTabChange}
        workflow={workflow}
        dagData={{ timeline }}
        vcChain={{ component_vcs: [{ credential_id: "vc-1" }, { credential_id: "vc-2" }] } as never}
      />
    );

    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Inputs & Outputs")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();

    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("1 failures across callbacks")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Insights/i }));
    expect(onTabChange).toHaveBeenCalledWith("insights");
  });

  it("hides desktop context on mobile", () => {
    state.isMobile = true;

    const { container } = render(
      <EnhancedWorkflowTabs
        activeTab="identity"
        onTabChange={vi.fn()}
        workflow={createWorkflow({ status: "succeeded" })}
        dagData={{ timeline: [createTimelineNode()] }}
        vcChain={{ component_vcs: [] } as never}
      />
    );

    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("px-4");
  });
});
