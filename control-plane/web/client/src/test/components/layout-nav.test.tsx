// @ts-nocheck
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "@/components/AppLayout";
import { TopNavigation } from "@/components/Navigation/TopNavigation";
import { SidebarNew } from "@/components/Navigation/SidebarNew";

const sidebarState = vi.hoisted(() => ({
  state: "expanded" as "expanded" | "collapsed",
}));

vi.mock("@/assets/logos/logo-short-light-v2.svg?url", () => ({ default: "/logo-light.svg" }));
vi.mock("@/assets/logos/logo-short-dark-v2.svg?url", () => ({ default: "/logo-dark.svg" }));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar-stub">sidebar</div>,
}));

vi.mock("@/components/HealthStrip", () => ({
  HealthStrip: () => <div data-testid="health-strip">health</div>,
}));

vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette">command-palette</div>,
}));

vi.mock("@/components/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

vi.mock("@/hooks/useSSEQuerySync", () => ({
  SSESyncProvider: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sse-sync-provider">{children}</div>
  ),
}));

vi.mock("@/components/ui/mode-toggle", () => ({
  ModeToggle: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      Toggle theme
    </button>
  ),
}));

vi.mock("@/components/ui/icon", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true" data-testid={`icon-${name}`} />,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="separator" {...props} />,
}));

vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
    <nav {...props}>{children}</nav>
  ),
  BreadcrumbList: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
    <div {...props}>{children}</div>
  ),
  BreadcrumbItem: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
    <span {...props}>{children}</span>
  ),
  BreadcrumbLink: ({ children }: React.PropsWithChildren) => <>{children}</>,
  BreadcrumbPage: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
    <span {...props}>{children}</span>
  ),
  BreadcrumbSeparator: (props: React.HTMLAttributes<HTMLElement>) => <span {...props}>/</span>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="sidebar-provider" className={className}>
      {children}
    </div>
  ),
  SidebarInset: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="sidebar-inset" className={className}>
      {children}
    </div>
  ),
  SidebarTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" aria-label="Toggle Sidebar" {...props}>
      Toggle Sidebar
    </button>
  ),
  Sidebar: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <aside {...props}>{children}</aside>,
  SidebarContent: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarGroup: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <section {...props}>{children}</section>,
  SidebarGroupLabel: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarGroupContent: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarMenu: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarMenuItem: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarMenuButton: ({
    asChild,
    children,
    isActive,
    tooltip,
    ...props
  }: React.PropsWithChildren<{
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string;
  } & React.HTMLAttributes<HTMLElement>>) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        title: tooltip,
        "data-active": isActive ? "true" : "false",
        "data-testid": props["data-testid"] ?? "sidebar-menu-button",
      });
    }
    return (
      <button
        type="button"
        title={tooltip}
        data-active={isActive ? "true" : "false"}
        {...props}
      >
        {children}
      </button>
    );
  },
  SidebarHeader: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  SidebarRail: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="sidebar-rail" {...props} />,
  SidebarSeparator: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-separator" {...props} />
  ),
  SidebarFooter: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  useSidebar: () => sidebarState,
}));

describe("layout and navigation components", () => {
  beforeEach(() => {
    sidebarState.state = "expanded";
  });

  it("renders layout children and hides the section breadcrumb on section index routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("sse-sync-provider")).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar-stub")).toBeInTheDocument();
    expect(screen.getByTestId("health-strip")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("renders nested route breadcrumbs for compare and resource detail routes", () => {
    render(
      <MemoryRouter initialEntries={["/runs/compare"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="runs/compare" element={<div>Compare view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Runs" })).toHaveAttribute("href", "/runs");
    expect(screen.getAllByText("Compare")).toHaveLength(2);
    expect(screen.getByText("Compare view")).toBeInTheDocument();

    cleanup();

    render(
      <MemoryRouter initialEntries={["/runs/1234567890abcdef"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="runs/:runId" element={<div>Run detail</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("…90abcdef")).toHaveLength(2);
    expect(screen.getByText("Run detail")).toBeInTheDocument();
  });

  it("renders app sidebar nav groups, active links, and collapsed branding state", async () => {
    const { AppSidebar } = await vi.importActual<typeof import("@/components/AppSidebar")>(
      "@/components/AppSidebar",
    );

    const { rerender } = render(
      <MemoryRouter initialEntries={["/runs/active"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AgentField/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Runs" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "https://agentfield.ai/docs");
    expect(screen.getByText("Control Plane")).toBeInTheDocument();

    sidebarState.state = "collapsed";
    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Control Plane")).not.toBeInTheDocument();
  });

  it("builds top navigation breadcrumbs for mapped and dynamic routes", () => {
    render(
      <MemoryRouter initialEntries={["/reasoners/acme.demo.reasoner"]}>
        <TopNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Reasoners" })).toHaveAttribute("href", "/reasoners/all");
    expect(screen.getByText("reasoner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();

    cleanup();

    render(
      <MemoryRouter initialEntries={["/nodes/node-7"]}>
        <TopNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByText("Node node-7")).toBeInTheDocument();
  });

  it("renders new sidebar sections, active items, disabled items, and footer links", async () => {
    const user = userEvent.setup();

    sidebarState.state = "collapsed";

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SidebarNew
          sections={[
            {
              id: "primary",
              title: "Primary",
              items: [
                { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
                { id: "reports", label: "Reports", href: "/reports", icon: "settings" },
                { id: "disabled", label: "Disabled item", href: "/disabled", disabled: true, icon: "support" },
              ],
            },
          ]}
        />
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/reports" element={<div>Reports page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("AgentField")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("[data-active]")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Dashboard").closest("[title]")).toHaveAttribute("title", "Dashboard");
    expect(screen.getByRole("button", { name: /Disabled item/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "https://agentfield.ai/docs/learn",
    );

    await user.click(screen.getByRole("link", { name: "Reports" }));
    expect(screen.getByText("Reports").closest("[data-active]")).toHaveAttribute("data-active", "true");
  });
});