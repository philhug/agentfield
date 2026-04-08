import { describe, expect, it } from "vitest";

import { jsonSchemaToZodObject } from "@/utils/jsonSchemaToZod";
import { summarizeNodeStatuses, getNodeStatusPresentation } from "@/utils/node-status";
import { formatNumber, formatNumberWithCommas } from "@/utils/numberFormat";
import {
  getStatusLabel,
  getStatusTheme,
  isCancelledStatus,
  isFailureStatus,
  isPausedStatus,
  isQueuedStatus,
  isRunningStatus,
  isSuccessStatus,
  isTerminalStatus,
  isTimeoutStatus,
  isWaitingStatus,
  normalizeExecutionStatus,
} from "@/utils/status";
import {
  calculateTrend,
  formatDeltaWithArrow,
  getTrendColorClass,
  normalizeForSparkline,
} from "@/utils/trendUtils";

describe("misc utility coverage", () => {
  it("converts JSON schema to a zod object for objects, enums, arrays, and nullable fields", () => {
    const objectSchema = jsonSchemaToZodObject({
      type: "object",
      required: ["mode", "count"],
      properties: {
        mode: { enum: ["fast", "safe"] },
        count: { type: "integer" },
        enabled: { type: ["boolean", "null"] },
        tags: { type: "array", items: { type: "string" } },
        config: {
          type: ["object", "null"],
          properties: { retries: { type: "number" } },
        },
      },
    });

    expect(
      objectSchema.parse({
        mode: "fast",
        count: 2,
        enabled: null,
        tags: ["a"],
        config: { retries: 1 },
        extra: "allowed",
      })
    ).toMatchObject({
      mode: "fast",
      count: 2,
      enabled: null,
      tags: ["a"],
      config: { retries: 1 },
      extra: "allowed",
    });
    expect(() => objectSchema.parse({ mode: "fast" })).toThrow();

    const scalarWrapped = jsonSchemaToZodObject({
      type: "string",
      enum: ["alpha", "beta"],
    });
    expect(scalarWrapped.parse({ value: "alpha" })).toEqual({ value: "alpha" });
    expect(() => scalarWrapped.parse({ value: "gamma" })).toThrow();
  });

  it("formats node presentation and summarizes status buckets", () => {
    expect(getNodeStatusPresentation("ready", "ready")).toMatchObject({
      kind: "ready",
      label: "Ready",
      canonical: "running",
      shouldPulse: false,
    });
    expect(getNodeStatusPresentation("starting", "starting")).toMatchObject({
      kind: "starting",
      shouldPulse: true,
    });
    expect(getNodeStatusPresentation("offline", "inactive")).toMatchObject({
      kind: "offline",
      canonical: "failed",
    });
    expect(getNodeStatusPresentation(undefined, "degraded")).toMatchObject({
      kind: "error",
      label: "Error",
    });

    expect(
      summarizeNodeStatuses([
        {
          id: "1",
          base_url: "http://a",
          version: "1",
          team_id: "team",
          health_status: "ready",
          lifecycle_status: "ready",
          reasoner_count: 1,
          skill_count: 1,
        },
        {
          id: "2",
          base_url: "http://b",
          version: "1",
          team_id: "team",
          health_status: "starting",
          lifecycle_status: "starting",
          reasoner_count: 1,
          skill_count: 1,
        },
        {
          id: "3",
          base_url: "http://c",
          version: "1",
          team_id: "team",
          health_status: "degraded",
          lifecycle_status: "unknown",
          reasoner_count: 1,
          skill_count: 1,
        },
        {
          id: "4",
          base_url: "http://d",
          version: "1",
          team_id: "team",
          health_status: "unknown",
          lifecycle_status: "offline",
          reasoner_count: 1,
          skill_count: 1,
        },
      ])
    ).toEqual({
      total: 4,
      online: 2,
      offline: 2,
      degraded: 0,
      starting: 1,
      ready: 1,
    });
  });

  it("formats numbers and normalizes execution status helpers", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(2_000_000, 2)).toBe("2M");
    expect(formatNumberWithCommas(1_000_000)).toBe("1,000,000");

    expect(normalizeExecutionStatus(" success ")).toBe("succeeded");
    expect(normalizeExecutionStatus("WAIT")).toBe("queued");
    expect(normalizeExecutionStatus("mystery")).toBe("unknown");
    expect(getStatusLabel("timed_out")).toBe("Timed Out");
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isSuccessStatus("done")).toBe(true);
    expect(isFailureStatus("error")).toBe(true);
    expect(isCancelledStatus("canceled")).toBe(true);
    expect(isTimeoutStatus("timeout")).toBe(true);
    expect(isRunningStatus("processing")).toBe(true);
    expect(isPausedStatus("hold")).toBe(true);
    expect(isWaitingStatus("awaiting_human")).toBe(true);
    expect(isQueuedStatus("pending")).toBe(true);

    const runningTheme = getStatusTheme("running");
    expect(runningTheme).toMatchObject({
      status: "running",
      badgeVariant: "secondary",
      motion: "live",
      hexColor: "#2563eb",
    });
    expect(runningTheme.pillClass).toContain("bg-status-info/10");
    expect(getStatusTheme("bogus").status).toBe("unknown");
  });

  it("calculates trends, display helpers, and sparkline normalization", () => {
    const up = calculateTrend(12, 10, "up-is-good");
    expect(up).toMatchObject({
      direction: "up",
      absoluteDelta: 2,
      displayText: "+20.0%",
      color: "success",
    });

    const down = calculateTrend(6, 10, "down-is-good");
    expect(down).toMatchObject({
      direction: "down",
      color: "success",
    });

    const flat = calculateTrend(0, 0);
    expect(flat).toMatchObject({
      direction: "flat",
      displayText: "—",
      color: "muted",
    });

    expect(formatDeltaWithArrow(up)).toBe("↑ +20.0%");
    expect(formatDeltaWithArrow(down)).toBe("↓ -40.0%");
    expect(formatDeltaWithArrow(flat)).toBe("—");
    expect(getTrendColorClass("success")).toBe("text-emerald-500");
    expect(getTrendColorClass("destructive")).toBe("text-destructive");
    expect(getTrendColorClass("muted")).toBe("text-muted-foreground");
    expect(normalizeForSparkline([])).toEqual([]);
    expect(normalizeForSparkline([5, 5, 5])).toEqual([0.5, 0.5, 0.5]);
    expect(normalizeForSparkline([10, 20, 30])).toEqual([0, 0.5, 1]);
  });
});
