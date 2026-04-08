import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompactWorkflowSummary } from "@/components/CompactWorkflowSummary";

const state = vi.hoisted(() => ({
  clipboardWriteText: vi.fn(),
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  CheckCircle: () => <span>check-circle</span>,
  SpinnerGap: () => <span>spinner-gap</span>,
  WarningOctagon: () => <span>warning-octagon</span>,
  PauseCircle: () => <span>pause-circle</span>,
  CopySimple: () => <span>copy-simple</span>,
  Pulse: () => <span>pulse</span>,
  X: () => <span>x</span>,
  Clock: () => <span>clock</span>,
}));

vi.mock("@/utils/dateFormat", () => ({
  formatCompactRelativeTime: (timestamp: string) => `relative:${timestamp}`,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("./ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("./ui/hover-card", () => ({
  HoverCard: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  HoverCardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/utils/status", () => ({
  normalizeExecutionStatus: (status: string) => status,
}));

vi.mock("@/lib/theme", () => ({
  statusTone: {
    success: { accent: "text-success", solidBg: "bg-success" },
    info: { accent: "text-info", solidBg: "bg-info" },
    error: { accent: "text-error", solidBg: "bg-error" },
    neutral: { accent: "text-neutral", solidBg: "bg-neutral" },
  },
}));

function buildWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    workflow_id: "wf-123",
    display_name: "Workflow Summary",
    status: "running",
    status_counts: { failed: 1, timeout: 1 },
    active_executions: 2,
    total_executions: 5,
    max_depth: 3,
    duration_ms: 65000,
    agent_name: "agent-a",
    started_at: "2026-04-08T00:00:00Z",
    latest_activity: "2026-04-08T00:05:00Z",
    ...overrides,
  };
}

describe("CompactWorkflowSummary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.clipboardWriteText.mockReset();
    state.clipboardWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: state.clipboardWriteText,
      },
    });
  });

  it("renders workflow metrics and refresh/close actions", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onClose = vi.fn();

    render(
      <CompactWorkflowSummary
        workflow={buildWorkflow() as never}
        onRefresh={onRefresh}
        onClose={onClose}
        isLiveUpdating={true}
        hasRunningWorkflows={true}
        pollingInterval={5000}
        isRefreshing={false}
      />
    );

    expect(screen.getByText("Workflow Summary")).toBeInTheDocument();
    expect(screen.getByText("wf-123")).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes("Exec:")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content) => content.includes("Depth:")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.1m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 issues").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copies the workflow id and selects the code content on double click", async () => {
    const user = userEvent.setup();
    const addRange = vi.fn();
    const removeAllRanges = vi.fn();
    const selectNodeContents = vi.fn();

    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);
    vi.spyOn(document, "createRange").mockReturnValue({
      selectNodeContents,
    } as unknown as Range);

    render(<CompactWorkflowSummary workflow={buildWorkflow() as never} />);

    fireEvent.doubleClick(screen.getByText("wf-123"));
    expect(selectNodeContents).toHaveBeenCalled();
    expect(removeAllRanges).toHaveBeenCalled();
    expect(addRange).toHaveBeenCalled();

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]!);

    expect(await screen.findByText("✓")).toBeInTheDocument();
  });

  it("renders fallback labels for unnamed and idle workflows", () => {
    render(
      <CompactWorkflowSummary
        workflow={
          buildWorkflow({
            display_name: "",
            status: "mystery",
            duration_ms: undefined,
            active_executions: 0,
            status_counts: {},
            latest_activity: undefined,
          }) as never
        }
        isLiveUpdating={true}
        hasRunningWorkflows={false}
        isRefreshing={true}
      />
    );

    expect(screen.getByText("Unnamed Workflow")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monitor").length).toBeGreaterThan(0);
    expect(screen.queryByText(/issues/)).not.toBeInTheDocument();
  });
});
