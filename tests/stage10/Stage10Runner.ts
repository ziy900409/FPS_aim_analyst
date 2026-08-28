import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {
  allocateStage10Environment,
  cleanupStage10Environment,
  type AllocateStage10EnvironmentOptions,
  type CleanupStage10EnvironmentResult,
  type Stage10AcceptanceEnvironment,
} from './Stage10AcceptanceEnvironment.ts';

/**
 * WP-51 T1 — process/port lifecycle for the Stage 10 acceptance runner (README §2.3 "Runner擁有
 * process與root lifecycle"). Ports/process-spawn/HTTP-readiness are all behind small injectable
 * seams (`PortCheck`/`ProcessLauncher`/`ReadinessCheck`) so the re-entry/occupied-port/startup-
 * failure/test-failure/cleanup-failure regressions (T1-acceptance-harness.md DoD) run fast, without
 * actually booting Vite — only the real CLI entry (scripts/run-stage10-acceptance.mjs) uses the real
 * implementations.
 */

export class Stage10PortOccupiedError extends Error {
  constructor(public readonly port: number) {
    super(`port ${port} is already in use by an unknown process — refusing to start (fail-fast, not killing it)`);
    this.name = 'Stage10PortOccupiedError';
  }
}

export class Stage10ServerStartupError extends Error {
  constructor(
    public readonly label: string,
    cause: unknown,
  ) {
    super(`Stage 10 "${label}" server failed to become ready: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'Stage10ServerStartupError';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Injectable seams
// ---------------------------------------------------------------------------

export interface PortCheck {
  isPortFree(port: number, host?: string): Promise<boolean>;
}

export const realPortCheck: PortCheck = {
  isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ port, host });
      const finish = (free: boolean): void => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(free);
      };
      socket.once('connect', () => finish(false));
      socket.once('error', () => finish(true));
      socket.setTimeout(500, () => finish(true));
    });
  },
};

export interface ManagedProcess {
  readonly pid: number | undefined;
  stop(): Promise<void>;
}

export interface ProcessLauncher {
  spawn(command: string, args: readonly string[], opts: { readonly cwd: string; readonly env: NodeJS.ProcessEnv }): ManagedProcess;
}

function wrapChildProcess(child: ChildProcess): ManagedProcess {
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  return {
    pid: child.pid,
    async stop(): Promise<void> {
      if (exited) return;
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        const killTimer = setTimeout(() => {
          if (!exited) child.kill('SIGKILL');
        }, 5000);
        killTimer.unref();
      });
    },
  };
}

export const realProcessLauncher: ProcessLauncher = {
  spawn(command, args, opts): ManagedProcess {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    return wrapChildProcess(child);
  },
};

export interface ReadinessCheck {
  waitUntilReady(url: string, timeoutMs: number): Promise<void>;
}

function fetchOnce(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      if (res.statusCode !== undefined && res.statusCode < 500) resolve();
      else reject(new Error(`unexpected status ${res.statusCode}`));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error(`timed out requesting ${url}`)));
  });
}

export const httpReadinessCheck: ReadinessCheck = {
  async waitUntilReady(url, timeoutMs): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        await fetchOnce(url);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw lastError ?? new Error(`timed out waiting for ${url}`);
  },
};

// ---------------------------------------------------------------------------
// Server spec + run orchestration
// ---------------------------------------------------------------------------

export interface Stage10ServerSpec {
  readonly label: 'dev' | 'preview';
  readonly command: string;
  readonly args: readonly string[];
  readonly port: number;
  readonly healthPath: string;
}

export interface Stage10RunnerDeps {
  readonly portCheck?: PortCheck;
  readonly processLauncher?: ProcessLauncher;
  readonly readinessCheck?: ReadinessCheck;
  readonly startupTimeoutMs?: number;
}

export interface Stage10RunOptions extends AllocateStage10EnvironmentOptions {
  readonly servers: readonly Stage10ServerSpec[];
}

export interface Stage10RunHandle {
  readonly env: Stage10AcceptanceEnvironment;
  readonly servers: ReadonlyMap<string, ManagedProcess>;
  stopServers(): Promise<void>;
  cleanup(): Promise<CleanupStage10EnvironmentResult>;
}

function historyRootFor(env: Stage10AcceptanceEnvironment, label: Stage10ServerSpec['label']): string {
  return label === 'dev' ? env.devHistoryRoot : env.previewHistoryRoot;
}

/**
 * Allocates the environment, preflights every server's port, then starts and waits for each server
 * in sequence. Any failure (occupied port, startup timeout) leaves nothing running: already-started
 * processes are stopped and the environment is cleaned up before the error is rethrown.
 */
export async function startStage10Run(options: Stage10RunOptions, deps: Stage10RunnerDeps = {}): Promise<Stage10RunHandle> {
  const portCheck = deps.portCheck ?? realPortCheck;
  const processLauncher = deps.processLauncher ?? realProcessLauncher;
  const readinessCheck = deps.readinessCheck ?? httpReadinessCheck;
  const startupTimeoutMs = deps.startupTimeoutMs ?? 120_000;

  for (const server of options.servers) {
    const free = await portCheck.isPortFree(server.port);
    if (!free) throw new Stage10PortOccupiedError(server.port);
  }

  const env = await allocateStage10Environment(options);
  const started = new Map<string, ManagedProcess>();

  try {
    for (const server of options.servers) {
      const proc = processLauncher.spawn(server.command, server.args, {
        cwd: env.workspaceRoot,
        env: { ...process.env, FPS_HISTORY_ROOT: historyRootFor(env, server.label) },
      });
      started.set(server.label, proc);
      try {
        await readinessCheck.waitUntilReady(`http://127.0.0.1:${server.port}${server.healthPath}`, startupTimeoutMs);
      } catch (error) {
        throw new Stage10ServerStartupError(server.label, error);
      }
    }
  } catch (error) {
    for (const proc of started.values()) await proc.stop();
    await cleanupStage10Environment(env);
    throw error;
  }

  return {
    env,
    servers: started,
    async stopServers(): Promise<void> {
      for (const proc of started.values()) await proc.stop();
    },
    async cleanup(): Promise<CleanupStage10EnvironmentResult> {
      return cleanupStage10Environment(env);
    },
  };
}

export interface Stage10AcceptanceOutcome {
  readonly exitCode: number;
  readonly cleanup: CleanupStage10EnvironmentResult;
}

/**
 * Runs `scenario` against a freshly-started environment and always tears it down afterward —
 * whether the scenario returns a failing exit code (a "test failure": still reported, not thrown)
 * or throws (a runner-internal error: cleanup still runs, then the original error propagates).
 */
export async function runStage10Acceptance(
  options: Stage10RunOptions,
  scenario: (handle: Stage10RunHandle) => Promise<number>,
  deps: Stage10RunnerDeps = {},
): Promise<Stage10AcceptanceOutcome> {
  const handle = await startStage10Run(options, deps);
  try {
    const exitCode = await scenario(handle);
    await handle.stopServers();
    const cleanup = await handle.cleanup();
    return { exitCode, cleanup };
  } catch (error) {
    await handle.stopServers();
    await handle.cleanup();
    throw error;
  }
}
