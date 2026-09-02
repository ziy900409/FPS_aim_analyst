import { describe, expect, it, vi } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TrackingRunEligibility } from '../pilot/trackingRunEligibility.ts';
import {
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import type { TrackingPilotManifest } from './trackingPilotManifest.ts';
import { createTrackingPilotRunner, type TrackingPilotRunnerOptions } from './TrackingPilotRunner.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

const DUMMY_PAYLOAD = {} as ExportPayload;
const ELIGIBLE: TrackingRunEligibility = { status: 'eligible', validScoredTicks: 100, durationMs: 1000 };
const BLOCKED: TrackingRunEligibility = { status: 'blocked', reasons: ['insufficient-scored-coverage'] };

/** practice + 2 scored blocks — small enough to exercise every transition without 9-block noise. */
function smallManifest(): TrackingPilotManifest {
  return {
    protocolVersion: 'tracking-pilot-v1',
    participantId: 'P001',
    sessionIndex: 0,
    orderedBlocks: [
      { drillId: trackingCorePrPilotV1Practice.drillId, seedFamily: 'primary' },
      { drillId: TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].drillId, seedFamily: 'primary' },
      { drillId: TRACKING_CORE_PR_PILOT_V1_CANDIDATES[1].drillId, seedFamily: 'primary' },
    ],
    restSeconds: 5,
    generatedFromCounterbalanceCell: 'test-cell',
  };
}

function makeOptions(overrides: Partial<TrackingPilotRunnerOptions> = {}): TrackingPilotRunnerOptions {
  return {
    loadDrillConfig: vi.fn(async () => {}),
    exportBlock: vi.fn(async () => DUMMY_PAYLOAD),
    evaluateEligibility: vi.fn(() => ELIGIBLE),
    ...overrides,
  };
}

