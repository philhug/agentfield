import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { AllReasonersPage } from "@/pages/AllReasonersPage";
import type { ReasonersResponse, ReasonerWithNode } from "@/types/reasoners";

const state = vi.hoisted(() => ({
  getAllReasoners: vi.fn<(filters?: unknown) => Promise<ReasonersResponse>>(),
  nodeConnected: true,
  reasonerConnected: true,
}));

vi.mock("@/services/reasonersApi", () => {
  class MockReasonersApiError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
      super(message);
      this.name = "ReasonersApiError";
      this.status = status;
    }
  }

  return {
    reasonersApi: {
      getAllReasoners: (filters?: unknown) => state.getAllReasoners(filters),
    },
    ReasonersApiError: MockReasonersApiError,
  };
});

vi.mock("@/hooks/useSSEQuerySync", () => ({
  useSSESync: () => ({
    nodeConnected: state.nodeConnected,
    reasonerConnected: state.reasonerConnected,
  }),
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

vi.mock("@/components/reasoners/CompactReasonersStats", () => ({
  CompactReasonersStats: ({
    total,
    onRefresh,
  }: {
    total: number;
    onRefresh?: () => void;
  }) => (
    <div>
      <span>Total {total}</span>
      <button type="button" onClick={onRefresh}>
        Refresh stats
      </button>
    </div>
  ),
}));

vi.mock("@/components/reasoners/SearchFilters", () => ({
  SearchFilters: ({
    filters,
    onFiltersChange,
  }: {
    filters: { status?: string; search?: string; limit?: number; offset?: number };
    onFiltersChange: (filters: {
      status?: "all" | "online" | "offline";
      search?: string;
      limit?: number;
      offset?: number;
    }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, status: "offline" })}
      >
        Show offline
      </button>
      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, search: "beta" })}
      >
        Search beta
      </button>
    </div>
  ),
}));

vi.mock("@/components/reasoners/ReasonerGrid", () => ({
  ReasonerGrid: ({
    reasoners,
    loading,
    onReasonerClick,
    viewMode,
  }: {
    reasoners: ReasonerWithNode[];
    loading?: boolean;
    onReasonerClick?: (reasoner: ReasonerWithNode) => void;
    viewMode?: string;
  }) => (
    <div>
      <div>{loading ? "Loading reasoners..." : `View ${viewMode}`}</div>
      {reasoners.map((reasoner) => (
        <button
          key={reasoner.reasoner_id}
          type="button"
          onClick={() => onReasonerClick?.(reasoner)}
        >
          {reasoner.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/reasoners/EmptyReasonersState", () => ({
  EmptyReasonersState: ({
    type,
    onRefresh,
    onClearFilters,
    onShowAll,
  }: {
    type: string;
    onRefresh?: () => void;
    onClearFilters?: () => void;
    onShowAll?: () => void;
  }) => (
    <div>
      <div>Empty {type}</div>
      <button type="button" onClick={onRefresh}>
        Refresh empty
      </button>
      <button type="button" onClick={onClearFilters}>
        Clear filters
      </button>
      <button type="button" onClick={onShowAll}>
        Show all
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
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

vi.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onValueChange?.(value === "grid" ? "table" : "grid")}
    >
      Switch view
    </button>
  ),
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props} />
  );
  return {
    Grid: Icon,
    List: Icon,
    Renew: Icon,
    Terminal: Icon,
    Wifi: Icon,
    WifiOff: Icon,
  };
});

const makeReasoner = (overrides?: Partial<ReasonerWithNode>): ReasonerWithNode => ({
  reasoner_id: "node-1.reasoner-a",
  name: "Reasoner A",
  description: "does work",
  node_id: "node-1",
  node_status: "active",
  node_version: "1.0.0",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  memory_config: {
    auto_inject: [],
    memory_retention: "short",
    cache_results: false,
  },
  tags: ["test"],
  last_updated: "2026-04-08T00:00:00Z",
  ...overrides,
});

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/reasoners"]}>
        <Routes>
          <Route
            path="/reasoners"
            element={
              <>
                <AllReasonersPage />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/reasoners/:id" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AllReasonersPage coverage", () => {
  beforeEach(() => {
    state.getAllReasoners.mockReset();
    state.nodeConnected = true;
    state.reasonerConnected = true;
  });

  it("renders loading then populated state and supports refresh, filters, view switch, and navigation", async () => {
    let resolveQuery: ((value: ReasonersResponse) => void) | undefined;
    const response: ReasonersResponse = {
      reasoners: [
        makeReasoner(),
        makeReasoner({
          reasoner_id: "node-2.reasoner-b",
          name: "Reasoner B",
          node_id: "node-2",
        }),
      ],
      total: 2,
      online_count: 1,
      offline_count: 1,
      nodes_count: 2,
    };
    state.getAllReasoners
      .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        })
      )
      .mockResolvedValue(response);

    renderPage();

    expect(screen.getByText("Loading reasoners...")).toBeInTheDocument();

    resolveQuery?.(response);

    expect(await screen.findByText("Reasoner A")).toBeInTheDocument();
    expect(screen.getByText("Reasoner B")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch view" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh stats" }));
    fireEvent.click(screen.getByRole("button", { name: "Show offline" }));
    fireEvent.click(screen.getByRole("button", { name: "Search beta" }));

    await waitFor(() => expect(state.getAllReasoners).toHaveBeenCalledTimes(4));

    fireEvent.click(screen.getByRole("button", { name: "Reasoner A" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/reasoners/node-1.reasoner-a"
    );
  });

  it("renders error and disconnected states", async () => {
    state.nodeConnected = false;
    state.reasonerConnected = false;
    state.getAllReasoners.mockRejectedValue(new Error("fetch failed"));

    renderPage();

    expect(await screen.findByText("Connection Error")).toBeInTheDocument();
    expect(screen.getByText("fetch failed")).toBeInTheDocument();
    expect(screen.getByText("Live updates unavailable")).toBeInTheDocument();
  });
});
