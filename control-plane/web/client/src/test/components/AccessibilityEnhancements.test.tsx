import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorAnnouncer,
  FocusTrap,
  KeyboardNavigable,
  LiveRegion,
  ProgressAnnouncer,
  ScreenReaderOnly,
  SkipLink,
  StatusAnnouncer,
  useAccessibility,
} from "@/components/AccessibilityEnhancements";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= vi.fn();
});

describe("AccessibilityEnhancements", () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders basic accessibility helpers with the expected attributes", () => {
    render(
      <div>
        <ScreenReaderOnly className="extra">Hidden text</ScreenReaderOnly>
        <SkipLink href="#main">Skip to content</SkipLink>
        <LiveRegion politeness="assertive" atomic className="custom-live">
          Announce me
        </LiveRegion>
      </div>,
    );

    expect(screen.getByText("Hidden text").className).toContain("sr-only");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByText("Announce me")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Announce me")).toHaveAttribute("aria-atomic", "true");
  });

  it("traps focus, wraps tab navigation, and restores focus on cleanup", () => {
    function Harness({ active }: { active: boolean }) {
      return (
        <div>
          <button type="button">Before</button>
          <FocusTrap active={active}>
            <button type="button">First</button>
            <button type="button">Last</button>
          </FocusTrap>
        </div>
      );
    }

    const { rerender } = render(<Harness active={false} />);
    const before = screen.getByRole("button", { name: "Before" });

    before.focus();
    expect(before).toHaveFocus();

    rerender(<Harness active />);
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    rerender(<Harness active={false} />);
    expect(before).toHaveFocus();
  });

  it("handles keyboard callbacks for supported keys", () => {
    const onEnter = vi.fn();
    const onSpace = vi.fn();
    const onEscape = vi.fn();
    const onArrowUp = vi.fn();
    const onArrowDown = vi.fn();
    const onArrowLeft = vi.fn();
    const onArrowRight = vi.fn();

    render(
      <KeyboardNavigable
        onEnter={onEnter}
        onSpace={onSpace}
        onEscape={onEscape}
        onArrowUp={onArrowUp}
        onArrowDown={onArrowDown}
        onArrowLeft={onArrowLeft}
        onArrowRight={onArrowRight}
      >
        Keyboard target
      </KeyboardNavigable>,
    );

    const target = screen.getByText("Keyboard target");
    fireEvent.keyDown(target, { key: "Enter" });
    fireEvent.keyDown(target, { key: " " });
    fireEvent.keyDown(target, { key: "Escape" });
    fireEvent.keyDown(target, { key: "ArrowUp" });
    fireEvent.keyDown(target, { key: "ArrowDown" });
    fireEvent.keyDown(target, { key: "ArrowLeft" });
    fireEvent.keyDown(target, { key: "ArrowRight" });

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onSpace).toHaveBeenCalledTimes(1);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onArrowUp).toHaveBeenCalledTimes(1);
    expect(onArrowDown).toHaveBeenCalledTimes(1);
    expect(onArrowLeft).toHaveBeenCalledTimes(1);
    expect(onArrowRight).toHaveBeenCalledTimes(1);
  });

  it("announces status, progress, and errors on their timer boundaries", () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <div>
        <StatusAnnouncer status="Loaded" delay={250} />
        <ProgressAnnouncer progress={10} total={10} label="Upload" announceInterval={25} />
        <ErrorAnnouncer error="Broken" clearAfter={500} />
      </div>,
    );

    expect(screen.getByText("Upload: 100% complete")).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText("Loaded")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText("Broken")).not.toBeInTheDocument();

    rerender(
      <div>
        <StatusAnnouncer status="Updated" delay={100} />
        <ProgressAnnouncer progress={10} total={10} label="Upload" announceInterval={25} />
        <ErrorAnnouncer error={null} clearAfter={500} />
      </div>,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("supports the accessibility hook announcement and focus helpers", () => {
    vi.useFakeTimers();

    const target = document.createElement("button");
    target.className = "focus-target";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const { result } = renderHook(() => useAccessibility());

    result.current.announceStatus("Saved");
    result.current.announceError("Bad request");
    result.current.focusElement(".focus-target");

    expect(target).toHaveFocus();
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(document.body).toHaveTextContent("Saved");
    expect(document.body).toHaveTextContent("Error: Bad request");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.body).not.toHaveTextContent("Saved");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.body).not.toHaveTextContent("Error: Bad request");
  });
});
