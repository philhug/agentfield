import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  );

  return {
    Wifi: Icon,
    WifiOff: Icon,
    Grid: Icon,
    Terminal: Icon,
    Renew: Icon,
    Search: Icon,
    CloudOffline: Icon,
    AlertTriangle: Icon,
    RefreshCw: Icon,
  };
});

import {
  LoadingSkeleton,
  LoadingWrapper,
  useLoadingState,
} from "@/components/LoadingSkeleton";
import { EmptyReasonersState } from "@/components/reasoners/EmptyReasonersState";
import { ErrorState } from "@/components/ui/ErrorState";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

describe("empty, error, and loading states", () => {
  it("renders empty reasoners search state actions and callbacks", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const onRefresh = vi.fn();

    render(
      <EmptyReasonersState
        type="no-search-results"
        searchTerm="agent-x"
        onClearFilters={onClearFilters}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText('No reasoners match "agent-x". Try a different search term or clear your filters.')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Filters" }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders empty reasoners loading state with disabled refresh", () => {
    const onRefresh = vi.fn();

    render(
      <EmptyReasonersState
        type="no-reasoners"
        onRefresh={onRefresh}
        loading
      />,
    );

    expect(screen.getByText("No Reasoners Available")).toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("renders banner and card error states with retry and dismiss actions", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <ErrorState
        variant="banner"
        severity="warning"
        title="Temporary issue"
        error="Request failed"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Temporary issue")).toBeInTheDocument();
    expect(screen.getByText("Request failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorState
        title="Card error"
        error={new Error("Boom")}
        onRetry={onRetry}
        onDismiss={onDismiss}
        retrying
      />,
    );

    expect(screen.getByText("Card error")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retrying..." })).toBeDisabled();
  });

  it("renders inline error state retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ErrorState
        variant="inline"
        severity="info"
        title="Inline issue"
        description="Needs retry"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Inline issue")).toBeInTheDocument();
    expect(screen.getByText("Needs retry")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders loading skeleton variants and wrapper fallbacks", () => {
    const { container, rerender } = render(
      <div>
        <LoadingSkeleton variant="list" count={3} />
        <LoadingSkeleton variant="table" count={2} animated={false} />
        <LoadingWrapper loading fallback={<div>Fallback loading</div>}>
          <div>Loaded content</div>
        </LoadingWrapper>
      </div>,
    );

    expect(container.querySelectorAll(".rounded-full").length).toBe(3);
    expect(container.querySelectorAll(".border-b").length).toBeGreaterThan(0);
    expect(screen.getByText("Fallback loading")).toBeInTheDocument();

    rerender(
      <LoadingWrapper loading={false} skeleton={<div>Skeleton</div>}>
        <div>Loaded content</div>
      </LoadingWrapper>,
    );

    expect(screen.getByText("Loaded content")).toBeInTheDocument();
  });

  it("tracks loading state through the hook helper", async () => {
    const { result } = renderHook(() => useLoadingState());

    let pendingResolve: (() => void) | undefined;
    const pendingPromise = new Promise<string>((resolve) => {
      pendingResolve = () => resolve("done");
    });

    let promise!: Promise<string>;

    act(() => {
      promise = result.current.withLoading(() => pendingPromise);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      pendingResolve?.();
      await expect(promise).resolves.toBe("done");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.withLoading(async () => "fast", false),
      ).resolves.toBe("fast");
    });

    expect(result.current.loading).toBe(false);
  });
});
