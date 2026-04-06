import type { ServerProviderModel } from "@t3tools/contracts";

export type CodexPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown";

export interface CodexAccountSnapshot {
  readonly type: "apiKey" | "chatgpt" | "unknown";
  readonly planType: CodexPlanType | null;
  readonly sparkEnabled: boolean;
  readonly rateLimits?: CodexRateLimitsSnapshot;
}

export interface CodexRateLimitWindowSnapshot {
  readonly usedPercent: number;
  readonly windowDurationMins: number;
  readonly resetsAt: string;
}

export interface CodexRateLimitsSnapshot {
  readonly limitId?: string;
  readonly limitName?: string;
  readonly planType?: string;
  readonly primary?: CodexRateLimitWindowSnapshot;
  readonly secondary?: CodexRateLimitWindowSnapshot;
}

export const CODEX_DEFAULT_MODEL = "gpt-5.3-codex";
export const CODEX_SPARK_MODEL = "gpt-5.3-codex-spark";
const CODEX_SPARK_ENABLED_PLAN_TYPES = new Set<CodexPlanType>(["pro"]);

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function epochSecondsToIsoDate(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value * 1_000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readCodexRateLimitWindow(value: unknown): CodexRateLimitWindowSnapshot | undefined {
  const record = asObject(value);
  const usedPercent = asFiniteNumber(record?.usedPercent);
  const windowDurationMins = asFiniteNumber(record?.windowDurationMins);
  const resetsAt = epochSecondsToIsoDate(asFiniteNumber(record?.resetsAt));

  if (
    usedPercent === undefined ||
    windowDurationMins === undefined ||
    resetsAt === undefined ||
    !Number.isInteger(windowDurationMins) ||
    windowDurationMins < 0
  ) {
    return undefined;
  }

  return {
    usedPercent,
    windowDurationMins,
    resetsAt,
  };
}

export function readCodexAccountSnapshot(response: unknown): CodexAccountSnapshot {
  const record = asObject(response);
  const account = asObject(record?.account) ?? record;
  const accountType = asString(account?.type);

  if (accountType === "apiKey") {
    return {
      type: "apiKey",
      planType: null,
      sparkEnabled: false,
    };
  }

  if (accountType === "chatgpt") {
    const planType = (account?.planType as CodexPlanType | null) ?? "unknown";
    return {
      type: "chatgpt",
      planType,
      sparkEnabled: CODEX_SPARK_ENABLED_PLAN_TYPES.has(planType),
    };
  }

  return {
    type: "unknown",
    planType: null,
    sparkEnabled: false,
  };
}

export function readCodexRateLimitsSnapshot(
  response: unknown,
): CodexRateLimitsSnapshot | undefined {
  const record = asObject(response);
  const rateLimits = asObject(record?.rateLimits) ?? record;
  const primary = readCodexRateLimitWindow(rateLimits?.primary);
  const secondary = readCodexRateLimitWindow(rateLimits?.secondary);
  const limitId = asString(rateLimits?.limitId);
  const limitName = asString(rateLimits?.limitName);
  const planType = asString(rateLimits?.planType);

  if (!limitId && !limitName && !planType && !primary && !secondary) {
    return undefined;
  }

  return {
    ...(limitId ? { limitId } : {}),
    ...(limitName ? { limitName } : {}),
    ...(planType ? { planType } : {}),
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
  };
}

export function codexAuthSubType(account: CodexAccountSnapshot | undefined): string | undefined {
  if (account?.type === "apiKey") {
    return "apiKey";
  }

  if (account?.type !== "chatgpt") {
    return undefined;
  }

  return account.planType && account.planType !== "unknown" ? account.planType : "chatgpt";
}

export function codexAuthSubLabel(account: CodexAccountSnapshot | undefined): string | undefined {
  switch (codexAuthSubType(account)) {
    case "apiKey":
      return "OpenAI API Key";
    case "chatgpt":
      return "ChatGPT Subscription";
    case "free":
      return "ChatGPT Free Subscription";
    case "go":
      return "ChatGPT Go Subscription";
    case "plus":
      return "ChatGPT Plus Subscription";
    case "pro":
      return "ChatGPT Pro Subscription";
    case "team":
      return "ChatGPT Team Subscription";
    case "business":
      return "ChatGPT Business Subscription";
    case "enterprise":
      return "ChatGPT Enterprise Subscription";
    case "edu":
      return "ChatGPT Edu Subscription";
    default:
      return undefined;
  }
}

export function adjustCodexModelsForAccount(
  baseModels: ReadonlyArray<ServerProviderModel>,
  account: CodexAccountSnapshot | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (account?.sparkEnabled !== false) {
    return baseModels;
  }

  return baseModels.filter((model) => model.isCustom || model.slug !== CODEX_SPARK_MODEL);
}

export function resolveCodexModelForAccount(
  model: string | undefined,
  account: CodexAccountSnapshot,
): string | undefined {
  if (model !== CODEX_SPARK_MODEL || account.sparkEnabled) {
    return model;
  }

  return CODEX_DEFAULT_MODEL;
}
