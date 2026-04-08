// @ts-nocheck
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  );

  return {
    Trash: Icon,
    WarningOctagon: Icon,
    SpinnerGap: Icon,
    ArrowsOutSimple: Icon,
    CornersIn: Icon,
    X: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    CheckCircle2: Icon,
    AgentNodeIcon: Icon,
    CheckCircle: Icon,
  };
});

vi.mock("@/components/ui/UnifiedJsonViewer", () => ({
  UnifiedJsonViewer: ({ data }: { data: unknown }) => (
    <div data-testid="unified-json-viewer">{JSON.stringify(data)}</div>
  ),
}));

vi.mock("@/components/ui/json-syntax-highlight", () => ({
  JsonHighlightedPre: ({ text }: { text: string }) => (
    <pre data-testid="json-highlighted-pre">{text}</pre>
  ),
}));

vi.mock("@/services/api", () => ({
  registerServerlessAgent: vi.fn(),
}));

vi.mock("@/components/authorization/PolicyContextPanel", () => ({
  PolicyContextPanel: ({ tags }: { tags: string[] }) => (
    <div data-testid="policy-context-panel">{tags.join(",")}</div>
  ),
}));

import { ServerlessRegistrationModal } from "@/components/ServerlessRegistrationModal";
import { ApproveWithContextDialog } from "@/components/authorization/ApproveWithContextDialog";
import { DataModal, EnhancedModal } from "@/components/execution/EnhancedModal";
import { WorkflowDeleteDialog } from "@/components/workflows/WorkflowDeleteDialog";
import { registerServerlessAgent } from "@/services/api";
import type { AccessPolicy } from "@/services/accessPoliciesApi";
import type { AgentTagSummary } from "@/services/tagApprovalApi";
import type { WorkflowSummary } from "@/types/workflows";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

