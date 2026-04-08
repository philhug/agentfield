import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NotificationProvider,
  getNotificationGlyph,
  resolveEventKind,
  useErrorNotification,
  useInfoNotification,
  useNotifications,
  useRunNotification,
  useSuccessNotification,
  useWarningNotification,
} from "@/components/ui/notification";

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("sonner", () => ({
  Toaster: ({ theme }: { theme: string }) => <div data-testid="toaster" data-theme={theme} />,
  toast: toastMock,
}));

function NotificationHarness() {
  const {
    notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
  } = useNotifications();

  return (
    <div>
      <div data-testid="unread-count">{unreadCount}</div>
      <div data-testid="notification-count">{notifications.length}</div>
      <div data-testid="first-href">{notifications[0]?.href ?? ""}</div>
      <button
        onClick={() =>
          addNotification({
            type: "success",
            title: "Saved",
            message: "Changes stored",
            action: { label: "Undo", onClick: vi.fn() },
          })
        }
      >
        add
      </button>
      <button
        onClick={() =>
          addNotification({
            type: "info",
            title: "Run update",
            runId: "run-42",
            persistent: true,
          })
        }
      >
        add-run
      </button>
      <button onClick={() => notifications[0] && markRead(notifications[0].id)}>
        mark-read
      </button>
      <button onClick={() => markAllRead()}>mark-all</button>
      <button onClick={() => notifications[0] && removeNotification(notifications[0].id)}>
        remove
      </button>
      <button onClick={() => clearAll()}>clear</button>
    </div>
  );
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe("notification utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "Control Plane";
  });

  it("resolves event kinds and glyphs", () => {
    const resumeGlyph = getNotificationGlyph({
      type: "success",
      eventKind: "resume",
    });

    expect(resolveEventKind({ type: "success" })).toBe("complete");
    expect(resolveEventKind({ type: "warning", eventKind: "pause" })).toBe("pause");
    expect(getNotificationGlyph({ type: "error" }).iconClass).toContain("text-destructive");
    expect(resumeGlyph.Icon).toBeTruthy();
    expect(resumeGlyph.iconClass).toContain("text-emerald-500");
  });

  it("adds notifications, updates unread count, marks them read, removes them, and clears the log", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    });

    render(
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>,
    );

    expect(screen.getByTestId("toaster")).toHaveAttribute("data-theme", "light");

    await user.click(screen.getByRole("button", { name: "add" }));

    expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
    expect(screen.getByTestId("notification-count")).toHaveTextContent("1");
    expect(document.title).toBe("(1) Control Plane");
    expect(toastMock.success).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({
        description: "Changes stored",
        duration: 5000,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "mark-read" }));
    expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    expect(document.title).toBe("Control Plane");

    await user.click(screen.getByRole("button", { name: "add-run" }));
    expect(toastMock.info).toHaveBeenCalledWith(
      "Run update",
      expect.objectContaining({
        duration: Infinity,
        action: expect.objectContaining({ label: "View run" }),
      }),
    );

    const action = toastMock.info.mock.calls[0]?.[1]?.action;
    act(() => {
      action.onClick();
    });
    expect(assign).toHaveBeenCalledWith("/ui/runs/run-42");

    await user.click(screen.getByRole("button", { name: "remove" }));
    expect(toastMock.dismiss).toHaveBeenCalledWith(expect.any(String));

    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
    expect(toastMock.dismiss).toHaveBeenCalledWith();
  });

  it("supports hook helpers for semantic notification types", () => {
    const success = renderHook(() => useSuccessNotification(), { wrapper });
    const error = renderHook(() => useErrorNotification(), { wrapper });
    const info = renderHook(() => useInfoNotification(), { wrapper });
    const warning = renderHook(() => useWarningNotification(), { wrapper });
    const runNotification = renderHook(() => useRunNotification(), { wrapper });

    act(() => {
      success.result.current("Saved", "Done");
      error.result.current("Failed", "Nope");
      info.result.current("Heads up", "FYI");
      warning.result.current("Careful", "Watch it");
      runNotification.result.current({
        title: "Pipeline finished",
        message: "run complete",
        runId: "run-99",
        runLabel: "nightly",
        type: "success",
      });
    });

    expect(toastMock.success).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({ duration: 4000 }),
    );
    expect(toastMock.error).toHaveBeenCalledWith(
      "Failed",
      expect.objectContaining({ duration: 6000 }),
    );
    expect(toastMock.info).toHaveBeenCalledWith(
      "Heads up",
      expect.objectContaining({ duration: 5000 }),
    );
    expect(toastMock.warning).toHaveBeenCalledWith(
      "Careful",
      expect.objectContaining({ duration: 5000 }),
    );
    expect(runNotification.result.current).toBeTypeOf("function");
  });

  it("stores run hrefs in the notification log", async () => {
    const user = userEvent.setup();

    function RunHarness() {
      const notifyRun = useRunNotification();
      const { notifications } = useNotifications();

      return (
        <div>
          <div data-testid="href">{notifications[0]?.href ?? ""}</div>
          <button
            onClick={() =>
              notifyRun({
                title: "Run started",
                runId: "run-77",
                eventKind: "start",
              })
            }
          >
            notify-run
          </button>
        </div>
      );
    }

    render(
      <NotificationProvider>
        <RunHarness />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "notify-run" }));
    expect(screen.getByTestId("href")).toHaveTextContent("/runs/run-77");
  });
});
