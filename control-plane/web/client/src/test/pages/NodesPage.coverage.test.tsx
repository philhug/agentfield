import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { NodesPage } from "@/pages/NodesPage";
import type { AgentNodeSummary, AgentStatus } from "@/types/agentfield";

const state = vi.hoisted(() => ({
  getNodesSummary: vi.fn<
    () => Promise<{ nodes: AgentNodeSummary[]; count: number }>
  >(),
  reconnect: vi.fn(),
  nodeEvent: null as null | { type: string; data: unknown },
  unifiedStatusEvent: null as null | { type: string; data: unknown },
  connected: true,
  reconnecting: false,
}));

vi.mock("@/services/api", () => ({
  getNodesSummary: () => state.getNodesSummary(),
}));

vi.mock("@/hooks/useSSE", () => ({
  useNodeEventsSSE: () => ({
    connected: state.connected,
    reconnecting: state.reconnecting,
    latestEvent: state.nodeEvent,
    reconnect: state.reconnect,
  }),
  useUnifiedStatusSSE: () => ({
    latestEvent: state.unifiedStatusEvent,
  }),
}));

vi.mock("@/utils/dateFormat", () => ({
  formatCompactRelativeTime: () => "just now",
}));

vi.mock("@/utils/node-status", () => ({
  summarizeNodeStatuses: (nodes: AgentNodeSummary[]) => ({ total: nodes.length }),
}));

vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    title,
    description,
    actions,
    aside,
  }: {
    title: string;
    description: string;
    actions?: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
    aside?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{aside}</div>
      <div>
        {actions?.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </header>
  ),
}));

vi.mock("@/components/status", () => ({
  StatusRefreshButton: ({
    onRefresh,
    onError,
  }: {
    onRefresh?: (status: AgentStatus | Record<string, AgentStatus>) => void;
    onError?: (error: string) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onRefresh?.({
            "node-1": {
              status: "ok",
              health_status: "ready",
              lifecycle_status: "ready",
              last_seen: "2026-04-08T00:00:00Z",
            },
          })
        }
      >
        Refresh statuses
      </button>
      <button type="button" onClick={() => onError?.("refresh failed")}>
        Trigger refresh error
      </button>
    </div>
  ),
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
      aria-label="Search nodes"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/NodesStatusSummary", () => ({
  NodesStatusSummary: ({
    nodes,
    searchQuery,
  }: {
    nodes: AgentNodeSummary[];
    searchQuery: string;
  }) => (
    <div>
      Summary {nodes.length} Search {searchQuery || "none"}
    </div>
  ),
}));

vi.mock("@/components/NodesVirtualList", () => ({
  NodesVirtualList: ({
    nodes,
    isLoading,
  }: {
    nodes: AgentNodeSummary[];
    isLoading: boolean;
  }) => (
    <div>
      {isLoading ? (
        <span>Loading nodes...</span>
      ) : (
        nodes.map((node) => <div key={node.id}>{node.id}</div>)
      )}
    </div>
  ),
}));

vi.mock("@/components/DensityToggle", () => ({
  DensityToggle: ({
    density,
    onChange,
  }: {
    density: string;
    onChange: (density: "compact" | "comfortable") => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange(density === "comfortable" ? "compact" : "comfortable")
      }
    >
      Density {density}
    </button>
  ),
}));

vi.mock("@/components/ServerlessRegistrationModal", () => ({
  ServerlessRegistrationModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>Serverless modal</span>
        <button type="button" onClick={onClose}>
          Close modal
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  AlertDescription: ({ children }: React.PropsWithChildren) => (
    <p>{children}</p>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props} />
  );
  return {
    ArrowClockwise: Icon,
    Plus: Icon,
    Terminal: Icon,
    WifiHigh: Icon,
    WifiSlash: Icon,
  };
});

const makeNode = (overrides?: Partial<AgentNodeSummary>): AgentNodeSummary => ({
  id: "node-1",
  base_url: "http://node-1",
  version: "1.0.0",
  team_id: "team-a",
  health_status: "ready",
  lifecycle_status: "ready",
  last_heartbeat: "2026-04-08T00:00:00Z",
  deployment_type: "long_running",
  reasoner_count: 2,
  skill_count: 1,
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <NodesPage />
    </MemoryRouter>
  );
}

describe("NodesPage coverage", () => {
  beforeEach(() => {
    state.getNodesSummary.mockReset();
    state.reconnect.mockReset();
    state.nodeEvent = null;
    state.unifiedStatusEvent = null;
    state.connected = true;
    state.reconnecting = false;
  });

  it("renders loading then populated state and supports key interactions", async () => {
    let resolveFetch:
      | ((value: { nodes: AgentNodeSummary[]; count: number }) => void)
      | undefined;
    state.getNodesSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    renderPage();

    expect(screen.getByText("Loading nodes...")).toBeInTheDocument();

    resolveFetch?.({
      nodes: [makeNode(), makeNode({ id: "node-2", team_id: "team-b" })],
      count: 2,
    });

    expect(await screen.findByText("node-1")).toBeInTheDocument();
    expect(screen.getByText("node-2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search nodes"), {
      target: { value: "node-2" },
    });
    expect(screen.queryByText("node-1")).not.toBeInTheDocument();
    expect(screen.getByText("node-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Serverless Agent" }));
    expect(screen.getByText("Serverless modal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(screen.queryByText("Serverless modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Refresh statuses" })[0]);
    await waitFor(() =>
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    );
  });

  it("renders error state and reconnect action when disconnected", async () => {
    state.connected = false;
    state.getNodesSummary.mockRejectedValue(new Error("offline"));

    renderPage();

    expect(
      await screen.findByText(/Failed to load agent nodes/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(state.reconnect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Add Serverless Agent" }));
    expect(screen.getByText("Serverless modal")).toBeInTheDocument();
  });
});
