import {
  ArchiveIcon,
  ArchiveX,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
  ThreadId,
} from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { normalizeModelSlug } from "@t3tools/shared/model";
import { Equal } from "effect";
import { APP_VERSION } from "../../branding";
import {
  canCheckForUpdate,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
} from "../../components/desktopUpdate.logic";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { TraitsPicker } from "../chat/TraitsPicker";
import { resolveAndPersistPreferredEditor } from "../../editorPreferences";
import { isElectron } from "../../env";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { useThreadActions } from "../../hooks/useThreadActions";
import {
  setDesktopUpdateStateQueryData,
  useDesktopUpdateState,
} from "../../lib/desktopUpdateReactQuery";
import {
  MAX_CUSTOM_MODEL_LENGTH,
  getCustomModelOptionsByProvider,
  resolveAppModelSelectionState,
} from "../../modelSelection";
import { ensureNativeApi, readNativeApi } from "../../nativeApi";
import { useStore } from "../../store";
import { formatRelativeTime, formatRelativeTimeLabel } from "../../timestampFormat";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent } from "../ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ProjectFavicon } from "../ProjectFavicon";
import {
  useServerAvailableEditors,
  useServerKeybindingsConfigPath,
  useServerObservability,
  useServerProviders,
} from "../../rpc/serverState";
import { APP_LANGUAGE_LABELS, getUiLocale, useTranslation } from "../../i18n";
import { type AppLanguage } from "@t3tools/contracts/settings";
import {
  DEFAULT_THEME,
  DEFAULT_THEME_PRESET,
  getThemePresetDefinitions,
  type ThemePresetDefinition,
  type ThemePresetId,
} from "../../theme";

type InstallProviderSettings = {
  provider: ProviderKind;
  homePathKey?: "codexHomePath";
};

const PROVIDER_SETTINGS: readonly InstallProviderSettings[] = [
  {
    provider: "codex",
    homePathKey: "codexHomePath",
  },
  {
    provider: "claudeAgent",
  },
] as const;

const PROVIDER_STATUS_STYLES = {
  disabled: {
    dot: "bg-amber-400",
  },
  error: {
    dot: "bg-destructive",
  },
  ready: {
    dot: "bg-success",
  },
  warning: {
    dot: "bg-warning",
  },
} as const;

function getThemeOptions(copy: ReturnType<typeof useTranslation>["copy"]) {
  return [
    { value: "system", label: copy.common.system },
    { value: "light", label: copy.common.light },
    { value: "dark", label: copy.common.dark },
  ] as const;
}

function getTimestampFormatLabels(copy: ReturnType<typeof useTranslation>["copy"]) {
  return {
    locale: copy.common.system,
    "12-hour": "12-hour",
    "24-hour": "24-hour",
  } as const;
}

function getProviderConfigCopy(
  provider: ProviderKind,
  language: AppLanguage,
): {
  binaryDescription: ReactNode;
  binaryPlaceholder: string;
  homeDescription?: ReactNode;
  homePlaceholder?: string;
  title: string;
} {
  if (provider === "codex") {
    return {
      title: "Codex",
      binaryPlaceholder: language === "it" ? "Percorso binario Codex" : "Codex binary path",
      binaryDescription:
        language === "it" ? "Percorso del binario Codex" : "Path to the Codex binary",
      homePlaceholder: "CODEX_HOME",
      homeDescription:
        language === "it"
          ? "Directory home e configurazione personalizzata opzionale per Codex."
          : "Optional custom Codex home and config directory.",
    };
  }

  return {
    title: "Claude",
    binaryPlaceholder: language === "it" ? "Percorso binario Claude" : "Claude binary path",
    binaryDescription:
      language === "it" ? "Percorso del binario Claude" : "Path to the Claude binary",
  };
}

function getProviderSummary(provider: ServerProvider | undefined, language: AppLanguage) {
  if (!provider) {
    return {
      headline: language === "it" ? "Controllo stato provider" : "Checking provider status",
      detail:
        language === "it"
          ? "In attesa che il server riporti i dettagli di installazione e autenticazione."
          : "Waiting for the server to report installation and authentication details.",
    };
  }
  if (!provider.enabled) {
    return {
      headline: language === "it" ? "Disabilitato" : "Disabled",
      detail:
        provider.message ??
        (language === "it"
          ? "Questo provider è installato ma disabilitato per le nuove sessioni in T3 Code."
          : "This provider is installed but disabled for new sessions in T3 Code."),
    };
  }
  if (!provider.installed) {
    return {
      headline: language === "it" ? "Non trovato" : "Not found",
      detail:
        provider.message ??
        (language === "it" ? "CLI non rilevata nel PATH." : "CLI not detected on PATH."),
    };
  }
  if (provider.auth.status === "authenticated") {
    const authLabel = provider.auth.label ?? provider.auth.type;
    return {
      headline: authLabel
        ? `${language === "it" ? "Autenticato" : "Authenticated"} · ${authLabel}`
        : language === "it"
          ? "Autenticato"
          : "Authenticated",
      detail: provider.message ?? null,
    };
  }
  if (provider.auth.status === "unauthenticated") {
    return {
      headline: language === "it" ? "Non autenticato" : "Not authenticated",
      detail: provider.message ?? null,
    };
  }
  if (provider.status === "warning") {
    return {
      headline: language === "it" ? "Richiede attenzione" : "Needs attention",
      detail:
        provider.message ??
        (language === "it"
          ? "Il provider è installato, ma il server non è riuscito a verificarlo completamente."
          : "The provider is installed, but the server could not fully verify it."),
    };
  }
  if (provider.status === "error") {
    return {
      headline: language === "it" ? "Non disponibile" : "Unavailable",
      detail:
        provider.message ??
        (language === "it"
          ? "Il provider non ha superato i controlli di avvio."
          : "The provider failed its startup checks."),
    };
  }
  return {
    headline: language === "it" ? "Disponibile" : "Available",
    detail:
      provider.message ??
      (language === "it"
        ? "Installato e pronto, ma l’autenticazione non è stata verificata."
        : "Installed and ready, but authentication could not be verified."),
  };
}

function getProviderVersionLabel(version: string | null | undefined) {
  if (!version) return null;
  return version.startsWith("v") ? version : `v${version}`;
}

function useRelativeTimeTick(intervalMs = 1_000) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function ProviderLastChecked({
  language,
  lastCheckedAt,
}: {
  language: "en" | "it";
  lastCheckedAt: string | null;
}) {
  useRelativeTimeTick();
  const lastCheckedRelative = lastCheckedAt ? formatRelativeTime(lastCheckedAt, language) : null;

  if (!lastCheckedRelative) {
    return null;
  }

  return (
    <span className="text-[11px] text-muted-foreground/60">
      {lastCheckedRelative.suffix ? (
        <>
          {language === "it" ? "Controllato" : "Checked"}{" "}
          <span className="font-mono tabular-nums">{lastCheckedRelative.value}</span>{" "}
          {lastCheckedRelative.suffix}
        </>
      ) : (
        <>
          {language === "it" ? "Controllato" : "Checked"} {lastCheckedRelative.value}
        </>
      )}
    </span>
  );
}

