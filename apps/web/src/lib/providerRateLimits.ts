import type { OrchestrationThreadActivity } from "@t3tools/contracts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRateLimitWindow(value: unknown): ProviderRateLimitWindowSnapshot | null {
  const window = asRecord(value);
  if (!window) {
    return null;
  }

  const usedPercentage = asFiniteNumber(window.used_percent ?? window.usedPercent);
  const windowMinutes = asFiniteNumber(window.window_minutes ?? window.windowMinutes);
  const resetsAt = asFiniteNumber(window.resets_at ?? window.resetsAt);
  if (usedPercentage === null || windowMinutes === null || windowMinutes <= 0) {
    return null;
  }

  const normalizedUsedPercentage = Math.max(0, Math.min(100, usedPercentage));
  return {
    usedPercentage: normalizedUsedPercentage,
    remainingPercentage: Math.max(0, 100 - normalizedUsedPercentage),
    windowMinutes,
    resetsAt,
  };
}

export interface ProviderRateLimitWindowSnapshot {
  usedPercentage: number;
  remainingPercentage: number;
  windowMinutes: number;
  resetsAt: number | null;
}

export interface ProviderRateLimitsSnapshot {
  limitId: string | null;
  limitName: string | null;
  planType: string | null;
  primary: ProviderRateLimitWindowSnapshot | null;
  secondary: ProviderRateLimitWindowSnapshot | null;
  updatedAt: string;
}

export function deriveLatestProviderRateLimitsSnapshot(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ProviderRateLimitsSnapshot | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (!activity || activity.kind !== "account-rate-limits.updated") {
      continue;
    }

    const payload = asRecord(activity.payload);
    if (!payload) {
      continue;
    }

    const primary = parseRateLimitWindow(payload.primary);
    const secondary = parseRateLimitWindow(payload.secondary);
    if (!primary && !secondary) {
      continue;
    }

    return {
      limitId: asTrimmedString(payload.limit_id ?? payload.limitId),
      limitName: asTrimmedString(payload.limit_name ?? payload.limitName),
      planType: asTrimmedString(payload.plan_type ?? payload.planType),
      primary,
      secondary,
      updatedAt: activity.createdAt,
    };
  }

  return null;
}

export function formatRateLimitPercentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "0%";
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}
