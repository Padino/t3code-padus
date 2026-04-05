import { useTranslation } from "../../i18n";
import {
  formatRateLimitPercentage,
  type ProviderRateLimitWindowSnapshot,
  type ProviderRateLimitsSnapshot,
} from "../../lib/providerRateLimits";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

function formatResetCountdown(
  resetsAt: number | null,
  language: "en" | "it",
  now = Date.now(),
): string | null {
  if (resetsAt === null || !Number.isFinite(resetsAt)) {
    return null;
  }

  const diffMs = Math.max(0, resetsAt * 1000 - now);
  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes <= 1) {
    return language === "it" ? "meno di 1 min" : "under 1 min";
  }

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}${language === "it" ? "g" : "d"}`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 && parts.length < 2) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

function formatResetTimestamp(resetsAt: number | null, locale: string): string | null {
  if (resetsAt === null || !Number.isFinite(resetsAt)) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(resetsAt * 1000));
}

function RateLimitWindowRow(props: {
  label: string;
  window: ProviderRateLimitWindowSnapshot;
  locale: string;
  language: "en" | "it";
  resetLabel: (value: string) => string;
}) {
  const percentage = formatRateLimitPercentage(props.window.remainingPercentage);
  const resetCountdown = formatResetCountdown(props.window.resetsAt, props.language);
  const resetTimestamp = formatResetTimestamp(props.window.resetsAt, props.locale);

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {props.label}
        </div>
        <div className="text-sm font-semibold text-foreground">{percentage}</div>
      </div>
      {resetCountdown || resetTimestamp ? (
        <div className="text-[11px] leading-tight text-muted-foreground">
          {[resetCountdown ? props.resetLabel(resetCountdown) : null, resetTimestamp]
            .filter((value): value is string => value !== null)
            .join(" • ")}
        </div>
      ) : null}
    </div>
  );
}

export function RateLimitsMeter(props: { usage: ProviderRateLimitsSnapshot }) {
  const { usage } = props;
  const { copy, language, locale } = useTranslation();
  const primary = usage.primary;
  if (!primary) {
    return null;
  }

  const radius = 9.75;
  const circumference = 2 * Math.PI * radius;
  const normalizedPercentage = Math.max(0, Math.min(100, primary.remainingPercentage));
  const dashOffset = circumference - (normalizedPercentage / 100) * circumference;
  const centerLabel = `${Math.round(normalizedPercentage)}`;
  const planLabel = usage.planType ? copy.rateLimits.plan(usage.planType) : null;

  return (
    <Popover>
      <PopoverTrigger className="group inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-85">
        <span className="relative flex h-6 w-6 items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="-rotate-90 absolute inset-0 h-full w-full transform-gpu"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="color-mix(in oklab, var(--color-muted) 82%, transparent)"
              strokeWidth="3"
            />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="var(--color-blue-500)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
            />
          </svg>
          <span className="relative flex h-[15px] w-[15px] items-center justify-center rounded-full bg-background text-[7px] font-semibold text-blue-600">
            {centerLabel}
          </span>
        </span>
        <span className="sr-only">
          {copy.rateLimits.ariaLabel(formatRateLimitPercentage(primary.remainingPercentage))}
        </span>
      </PopoverTrigger>
      <PopoverPopup tooltipStyle side="top" align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        <div className="space-y-2.5 leading-tight">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {copy.rateLimits.title}
            </div>
            {planLabel ? <div className="text-xs text-foreground">{planLabel}</div> : null}
          </div>
          <RateLimitWindowRow
            label={copy.rateLimits.fiveHourWindow}
            window={primary}
            locale={locale}
            language={language}
            resetLabel={copy.rateLimits.resetIn}
          />
          {usage.secondary ? (
            <RateLimitWindowRow
              label={copy.rateLimits.weeklyWindow}
              window={usage.secondary}
              locale={locale}
              language={language}
              resetLabel={copy.rateLimits.resetIn}
            />
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
