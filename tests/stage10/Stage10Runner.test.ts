import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allocateStage10Environment,
  cleanupStage10Environment,
} from './Stage10AcceptanceEnvironment.ts';
import {
  runStage10Acceptance,
  startStage10Run,
  Stage10PortOccupiedError,
  Stage10ServerStartupError,
  type ManagedProcess,
  type PortCheck,
  type ProcessLauncher,
  type ReadinessCheck,
  type Stage10ServerSpec,
} from './Stage10Runner.ts';

/**
 * WP-51 T1 — harness regressions for the process/port runner: occupied port, startup failure, test
 * failure (propagated, not swallowed) and cleanup failure wired end-to-end (T1-acceptance-harness.md
 * DoD). Re-entry / invalid-root are already covered at the environment layer
 * (Stage10AcceptanceEnvironment.test.ts) and exercised again here transitively via startStage10Run.
 * All process/port/HTTP seams are faked — no real Vite/npm process is ever spawned in this file.
 */

const DEV_SPEC: Stage10ServerSpec = { label: 'dev', command: 'fake-dev', args: [], port: 15173, healthPath: '/api/history/health' };
const PREVIEW_SPEC: Stage10ServerSpec = {
  label: 'preview',
  command: 'fake-preview',
  args: [],
  port: 14173,
  healthPath: '/api/history/health',
};

function fakeManagedProcess(): ManagedProcess & { stopped: boolean } {
  const handle = {
    pid: 4242,
    stopped: false,
    async stop(): Promise<void> {
      handle.stopped = true;
    },
  };
  return handle;
}

function alwaysFreePortCheck(): PortCheck {
  return { isPortFree: async () => true };
}

function fakeLauncher(): ProcessLauncher & { spawned: ReturnType<typeof fakeManagedProcess>[] } {
  const spawned: ReturnType<typeof fakeManagedProcess>[] = [];
  return {
    spawned,
    spawn(): ManagedProcess {
      const proc = fakeManagedProcess();
      spawned.push(proc);
      return proc;
    },
  };
}

function alwaysReadyCheck(): ReadinessCheck {
  return { waitUntilReady: async () => {} };
}

async function makeWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'stage10-runner-test-'));
}

const cleanupWorkspaces: string[] = [];
afterEach(async () => {
  while (cleanupWorkspaces.length > 0) {
    const dir = cleanupWorkspaces.pop();
    if (dir !== undefined) await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('startStage10Run — occupied port', () => {
  it('fails fast without allocating any environment when a port is already in use', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const launcher = fakeLauncher();

    const portCheck: PortCheck = { isPortFree: async (port) => port !== DEV_SPEC.port };

    await expect(
      startStage10Run(
        { workspaceRoot, runToken: 'occupied-port-run', servers: [DEV_SPEC, PREVIEW_SPEC] },
        { portCheck, processLauncher: launcher, readinessCheck: alwaysReadyCheck() },
      ),
    ).rejects.toBeInstanceOf(Stage10PortOccupiedError);

    expect(launcher.spawned).toHaveLength(0);
    const runRoot = path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'occupied-port-run');
    await expect(fs.stat(runRoot)).rejects.toThrow();
    const lockPath = path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'stage10.lock');
    await expect(fs.stat(lockPath)).rejects.toThrow();
  });
});

describe('startStage10Run — startup failure', () => {
  it('stops already-started processes and cleans up the environment when a server never becomes ready', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const launcher = fakeLauncher();
    const readinessCheck: ReadinessCheck = {
      waitUntilReady: async (url) => {
        if (url.includes(String(PREVIEW_SPEC.port))) throw new Error('preview never came up');
      },
    };

    await expect(
      startStage10Run(
        { workspaceRoot, runToken: 'startup-failure-run', servers: [DEV_SPEC, PREVIEW_SPEC] },
        { portCheck: alwaysFreePortCheck(), processLauncher: launcher, readinessCheck },
      ),
    ).rejects.toBeInstanceOf(Stage10ServerStartupError);

    // dev was spawned (started before preview) and must have been stopped during unwind.
    expect(launcher.spawned).toHaveLength(2);
    expect(launcher.spawned.every((p) => p.stopped)).toBe(true);

    // Environment cleaned up — a fresh allocate with the same runToken must succeed again.
    const recovered = await allocateStage10Environment({ workspaceRoot, runToken: 'startup-failure-run' });
    await cleanupStage10Environment(recovered);
  });
});

describe('runStage10Acceptance — test failure', () => {
  it('propagates a non-zero scenario exit code and still tears everything down', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const launcher = fakeLauncher();

    const outcome = await runStage10Acceptance(
      { workspaceRoot, runToken: 'test-failure-run', servers: [DEV_SPEC, PREVIEW_SPEC] },
      async () => 1,
      { portCheck: alwaysFreePortCheck(), processLauncher: launcher, readinessCheck: alwaysReadyCheck() },
    );

    expect(outcome.exitCode).toBe(1);
    expect(outcome.cleanup.ok).toBe(true);
    expect(launcher.spawned.every((p) => p.stopped)).toBe(true);

    const runRoot = path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'test-failure-run');
    await expect(fs.stat(runRoot)).rejects.toThrow();
  });

  it('tears down and rethrows when the scenario itself throws', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const launcher = fakeLauncher();

    await expect(
      runStage10Acceptance(
        { workspaceRoot, runToken: 'scenario-throws-run', servers: [DEV_SPEC] },
        async () => {
          throw new Error('scenario blew up');
        },
        { portCheck: alwaysFreePortCheck(), processLauncher: launcher, readinessCheck: alwaysReadyCheck() },
      ),
    ).rejects.toThrow('scenario blew up');

    expect(launcher.spawned.every((p) => p.stopped)).toBe(true);
    const recovered = await allocateStage10Environment({ workspaceRoot, runToken: 'scenario-throws-run' });
    await cleanupStage10Environment(recovered);
  });
});

describe('runStage10Acceptance — cleanup failure surfaces without masking the scenario result', () => {
  it('reports cleanup.ok=false when the real history root mutates mid-run, without deleting the run root', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const realHistoryRoot = path.join(workspaceRoot, 'data', 'session-history');
    await fs.mkdir(realHistoryRoot, { recursive: true });
    await fs.writeFile(path.join(realHistoryRoot, 'real.json'), '{"a":1}', 'utf8');
    const launcher = fakeLauncher();

    let runRoot = '';
    const outcome = await runStage10Acceptance(
      { workspaceRoot, runToken: 'cleanup-failure-run', realHistoryRoot, servers: [DEV_SPEC] },
      async (handle) => {
        runRoot = handle.env.workspaceTempRoot;
        // Simulate a bug elsewhere mutating the real root while the run is in flight.
        await fs.writeFile(path.join(realHistoryRoot, 'real.json'), '{"a":2}', 'utf8');
        return 0;
      },
      { portCheck: alwaysFreePortCheck(), processLauncher: launcher, readinessCheck: alwaysReadyCheck() },
    );

    expect(outcome.exitCode).toBe(0);
    expect(outcome.cleanup.ok).toBe(false);
    await expect(fs.stat(runRoot)).resolves.toBeDefined();
  });
});
