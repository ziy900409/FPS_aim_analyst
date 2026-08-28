import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createStage10EvidenceReporter,
  Stage10EvidenceRedactionError,
  type Stage10EvidenceReport,
} from './Stage10EvidenceReporter.ts';

const BASE_ENV = { commit: 'deadbeef', node: 'v25.0.0', os: 'win32', browser: 'edge', backend: 'webgpu' };

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir !== undefined) await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('Stage10EvidenceReporter', () => {
  it('merges the shared environment into every recorded entry', () => {
    const reporter = createStage10EvidenceReporter({ environment: BASE_ENV });
    const record = reporter.record({
      id: 'FR-51.3-canonical-journey',
      status: 'pass',
      kind: 'automated',
      owner: 'wp-51',
      artifact: 'tests/e2e/stage10-assessment.spec.ts',
      command: 'npm run test:stage10',
    });

    expect(record.environment).toMatchObject(BASE_ENV);
    expect(record.environment.startedAt).toEqual(expect.any(String));
    expect(reporter.records()).toEqual([record]);
  });

  it('rejects a record whose artifact/command/notes leaks a forbidden absolute path', () => {
    const forbiddenRoot = path.join(os.tmpdir(), 'real-workspace');
    const reporter = createStage10EvidenceReporter({
      environment: BASE_ENV,
      forbiddenAbsolutePaths: [forbiddenRoot],
    });

    expect(() =>
      reporter.record({
        id: 'leaky',
        status: 'pass',
        kind: 'inspection',
        owner: 'wp-51',
        artifact: path.join(forbiddenRoot, 'data', 'session-history', 'participant.json'),
      }),
    ).toThrow(Stage10EvidenceRedactionError);
    expect(reporter.records()).toEqual([]);
  });

  it('rejects a leak carried in notes even when artifact/command are clean', () => {
    const forbiddenRoot = path.join(os.tmpdir(), 'real-workspace-2');
    const reporter = createStage10EvidenceReporter({
      environment: BASE_ENV,
      forbiddenAbsolutePaths: [forbiddenRoot],
    });

    expect(() =>
      reporter.record({
        id: 'leaky-notes',
        status: 'fail',
        kind: 'automated',
        owner: 'wp-51',
        artifact: 'tests/stage10/evidence.json',
        notes: `see ${forbiddenRoot} for the failing file`,
      }),
    ).toThrow(Stage10EvidenceRedactionError);
  });

  it('writes a JSON report file readable back as Stage10EvidenceReport', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stage10-evidence-'));
    cleanupDirs.push(dir);
    const reporter = createStage10EvidenceReporter({ environment: BASE_ENV });
    reporter.record({ id: 'a', status: 'pass', kind: 'measurement', owner: 'wp-51', artifact: 'artifact-a' });
    reporter.record({ id: 'b', status: 'blocked', kind: 'manual', owner: 'qa', artifact: 'artifact-b', notes: 'awaiting hardware' });

    const filePath = path.join(dir, 'nested', 'stage10-evidence.json');
    await reporter.write(filePath);

    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Stage10EvidenceReport;
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records.map((r) => r.id)).toEqual(['a', 'b']);
    expect(parsed.generatedAt).toEqual(expect.any(String));
  });
});
