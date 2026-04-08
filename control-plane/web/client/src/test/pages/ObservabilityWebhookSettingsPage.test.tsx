// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ObservabilityWebhookSettingsPage } from "@/pages/ObservabilityWebhookSettingsPage";

const state = vi.hoisted(() => ({
  getObservabilityWebhook: vi.fn<() => Promise<any>>(),
  setObservabilityWebhook: vi.fn<(request: any) => Promise<void>>(),
  deleteObservabilityWebhook: vi.fn<() => Promise<void>>(),
  getObservabilityWebhookStatus: vi.fn<() => Promise<any>>(),
  redriveDeadLetterQueue: vi.fn<() => Promise<any>>(),
  clearDeadLetterQueue: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/services/observabilityWebhookApi", () => ({
  getObservabilityWebhook: () => state.getObservabilityWebhook(),
  setObservabilityWebhook: (request: any) => state.setObservabilityWebhook(request),
  deleteObservabilityWebhook: () => state.deleteObservabilityWebhook(),
  getObservabilityWebhookStatus: () => state.getObservabilityWebhookStatus(),
  redriveDeadLetterQueue: () => state.redriveDeadLetterQueue(),
  clearDeadLetterQueue: () => state.clearDeadLetterQueue(),
}));

vi.mock("@/utils/dateFormat", () => ({
  formatRelativeTime: (value: string) => `relative:${value}`,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    ...props
  }: React.PropsWithChildren<React.LabelHTMLAttributes<HTMLLabelElement>>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/icon-bridge", () => {
  const Icon = () => <span>icon</span>;
  return {
    Trash: Icon,
    Plus: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
    Renew: Icon,
    Settings: Icon,
    Eye: Icon,
    EyeOff: Icon,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ObservabilityWebhookSettingsPage />
    </MemoryRouter>
  );
}

describe("ObservabilityWebhookSettingsPage", () => {
  beforeEach(() => {
    state.getObservabilityWebhook.mockReset();
    state.setObservabilityWebhook.mockReset();
    state.deleteObservabilityWebhook.mockReset();
    state.getObservabilityWebhookStatus.mockReset();
    state.redriveDeadLetterQueue.mockReset();
    state.clearDeadLetterQueue.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders loading, then populated config, and saves updated headers", async () => {
    let resolveConfig: ((value: any) => void) | null = null;
    let resolveStatus: ((value: any) => void) | null = null;

    state.getObservabilityWebhook.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConfig = resolve;
        })
    );
    state.getObservabilityWebhookStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );
    state.setObservabilityWebhook.mockResolvedValue();
    state.getObservabilityWebhook.mockResolvedValue({
      configured: true,
      config: {
        url: "https://example.com/hook",
        enabled: true,
        headers: { Authorization: "Bearer one" },
        has_secret: true,
        created_at: "2026-04-07T00:00:00Z",
        updated_at: "2026-04-08T00:00:00Z",
      },
    });
    state.getObservabilityWebhookStatus.mockResolvedValue({
      enabled: true,
      events_forwarded: 10,
      events_dropped: 2,
      queue_depth: 1,
      dead_letter_count: 0,
      last_forwarded_at: "2026-04-08T00:00:00Z",
    });

    renderPage();

    expect(screen.getByText("Loading configuration...")).toBeInTheDocument();

    resolveConfig?.({
      configured: true,
      config: {
        url: "https://example.com/hook",
        enabled: true,
        headers: { Authorization: "Bearer one" },
        has_secret: true,
        created_at: "2026-04-07T00:00:00Z",
        updated_at: "2026-04-08T00:00:00Z",
      },
    });
    resolveStatus?.({
      enabled: true,
      events_forwarded: 10,
      events_dropped: 2,
      queue_depth: 1,
      dead_letter_count: 0,
      last_forwarded_at: "2026-04-08T00:00:00Z",
    });

    expect(await screen.findByDisplayValue("https://example.com/hook")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getAllByText("relative:2026-04-08T00:00:00Z").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /add header/i }));

    const nameInputs = screen.getAllByPlaceholderText("Header name");
    const valueInputs = screen.getAllByPlaceholderText("Header value");
    fireEvent.change(nameInputs[1], { target: { value: "X-Test" } });
    fireEvent.change(valueInputs[1], { target: { value: "enabled" } });
    fireEvent.change(screen.getByLabelText("Webhook URL"), {
      target: { value: "https://example.com/updated" },
    });

    fireEvent.click(screen.getByRole("button", { name: /update configuration/i }));

    await waitFor(() => {
      expect(state.setObservabilityWebhook).toHaveBeenCalledWith({
        url: "https://example.com/updated",
        enabled: true,
        headers: {
          Authorization: "Bearer one",
          "X-Test": "enabled",
        },
      });
    });

    expect(await screen.findByText("Webhook configuration saved successfully")).toBeInTheDocument();
  });
});