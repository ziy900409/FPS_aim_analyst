import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it, afterEach } from 'vitest';
import {
  allocateStage10Environment,
  cleanupStage10Environment,
  verifyOutsideSentinelUnchanged,
  Stage10ReentryError,
  Stage10ContainmentViolationError,
} from './Stage10AcceptanceEnvironment.ts';

/**
 * WP-51 T1 — harness regressions for the root allocator: re-entry, invalid root and cleanup
 * failure (README T1-acceptance-harness.md DoD). Each test gets its own disposable workspace root
 * (never the real repo root) so `.playwright-tmp/stage10/` layout can be asserted precisely.
 */

async function makeWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'stage10-env-test-'));
}

const cleanupWorkspaces: string[] = [];

afterEach(async () => {
  while (cleanupWorkspaces.length > 0) {
    const dir = cleanupWorkspaces.pop();
    if (dir !== undefined) await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('allocateStage10Environment', () => {
  it('creates run-scoped dev/preview/downloads roots contained under .playwright-tmp/stage10/<runToken>', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);

    const env = await allocateStage10Environment({ workspaceRoot, runToken: 'run-a' });

    expect(env.devHistoryRoot).toBe(path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'run-a', 'dev'));
    expect(env.previewHistoryRoot).toBe(path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'run-a', 'preview'));
    expect(env.devHistoryRoot).not.toBe(env.previewHistoryRoot);
    await expect(fs.stat(env.devHistoryRoot)).resolves.toBeDefined();
    await expect(fs.stat(env.previewHistoryRoot)).resolves.toBeDefined();
    await expect(fs.stat(env.downloadsRoot)).resolves.toBeDefined();

    const result = await cleanupStage10Environment(env);
    expect(result.ok).toBe(true);
  });

  it('fails closed (re-entry) when a Stage 10 run is already in progress, without touching the existing run', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);

    const first = await allocateStage10Environment({ workspaceRoot, runToken: 'first' });

    await expect(allocateStage10Environment({ workspaceRoot, runToken: 'second' })).rejects.toBeInstanceOf(
      Stage10ReentryError,
    );

    // the first run's root must be untouched by the failed second attempt
    await expect(fs.stat(first.devHistoryRoot)).resolves.toBeDefined();
    const secondRoot = path.join(workspaceRoot, '.playwright-tmp', 'stage10', 'second');
    await expect(fs.stat(secondRoot)).rejects.toThrow();

    await cleanupStage10Environment(first);
  });

  it('allows a new run after the previous one released its lock via cleanup', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);

    const first = await allocateStage10Environment({ workspaceRoot, runToken: 'first' });
    await cleanupStage10Environment(first);

    const second = await allocateStage10Environment({ workspaceRoot, runToken: 'second' });
    await expect(fs.stat(second.devHistoryRoot)).resolves.toBeDefined();
    await cleanupStage10Environment(second);
  });

  it('rejects a runToken that would escape the Stage 10 root (invalid root) and leaves no stray directories', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);

    await expect(
      allocateStage10Environment({ workspaceRoot, runToken: '../../escaped' }),
    ).rejects.toBeInstanceOf(Stage10ContainmentViolationError);

    const outsidePath = path.join(workspaceRoot, '..', 'escaped');
    await expect(fs.stat(outsidePath)).rejects.toThrow();

    // the lock must be released so a subsequent valid run is not blocked by the rejected attempt
    const recovered = await allocateStage10Environment({ workspaceRoot, runToken: 'valid-after-invalid' });
    await cleanupStage10Environment(recovered);
  });
});

describe('cleanupStage10Environment — cleanup failure', () => {
  it('refuses to delete the run root and preserves evidence when the outside sentinel detects real-root mutation', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const realHistoryRoot = path.join(workspaceRoot, 'data', 'session-history');
    await fs.mkdir(realHistoryRoot, { recursive: true });
    await fs.writeFile(path.join(realHistoryRoot, 'real-participant-run.json'), '{"untouched":true}', 'utf8');

    const env = await allocateStage10Environment({ workspaceRoot, runToken: 'mutating-run', realHistoryRoot });

    // Simulate a bug elsewhere in the harness writing into the real root during the run.
    await fs.writeFile(path.join(realHistoryRoot, 'real-participant-run.json'), '{"untouched":false}', 'utf8');

    const result = await cleanupStage10Environment(env);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/file tree\/mtimes changed/);

    // Run root must survive as evidence — not deleted.
    await expect(fs.stat(env.workspaceTempRoot)).resolves.toBeDefined();

    // Lock is still released, so a later run is not blocked forever by this failure.
    const next = await allocateStage10Environment({ workspaceRoot, runToken: 'after-failed-cleanup' });
    await cleanupStage10Environment(next);
  });

  it('refuses to delete a run root that does not resolve under the Stage 10 root', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const env = await allocateStage10Environment({ workspaceRoot, runToken: 'ok-run' });

    const tampered = { ...env, workspaceTempRoot: path.join(workspaceRoot, 'data', 'session-history') };
    const result = await cleanupStage10Environment(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/refusing to delete/);

    await cleanupStage10Environment(env);
  });
});

describe('verifyOutsideSentinelUnchanged', () => {
  it('reports ok when the real history root never existed and still does not', async () => {
    const workspaceRoot = await makeWorkspace();
    cleanupWorkspaces.push(workspaceRoot);
    const env = await allocateStage10Environment({ workspaceRoot, runToken: 'no-real-root' });

    const check = await verifyOutsideSentinelUnchanged(env.outsideSentinel);
    expect(check.ok).toBe(true);

    await cleanupStage10Environment(env);
  });
});
