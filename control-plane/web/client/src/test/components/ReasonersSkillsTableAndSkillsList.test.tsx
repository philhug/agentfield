import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReasonersSkillsTable } from "@/components/ReasonersSkillsTable";
import SkillsList from "@/components/SkillsList";

const navigateMock = vi.fn();
const clipboardWriteTextMock = vi.fn();
const didCopiedMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/icon-bridge", () => ({
  Copy: () => <span>copy</span>,
  Identification: () => <span>identification</span>,
  ReasonerIcon: () => <span>reasoner-icon</span>,
  SkillIcon: () => <span>skill-icon</span>,
  Information: () => <span>information</span>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SearchBar", () => ({
  SearchBar: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
  TableBody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLTableRowElement>>) => (
    <tr onClick={onClick} {...props}>
      {children}
    </tr>
  ),
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
}));

vi.mock("@/components/did/DIDStatusBadge", () => ({
  DIDStatusBadge: ({ status }: { status: string }) => <span>did-status:{status}</span>,
  DIDIdentityBadge: ({
    did,
    onCopy,
  }: {
    did: string;
    onCopy?: (did: string) => void;
  }) => (
    <button type="button" onClick={() => onCopy?.(did)}>
      {did}
    </button>
  ),
}));

vi.mock("@/components/ui/notification", () => ({
  useDIDNotifications: () => ({
    didCopied: didCopiedMock,
  }),
}));

describe("ReasonersSkillsTable and SkillsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {},
      });
    }
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      writable: true,
      value: clipboardWriteTextMock,
    });
    clipboardWriteTextMock.mockResolvedValue(undefined);
  });

  it("renders empty state for the table when there are no items", () => {
    render(<ReasonersSkillsTable reasoners={[]} skills={[]} />);
    expect(screen.getByText(/No reasoners or skills available/i)).toBeInTheDocument();
  });

  it("filters, copies DIDs, and navigates to reasoner details", async () => {
    const user = userEvent.setup();

    render(
      <ReasonersSkillsTable
        reasoners={[
          { id: "planner", name: "Planner", tags: ["core"], memory_config: { memory_retention: "7d" } },
        ]}
        skills={[{ id: "summarize", name: "Summarize", tags: ["text"] }]}
        reasonerDIDs={{
          planner: {
            did: "did:example:planner",
            exposure_level: "public",
            capabilities: ["reason"],
            created_at: "2026-04-08T00:00:00Z",
            derivation_path: "/r",
            function_name: "planner",
            public_key_jwk: {},
          },
        }}
        skillDIDs={{
          summarize: {
            did: "did:example:summarize",
            exposure_level: "private",
            tags: ["text"],
            created_at: "2026-04-08T00:00:00Z",
            derivation_path: "/s",
            function_name: "summarize",
            public_key_jwk: {},
          },
        }}
        agentDID="did:example:agent"
        agentStatus={{ health_status: "active", lifecycle_status: "ready" }}
        nodeId="node-1"
      />
    );

    expect(screen.getByText("Reasoners & Skills")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Search reasoners and skills/i), "plan");
    expect(screen.getByText("planner")).toBeInTheDocument();
    expect(screen.queryByText("summarize")).not.toBeInTheDocument();

    await user.click(screen.getByText("planner"));
    expect(navigateMock).toHaveBeenCalledWith("/reasoners/node-1.planner");

    fireEvent.click(screen.getAllByTitle("Copy DID")[0]);
  });

  it("renders skills list variants and reports DID copy events", async () => {
    const user = userEvent.setup();
    const didInfo = {
      did: "did:example:agent",
      agent_node_id: "node-1",
      agentfield_server_id: "server-1",
      public_key_jwk: {},
      derivation_path: "/agent",
      reasoners: {},
      skills: {
        summarize: {
          did: "did:example:summarize",
          tags: ["tag-a", "tag-b", "tag-c"],
          exposure_level: "public",
          created_at: "2026-04-08T00:00:00Z",
          derivation_path: "/skill",
          function_name: "summarize",
          public_key_jwk: {},
        },
      },
      status: "active" as const,
      registered_at: "2026-04-08T00:00:00Z",
    };

    const { rerender } = render(<SkillsList skills={[]} />);
    expect(screen.getByText(/No skills available/i)).toBeInTheDocument();

    rerender(
      <SkillsList
        skills={[{ id: "summarize", name: "Summarize", tags: ["tag-a", "tag-b", "tag-c"] }]}
        didInfo={didInfo}
      />
    );

    expect(screen.getByText("Skills (1)")).toBeInTheDocument();
    expect(screen.getByText("1 with DID")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /information/i }));
    expect(screen.getByText("Exposure Level:")).toBeInTheDocument();
    expect(screen.getAllByText("tag-a").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "did:example:summarize" }));
    expect(clipboardWriteTextMock).toHaveBeenCalledWith("did:example:summarize");
    expect(didCopiedMock).toHaveBeenCalledWith("Skill DID");

    rerender(
      <SkillsList
        skills={[{ id: "summarize", name: "Summarize", tags: ["tag-a", "tag-b", "tag-c"] }]}
        didInfo={didInfo}
        compact={true}
      />
    );

    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
