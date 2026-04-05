import { describe, expect, it } from "vitest";
import { EventId, type OrchestrationThreadActivity } from "@t3tools/contracts";

import {
  deriveLatestProviderRateLimitsSnapshot,
  formatRateLimitPercentage,
} from "./providerRateLimits";

function makeActivity(
  id: string,
  kind: string,
  payload: unknown,
  createdAt = "2026-04-06T10:30:00.000Z",
): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(id),
    tone: "info",
    kind,
    summary: kind,
    payload,
    turnId: null,
    createdAt,
  };
}

describe("providerRateLimits", () => {
  it("derives the latest valid provider rate limit snapshot", () => {
    const snapshot = deriveLatestProviderRateLimitsSnapshot([
      makeActivity("activity-1", "account-rate-limits.updated", {
        primary: {
          used_percent: 80,
          window_minutes: 300,
          resets_at: 1_775_233_667,
        },
      }),
      makeActivity("activity-2", "tool.updated", {}),
      makeActivity(
        "activity-3",
        "account-rate-limits.updated",
        {
          limit_id: "codex",
          plan_type: "plus",
          primary: {
            used_percent: 45,
            window_minutes: 300,
            resets_at: 1_775_233_667,
          },
          secondary: {
            used_percent: 59,
            window_minutes: 10_080,
            resets_at: 1_775_641_444,
          },
        },
        "2026-04-06T10:45:00.000Z",
      ),
    ]);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.limitId).toBe("codex");
    expect(snapshot?.planType).toBe("plus");
    expect(snapshot?.primary).toEqual({
      usedPercentage: 45,
      remainingPercentage: 55,
      windowMinutes: 300,
      resetsAt: 1_775_233_667,
    });
    expect(snapshot?.secondary).toEqual({
      usedPercentage: 59,
      remainingPercentage: 41,
      windowMinutes: 10_080,
      resetsAt: 1_775_641_444,
    });
  });

  it("accepts camelCase window keys", () => {
    const snapshot = deriveLatestProviderRateLimitsSnapshot([
      makeActivity("activity-1", "account-rate-limits.updated", {
        primary: {
          usedPercent: 12.5,
          windowMinutes: 300,
          resetsAt: 1_775_233_667,
        },
      }),
    ]);

    expect(snapshot?.primary).toEqual({
      usedPercentage: 12.5,
      remainingPercentage: 87.5,
      windowMinutes: 300,
      resetsAt: 1_775_233_667,
    });
  });

  it("ignores malformed payloads", () => {
    const snapshot = deriveLatestProviderRateLimitsSnapshot([
      makeActivity("activity-1", "account-rate-limits.updated", {
        primary: {
          resets_at: 1_775_233_667,
        },
      }),
    ]);

    expect(snapshot).toBeNull();
  });

  it("formats compact percentages", () => {
    expect(formatRateLimitPercentage(9.4)).toBe("9.4%");
    expect(formatRateLimitPercentage(55.2)).toBe("55%");
  });
});