describe('TrackingPilotRunner', () => {
  it('runs practice -> scored -> rest -> scored -> done, skipping eligibility for practice only', async () => {
    const options = makeOptions();
    const runner = createTrackingPilotRunner(options);
    const manifest = smallManifest();

    await runner.start(manifest);
    expect(runner.phase).toEqual({
      kind: 'running',
      block: manifest.orderedBlocks[0],
      blockIndex: 0,
      role: 'practice',
      attempt: 1,
    });

    const practiceRecord = await runner.completeCurrentBlock();
    expect(practiceRecord.eligibility).toBeUndefined();
    expect(practiceRecord.outcome).toBe('completed');
    expect(runner.phase).toEqual({
      kind: 'block-outcome',
      block: manifest.orderedBlocks[0],
      blockIndex: 0,
      role: 'practice',
      attempt: 1,
      eligibility: undefined,
    });

    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'rest', nextBlockIndex: 1, remainingMs: 5000 });
    runner.poll(1000);
    runner.poll(6000);
    await settleTransitions();
    expect(runner.phase).toMatchObject({ kind: 'running', blockIndex: 1, role: 'scored', attempt: 1 });

    const scoredRecord = await runner.completeCurrentBlock();
    expect(scoredRecord.eligibility).toEqual(ELIGIBLE);
    await runner.advance();
    runner.poll(1000);
    runner.poll(6001);
    await settleTransitions();
    expect(runner.phase).toMatchObject({ kind: 'running', blockIndex: 2, role: 'scored', attempt: 1 });

    await runner.completeCurrentBlock();
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });

    expect(options.loadDrillConfig).toHaveBeenCalledTimes(3);
    expect(options.evaluateEligibility).toHaveBeenCalledTimes(2);
    expect(runner.records.map((r) => [r.blockIndex, r.role, r.outcome])).toEqual([
      [0, 'practice', 'completed'],
      [1, 'scored', 'completed'],
      [2, 'scored', 'completed'],
    ]);
  });

  it('retries a block on a blocked outcome without overwriting the original record', async () => {
    const evaluateEligibility = vi.fn<() => TrackingRunEligibility>().mockReturnValueOnce(BLOCKED).mockReturnValueOnce(ELIGIBLE);
    const options = makeOptions({ evaluateEligibility });
    const runner = createTrackingPilotRunner(options);
    const manifest = smallManifest();

    await runner.start(manifest);
    await runner.completeCurrentBlock(); // practice
    await runner.advance();
    runner.poll(0);
    runner.poll(5000);
    await settleTransitions();

    const firstAttempt = await runner.completeCurrentBlock();
    expect(firstAttempt.eligibility).toEqual(BLOCKED);
    expect(firstAttempt.attempt).toBe(1);

    await runner.retryCurrentBlock('participant lost tracking mid-block, technical fault');
    expect(runner.retryLog).toEqual([
      { drillId: manifest.orderedBlocks[1].drillId, blockIndex: 1, previousAttempt: 1, reason: 'participant lost tracking mid-block, technical fault' },
    ]);
    expect(runner.phase).toMatchObject({ kind: 'running', blockIndex: 1, attempt: 2 });

    const secondAttempt = await runner.completeCurrentBlock();
    expect(secondAttempt.eligibility).toEqual(ELIGIBLE);
    expect(secondAttempt.attempt).toBe(2);

    // Both attempts remain in the audit trail — the retry never overwrote attempt 1.
    const blockOneRecords = runner.records.filter((r) => r.blockIndex === 1);
    expect(blockOneRecords).toHaveLength(2);
    expect(blockOneRecords[0]).toMatchObject({ attempt: 1, eligibility: BLOCKED });
    expect(blockOneRecords[1]).toMatchObject({ attempt: 2, eligibility: ELIGIBLE });
  });

  it('aborts the running block without exporting, then advances past it', async () => {
    const options = makeOptions();
    const runner = createTrackingPilotRunner(options);
    await runner.start(smallManifest());
    await runner.completeCurrentBlock(); // practice
    await runner.advance();
    runner.poll(0);
    runner.poll(5000);
    await settleTransitions();
    vi.mocked(options.exportBlock).mockClear();

    await runner.abortCurrentBlock('participant requested to stop this block early');
    expect(options.exportBlock).not.toHaveBeenCalled();
    expect(runner.records[runner.records.length - 1]).toMatchObject({
      blockIndex: 1,
      outcome: 'aborted',
      abortReason: 'participant requested to stop this block early',
      payload: undefined,
      eligibility: undefined,
    });
    expect(runner.phase).toMatchObject({ kind: 'rest', nextBlockIndex: 2 });
  });

  it('rejects an illegal manifest via the same fail-fast validator as parseTrackingPilotManifest', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    const illegal = { ...smallManifest(), orderedBlocks: [{ drillId: 'not-a-real-drill', seedFamily: 'primary' }] };
    await expect(runner.start(illegal as TrackingPilotManifest)).rejects.toThrow('Unknown WP-54 tracking pilot drillId');
  });

  it.each([
    { method: 'completeCurrentBlock', args: [] as const, message: 'No block is currently running' },
    { method: 'retryCurrentBlock', args: ['reason'] as const, message: 'No completed block is awaiting a retry decision' },
    { method: 'abortCurrentBlock', args: ['reason'] as const, message: 'No block is currently running to abort' },
    { method: 'advance', args: [] as const, message: 'No block outcome is awaiting advance' },
  ])('rejects $method() from the idle phase', async ({ method, args, message }) => {
    const runner = createTrackingPilotRunner(makeOptions());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((runner as any)[method](...args)).rejects.toThrow(message);
  });

  it('rejects an empty retry/abort reason', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    await runner.start(smallManifest());
    await expect(runner.abortCurrentBlock('  ')).rejects.toThrow('abort reason must be a non-empty string');
    await runner.completeCurrentBlock();
    await expect(runner.retryCurrentBlock('')).rejects.toThrow('retry reason must be a non-empty string');
  });

  it('rejects starting twice while already active', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    const manifest = smallManifest();
    await runner.start(manifest);
    await expect(runner.start(manifest)).rejects.toThrow('TrackingPilotRunner is already active');
  });

  it('dispose() resets phase, records, and retryLog', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    await runner.start(smallManifest());
    await runner.completeCurrentBlock();
    runner.dispose();
    expect(runner.phase).toEqual({ kind: 'idle' });
    expect(runner.records).toEqual([]);
    expect(runner.retryLog).toEqual([]);
  });
});
