import "../../index.css";

import {
  DEFAULT_SERVER_SETTINGS,
  type NativeApi,
  type ServerConfig,
  type ServerProvider,
} from "@t3tools/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { __resetNativeApiForTests } from "../../nativeApi";
import { AppAtomRegistryProvider } from "../../rpc/atomRegistry";
import { resetServerStateForTests, setServerConfigSnapshot } from "../../rpc/serverState";
import { GeneralSettingsPanel } from "./SettingsPanels";

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: "/repo/project",
    keybindingsConfigPath: "/repo/project/.t3code-keybindings.json",
    keybindings: [],
    issues: [],
    providers: [],
    availableEditors: ["cursor"],
    observability: {
      logsDirectoryPath: "/repo/project/.t3/logs",
      localTracingEnabled: true,
      otlpTracesUrl: "http://localhost:4318/v1/traces",
      otlpTracesEnabled: true,
      otlpMetricsEnabled: false,
    },
    settings: DEFAULT_SERVER_SETTINGS,
  };
}

function createCodexProvider(overrides: Partial<ServerProvider> = {}): ServerProvider {
  return {
    provider: "codex",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: {
      status: "authenticated",
      type: "plus",
      label: "ChatGPT Plus Subscription",
    },
    checkedAt: "2026-04-06T10:00:00.000Z",
    models: [],
    ...overrides,
  };
}

describe("GeneralSettingsPanel observability", () => {
  beforeEach(() => {
    resetServerStateForTests();
    __resetNativeApiForTests();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    resetServerStateForTests();
    __resetNativeApiForTests();
    document.body.innerHTML = "";
  });

  it("shows diagnostics inside About with a single logs-folder action", async () => {
    setServerConfigSnapshot(createBaseServerConfig());

    await render(
      <AppAtomRegistryProvider>
        <GeneralSettingsPanel />
      </AppAtomRegistryProvider>,
    );

    await expect.element(page.getByText("About")).toBeInTheDocument();
    await expect.element(page.getByText("Diagnostics")).toBeInTheDocument();
    await expect.element(page.getByText("Open logs folder")).toBeInTheDocument();
    await expect
      .element(page.getByText("/repo/project/.t3/logs", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "Local trace file. OTLP exporting traces to http://localhost:4318/v1/traces.",
        ),
      )
      .toBeInTheDocument();
  });

  it("opens the logs folder in the preferred editor", async () => {
    const openInEditor = vi.fn<NativeApi["shell"]["openInEditor"]>().mockResolvedValue(undefined);
    window.nativeApi = {
      shell: {
        openInEditor,
      },
    } as unknown as NativeApi;

    setServerConfigSnapshot(createBaseServerConfig());

    await render(
      <AppAtomRegistryProvider>
        <GeneralSettingsPanel />
      </AppAtomRegistryProvider>,
    );

    const openLogsButton = page.getByText("Open logs folder");
    await openLogsButton.click();

    expect(openInEditor).toHaveBeenCalledWith("/repo/project/.t3/logs", "cursor");
  });

  it("shows codex billing limits inside provider details", async () => {
    setServerConfigSnapshot({
      ...createBaseServerConfig(),
      providers: [
        createCodexProvider({
          rateLimits: {
            limitId: "codex",
            planType: "plus",
            primary: {
              usedPercent: 73,
              windowDurationMins: 300,
              resetsAt: "2026-04-06T15:00:00.000Z",
            },
            secondary: {
              usedPercent: 92,
              windowDurationMins: 10080,
              resetsAt: "2026-04-09T15:00:00.000Z",
            },
          },
        }),
      ],
    });

    await render(
      <AppAtomRegistryProvider>
        <GeneralSettingsPanel />
      </AppAtomRegistryProvider>,
    );

    await page.getByLabelText("Show details: Codex").click();

    await expect.element(page.getByText("Billing limits")).toBeInTheDocument();
    await expect.element(page.getByText("5h reset")).toBeInTheDocument();
    await expect.element(page.getByText("Weekly reset")).toBeInTheDocument();
    await expect.element(page.getByText("Remaining 27%")).toBeInTheDocument();
    await expect.element(page.getByText("Remaining 8%")).toBeInTheDocument();
  });
});