function formatFutureRelativeTimeLabel(isoDate: string, language: AppLanguage): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) {
    return language === "it" ? "ora" : "now";
  }

  const seconds = Math.floor(diffMs / 1_000);
  if (seconds < 60) {
    return language === "it" ? `tra ${seconds}s` : `in ${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return language === "it" ? `tra ${minutes}m` : `in ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return language === "it" ? `tra ${hours}h` : `in ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return language === "it" ? `tra ${days}g` : `in ${days}d`;
}

function formatResetDateTimeLabel(isoDate: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(getUiLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function getRemainingRateLimitPercent(usedPercent: number): string {
  const remaining = Math.max(0, Math.min(100, 100 - usedPercent));
  return `${Math.round(remaining)}%`;
}

function getRateLimitWindowLabel(
  windowDurationMins: number,
  copy: ReturnType<typeof useTranslation>["copy"],
): string {
  if (windowDurationMins === 300) {
    return copy.settings.rateLimitFiveHour;
  }

  if (windowDurationMins === 10_080) {
    return copy.settings.rateLimitWeekly;
  }

  const hours = Math.round(windowDurationMins / 60);
  return `${hours}h`;
}

function ProviderRateLimitsSection({
  provider,
  copy,
  language,
}: {
  provider: ServerProvider;
  copy: ReturnType<typeof useTranslation>["copy"];
  language: AppLanguage;
}) {
  useRelativeTimeTick(60_000);

  const rateLimitWindows = [provider.rateLimits?.primary, provider.rateLimits?.secondary].filter(
    (window) => window !== undefined,
  );

  return (
    <div className="border-t border-border/60 px-4 py-3 sm:px-5">
      <div className="text-xs font-medium text-foreground">{copy.settings.rateLimits}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {copy.settings.rateLimitsDescription}
      </div>

      {rateLimitWindows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {copy.settings.rateLimitUnavailable}
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {rateLimitWindows.map((window) => (
            <div
              key={`${window.windowDurationMins}:${window.resetsAt}`}
              className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-foreground">
                  {getRateLimitWindowLabel(window.windowDurationMins, copy)}
                </div>
                <div className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-mono tabular-nums text-foreground/90">
                  {copy.settings.rateLimitRemaining}{" "}
                  {getRemainingRateLimitPercent(window.usedPercent)}
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-[auto_1fr] sm:items-start">
                <span className="text-muted-foreground">{copy.settings.rateLimitResetsIn}</span>
                <span className="font-mono tabular-nums text-foreground/90 sm:text-right">
                  {formatFutureRelativeTimeLabel(window.resetsAt, language)}
                </span>
                <span className="text-muted-foreground">{copy.settings.rateLimitResetsAt}</span>
                <span className="text-foreground/90 sm:text-right">
                  {formatResetDateTimeLabel(window.resetsAt, language)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsSection({
  title,
  icon,
  headerAction,
  collapsed = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  collapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", collapsed && "space-y-1")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {icon}
          {title}
        </h2>
        {headerAction}
      </div>
      {collapsed ? null : (
        <div className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs/5 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
          {children}
        </div>
      )}
    </section>
  );
}

function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
}: {
  title: ReactNode;
  description: string;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {status ? <div className="pt-1 text-[11px] text-muted-foreground">{status}</div> : null}
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { copy } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`${copy.common.resetToDefault}: ${label}`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">{copy.common.resetToDefault}</TooltipPopup>
    </Tooltip>
  );
}

function SettingsPageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>
    </div>
  );
}

function ThemePresetPicker({
  presets,
  value,
  onValueChange,
}: {
  presets: ReadonlyArray<ThemePresetDefinition>;
  value: ThemePresetId;
  onValueChange: (next: ThemePresetId) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {presets.map((preset) => {
        const selected = preset.id === value;
        const previewForeground = preset.previewForeground;

        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            className={cn(
              "group overflow-hidden rounded-xl border bg-background text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-lg/8 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected ? "border-primary shadow-lg/10 ring-2 ring-primary/18" : "border-border/80",
            )}
            onClick={() => onValueChange(preset.id)}
          >
            <div
              className="relative h-24 border-b"
              style={{
                background: `linear-gradient(140deg, ${preset.background} 0%, ${preset.card} 100%)`,
                borderColor: selected ? `${preset.accent}66` : `${preset.accent}2a`,
              }}
            >
              <div
                className="absolute inset-0 opacity-90"
                style={{
                  background: `radial-gradient(circle at 18% 18%, ${preset.accent}44 0%, transparent 42%), radial-gradient(circle at 82% 24%, ${preset.accent}26 0%, transparent 36%)`,
                }}
              />
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: `${previewForeground}33` }}
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: `${previewForeground}4d` }}
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: preset.accent }}
                />
              </div>
              <div
                className="absolute inset-x-3 bottom-3 rounded-lg border px-3 py-2 shadow-lg/10 backdrop-blur-sm"
                style={{
                  backgroundColor: `${preset.card}f2`,
                  borderColor: `${preset.accent}40`,
                  color: previewForeground,
                }}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                  <span className="truncate">{preset.label}</span>
                  <span
                    className="h-2 w-8 rounded-full"
                    style={{ backgroundColor: preset.accent }}
                  />
                </div>
                <div
                  className="mt-1 h-1.5 rounded-full"
                  style={{ backgroundColor: `${previewForeground}1f` }}
                />
              </div>
            </div>

            <div className="space-y-1.5 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{preset.label}</span>
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full border transition-opacity",
                    selected
                      ? "border-primary bg-primary text-primary-foreground opacity-100"
                      : "border-border/80 bg-muted/60 text-muted-foreground opacity-70",
                  )}
                >
                  <CheckIcon className="size-3" />
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AboutVersionTitle() {
  const { copy } = useTranslation();

  return (
    <span className="inline-flex items-center gap-2">
      <span>{copy.common.version}</span>
      <code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>
    </span>
  );
}

function AboutVersionSection() {
  const { copy, language } = useTranslation();
  const queryClient = useQueryClient();
  const updateStateQuery = useDesktopUpdateState();

  const updateState = updateStateQuery.data ?? null;

  const handleButtonClick = useCallback(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;

    const action = updateState ? resolveDesktopUpdateButtonAction(updateState) : "none";

    if (action === "download") {
      void bridge
        .downloadUpdate()
        .then((result) => {
          setDesktopUpdateStateQueryData(queryClient, result.state);
        })
        .catch((error: unknown) => {
          toastManager.add({
            type: "error",
            title: copy.common.download,
            description: error instanceof Error ? error.message : copy.common.download,
          });
        });
      return;
    }

    if (action === "install") {
      const confirmed = window.confirm(
        getDesktopUpdateInstallConfirmationMessage(
          updateState ?? { availableVersion: null, downloadedVersion: null },
        ),
      );
      if (!confirmed) return;
      void bridge
        .installUpdate()
        .then((result) => {
          setDesktopUpdateStateQueryData(queryClient, result.state);
        })
        .catch((error: unknown) => {
          toastManager.add({
            type: "error",
            title: copy.common.install,
            description: error instanceof Error ? error.message : copy.common.install,
          });
        });
      return;
    }

    if (typeof bridge.checkForUpdate !== "function") return;
    void bridge
      .checkForUpdate()
      .then((result) => {
        setDesktopUpdateStateQueryData(queryClient, result.state);
        if (!result.checked) {
          toastManager.add({
            type: "error",
            title: copy.common.checkForUpdates,
            description:
              result.state.message ??
              (language === "it"
                ? "Gli aggiornamenti automatici non sono disponibili in questa build."
                : "Automatic updates are not available in this build."),
          });
        }
      })
      .catch((error: unknown) => {
        toastManager.add({
          type: "error",
          title: copy.common.checkForUpdates,
          description: error instanceof Error ? error.message : copy.common.checkForUpdates,
        });
      });
  }, [
    copy.common.checkForUpdates,
    copy.common.download,
    copy.common.install,
    language,
    queryClient,
    updateState,
  ]);

  const action = updateState ? resolveDesktopUpdateButtonAction(updateState) : "none";
  const buttonTooltip = updateState ? getDesktopUpdateButtonTooltip(updateState) : null;
  const buttonDisabled =
    action === "none"
      ? !canCheckForUpdate(updateState)
      : isDesktopUpdateButtonDisabled(updateState);

  const actionLabel: Record<string, string> = {
    download: copy.common.download,
    install: copy.common.install,
  };
  const statusLabel: Record<string, string> = {
    checking: copy.common.checking,
    downloading: language === "it" ? "Download in corso..." : "Downloading...",
    "up-to-date": copy.common.upToDate,
  };
  const buttonLabel =
    actionLabel[action] ?? statusLabel[updateState?.status ?? ""] ?? copy.common.checkForUpdates;
  const description =
    action === "download" || action === "install"
      ? language === "it"
        ? "Aggiornamento disponibile."
        : "Update available."
      : copy.settings.currentAppVersion;

  return (
    <SettingsRow
      title={<AboutVersionTitle />}
      description={description}
      control={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="xs"
                variant={action === "install" ? "default" : "outline"}
                disabled={buttonDisabled}
                onClick={handleButtonClick}
              >
                {buttonLabel}
              </Button>
            }
          />
          {buttonTooltip ? <TooltipPopup>{buttonTooltip}</TooltipPopup> : null}
        </Tooltip>
      }
    />
  );
}

export function useSettingsRestore(onRestored?: () => void) {
  const { copy } = useTranslation();
  const { theme, setTheme, themePreset, setThemePreset } = useTheme();
  const settings = useSettings();
  const { resetSettings } = useUpdateSettings();

  const isGitWritingModelDirty = !Equal.equals(
    settings.textGenerationModelSelection ?? null,
    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
  );
  const areProviderSettingsDirty = PROVIDER_SETTINGS.some((providerSettings) => {
    const currentSettings = settings.providers[providerSettings.provider];
    const defaultSettings = DEFAULT_UNIFIED_SETTINGS.providers[providerSettings.provider];
    return !Equal.equals(currentSettings, defaultSettings);
  });

  const changedSettingLabels = useMemo(
    () => [
      ...(theme !== DEFAULT_THEME ? [copy.settings.theme] : []),
      ...(themePreset !== DEFAULT_THEME_PRESET ? [copy.settings.themePalette] : []),
      ...(settings.language !== DEFAULT_UNIFIED_SETTINGS.language ? [copy.settings.language] : []),
      ...(settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat
        ? [copy.settings.timeFormat]
        : []),
      ...(settings.diffWordWrap !== DEFAULT_UNIFIED_SETTINGS.diffWordWrap
        ? [copy.settings.diffLineWrapping]
        : []),
      ...(settings.enableAssistantStreaming !== DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming
        ? [copy.settings.assistantOutput]
        : []),
      ...(settings.defaultThreadEnvMode !== DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode
        ? [copy.settings.newThreads]
        : []),
      ...(settings.confirmThreadArchive !== DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive
        ? [copy.settings.archiveConfirmation]
        : []),
      ...(settings.confirmThreadDelete !== DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete
        ? [copy.settings.deleteConfirmation]
        : []),
      ...(isGitWritingModelDirty ? [copy.settings.textGenerationModel] : []),
      ...(areProviderSettingsDirty ? [copy.settings.providers] : []),
    ],
    [
      areProviderSettingsDirty,
      copy.settings.archiveConfirmation,
      copy.settings.assistantOutput,
      copy.settings.deleteConfirmation,
      copy.settings.diffLineWrapping,
      copy.settings.language,
      copy.settings.newThreads,
      copy.settings.providers,
      copy.settings.textGenerationModel,
      copy.settings.theme,
      copy.settings.themePalette,
      copy.settings.timeFormat,
      isGitWritingModelDirty,
      settings.confirmThreadArchive,
      settings.confirmThreadDelete,
      settings.defaultThreadEnvMode,
      settings.diffWordWrap,
      settings.enableAssistantStreaming,
      settings.language,
      settings.timestampFormat,
      theme,
      themePreset,
    ],
  );

  const restoreDefaults = useCallback(async () => {
    if (changedSettingLabels.length === 0) return;
    const api = readNativeApi();
    const confirmed = await (api ?? ensureNativeApi()).dialogs.confirm(
      copy.settings.restoreDefaultsConfirmation(changedSettingLabels.join(", ")),
    );
    if (!confirmed) return;

    setTheme(DEFAULT_THEME);
    setThemePreset(DEFAULT_THEME_PRESET);
    resetSettings();
    onRestored?.();
  }, [changedSettingLabels, copy, onRestored, resetSettings, setTheme, setThemePreset]);

  return {
    changedSettingLabels,
    restoreDefaults,
  };
}

export function GeneralSettingsPanel() {
  const { copy, language } = useTranslation();
  const { theme, setTheme, themePreset, setThemePreset, resolvedTheme } = useTheme();
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const [isThemesSectionOpen, setIsThemesSectionOpen] = useState(true);
  const [openingPathByTarget, setOpeningPathByTarget] = useState({
    keybindings: false,
    logsDirectory: false,
  });
  const [openPathErrorByTarget, setOpenPathErrorByTarget] = useState<
    Partial<Record<"keybindings" | "logsDirectory", string | null>>
  >({});
  const [openProviderDetails, setOpenProviderDetails] = useState<Record<ProviderKind, boolean>>({
    codex: Boolean(
      settings.providers.codex.binaryPath !== DEFAULT_UNIFIED_SETTINGS.providers.codex.binaryPath ||
      settings.providers.codex.homePath !== DEFAULT_UNIFIED_SETTINGS.providers.codex.homePath ||
      settings.providers.codex.customModels.length > 0,
    ),
    claudeAgent: Boolean(
      settings.providers.claudeAgent.binaryPath !==
        DEFAULT_UNIFIED_SETTINGS.providers.claudeAgent.binaryPath ||
      settings.providers.claudeAgent.customModels.length > 0,
    ),
  });
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Record<ProviderKind, string>
  >({
    codex: "",
    claudeAgent: "",
  });
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderKind, string | null>>
  >({});
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(false);
  const themeOptions = useMemo(() => getThemeOptions(copy), [copy]);
  const themePresets = useMemo(() => getThemePresetDefinitions(language), [language]);
  const hiddenThemePresetIds = useMemo<ReadonlyArray<ThemePresetId>>(
    () => (resolvedTheme === "dark" ? ["light", "og"] : ["super-black"]),
    [resolvedTheme],
  );
  const visibleThemePresets = useMemo(
    () => themePresets.filter((preset) => !hiddenThemePresetIds.includes(preset.id)),
    [hiddenThemePresetIds, themePresets],
  );
  const timestampFormatLabels = useMemo(() => getTimestampFormatLabels(copy), [copy]);
  const refreshingRef = useRef(false);
  const modelListRefs = useRef<Partial<Record<ProviderKind, HTMLDivElement | null>>>({});
  const refreshProviders = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshingProviders(true);
    void ensureNativeApi()
      .server.refreshProviders()
      .catch((error: unknown) => {
        console.warn("Failed to refresh providers", error);
      })
      .finally(() => {
        refreshingRef.current = false;
        setIsRefreshingProviders(false);
      });
  }, []);

  const keybindingsConfigPath = useServerKeybindingsConfigPath();
  const availableEditors = useServerAvailableEditors();
  const observability = useServerObservability();
  const serverProviders = useServerProviders();
  const codexHomePath = settings.providers.codex.homePath;
  const logsDirectoryPath = observability?.logsDirectoryPath ?? null;
  const diagnosticsDescription = useMemo(() => {
    const exports: string[] = [];
    if (observability?.otlpTracesEnabled && observability.otlpTracesUrl) {
      exports.push(
        language === "it"
          ? `tracce verso ${observability.otlpTracesUrl}`
          : `traces to ${observability.otlpTracesUrl}`,
      );
    }
    if (observability?.otlpMetricsEnabled && observability.otlpMetricsUrl) {
      exports.push(
        language === "it"
          ? `metriche verso ${observability.otlpMetricsUrl}`
          : `metrics to ${observability.otlpMetricsUrl}`,
      );
    }
    const mode = observability?.localTracingEnabled
      ? language === "it"
        ? "File di trace locale"
        : "Local trace file"
      : language === "it"
        ? "Solo log del terminale"
        : "Terminal logs only";
    return exports.length > 0
      ? `${mode}. ${language === "it" ? "Esportazione OTLP di" : "OTLP exporting"} ${exports.join(language === "it" ? " e " : " and ")}.`
      : `${mode}.`;
  }, [language, observability]);

  const textGenerationModelSelection = resolveAppModelSelectionState(settings, serverProviders);
  const textGenProvider = textGenerationModelSelection.provider;
  const textGenModel = textGenerationModelSelection.model;
  const textGenModelOptions = textGenerationModelSelection.options;
  const gitModelOptionsByProvider = getCustomModelOptionsByProvider(
    settings,
    serverProviders,
    textGenProvider,
    textGenModel,
  );
  const isGitWritingModelDirty = !Equal.equals(
    settings.textGenerationModelSelection ?? null,
    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
  );

  const openInPreferredEditor = useCallback(
    (target: "keybindings" | "logsDirectory", path: string | null, failureMessage: string) => {
      if (!path) return;
      setOpenPathErrorByTarget((existing) => ({ ...existing, [target]: null }));
      setOpeningPathByTarget((existing) => ({ ...existing, [target]: true }));

      const editor = resolveAndPersistPreferredEditor(availableEditors ?? []);
      if (!editor) {
        setOpenPathErrorByTarget((existing) => ({
          ...existing,
          [target]: copy.settings.unavailableEditor,
        }));
        setOpeningPathByTarget((existing) => ({ ...existing, [target]: false }));
        return;
      }

      void ensureNativeApi()
        .shell.openInEditor(path, editor)
        .catch((error) => {
          setOpenPathErrorByTarget((existing) => ({
            ...existing,
            [target]: error instanceof Error ? error.message : failureMessage,
          }));
        })
        .finally(() => {
          setOpeningPathByTarget((existing) => ({ ...existing, [target]: false }));
        });
    },
    [availableEditors, copy.settings.unavailableEditor],
  );

  const openKeybindingsFile = useCallback(() => {
    openInPreferredEditor(
      "keybindings",
      keybindingsConfigPath,
      language === "it"
        ? "Impossibile aprire il file delle scorciatoie."
        : "Unable to open keybindings file.",
    );
  }, [keybindingsConfigPath, language, openInPreferredEditor]);

  const openLogsDirectory = useCallback(() => {
    openInPreferredEditor(
      "logsDirectory",
      logsDirectoryPath,
      language === "it" ? "Impossibile aprire la cartella dei log." : "Unable to open logs folder.",
    );
  }, [language, logsDirectoryPath, openInPreferredEditor]);

  const openKeybindingsError = openPathErrorByTarget.keybindings ?? null;
  const openDiagnosticsError = openPathErrorByTarget.logsDirectory ?? null;
  const isOpeningKeybindings = openingPathByTarget.keybindings;
  const isOpeningLogsDirectory = openingPathByTarget.logsDirectory;

  const addCustomModel = useCallback(
    (provider: ProviderKind) => {
      const customModelInput = customModelInputByProvider[provider];
      const customModels = settings.providers[provider].customModels;
      const normalized = normalizeModelSlug(customModelInput, provider);
      if (!normalized) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: language === "it" ? "Inserisci uno slug modello." : "Enter a model slug.",
        }));
        return;
      }
      if (
        serverProviders
          .find((candidate) => candidate.provider === provider)
          ?.models.some((option) => !option.isCustom && option.slug === normalized)
      ) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]:
            language === "it" ? "Questo modello è già incluso." : "That model is already built in.",
        }));
        return;
      }
      if (normalized.length > MAX_CUSTOM_MODEL_LENGTH) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]:
            language === "it"
              ? `Gli slug modello devono avere al massimo ${MAX_CUSTOM_MODEL_LENGTH} caratteri.`
              : `Model slugs must be ${MAX_CUSTOM_MODEL_LENGTH} characters or less.`,
        }));
        return;
      }
      if (customModels.includes(normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]:
            language === "it"
              ? "Questo modello personalizzato è già salvato."
              : "That custom model is already saved.",
        }));
        return;
      }

      updateSettings({
        providers: {
          ...settings.providers,
          [provider]: {
            ...settings.providers[provider],
            customModels: [...customModels, normalized],
          },
        },
      });
      setCustomModelInputByProvider((existing) => ({
        ...existing,
        [provider]: "",
      }));
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));

      const el = modelListRefs.current[provider];
      if (!el) return;
      const scrollToEnd = () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      requestAnimationFrame(scrollToEnd);
      const observer = new MutationObserver(() => {
        scrollToEnd();
        observer.disconnect();
      });
      observer.observe(el, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 2_000);
    },
    [customModelInputByProvider, language, serverProviders, settings, updateSettings],
  );

  const removeCustomModel = useCallback(
    (provider: ProviderKind, slug: string) => {
      updateSettings({
        providers: {
          ...settings.providers,
          [provider]: {
            ...settings.providers[provider],
            customModels: settings.providers[provider].customModels.filter(
              (model) => model !== slug,
            ),
          },
        },
      });
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [settings, updateSettings],
  );

  const providerCards = PROVIDER_SETTINGS.map((providerSettings) => {
    const liveProvider = serverProviders.find(
      (candidate) => candidate.provider === providerSettings.provider,
    );
    const providerConfig = settings.providers[providerSettings.provider];
    const defaultProviderConfig = DEFAULT_UNIFIED_SETTINGS.providers[providerSettings.provider];
    const statusKey = liveProvider?.status ?? (providerConfig.enabled ? "warning" : "disabled");
    const providerCopy = getProviderConfigCopy(providerSettings.provider, language);
    const summary = getProviderSummary(liveProvider, language);
    const models: ReadonlyArray<ServerProviderModel> =
      liveProvider?.models ??
      providerConfig.customModels.map((slug) => ({
        slug,
        name: slug,
        isCustom: true,
        capabilities: null,
      }));

    return {
      provider: providerSettings.provider,
      title: providerCopy.title,
      binaryPlaceholder: providerCopy.binaryPlaceholder,
      binaryDescription: providerCopy.binaryDescription,
      homePathKey: providerSettings.homePathKey,
      homePlaceholder: providerCopy.homePlaceholder,
      homeDescription: providerCopy.homeDescription,
      binaryPathValue: providerConfig.binaryPath,
      isDirty: !Equal.equals(providerConfig, defaultProviderConfig),
      liveProvider,
      models,
      providerConfig,
      statusStyle: PROVIDER_STATUS_STYLES[statusKey],
      summary,
      versionLabel: getProviderVersionLabel(liveProvider?.version),
    };
  });

  const lastCheckedAt =
    serverProviders.length > 0
      ? serverProviders.reduce(
          (latest, provider) => (provider.checkedAt > latest ? provider.checkedAt : latest),
          serverProviders[0]!.checkedAt,
        )
      : null;

  useEffect(() => {
    if (hiddenThemePresetIds.includes(themePreset)) {
      setThemePreset(DEFAULT_THEME_PRESET);
    }
  }, [hiddenThemePresetIds, setThemePreset, themePreset]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        collapsed={!isThemesSectionOpen}
        title={copy.settings.themes}
        headerAction={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`${isThemesSectionOpen ? copy.common.hideDetails : copy.common.showDetails}: ${copy.settings.themes}`}
            onClick={() => setIsThemesSectionOpen((open) => !open)}
          >
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform", isThemesSectionOpen && "rotate-180")}
            />
          </Button>
        }
      >
        <SettingsRow
          title={copy.settings.themeMode}
          description={copy.settings.themeDescription}
          resetAction={
            theme !== DEFAULT_THEME ? (
              <SettingResetButton
                label={copy.settings.themeMode}
                onClick={() => setTheme(DEFAULT_THEME)}
              />
            ) : null
          }
          control={
            <Select
              value={theme}
              onValueChange={(value) => {
                if (value === "system" || value === "light" || value === "dark") {
                  setTheme(value);
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:min-w-40 sm:max-w-48"
                aria-label={copy.settings.themePreference}
              >
                <SelectValue>
                  {themeOptions.find((option) => option.value === theme)?.label ??
                    copy.common.system}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {themeOptions.map((option) => (
                  <SelectItem hideIndicator key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          title={copy.settings.themePalette}
          description={copy.settings.themePaletteDescription}
          resetAction={
            themePreset !== DEFAULT_THEME_PRESET ? (
              <SettingResetButton
                label={copy.settings.themePalette}
                onClick={() => setThemePreset(DEFAULT_THEME_PRESET)}
              />
            ) : null
          }
        >
          <div className="pt-1">
            <ThemePresetPicker
              presets={visibleThemePresets}
              value={themePreset}
              onValueChange={setThemePreset}
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={copy.settings.general}>
        <SettingsRow
          title={copy.settings.language}
          description={copy.settings.languageDescription}
          resetAction={
            settings.language !== DEFAULT_UNIFIED_SETTINGS.language ? (
              <SettingResetButton
                label={copy.settings.language}
                onClick={() => updateSettings({ language: DEFAULT_UNIFIED_SETTINGS.language })}
              />
            ) : null
          }
          control={
            <Select
              value={settings.language}
              onValueChange={(value) => {
                if (value === "en" || value === "it") {
                  updateSettings({ language: value });
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:min-w-40 sm:max-w-48"
                aria-label={copy.settings.language}
              >
                <SelectValue>{APP_LANGUAGE_LABELS[settings.language]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="en">
                  {APP_LANGUAGE_LABELS.en}
                </SelectItem>
                <SelectItem hideIndicator value="it">
                  {APP_LANGUAGE_LABELS.it}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          title={copy.settings.timeFormat}
          description={copy.settings.timeFormatDescription}
          resetAction={
            settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat ? (
              <SettingResetButton
                label={copy.settings.timeFormat}
                onClick={() =>
                  updateSettings({
                    timestampFormat: DEFAULT_UNIFIED_SETTINGS.timestampFormat,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.timestampFormat}
              onValueChange={(value) => {
                if (value === "locale" || value === "12-hour" || value === "24-hour") {
                  updateSettings({ timestampFormat: value });
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:min-w-40 sm:max-w-48"
                aria-label={copy.settings.timestampFormat}
              >
                <SelectValue>{timestampFormatLabels[settings.timestampFormat]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="locale">
                  {timestampFormatLabels.locale}
                </SelectItem>
                <SelectItem hideIndicator value="12-hour">
                  {timestampFormatLabels["12-hour"]}
                </SelectItem>
                <SelectItem hideIndicator value="24-hour">
                  {timestampFormatLabels["24-hour"]}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          title={copy.settings.diffLineWrapping}
          description={copy.settings.diffLineWrappingDescription}
          resetAction={
            settings.diffWordWrap !== DEFAULT_UNIFIED_SETTINGS.diffWordWrap ? (
              <SettingResetButton
                label={copy.settings.diffLineWrapping}
                onClick={() =>
                  updateSettings({
                    diffWordWrap: DEFAULT_UNIFIED_SETTINGS.diffWordWrap,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.diffWordWrap}
              onCheckedChange={(checked) => updateSettings({ diffWordWrap: Boolean(checked) })}
              aria-label={copy.settings.wrappingAria}
            />
          }
        />

        <SettingsRow
          title={copy.settings.assistantOutput}
          description={copy.settings.assistantOutputDescription}
          resetAction={
            settings.enableAssistantStreaming !==
            DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming ? (
              <SettingResetButton
                label={copy.settings.assistantOutput}
                onClick={() =>
                  updateSettings({
                    enableAssistantStreaming: DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.enableAssistantStreaming}
              onCheckedChange={(checked) =>
                updateSettings({ enableAssistantStreaming: Boolean(checked) })
              }
              aria-label={copy.settings.assistantOutput}
            />
          }
        />

        <SettingsRow
          title={copy.settings.newThreads}
          description={copy.settings.newThreadsDescription}
          resetAction={
            settings.defaultThreadEnvMode !== DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode ? (
              <SettingResetButton
                label={copy.settings.newThreads}
                onClick={() =>
                  updateSettings({
                    defaultThreadEnvMode: DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.defaultThreadEnvMode}
              onValueChange={(value) => {
                if (value === "local" || value === "worktree") {
                  updateSettings({ defaultThreadEnvMode: value });
                }
              }}
            >
              <SelectTrigger
                className="w-full sm:min-w-44 sm:max-w-52"
                aria-label={copy.settings.newThreads}
              >
                <SelectValue>
                  {settings.defaultThreadEnvMode === "worktree"
                    ? copy.common.newWorktree
                    : copy.common.local}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="local">
                  {copy.common.local}
                </SelectItem>
                <SelectItem hideIndicator value="worktree">
                  {copy.common.newWorktree}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          title={copy.settings.archiveConfirmation}
          description={copy.settings.archiveConfirmationDescription}
          resetAction={
            settings.confirmThreadArchive !== DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive ? (
              <SettingResetButton
                label={copy.settings.archiveConfirmation}
                onClick={() =>
                  updateSettings({
                    confirmThreadArchive: DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.confirmThreadArchive}
              onCheckedChange={(checked) =>
                updateSettings({ confirmThreadArchive: Boolean(checked) })
              }
              aria-label={copy.settings.confirmThreadArchiving}
            />
          }
        />

        <SettingsRow
          title={copy.settings.deleteConfirmation}
          description={copy.settings.deleteConfirmationDescription}
          resetAction={
            settings.confirmThreadDelete !== DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete ? (
              <SettingResetButton
                label={copy.settings.deleteConfirmation}
                onClick={() =>
                  updateSettings({
                    confirmThreadDelete: DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.confirmThreadDelete}
              onCheckedChange={(checked) =>
                updateSettings({ confirmThreadDelete: Boolean(checked) })
              }
              aria-label={copy.settings.confirmThreadDeletion}
            />
          }
        />

        <SettingsRow
          title={copy.settings.textGenerationModel}
          description={copy.settings.textGenerationModelDescription}
          resetAction={
            isGitWritingModelDirty ? (
              <SettingResetButton
                label={copy.settings.textGenerationModel}
                onClick={() =>
                  updateSettings({
                    textGenerationModelSelection:
                      DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
                  })
                }
              />
            ) : null
          }
          control={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <ProviderModelPicker
                provider={textGenProvider}
                model={textGenModel}
                lockedProvider={null}
                providers={serverProviders}
                modelOptionsByProvider={gitModelOptionsByProvider}
                triggerVariant="outline"
                triggerClassName="min-w-0 max-w-none shrink-0 text-foreground/90 hover:text-foreground"
                onProviderModelChange={(provider, model) => {
                  updateSettings({
                    textGenerationModelSelection: resolveAppModelSelectionState(
                      {
                        ...settings,
                        textGenerationModelSelection: { provider, model },
                      },
                      serverProviders,
                    ),
                  });
                }}
              />
              <TraitsPicker
                provider={textGenProvider}
                models={
                  serverProviders.find((provider) => provider.provider === textGenProvider)
                    ?.models ?? []
                }
                model={textGenModel}
                prompt=""
                onPromptChange={() => {}}
                modelOptions={textGenModelOptions}
                allowPromptInjectedEffort={false}
                triggerVariant="outline"
                triggerClassName="min-w-0 max-w-none shrink-0 text-foreground/90 hover:text-foreground"
                onModelOptionsChange={(nextOptions) => {
                  updateSettings({
                    textGenerationModelSelection: resolveAppModelSelectionState(
                      {
                        ...settings,
                        textGenerationModelSelection: {
                          provider: textGenProvider,
                          model: textGenModel,
                          ...(nextOptions ? { options: nextOptions } : {}),
                        },
                      },
                      serverProviders,
                    ),
                  });
                }}
              />
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection
        title={copy.settings.providers}
        headerAction={
          <div className="flex items-center gap-1.5">
            <ProviderLastChecked language={language} lastCheckedAt={lastCheckedAt} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                    disabled={isRefreshingProviders}
                    onClick={() => void refreshProviders()}
                    aria-label={copy.settings.refreshProviderStatus}
                  >
                    {isRefreshingProviders ? (
                      <LoaderIcon className="size-3 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-3" />
                    )}
                  </Button>
                }
              />
              <TooltipPopup side="top">{copy.settings.refreshProviderStatus}</TooltipPopup>
            </Tooltip>
          </div>
        }
      >
        {providerCards.map((providerCard) => {
          const customModelInput = customModelInputByProvider[providerCard.provider];
          const customModelError = customModelErrorByProvider[providerCard.provider] ?? null;
          const providerDisplayName =
            PROVIDER_DISPLAY_NAMES[providerCard.provider] ?? providerCard.title;

          return (
            <div key={providerCard.provider} className="border-t border-border first:border-t-0">
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-h-5 items-center gap-1.5">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", providerCard.statusStyle.dot)}
                      />
                      <h3 className="text-sm font-medium text-foreground">{providerDisplayName}</h3>
                      {providerCard.versionLabel ? (
                        <code className="text-xs text-muted-foreground">
                          {providerCard.versionLabel}
                        </code>
                      ) : null}
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        {providerCard.isDirty ? (
                          <SettingResetButton
                            label={`${providerDisplayName} provider settings`}
                            onClick={() => {
                              updateSettings({
                                providers: {
                                  ...settings.providers,
                                  [providerCard.provider]:
                                    DEFAULT_UNIFIED_SETTINGS.providers[providerCard.provider],
                                },
                              });
                              setCustomModelErrorByProvider((existing) => ({
                                ...existing,
                                [providerCard.provider]: null,
                              }));
                            }}
                          />
                        ) : null}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {providerCard.summary.headline}
                      {providerCard.summary.detail ? ` - ${providerCard.summary.detail}` : null}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setOpenProviderDetails((existing) => ({
                          ...existing,
                          [providerCard.provider]: !existing[providerCard.provider],
                        }))
                      }
                      aria-label={`${copy.common.showDetails}: ${providerDisplayName}`}
                    >
                      <ChevronDownIcon
                        className={cn(
                          "size-3.5 transition-transform",
                          openProviderDetails[providerCard.provider] && "rotate-180",
                        )}
                      />
                    </Button>
                    <Switch
                      checked={providerCard.providerConfig.enabled}
                      onCheckedChange={(checked) => {
                        const isDisabling = !checked;
                        const shouldClearModelSelection =
                          isDisabling && textGenProvider === providerCard.provider;
                        updateSettings({
                          providers: {
                            ...settings.providers,
                            [providerCard.provider]: {
                              ...settings.providers[providerCard.provider],
                              enabled: Boolean(checked),
                            },
                          },
                          ...(shouldClearModelSelection
                            ? {
                                textGenerationModelSelection:
                                  DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
                              }
                            : {}),
                        });
                      }}
                      aria-label={copy.settings.enableProvider(providerDisplayName)}
                    />
                  </div>
                </div>
              </div>

              <Collapsible
                open={openProviderDetails[providerCard.provider]}
                onOpenChange={(open) =>
                  setOpenProviderDetails((existing) => ({
                    ...existing,
                    [providerCard.provider]: open,
                  }))
                }
              >
                <CollapsibleContent>
                  <div className="space-y-0">
                    <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                      <label
                        htmlFor={`provider-install-${providerCard.provider}-binary-path`}
                        className="block"
                      >
                        <span className="text-xs font-medium text-foreground">
                          {language === "it"
                            ? `Percorso binario ${providerDisplayName}`
                            : `${providerDisplayName} binary path`}
                        </span>
                        <Input
                          id={`provider-install-${providerCard.provider}-binary-path`}
                          className="mt-1.5"
                          value={providerCard.binaryPathValue}
                          onChange={(event) =>
                            updateSettings({
                              providers: {
                                ...settings.providers,
                                [providerCard.provider]: {
                                  ...settings.providers[providerCard.provider],
                                  binaryPath: event.target.value,
                                },
                              },
                            })
                          }
                          placeholder={providerCard.binaryPlaceholder}
                          spellCheck={false}
                        />
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {providerCard.binaryDescription}
                        </span>
                      </label>
                    </div>

                    {providerCard.homePathKey ? (
                      <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                        <label
                          htmlFor={`provider-install-${providerCard.homePathKey}`}
                          className="block"
                        >
                          <span className="text-xs font-medium text-foreground">
                            {language === "it" ? "Percorso CODEX_HOME" : "CODEX_HOME path"}
                          </span>
                          <Input
                            id={`provider-install-${providerCard.homePathKey}`}
                            className="mt-1.5"
                            value={codexHomePath}
                            onChange={(event) =>
                              updateSettings({
                                providers: {
                                  ...settings.providers,
                                  codex: {
                                    ...settings.providers.codex,
                                    homePath: event.target.value,
                                  },
                                },
                              })
                            }
                            placeholder={providerCard.homePlaceholder}
                            spellCheck={false}
                          />
                          {providerCard.homeDescription ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {providerCard.homeDescription}
                            </span>
                          ) : null}
                        </label>
                      </div>
                    ) : null}

                    {providerCard.provider === "codex" && providerCard.liveProvider ? (
                      <ProviderRateLimitsSection
                        provider={providerCard.liveProvider}
                        copy={copy}
                        language={language}
                      />
                    ) : null}

                    <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                      <div className="text-xs font-medium text-foreground">
                        {copy.settings.models}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {language === "it"
                          ? `${providerCard.models.length} modell${providerCard.models.length === 1 ? "o disponibile" : "i disponibili"}.`
                          : `${providerCard.models.length} model${providerCard.models.length === 1 ? "" : "s"} available.`}
                      </div>
                      <div
                        ref={(el) => {
                          modelListRefs.current[providerCard.provider] = el;
                        }}
                        className="mt-2 max-h-40 overflow-y-auto pb-1"
                      >
                        {providerCard.models.map((model) => {
                          const caps = model.capabilities;
                          const capLabels: string[] = [];
                          if (caps?.supportsFastMode)
                            capLabels.push(language === "it" ? "Modalità veloce" : "Fast mode");
                          if (caps?.supportsThinkingToggle)
                            capLabels.push(language === "it" ? "Riflessione" : "Thinking");
                          if (
                            caps?.reasoningEffortLevels &&
                            caps.reasoningEffortLevels.length > 0
                          ) {
                            capLabels.push(language === "it" ? "Ragionamento" : "Reasoning");
                          }
                          const hasDetails = capLabels.length > 0 || model.name !== model.slug;

                          return (
                            <div
                              key={`${providerCard.provider}:${model.slug}`}
                              className="flex items-center gap-2 py-1"
                            >
                              <span className="min-w-0 truncate text-xs text-foreground/90">
                                {model.name}
                              </span>
                              {hasDetails ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <button
                                        type="button"
                                        className="shrink-0 text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                                        aria-label={
                                          language === "it"
                                            ? `Dettagli per ${model.name}`
                                            : `Details for ${model.name}`
                                        }
                                      />
                                    }
                                  >
                                    <InfoIcon className="size-3" />
                                  </TooltipTrigger>
                                  <TooltipPopup side="top" className="max-w-56">
                                    <div className="space-y-1">
                                      <code className="block text-[11px] text-foreground">
                                        {model.slug}
                                      </code>
                                      {capLabels.length > 0 ? (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                          {capLabels.map((label) => (
                                            <span
                                              key={label}
                                              className="text-[10px] text-muted-foreground"
                                            >
                                              {label}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </TooltipPopup>
                                </Tooltip>
                              ) : null}
                              {model.isCustom ? (
                                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    {language === "it" ? "personalizzato" : "custom"}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label={
                                      language === "it"
                                        ? `Rimuovi ${model.slug}`
                                        : `Remove ${model.slug}`
                                    }
                                    onClick={() =>
                                      removeCustomModel(providerCard.provider, model.slug)
                                    }
                                  >
                                    <XIcon className="size-3" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          id={`custom-model-${providerCard.provider}`}
                          value={customModelInput}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCustomModelInputByProvider((existing) => ({
                              ...existing,
                              [providerCard.provider]: value,
                            }));
                            if (customModelError) {
                              setCustomModelErrorByProvider((existing) => ({
                                ...existing,
                                [providerCard.provider]: null,
                              }));
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            addCustomModel(providerCard.provider);
                          }}
                          placeholder={
                            providerCard.provider === "codex"
                              ? "gpt-6.7-codex-ultra-preview"
                              : "claude-sonnet-5-0"
                          }
                          spellCheck={false}
                        />
                        <Button
                          className="shrink-0"
                          variant="outline"
                          onClick={() => addCustomModel(providerCard.provider)}
                        >
                          <PlusIcon className="size-3.5" />
                          {copy.common.add}
                        </Button>
                      </div>

                      {customModelError ? (
                        <p className="mt-2 text-xs text-destructive">{customModelError}</p>
                      ) : null}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </SettingsSection>

      <SettingsSection title={copy.settings.advanced}>
        <SettingsRow
          title={copy.settings.keybindings}
          description={copy.settings.keybindingsDescription}
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {keybindingsConfigPath ??
                  (language === "it"
                    ? "Risoluzione percorso scorciatoie..."
                    : "Resolving keybindings path...")}
              </span>
              {openKeybindingsError ? (
                <span className="mt-1 block text-destructive">{openKeybindingsError}</span>
              ) : (
                <span className="mt-1 block">{copy.settings.openPreferredEditor}</span>
              )}
            </>
          }
          control={
            <Button
              size="xs"
              variant="outline"
              disabled={!keybindingsConfigPath || isOpeningKeybindings}
              onClick={openKeybindingsFile}
            >
              {isOpeningKeybindings ? copy.common.opening : copy.common.openFile}
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection title={copy.settings.about}>
        {isElectron ? (
          <AboutVersionSection />
        ) : (
          <SettingsRow
            title={<AboutVersionTitle />}
            description={copy.settings.currentAppVersion}
          />
        )}
        <SettingsRow
          title={copy.settings.diagnostics}
          description={diagnosticsDescription}
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {logsDirectoryPath ??
                  (language === "it"
                    ? "Risoluzione cartella log..."
                    : "Resolving logs directory...")}
              </span>
              {openDiagnosticsError ? (
                <span className="mt-1 block text-destructive">{openDiagnosticsError}</span>
              ) : null}
            </>
          }
          control={
            <Button
              size="xs"
              variant="outline"
              disabled={!logsDirectoryPath || isOpeningLogsDirectory}
              onClick={openLogsDirectory}
            >
              {isOpeningLogsDirectory ? copy.common.opening : copy.settings.openLogsFolder}
            </Button>
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function ArchivedThreadsPanel() {
  const { copy, language } = useTranslation();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const { unarchiveThread, confirmAndDeleteThread } = useThreadActions();
  const archivedGroups = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project] as const));
    return [...projectById.values()]
      .map((project) => ({
        project,
        threads: threads
          .filter((thread) => thread.projectId === project.id && thread.archivedAt !== null)
          .toSorted((left, right) => {
            const leftKey = left.archivedAt ?? left.createdAt;
            const rightKey = right.archivedAt ?? right.createdAt;
            return rightKey.localeCompare(leftKey) || right.id.localeCompare(left.id);
          }),
      }))
      .filter((group) => group.threads.length > 0);
  }, [projects, threads]);

  const handleArchivedThreadContextMenu = useCallback(
    async (threadId: ThreadId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const clicked = await api.contextMenu.show(
        [
          { id: "unarchive", label: copy.settings.unarchive },
          { id: "delete", label: copy.common.delete, destructive: true },
        ],
        position,
      );

      if (clicked === "unarchive") {
        try {
          await unarchiveThread(threadId);
        } catch (error) {
          toastManager.add({
            type: "error",
            title:
              language === "it"
                ? "Impossibile ripristinare il thread"
                : "Failed to unarchive thread",
            description:
              error instanceof Error
                ? error.message
                : language === "it"
                  ? "Si è verificato un errore."
                  : "An error occurred.",
          });
        }
        return;
      }

      if (clicked === "delete") {
        await confirmAndDeleteThread(threadId);
      }
    },
    [
      confirmAndDeleteThread,
      copy.common.delete,
      copy.settings.unarchive,
      language,
      unarchiveThread,
    ],
  );

  return (
    <SettingsPageContainer>
      {archivedGroups.length === 0 ? (
        <SettingsSection title={copy.settings.archivedThreads}>
          <Empty className="min-h-88">
            <EmptyMedia variant="icon">
              <ArchiveIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>{copy.settings.archivedThreadsEmptyTitle}</EmptyTitle>
              <EmptyDescription>{copy.settings.archivedThreadsEmptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </SettingsSection>
      ) : (
        archivedGroups.map(({ project, threads: projectThreads }) => (
          <SettingsSection
            key={project.id}
            title={project.name}
            icon={<ProjectFavicon cwd={project.cwd} />}
          >
            {projectThreads.map((thread) => (
              <div
                key={thread.id}
                className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:px-5"
                onContextMenu={(event) => {
                  event.preventDefault();
                  void handleArchivedThreadContextMenu(thread.id, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">{thread.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "it" ? "Archiviato" : "Archived"}{" "}
                    {formatRelativeTimeLabel(thread.archivedAt ?? thread.createdAt, language)}
                    {" \u00b7 "}
                    {copy.common.createdAt} {formatRelativeTimeLabel(thread.createdAt, language)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 cursor-pointer gap-1.5 px-2.5"
                  onClick={() =>
                    void unarchiveThread(thread.id).catch((error) => {
                      toastManager.add({
                        type: "error",
                        title:
                          language === "it"
                            ? "Impossibile ripristinare il thread"
                            : "Failed to unarchive thread",
                        description:
                          error instanceof Error
                            ? error.message
                            : language === "it"
                              ? "Si è verificato un errore."
                              : "An error occurred.",
                      });
                    })
                  }
                >
                  <ArchiveX className="size-3.5" />
                  <span>{copy.settings.unarchive}</span>
                </Button>
              </div>
            ))}
          </SettingsSection>
        ))
      )}
    </SettingsPageContainer>
  );
}
