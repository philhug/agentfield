import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompactWorkflowInputOutput } from "@/components/workflow/CompactWorkflowInputOutput";
import { EnhancedWorkflowData } from "@/components/workflow/EnhancedWorkflowData";
import { EnhancedWorkflowEvents } from "@/components/workflow/EnhancedWorkflowEvents";
import { EnhancedWorkflowIdentity } from "@/components/workflow/EnhancedWorkflowIdentity";
import { ExecutionScatterPlot } from "@/components/workflow/ExecutionScatterPlot";
import { TimelineNodeCard, TimelineNodeCardSkeleton } from "@/components/workflow/TimelineNodeCard";
import type { WorkflowSummary, WorkflowTimelineNode } from "@/types/workflows";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  getExecutionDetails: vi.fn(),
  getExecutionNotes: vi.fn(),
  exportWorkflowComplianceReport: vi.fn(),
  downloadVCDocument: vi.fn(),
  copyVCToClipboard: vi.fn(),
  downloadDIDResolutionBundle: vi.fn(),
  mainNodeExecution: {
    execution: {
      input_data: { prompt: "hello" },
      output_data: { answer: "world" },
      input_size: 128,
      output_size: 256,
    },
    loading: false,
    error: null,
    hasInputData: true,
    hasOutputData: true,
    isCompleted: true,
    isRunning: false,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <span>icon</span>;
  return {
    Ban: Icon,
    CheckCircle2: Icon,
    Circle: Icon,
    Clock: Icon,
    HelpCircle: Icon,
    Hourglass: Icon,
    Loader2: Icon,
    PauseCircle: Icon,
    RotateCcw: Icon,
    TimerOff: Icon,
    XCircle: Icon,
    ZoomIn: Icon,
    ZoomOut: Icon,
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScatterChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Scatter: ({
    data,
    onClick,
  }: {
    data: Array<{ id: string }>;
    onClick?: (point: { payload: { id: string } }) => void;
  }) => (
    <div>
      {data.map((point) => (
        <button key={point.id} type="button" onClick={() => onClick?.({ payload: point })}>
          scatter-{point.id}
        </button>
      ))}
    </div>
  ),
  XAxis: () => <div />,
  YAxis: () => <div />,
  ZAxis: () => <div />,
  Tooltip: () => <div />,
  ReferenceLine: () => <div />,
  CartesianGrid: () => <div />,
  Cell: () => <div />,
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className}>icon</span>;
  return {
    Download: Icon,
    Database: Icon,
    InProgress: Icon,
    RadioTower: Icon,
    DownloadSimple: Icon,
    UploadSimple: Icon,
    AlertCircle: Icon,
    Check: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Circle: Icon,
    CircleCheck: Icon,
    CircleX: Icon,
    Copy: Icon,
    FileJson: Icon,
    Hash: Icon,
    Link: Icon,
    PauseCircle: Icon,
    ShieldCheck: Icon,
    Timer: Icon,
    User: Icon,
    ArrowsOutSimple: Icon,
    Code: Icon,
    Eye: Icon,
    ChevronRight: Icon,
    RefreshCw: Icon,
    Loader2: Icon,
    Clock: Icon,
    ArrowUpDown: Icon,
  };
});

vi.mock("@/components/layout/ResponsiveGrid", () => {
  const ResponsiveGrid = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  );
  ResponsiveGrid.Item = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { ResponsiveGrid };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
  StatusBadge: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/copy-button", () => ({
  CopyButton: ({ value }: { value: string }) => <button type="button">{value}</button>,
}));

vi.mock("@/components/ui/json-syntax-highlight", () => ({
  JsonHighlightedPre: ({ text }: { text: string }) => <pre>{text}</pre>,
}));

vi.mock("@/components/ui/UnifiedJsonViewer", () => ({
  UnifiedJsonViewer: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
}));

