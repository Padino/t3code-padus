import { type AppLanguage, type TimestampFormat } from "@t3tools/contracts/settings";
import { getUiLocale } from "./i18n";

export function getTimestampFormatOptions(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };

  if (timestampFormat === "locale") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hour12: timestampFormat === "12-hour",
  };
}

const timestampFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimestampFormatter(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
  language: AppLanguage,
): Intl.DateTimeFormat {
  const cacheKey = `${language}:${timestampFormat}:${includeSeconds ? "seconds" : "minutes"}`;
  const cachedFormatter = timestampFormatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getUiLocale(language), {
    ...getTimestampFormatOptions(timestampFormat, includeSeconds),
    ...(timestampFormat === "locale" ? {} : { localeMatcher: "lookup" }),
  });
  timestampFormatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  language: AppLanguage = "en",
): string {
  return getTimestampFormatter(timestampFormat, true, language).format(new Date(isoDate));
}

export function formatShortTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  language: AppLanguage = "en",
): string {
  return getTimestampFormatter(timestampFormat, false, language).format(new Date(isoDate));
}

/**
 * Format a relative time string from an ISO date.
 * Returns `{ value: "20s", suffix: "ago" }` or `{ value: "just now", suffix: null }`
 * so callers can style the numeric portion independently.
 */
export function formatRelativeTime(
  isoDate: string,
  language: AppLanguage = "en",
): { value: string; suffix: string | null } {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const labels =
    language === "it"
      ? {
          ago: "fa",
          day: "g",
          hour: "h",
          justNow: "proprio ora",
          minute: "m",
          second: "s",
        }
      : {
          ago: "ago",
          day: "d",
          hour: "h",
          justNow: "just now",
          minute: "m",
          second: "s",
        };

  if (diffMs < 0) return { value: labels.justNow, suffix: null };
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return { value: labels.justNow, suffix: null };
  if (seconds < 60) return { value: `${seconds}${labels.second}`, suffix: labels.ago };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { value: `${minutes}${labels.minute}`, suffix: labels.ago };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: `${hours}${labels.hour}`, suffix: labels.ago };
  const days = Math.floor(hours / 24);
  return { value: `${days}${labels.day}`, suffix: labels.ago };
}

export function formatRelativeTimeLabel(isoDate: string, language: AppLanguage = "en") {
  const relative = formatRelativeTime(isoDate, language);
  return relative.suffix ? `${relative.value} ${relative.suffix}` : relative.value;
}