describe("dialogs and modals", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("confirms workflow deletion and closes the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue([]);

    const workflows: WorkflowSummary[] = [
      {
        run_id: "run-1",
        workflow_id: "wf-1",
        status: "running",
        root_reasoner: "root",
        current_task: "task",
        total_executions: 3,
        max_depth: 1,
        started_at: "2026-01-01T00:00:00Z",
        latest_activity: "2026-01-01T00:00:00Z",
        display_name: "Workflow Alpha",
        agent_name: "Agent A",
        status_counts: { running: 1, succeeded: 1, failed: 1 },
        active_executions: 1,
        terminal: false,
      },
    ];

    render(
      <WorkflowDeleteDialog
        isOpen
        onClose={onClose}
        workflows={workflows}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("heading", { name: "Delete workflow" })).toBeInTheDocument();
    expect(screen.getByText("Workflow Alpha")).toBeInTheDocument();
    expect(screen.getByText("1 in-flight execution will be force-cancelled.")).toBeInTheDocument();
    expect(screen.getByText("Includes 1 failed/timeout run for forensic review.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete workflow" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(["wf-1"]);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows workflow deletion errors and prevents confirming with no workflows", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error("Cannot delete"));

    const workflows: WorkflowSummary[] = [
      {
        run_id: "run-2",
        workflow_id: "wf-2",
        status: "failed",
        root_reasoner: "root",
        current_task: "task",
        total_executions: 1,
        max_depth: 1,
        started_at: "2026-01-01T00:00:00Z",
        latest_activity: "2026-01-01T00:00:00Z",
        display_name: "Workflow Beta",
        agent_name: "Agent B",
        status_counts: {},
        active_executions: 0,
        terminal: true,
      },
    ];

    const { rerender } = render(
      <WorkflowDeleteDialog
        isOpen
        onClose={onClose}
        workflows={workflows}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete workflow" }));

    expect(await screen.findByText("Cannot delete")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <WorkflowDeleteDialog
        isOpen
        onClose={onClose}
        workflows={[]}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete 0 workflows" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("maximizes, restores, and closes the enhanced modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <EnhancedModal isOpen onClose={onClose} title="Execution Data">
        <div>Modal body</div>
      </EnhancedModal>,
    );

    expect(screen.getByText("Execution Data")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle({ width: "90vw", height: "90vh" });

    await user.click(screen.getByRole("button", { name: /maximize/i }));
    expect(dialog).toHaveStyle({ width: "100vw", height: "100vh" });

    await user.click(screen.getByRole("button", { name: /restore/i }));
    expect(dialog).toHaveStyle({ width: "90vw", height: "90vh" });

    await user.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("switches DataModal views and renders markdown preview only for markdown-like content", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <DataModal
        isOpen
        onClose={vi.fn()}
        title="Payload"
        data={"**bold**\n`code`"}
      />,
    );

    expect(screen.getByText("Payload - Full View")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Markdown Preview" })).toBeInTheDocument();
    expect(screen.getByTestId("unified-json-viewer")).toHaveTextContent('"**bold**\\n`code`"');

    await user.click(screen.getByRole("tab", { name: "Raw JSON" }));
    expect(screen.getByTestId("json-highlighted-pre")).toHaveTextContent('"**bold**\\n`code`"');

    await user.click(screen.getByRole("tab", { name: "Markdown Preview" }));
    expect(screen.getByText("bold", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("code", { selector: "code" })).toBeInTheDocument();

    rerender(
      <DataModal
        isOpen
        onClose={vi.fn()}
        title="Payload"
        data={{ ok: true }}
      />,
    );

    expect(screen.queryByRole("tab", { name: "Markdown Preview" })).not.toBeInTheDocument();
  });

  it("validates serverless registration input and handles successful registration", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    vi.mocked(registerServerlessAgent).mockResolvedValue({
      success: true,
      node: {
        id: "node-123",
        version: "1.2.3",
        reasoners_count: 4,
        skills_count: 2,
      },
    } as Awaited<ReturnType<typeof registerServerlessAgent>>);

    render(
      <ServerlessRegistrationModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Register" }).closest("form")!);
    expect(screen.getByText("Invocation URL is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/invocation url/i), { target: { value: "not-a-url" } });
    fireEvent.submit(screen.getByRole("button", { name: "Register" }).closest("form")!);
    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/invocation url/i), { target: { value: "https://agent.example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Register" }).closest("form")!);

    await waitFor(() => {
      expect(registerServerlessAgent).toHaveBeenCalledWith("https://agent.example.com");
    });

    expect(await screen.findByText("Successfully registered!")).toBeInTheDocument();
    expect(screen.getByText("Agent ID:", { exact: false })).toBeInTheDocument();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("node-123");
      expect(onClose).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it("renders serverless registration failures from the API", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(registerServerlessAgent).mockRejectedValue(new Error("Registration exploded"));

    render(<ServerlessRegistrationModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/invocation url/i), "https://agent.example.com");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Registration exploded")).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("approves selected tags and closes the context dialog", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    const agent: AgentTagSummary = {
      agent_id: "agent-42",
      proposed_tags: ["finance", "trusted"],
      approved_tags: [],
      lifecycle_status: "pending",
      registered_at: "2026-01-01T00:00:00Z",
    };

    const policies: AccessPolicy[] = [
      {
        id: 1,
        name: "policy",
        caller_tags: ["finance"],
        target_tags: ["trusted"],
        allow_functions: ["*"],
        deny_functions: [],
        action: "allow",
        priority: 1,
        enabled: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <ApproveWithContextDialog
        agent={agent}
        policies={policies}
        onApprove={onApprove}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Approve Tags")).toBeInTheDocument();
    expect(screen.getByTestId("policy-context-panel")).toHaveTextContent("finance,trusted");

    await user.click(screen.getByRole("button", { name: "trusted" }));
    expect(screen.getByRole("button", { name: "Approve 1 tag(s)" })).toBeEnabled();
    expect(screen.getByTestId("policy-context-panel")).toHaveTextContent("finance");

    await user.click(screen.getByRole("button", { name: "Approve 1 tag(s)" }));

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith("agent-42", ["finance"]);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("approves agents without proposed tags and supports cancel", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    const agent: AgentTagSummary = {
      agent_id: "agent-99",
      proposed_tags: [],
      approved_tags: [],
      lifecycle_status: "pending",
      registered_at: "2026-01-01T00:00:00Z",
    };

    render(
      <ApproveWithContextDialog
        agent={agent}
        policies={[]}
        onApprove={onApprove}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Approve Agent" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Approve Agent" }));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith("agent-99", []);
    });
  });
});