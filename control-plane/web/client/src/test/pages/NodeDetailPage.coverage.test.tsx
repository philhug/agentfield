import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { NodeDetailPage } from "@/pages/NodeDetailPage";
import type {
  AgentNodeDetailsForUIWithPackage,
  AgentStatus,
} from "@/types/agentfield";

const state = vi.hoisted(() => ({
  mode: "developer",
  getNodeDetailsWithPackageInfo: vi.fn<
    (nodeId: string, mode: string) => Promise<AgentNodeDetailsForUIWithPackage>
  >(),
  getNodeStatus: vi.fn<(nodeId: string) => Promise<AgentStatus>>(),
  startAgent: vi.fn<(nodeId: string) => Promise<unknown>>(),
  stopAgent: vi.fn<(nodeId: string) => Promise<unknown>>(),
  reconcileAgent: vi.fn<(nodeId: string) => Promise<unknown>>(),
  latestEvent: null as null | { type: string; data: unknown },
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
}));

vi.mock("@/contexts/ModeContext", () => ({
  useMode: () => ({ mode: state.mode }),
}));

vi.mock("@/services/api", () => ({
  getNodeDetailsWithPackageInfo: (nodeId: string, mode: string) =>
    state.getNodeDetailsWithPackageInfo(nodeId, mode),
  getNodeStatus: (nodeId: string) => state.getNodeStatus(nodeId),
}));

vi.mock("@/services/configurationApi", () => ({
  startAgent: (nodeId: string) => state.startAgent(nodeId),
  stopAgent: (nodeId: string) => state.stopAgent(nodeId),
  reconcileAgent: (nodeId: string) => state.reconcileAgent(nodeId),
}));

vi.mock("@/hooks/useDIDInfo", () => ({
  useDIDInfo: () => ({
    didInfo: { did: "did:agent", reasoners: [], skills: [] },
  }),
}));

vi.mock("@/hooks/useSSE", () => ({
  useNodeUnifiedStatusSSE: () => ({ latestEvent: state.latestEvent }),
}));

vi.mock("@/components/AccessibilityEnhancements", () => ({
  ErrorAnnouncer: ({ error }: { error: string }) => <div>{error}</div>,
  StatusAnnouncer: ({ status }: { status: string }) => <div>{status}</div>,
  useAccessibility: () => ({ announceStatus: vi.fn() }),
}));

vi.mock("@/components/ui/notification", () => ({
  NotificationProvider: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  useSuccessNotification: () => state.showSuccess,
  useErrorNotification: () => state.showError,
  useInfoNotification: () => state.showInfo,
}));

vi.mock("@/utils/node-status", () => ({
  getNodeStatusPresentation: () => ({
    label: "Ready",
    shouldPulse: false,
    theme: {
      bgClass: "bg-ready",
      textClass: "text-ready",
      borderClass: "border-ready",
      indicatorClass: "dot-ready",
    },
  }),
}));

vi.mock("@/components/nodes", () => ({
  EnhancedNodeDetailHeader: ({
    nodeId,
    rightActions,
    statusBadges,
    liveStatusBadge,
  }: {
    nodeId: string;
    rightActions?: React.ReactNode;
    statusBadges?: React.ReactNode;
    liveStatusBadge?: React.ReactNode;
  }) => (
    <div>
      <h1>{nodeId}</h1>
      <div>{rightActions}</div>
      <div>{statusBadges}</div>
      <div>{liveStatusBadge}</div>
    </div>
  ),
  NodeProcessLogsPanel: ({ nodeId }: { nodeId: string }) => (
    <div>Logs for {nodeId}</div>
  ),
}));

vi.mock("@/components/status", () => ({
  StatusRefreshButton: ({
    onRefresh,
  }: {
    onRefresh?: (status: AgentStatus) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onRefresh?.({
          status: "ok",
          health_status: "ready",
          lifecycle_status: "ready",
          last_seen: "2026-04-08T00:00:00Z",
        })
      }
    >
      Refresh status
    </button>
  ),
}));

vi.mock("@/components/ui/AgentControlButton", () => ({
  AgentControlButton: ({
    onToggle,
  }: {
    onToggle?: (action: "start" | "stop" | "reconcile") => void;
  }) => (
    <div>
      <button type="button" onClick={() => onToggle?.("start")}>
        Start agent
      </button>
      <button type="button" onClick={() => onToggle?.("stop")}>
        Stop agent
      </button>
      <button type="button" onClick={() => onToggle?.("reconcile")}>
        Reconcile agent
      </button>
    </div>
  ),
}));

vi.mock("@/components/forms/EnvironmentVariableForm", () => ({
  EnvironmentVariableForm: ({
    onConfigurationChange,
  }: {
    onConfigurationChange?: () => void;
  }) => (
    <button type="button" onClick={() => onConfigurationChange?.()}>
      Trigger configuration change
    </button>
  ),
}));

