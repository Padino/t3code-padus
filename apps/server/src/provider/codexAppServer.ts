import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import {
  readCodexAccountSnapshot,
  readCodexRateLimitsSnapshot,
  type CodexAccountSnapshot,
} from "./codexAccount";

interface JsonRpcProbeResponse {
  readonly id?: unknown;
  readonly result?: unknown;
  readonly error?: {
    readonly message?: unknown;
  };
}

function readErrorMessage(response: JsonRpcProbeResponse): string | undefined {
  return typeof response.error?.message === "string" ? response.error.message : undefined;
}

export function buildCodexInitializeParams() {
  return {
    clientInfo: {
      name: "t3code_desktop",
      title: "T3 Code Desktop",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  } as const;
}

export function killCodexChildProcess(child: ChildProcessWithoutNullStreams): void {
  if (process.platform === "win32" && child.pid !== undefined) {
    try {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {
      // Fall through to direct kill when taskkill is unavailable.
    }
  }

  child.kill();
}

export async function probeCodexAccount(input: {
  readonly binaryPath: string;
  readonly homePath?: string;
  readonly signal?: AbortSignal;
}): Promise<CodexAccountSnapshot> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.binaryPath, ["app-server"], {
      env: {
        ...process.env,
        ...(input.homePath ? { CODEX_HOME: input.homePath } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    const output = readline.createInterface({ input: child.stdout });

    let completed = false;
    let accountSnapshot: CodexAccountSnapshot | undefined;
    let rateLimitFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRateLimitFallbackTimer = () => {
      if (rateLimitFallbackTimer === null) {
        return;
      }
      clearTimeout(rateLimitFallbackTimer);
      rateLimitFallbackTimer = null;
    };

    const cleanup = () => {
      clearRateLimitFallbackTimer();
      output.removeAllListeners();
      output.close();
      child.removeAllListeners();
      if (!child.killed) {
        killCodexChildProcess(child);
      }
    };

    const finish = (callback: () => void) => {
      if (completed) return;
      completed = true;
      cleanup();
      callback();
    };

    const fail = (error: unknown) =>
      finish(() =>
        reject(
          error instanceof Error
            ? error
            : new Error(`Codex account probe failed: ${String(error)}.`),
        ),
      );

    if (input.signal?.aborted) {
      fail(new Error("Codex account probe aborted."));
      return;
    }
    input.signal?.addEventListener("abort", () => fail(new Error("Codex account probe aborted.")));

    const writeMessage = (message: unknown) => {
      if (!child.stdin.writable) {
        fail(new Error("Cannot write to codex app-server stdin."));
        return;
      }

      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const finishWithAccount = () => {
      const resolvedAccount = accountSnapshot;
      if (!resolvedAccount) {
        fail(new Error("Codex account probe completed without an account snapshot."));
        return;
      }

      finish(() => resolve(resolvedAccount));
    };

    output.on("line", (line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        fail(new Error("Received invalid JSON from codex app-server during account probe."));
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const response = parsed as JsonRpcProbeResponse;
      if (response.id === 1) {
        const errorMessage = readErrorMessage(response);
        if (errorMessage) {
          fail(new Error(`initialize failed: ${errorMessage}`));
          return;
        }

        writeMessage({ method: "initialized" });
        writeMessage({ id: 2, method: "account/read", params: {} });
        return;
      }

      if (response.id === 2) {
        const errorMessage = readErrorMessage(response);
        if (errorMessage) {
          fail(new Error(`account/read failed: ${errorMessage}`));
          return;
        }

        accountSnapshot = readCodexAccountSnapshot(response.result);
        writeMessage({ id: 3, method: "account/rateLimits/read", params: {} });
        rateLimitFallbackTimer = setTimeout(() => {
          finishWithAccount();
        }, 1_000);
        return;
      }

      if (response.id === 3) {
        clearRateLimitFallbackTimer();
        const resolvedAccount = accountSnapshot;
        if (!resolvedAccount) {
          fail(new Error("account/rateLimits/read completed before account/read."));
          return;
        }

        const errorMessage = readErrorMessage(response);
        if (errorMessage) {
          finish(() => resolve(resolvedAccount));
          return;
        }

        const rateLimits = readCodexRateLimitsSnapshot(response.result);
        finish(() => resolve(rateLimits ? { ...resolvedAccount, rateLimits } : resolvedAccount));
      }
    });

    child.once("error", fail);
    child.once("exit", (code, signal) => {
      if (completed) return;
      fail(
        new Error(
          `codex app-server exited before probe completed (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
    });

    writeMessage({
      id: 1,
      method: "initialize",
      params: buildCodexInitializeParams(),
    });
  });
}