vi.mock("@/components/ui/UnifiedDataPanel", () => ({
  UnifiedDataPanel: ({
    title,
    data,
    onModalOpen,
  }: {
    title: string;
    data: unknown;
    onModalOpen?: () => void;
  }) => (
    <div>
      <div>{title}</div>
      <pre>{JSON.stringify(data)}</pre>
      <button type="button" onClick={onModalOpen}>
        Open {title}
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/ResizableSplitPane", () => ({
  ResizableSplitPane: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  useResponsiveSplitPane: () => ({ isSmallScreen: false }),
}));

vi.mock("@/components/execution/EnhancedModal", () => ({
  DataModal: ({
    isOpen,
    title,
  }: {
    isOpen: boolean;
    title: string;
  }) => (isOpen ? <div>{title} modal</div> : null),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({
    value,
    onValueChange,
    options,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div>
      <div>mode-{value}</div>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onValueChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className}>skeleton</div>,
}));

vi.mock("@/components/notes/TagBadge", () => ({
  TagBadge: ({
    tag,
    onClick,
  }: {
    tag: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {tag}
    </button>
  ),
  getTagColor: () => "text-blue-500 bg-blue-50",
}));

vi.mock("@/hooks/useMainNodeExecution", () => ({
  useMainNodeExecution: () => state.mainNodeExecution,
}));

vi.mock("@/services/executionsApi", () => ({
  getExecutionDetails: (executionId: string) => state.getExecutionDetails(executionId),
  getExecutionNotes: (executionId: string, options: unknown) => state.getExecutionNotes(executionId, options),
}));

vi.mock("@/services/vcApi", () => ({
  exportWorkflowComplianceReport: (workflowId: string, format: "json" | "csv") =>
    state.exportWorkflowComplianceReport(workflowId, format),
  downloadVCDocument: (vc: unknown) => state.downloadVCDocument(vc),
  copyVCToClipboard: (vc: unknown) => state.copyVCToClipboard(vc),
  downloadDIDResolutionBundle: (did: string) => state.downloadDIDResolutionBundle(did),
}));

function createWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    run_id: "run-1",
    workflow_id: "wf-1",
    root_execution_id: "exec-1",
    status: "running",
    root_reasoner: "planner",
    current_task: "Plan",
    total_executions: 2,
    max_depth: 2,
    started_at: "2026-04-08T10:00:00Z",
    latest_activity: "2026-04-08T10:05:00Z",
    display_name: "Workflow Alpha",
    status_counts: { running: 1, succeeded: 1 },
    active_executions: 1,
    terminal: false,
    agent_name: "Ops Agent",
    session_id: "session-12345678",
    actor_id: "actor-1",
    ...overrides,
  };
}

function createNode(overrides: Partial<WorkflowTimelineNode> = {}): WorkflowTimelineNode {
  return {
    workflow_id: "wf-1",
    execution_id: "exec-1",
    agent_node_id: "agent-1",
    agent_name: "Planner",
    reasoner_id: "planner",
    status: "running",
    started_at: "2026-04-08T10:00:00Z",
    completed_at: "2026-04-08T10:00:05Z",
    workflow_depth: 0,
    input_data: { prompt: "hello" },
    output_data: { answer: "world" },
    duration_ms: 1500,
    webhook_registered: true,
    children: [],
    notes: [],
    notes_count: 0,
    ...overrides,
  } as unknown as WorkflowTimelineNode;
}

describe("enhanced workflow data and identity surfaces", () => {
  beforeEach(() => {
    state.navigate.mockReset();
    state.getExecutionDetails.mockReset();
    state.getExecutionNotes.mockReset();
    state.exportWorkflowComplianceReport.mockReset();
    state.downloadVCDocument.mockReset();
    state.copyVCToClipboard.mockReset();
    state.downloadDIDResolutionBundle.mockReset();
    state.copyVCToClipboard.mockResolvedValue(true);
    global.URL.createObjectURL = vi.fn(() => "blob:test");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders workflow data, prefetches details, filters nodes, and opens navigation targets", async () => {
    state.getExecutionDetails.mockImplementation(async (executionId: string) => ({
      execution_id: executionId,
      agent_node_id: executionId === "exec-2" ? "agent-2" : "agent-1",
      reasoner_id: executionId === "exec-2" ? "reviewer" : "planner",
      input_data: { prompt: executionId },
      output_data: { answer: executionId },
      input_size: 10,
      output_size: 12,
      webhook_registered: executionId === "exec-1",
      webhook_events:
        executionId === "exec-1"
          ? [
              {
                id: "wh-1",
                status: "failed",
                http_status: 500,
                event_type: "delivery",
                created_at: "2026-04-08T10:05:00Z",
                payload: "{\"ok\":false}",
                response_body: "boom",
                error_message: "Webhook failed",
              },
            ]
          : [],
    }));

    const onNodeSelection = vi.fn();
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    render(
      <MemoryRouter>
        <EnhancedWorkflowData
          workflow={createWorkflow()}
          dagData={{
            timeline: [
              createNode(),
              createNode({
                execution_id: "exec-2",
                agent_node_id: "agent-2",
                agent_name: "Reviewer",
                reasoner_id: "reviewer",
                started_at: "2026-04-08T10:01:00Z",
              }),
            ],
          }}
          selectedNodeIds={["exec-1"]}
          onNodeSelection={onNodeSelection}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(state.getExecutionDetails).toHaveBeenCalledWith("exec-1"));
    expect(state.getExecutionDetails).toHaveBeenCalledWith("exec-2");
    expect(screen.getByText("Input Data")).toBeInTheDocument();
    expect(screen.getByText("Webhook Activity")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search by agent/i), { target: { value: "reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: /Reviewer/i }));
    expect(onNodeSelection).toHaveBeenCalledWith(["exec-2"], true);

    fireEvent.click(screen.getByRole("button", { name: "Go to Execution" }));
    expect(state.navigate).toHaveBeenCalledWith("/executions/exec-2");

    fireEvent.click(screen.getByRole("button", { name: "Go to Reasoner" }));
    expect(state.navigate).toHaveBeenCalledWith("/reasoners/agent-2.reviewer");

    fireEvent.click(screen.getByRole("button", { name: /Download JSON/i }));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("renders workflow events, applies filters, expands notes, and focuses selected nodes", async () => {
    state.getExecutionNotes.mockImplementation(async (executionId: string) => ({
      notes:
        executionId === "exec-1"
          ? [
              {
                message: "a".repeat(300),
                tags: ["ops", "alert"],
                timestamp: "2026-04-08T10:05:00Z",
              },
            ]
          : [
              {
                message: "review complete",
                tags: ["qa"],
                timestamp: "2026-04-08T10:04:00Z",
              },
            ],
    }));

    const onNodeSelection = vi.fn();

    render(
      <EnhancedWorkflowEvents
        workflow={createWorkflow()}
        dagData={{
          timeline: [
            createNode({ status: "running" }),
            createNode({
              execution_id: "exec-2",
              agent_name: "Reviewer",
              reasoner_id: "review",
              status: "succeeded",
              started_at: "2026-04-08T10:01:00Z",
            }),
          ],
        }}
        selectedNodeIds={["exec-2"]}
        onNodeSelection={onNodeSelection}
      />
    );

    expect(await screen.findByText("2 / 2 events")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Selected" }));
    expect(screen.getByText("1 / 2 events")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getAllByRole("button", { name: "ops" })[0]);
    expect(screen.getByText("1 / 2 events")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(onNodeSelection).toHaveBeenCalled();
  });

  it("renders identity summary, exports bundles, expands credentials, and downloads artifacts", async () => {
    state.exportWorkflowComplianceReport.mockResolvedValue(undefined);
    state.downloadVCDocument.mockResolvedValue(undefined);
    state.downloadDIDResolutionBundle.mockResolvedValue(undefined);

    render(
      <EnhancedWorkflowIdentity
        workflow={createWorkflow()}
        vcChain={{
          status: "running",
          total_steps: 2,
          workflow_vc: {
            workflow_vc_id: "workflow-vc-1",
            status: "running",
            start_time: "2026-04-08T10:00:00Z",
          },
          component_vcs: [
            {
              vc_id: "vc-1",
              execution_id: "exec-1",
              status: "succeeded",
              created_at: "2026-04-08T10:01:00Z",
              caller_did: "did:caller:1",
              target_did: "did:target:1",
              issuer_did: "did:issuer:1",
              signature: "sig-1",
              input_hash: "in-1",
              output_hash: "out-1",
              vc_document: JSON.stringify({
                issuer: "did:issuer:1",
                proof: { proofValue: "proof-1" },
                credentialSubject: {
                  caller: { did: "did:caller:1", agentNodeDid: "agent:caller" },
                  target: { did: "did:target:1", agentNodeDid: "agent:target", functionName: "run" },
                  execution: { durationMs: 25, timestamp: "2026-04-08T10:01:00Z", inputHash: "in-1", outputHash: "out-1" },
                },
              }),
            },
          ],
          did_resolution_bundle: {
            "did:example:123": {
              method: "example",
              resolved_at: "2026-04-08T10:03:00Z",
              resolved_from: "cache",
            },
          },
        } as never}
      />
    );

    expect(screen.getByText("Digital Identity")).toBeInTheDocument();
    expect(screen.getByText("Workflow Credential Overview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /JSON$/ }));
    expect(state.exportWorkflowComplianceReport).toHaveBeenCalledWith("wf-1", "json");

    fireEvent.click(screen.getByRole("button", { name: /Expand credential/i }));
    expect(screen.getAllByText("Function").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Download JSON$/ }));
    await waitFor(() => expect(state.downloadVCDocument).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Copy JSON$/ }));
    await waitFor(() => expect(state.copyVCToClipboard).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Download bundle$/ }));
    await waitFor(() => expect(state.downloadDIDResolutionBundle).toHaveBeenCalledWith("did:example:123"));
  });

  it("renders compact workflow IO, toggles modes, and opens modals", () => {
    render(<CompactWorkflowInputOutput dagData={{} as never} />);

    expect(screen.getByText("Workflow Input/Output")).toBeInTheDocument();
    expect(screen.getByText("Input Data")).toBeInTheDocument();
    expect(screen.getByText("Output Data")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "JSON" })[0]);
    expect(screen.getByText("mode-json")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "icon" })[0]);
    expect(screen.getByText("Input Data modal")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "icon" })[1]);
    expect(screen.getByText("Output Data modal")).toBeInTheDocument();
  });

  it("renders scatter plot controls and timeline note interactions", () => {
    const onNodeClick = vi.fn();
    render(
      <ExecutionScatterPlot
        timedNodes={[
          createNode({ execution_id: "exec-1", duration_ms: 500, status: "succeeded" }),
          createNode({ execution_id: "exec-2", duration_ms: 2500, status: "failed", started_at: "2026-04-08T10:01:00Z" }),
        ]}
        onNodeClick={onNodeClick}
      />
    );

    expect(screen.getByText(/Scatter plot shows distribution of 2 executions/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "scatter-exec-1" }));
    expect(onNodeClick).toHaveBeenCalledWith("exec-1");

    const onTagClick = vi.fn();
    const onExpansionChange = vi.fn();
    const onNoteExpansionChange = vi.fn();

    render(
      <>
        <TimelineNodeCard
          node={createNode({ task_name: "review_task" }) as never}
          notes={[
            {
              message: "note body ".repeat(30),
              tags: ["ops", "qa", "prod"],
              timestamp: "2026-04-08T10:05:00Z",
            },
          ]}
          onClick={vi.fn()}
          onTagClick={onTagClick}
          isExpanded={true}
          onExpansionChange={onExpansionChange}
          expandedNotes={new Set()}
          onNoteExpansionChange={onNoteExpansionChange}
        />
        <TimelineNodeCardSkeleton />
      </>
    );

    expect(screen.getByText("Review Task")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onNoteExpansionChange).toHaveBeenCalledWith(0, true);

    fireEvent.click(screen.getAllByRole("button", { name: "#ops" })[0]);
    expect(onTagClick).toHaveBeenCalledWith("ops");

    expect(screen.getAllByText("skeleton").length).toBeGreaterThan(0);
  });
});
