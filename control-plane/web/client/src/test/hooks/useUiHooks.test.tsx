// @ts-nocheck
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardTimeRange } from "@/hooks/useDashboardTimeRange";
import { useFocusManagement } from "@/hooks/useFocusManagement";
import { useIsMobile } from "@/hooks/use-mobile";

const routerState = vi.hoisted(() => ({
  pathname: "/initial",
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: routerState.pathname }),
    useSearchParams: () => [routerState.searchParams, routerState.setSearchParams],
  };
});

describe("UI hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerState.pathname = "/initial";
    routerState.searchParams = new URLSearchParams();
    routerState.setSearchParams.mockReset();
    document.body.innerHTML = "";
    document.body.tabIndex = -1;
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("useDashboardTimeRange initializes from url params and syncs updates back", async () => {
    routerState.searchParams = new URLSearchParams({
      range: "custom",
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-02T00:00:00.000Z",
      compare: "true",
    });

    const { result } = renderHook(() => useDashboardTimeRange("24h"), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    expect(result.current.timeRange.preset).toBe("custom");
    expect(result.current.timeRange.compare).toBe(true);
    expect(result.current.label).toContain("Jan");
    expect(result.current.getApiParams()).toEqual({
      preset: "custom",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
      compare: true,
    });

    const updatedStart = new Date("2026-02-01T00:00:00.000Z");
    const updatedEnd = new Date("2026-02-03T00:00:00.000Z");

    act(() => {
      result.current.setPreset("7d");
      result.current.toggleCompare();
      result.current.setCustomRange(updatedStart, updatedEnd);
      result.current.setCompare(false);
    });

    expect(routerState.setSearchParams).toHaveBeenLastCalledWith(
      expect.any(URLSearchParams),
      { replace: true }
    );
    const params = routerState.setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(params.get("range")).toBe("custom");
    expect(params.get("start")).toBe(updatedStart.toISOString());
    expect(params.get("end")).toBe(updatedEnd.toISOString());
    expect(params.get("compare")).toBeNull();
  });

  it("useDashboardTimeRange falls back from invalid url values", () => {
    routerState.searchParams = new URLSearchParams({
      range: "unknown",
      start: "not-a-date",
      end: "still-bad",
    });

    const { result } = renderHook(() => useDashboardTimeRange("1h"), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    expect(result.current.timeRange.preset).toBe("1h");
    expect(result.current.timeRange.startTime).toBeNull();
    expect(result.current.label).toBe("Last hour");
  });

  it("useFocusManagement blurs focus, scrolls on route change, and removes listeners on cleanup", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const bodyFocusSpy = vi.spyOn(document.body, "focus").mockImplementation(() => {});
    const button = document.createElement("button");
    const blurSpy = vi.spyOn(button, "blur");
    document.body.appendChild(button);
    button.focus();

    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { rerender, unmount } = renderHook(() => useFocusManagement(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(blurSpy).toHaveBeenCalled();
    expect(bodyFocusSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    expect(addEventListenerSpy).toHaveBeenCalledWith("popstate", expect.any(Function));

    routerState.pathname = "/next";
    rerender();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(scrollSpy).toHaveBeenCalledTimes(2);

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
  });

  it("useFocusManagement registers load handlers when document is not complete", () => {
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading",
    });

    const addWindowListenerSpy = vi.spyOn(window, "addEventListener");
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const removeWindowListenerSpy = vi.spyOn(window, "removeEventListener");
    const removeDocumentListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useFocusManagement(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    expect(addWindowListenerSpy).toHaveBeenCalledWith("load", expect.any(Function));
    expect(addDocumentListenerSpy).toHaveBeenCalledWith(
      "DOMContentLoaded",
      expect.any(Function)
    );

    unmount();
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("load", expect.any(Function));
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith(
      "DOMContentLoaded",
      expect.any(Function)
    );
  });

  it("useIsMobile tracks media query changes and cleans up its listener", () => {
    let changeHandler: (() => void) | undefined;
    const addEventListener = vi.fn((_type: string, handler: () => void) => {
      changeHandler = handler;
    });
    const removeEventListener = vi.fn();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 500,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener,
        removeEventListener,
      }))
    );

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 900;
      changeHandler?.();
    });

    expect(result.current).toBe(false);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});