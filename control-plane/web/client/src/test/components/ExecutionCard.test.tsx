// @ts-nocheck
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExecutionCard } from "@/components/ExecutionCard";
import type { ExecutionSummary } from "@/types/executions";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type={type} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) => <span {...props}>{children}</span>,
  StatusBadge: ({
    children,
    status,
  }: React.PropsWithChildren<{ status: string; size?: string }>) => <span>{children ?? status}</span>,
}));

describe("ExecutionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
  });

  it("renders compact card fields and opens details", async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const execution: ExecutionSummary = {
      id: 1,
      execution_id: "exec-1",
      workflow_id: "wf-1",
      workflow_name: "Planner Workflow",
      agent_node_id: "agent-1",
      reasoner_id: "node-1.planner",
      status: "running",
      duration_ms: 1500,
      input_size: 512,
      output_size: 2048,
      created_at: "2026-04-08T11:00:00Z",
      started_at: "2026-04-08T11:59:00Z",
    };

    render(<ExecutionCard execution={execution} compact={true} onViewDetails={onViewDetails} />);

    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText("Planner Workflow")).toBeInTheDocument();
    expect(screen.getByText("node-1.planner")).toBeInTheDocument();
    expect(screen.getByText("1.5s")).toBeInTheDocument();
    expect(screen.getByText("1m ago")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View/i }));
    expect(onViewDetails).toHaveBeenCalledWith("exec-1");
  });

  it("renders full card formatting, tags overflow, error details, and fallback sizing", async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const execution: ExecutionSummary = {
      id: 5,
      execution_id: "exec-5",
      workflow_id: "wf-5",
      workflow_name: "Long Workflow",
      workflow_tags: ["alpha", "beta", "gamma", "delta"],
      session_id: "session-123",
      agent_node_id: "agent-5",
      reasoner_id: "node-5.reasoner",
      status: "completed",
      duration_ms: 90000,
      input_size: 10,
      output_size: 2_097_152,
      error_message: "stack trace",
      created_at: "2026-04-01T10:00:00Z",
      started_at: "2026-04-08T10:00:00Z",
      completed_at: "2026-04-08T10:02:00Z",
    };

    render(<ExecutionCard execution={execution} onViewDetails={onViewDetails} />);

    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("Long Workflow")).toBeInTheDocument();
    expect(screen.getByText("Execution ID:")).toBeInTheDocument();
    expect(screen.getByText("agent-5")).toBeInTheDocument();
    expect(screen.getByText("node-5.reasoner")).toBeInTheDocument();
    expect(screen.getByText("1.5m")).toBeInTheDocument();
    expect(screen.getByText("10B / 2.0MB")).toBeInTheDocument();
    expect(screen.getByText("session-123")).toBeInTheDocument();
    expect(screen.getByText("stack trace")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("Completed 1h ago")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View Details/i }));
    expect(onViewDetails).toHaveBeenCalledWith("exec-5");
  });

  it("handles unknown statuses and missing durations and sizes", () => {
    const execution: ExecutionSummary = {
      id: 9,
      execution_id: "exec-9",
      workflow_id: "wf-9",
      agent_node_id: "agent-9",
      reasoner_id: "node-9.reasoner",
      status: "unknown",
      duration_ms: 0,
      input_size: 0,
      output_size: 0,
      created_at: "2026-04-08T11:59:40Z",
    };

    render(<ExecutionCard execution={execution} compact={true} />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });
});