import { describe, expect, it, vi } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TrackingRunEligibility } from '../pilot/trackingRunEligibility.ts';
import {
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import type { TrackingPilotManifest } from './trackingPilotManifest.ts';
import { createTrackingPilotRunner, type TrackingPilotRunnerOptions } from './TrackingPilotRunner.ts';
import { TRACKING_PILOT_PROTOCOL_VERSION } from '../pilot/trackingCompatibilityKey.ts';

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

const DUMMY_PAYLOAD = {} as ExportPayload;
const ELIGIBLE: TrackingRunEligibility = { status: 'eligible', validScoredTicks: 100, durationMs: 1000 };
const BLOCKED: TrackingRunEligibility = { status: 'blocked', reasons: ['insufficient-scored-coverage'] };

/** practice + 2 scored blocks — small enough to exercise every transition without 9-block noise. */
function smallManifest(): TrackingPilotManifest {
  return {
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
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

/**
 * WP-69 / T5（FR-69.10，README §2.5）— 失效 attempt 的明確入口。
 *
 * 這一組真正要反證的是「**不得借用 `abortCurrentBlock()`**」：abort 會前進到下一個 block，而那正是
 * 失效 attempt 絕不能造成的事（FM-6）。所以每一個斷言都盯著兩件事——blockIndex 沒動、`records`
 * 沒長出一筆——而不只是「audit 有寫」。
 */
describe('TrackingPilotRunner — 失效 attempt 的 retry/audit（WP-69 T5）', () => {
  const PAUSED = { kind: 'invalid-retained', reason: 'paused' } as const;
  const DISCARDED = { kind: 'discarded', reason: 'pause-fence-unclosed' } as const;

  it('停在同一個 block：index/role/config 不動，attempt +1，records 不長', async () => {
    const options = makeOptions();
    const runner = createTrackingPilotRunner(options);
    const manifest = smallManifest();
    await runner.start(manifest);
    await runner.completeCurrentBlock();
    await runner.advance();
    runner.poll(1000);
    runner.poll(6000);
    await settleTransitions();
    expect(runner.phase).toMatchObject({ kind: 'running', blockIndex: 1, attempt: 1 });
    const recordsBefore = runner.records.length;
    const callsBefore = {
      load: (options.loadDrillConfig as ReturnType<typeof vi.fn>).mock.calls.length,
      exportBlock: (options.exportBlock as ReturnType<typeof vi.fn>).mock.calls.length,
      evaluate: (options.evaluateEligibility as ReturnType<typeof vi.fn>).mock.calls.length,
    };

    const entry = runner.retryRunningBlock(PAUSED);

    expect(runner.phase).toEqual({
      kind: 'running',
      block: manifest.orderedBlocks[1],
      blockIndex: 1,
      role: 'scored',
      attempt: 2,
    });
    expect(runner.records).toHaveLength(recordsBefore); // 正式 record 只在 candidate 通過後成立
    expect(entry).toEqual({
      drillId: manifest.orderedBlocks[1].drillId,
      blockIndex: 1,
      role: 'scored',
      previousAttempt: 1,
      disposition: PAUSED,
      reason: 'paused',
    });
    // 不重載 config、不匯出、不評分：full restart 是 app 單一 coordinator 的職責（同一個 block 的
    // config/seed 不變），而 held 路徑本來就走不到 `completeCurrentBlock()`。
    expect({
      load: (options.loadDrillConfig as ReturnType<typeof vi.fn>).mock.calls.length,
      exportBlock: (options.exportBlock as ReturnType<typeof vi.fn>).mock.calls.length,
      evaluate: (options.evaluateEligibility as ReturnType<typeof vi.fn>).mock.calls.length,
    }).toEqual(callsBefore);
  });

  it('連續兩次失效：audit 累積兩筆、不覆寫前筆，attempt 走到 3', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    await runner.start(smallManifest());

    runner.retryRunningBlock(PAUSED);
    runner.retryRunningBlock(DISCARDED);

    expect(runner.invalidAttempts).toHaveLength(2);
    expect(runner.invalidAttempts.map((entry) => entry.previousAttempt)).toEqual([1, 2]);
    expect(runner.invalidAttempts.map((entry) => entry.reason)).toEqual(['paused', 'pause-fence-unclosed']);
    expect(runner.phase).toMatchObject({ kind: 'running', blockIndex: 0, attempt: 3 });
  });

  it('失效之後仍可正常完成本 block，且 record 記的是那一次 attempt', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    await runner.start(smallManifest());
    runner.retryRunningBlock(PAUSED);

    const record = await runner.completeCurrentBlock();

    expect(record).toMatchObject({ blockIndex: 0, attempt: 2, outcome: 'completed' });
    expect(runner.records).toHaveLength(1);
    expect(runner.invalidAttempts).toHaveLength(1);
  });

  it('沒有 block 在跑就回 undefined（standalone drill 走同一個 app 接縫，不是錯誤）', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    expect(runner.retryRunningBlock(PAUSED)).toBeUndefined();

    await runner.start(smallManifest());
    await runner.completeCurrentBlock();
    expect(runner.phase.kind).toBe('block-outcome');

    expect(runner.retryRunningBlock(PAUSED)).toBeUndefined();
    expect(runner.invalidAttempts).toEqual([]);
    expect(runner.phase).toMatchObject({ kind: 'block-outcome', blockIndex: 0, attempt: 1 });
  });

  it('start() 清掉上一個 manifest run 的 audit', async () => {
    const runner = createTrackingPilotRunner(makeOptions());
    await runner.start(smallManifest());
    runner.retryRunningBlock(PAUSED);
    expect(runner.invalidAttempts).toHaveLength(1);

    await runner.completeCurrentBlock();
    await runner.advance();
    runner.poll(1000);
    runner.poll(6000);
    await settleTransitions();
    await runner.completeCurrentBlock();
    await runner.advance();
    runner.poll(7000);
    runner.poll(13000);
    await settleTransitions();
    await runner.completeCurrentBlock();
    await runner.advance();
    expect(runner.phase).toEqual({ kind: 'done' });

    await runner.start(smallManifest());

    expect(runner.invalidAttempts).toEqual([]);
  });
});