vi.mock("@/components/ReasonersSkillsTable", () => ({
  ReasonersSkillsTable: () => <div>Reasoners and skills table</div>,
}));

vi.mock("@/components/did/DIDInfoModal", () => ({
  DIDInfoModal: () => null,
}));

vi.mock("@/components/layout/ResponsiveGrid", () => ({
  ResponsiveGrid: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/animated-tabs", async () => {
  const ReactModule = await import("react");
  const TabsContext = ReactModule.createContext<{
    value: string;
    onValueChange?: (value: string) => void;
  }>({ value: "overview" });

  return {
    AnimatedTabs: ({
      children,
      value,
      onValueChange,
    }: React.PropsWithChildren<{
      value: string;
      onValueChange?: (value: string) => void;
    }>) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    AnimatedTabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AnimatedTabsTrigger: ({
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
    AnimatedTabsContent: ({
      children,
      value,
    }: React.PropsWithChildren<{ value: string }>) => {
      const ctx = ReactModule.useContext(TabsContext);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/RestartRequiredBanner", () => ({
  RestartRequiredBanner: ({
    onRestart,
    onDismiss,
  }: {
    onRestart?: () => void;
    onDismiss?: () => void;
  }) => (
    <div>
      <button type="button" onClick={onRestart}>
        Restart required
      </button>
      <button type="button" onClick={onDismiss}>
        Dismiss restart banner
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
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

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props} />
  );
  return {
    AlertCircle: Icon,
    Flash: Icon,
  };
});

const makeNode = (): AgentNodeDetailsForUIWithPackage => ({
  id: "agent-alpha",
  base_url: "http://localhost:7000",
  version: "1.0.0",
  team_id: "team-a",
  health_status: "ready",
  lifecycle_status: "ready",
  last_heartbeat: "2026-04-08T00:00:00Z",
  registered_at: "2026-04-08T00:00:00Z",
  deployment_type: "serverless",
  invocation_url: "https://invoke.example.com",
  reasoners: [{ id: "r1", name: "Reasoner One" }],
  skills: [{ id: "s1", name: "Skill One" }],
  package_info: { package_id: "pkg-1" },
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/nodes/agent-alpha"]}>
      <Routes>
        <Route path="/nodes/:nodeId" element={<NodeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NodeDetailPage coverage", () => {
  beforeEach(() => {
    state.getNodeDetailsWithPackageInfo.mockReset();
    state.getNodeStatus.mockReset();
    state.startAgent.mockReset();
    state.stopAgent.mockReset();
    state.reconcileAgent.mockReset();
    state.showSuccess.mockReset();
    state.showError.mockReset();
    state.showInfo.mockReset();
    state.latestEvent = null;
    state.mode = "developer";
  });

  it("renders loading then populated state and handles main actions", async () => {
    let resolveNode:
      | ((value: AgentNodeDetailsForUIWithPackage) => void)
      | undefined;
    state.getNodeDetailsWithPackageInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNode = resolve;
        })
    );
    state.getNodeStatus.mockResolvedValue({
      status: "ok",
      health_status: "ready",
      lifecycle_status: "ready",
      last_seen: "2026-04-08T00:00:00Z",
    });
    state.startAgent.mockResolvedValue({ ok: true });
    state.stopAgent.mockResolvedValue({ ok: true });
    state.reconcileAgent.mockResolvedValue({ ok: true });

    renderPage();

    expect(screen.getByText("Loading node details")).toBeInTheDocument();

    resolveNode?.(makeNode());

    expect(await screen.findByText("Node Information")).toBeInTheDocument();
    expect(screen.getByText("Reasoners and skills table")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
    expect(
      await screen.findByRole("button", { name: "Trigger configuration change" })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger configuration change" })
    );
    expect(
      await screen.findByRole("button", { name: "Restart required" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss restart banner" }));

    fireEvent.click(screen.getByRole("button", { name: "Logs" }));
    expect(await screen.findByText("Logs for agent-alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start agent" }));
    await waitFor(() => expect(state.startAgent).toHaveBeenCalledWith("agent-alpha"));

    fireEvent.click(screen.getAllByRole("button", { name: "Refresh status" })[0]);
    await waitFor(() => expect(state.getNodeDetailsWithPackageInfo).toHaveBeenCalled());
  });

  it("renders error state and supports retry", async () => {
    state.getNodeDetailsWithPackageInfo
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeNode());
    state.getNodeStatus.mockResolvedValue({
      status: "ok",
      health_status: "ready",
      lifecycle_status: "ready",
    });

    renderPage();

    expect(
      await screen.findByRole("button", { name: "Retry loading node details" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("boom")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry loading node details" })
    );
    expect(await screen.findByText("Node Information")).toBeInTheDocument();
  });
});
