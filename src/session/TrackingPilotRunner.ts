import type { DrillConfig } from '../drill/DrillConfig.ts';
import type { ExportPayload } from '../data/export.ts';
import { evaluateTrackingRunEligibility, type TrackingRunEligibility } from '../pilot/trackingRunEligibility.ts';
import {
  parseTrackingPilotManifest,
  resolveTrackingPilotBlockConfig,
  trackingPilotBlockRole,
  type TrackingPilotBlock,
  type TrackingPilotBlockRole,
  type TrackingPilotManifest,
} from './trackingPilotManifest.ts';

/**
 * TrackingPilotRunner — WP-54 / T5 (task-checklist T5 "Researcher-only runner 可執行 practice ->
 * scored block -> rest -> export", "操作端顯示 current block/rest/quality abort，不顯示即時能力
 * 分數", "記錄 completion、abort、retry reason；retry 不覆蓋原 export").
 *
 * DOM-agnostic phase state machine, same shape/precedent as `SessionRunner.ts` (`loadDrillById`/
 * `onStatus`/`onPhaseChange` injected, UI wired separately) — progress.md's T2 discovery note
 * already ruled out `ProtocolRunner.ts` for this (its granularity is "swap an entire drill+scene+
 * resolution condition", not "practice -> scored block -> rest within one manifest run"). Unlike
 * `SessionRunner.ts`, blocks are loaded by resolved `DrillConfig` (not `drillId` string) because a
 * session-1 scored block may carry an alternate-seed clone (`resolveTrackingPilotBlockConfig()`)
 * that was never registered under its own drillId in any `availableDrills`-style table.
 */

export type TrackingPilotRunnerPhase =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'running';
      readonly block: TrackingPilotBlock;
      readonly blockIndex: number;
      readonly role: TrackingPilotBlockRole;
      readonly attempt: number;
    }
  | {
      readonly kind: 'block-outcome';
      readonly block: TrackingPilotBlock;
      readonly blockIndex: number;
      readonly role: TrackingPilotBlockRole;
      readonly attempt: number;
      /** `undefined` for practice blocks — they have no `scored_start` event to evaluate (T2
       * design) and are never quality-gated. Never a numeric score — closed reason codes only. */
      readonly eligibility: TrackingRunEligibility | undefined;
    }
  | { readonly kind: 'rest'; readonly nextBlockIndex: number; readonly remainingMs: number }
  | { readonly kind: 'done' };

export type TrackingPilotBlockOutcome = 'completed' | 'aborted';

export interface TrackingPilotBlockRunRecord {
  readonly drillId: string;
  readonly blockIndex: number;
  readonly role: TrackingPilotBlockRole;
  readonly seedFamily: TrackingPilotBlock['seedFamily'];
  /** 1-based; increments each time this block is retried. */
  readonly attempt: number;
  readonly outcome: TrackingPilotBlockOutcome;
  readonly eligibility: TrackingRunEligibility | undefined;
  readonly payload: ExportPayload | undefined;
  readonly abortReason: string | undefined;
}

export interface TrackingPilotRetryLogEntry {
  readonly drillId: string;
  readonly blockIndex: number;
  readonly previousAttempt: number;
  readonly reason: string;
}

export interface TrackingPilotRunnerOptions {
  readonly loadDrillConfig: (config: DrillConfig) => Promise<void>;
  readonly exportBlock: () => ExportPayload | Promise<ExportPayload>;
  /** Injectable for tests; defaults to the real `evaluateTrackingRunEligibility()`. */
  readonly evaluateEligibility?: (payload: ExportPayload) => TrackingRunEligibility;
  /** Status is rendered by the UI owner; this module remains DOM-agnostic. */
  readonly onStatus?: (text: string) => void;
  readonly onPhaseChange?: (phase: TrackingPilotRunnerPhase) => void;
  readonly onBlockRecord?: (record: TrackingPilotBlockRunRecord) => void;
}

export interface TrackingPilotRunnerHandle {
  readonly phase: TrackingPilotRunnerPhase;
  readonly records: readonly TrackingPilotBlockRunRecord[];
  readonly retryLog: readonly TrackingPilotRetryLogEntry[];
  start(manifest: TrackingPilotManifest): Promise<void>;
  /** Called from the existing render loop; never interacts with simulation state. */
  poll(nowMs: number): void;
  /** Exports the currently-running block and evaluates its eligibility (skipped for practice). */
  completeCurrentBlock(): Promise<TrackingPilotBlockRunRecord>;
  /** Re-runs the same block from a `block-outcome` phase. Does not overwrite the prior record —
   * appends a new attempt. */
  retryCurrentBlock(reason: string): Promise<void>;
  /** Marks the currently-running block aborted (no export was taken) and advances past it. */
  abortCurrentBlock(reason: string): Promise<void>;
  /** Accepts the current block-outcome (or aborted block) and moves to rest / the next block. */
  advance(): Promise<void>;
  dispose(): void;
}

export function createTrackingPilotRunner(options: TrackingPilotRunnerOptions): TrackingPilotRunnerHandle {
  const evaluateEligibility = options.evaluateEligibility ?? evaluateTrackingRunEligibility;

  let phase: TrackingPilotRunnerPhase = { kind: 'idle' };
  let manifest: TrackingPilotManifest | undefined;
  let restStartedAt: number | undefined;
  let disposed = false;
  let transition: Promise<unknown> | undefined;
  const records: TrackingPilotBlockRunRecord[] = [];
  const retryLog: TrackingPilotRetryLogEntry[] = [];

  function setPhase(next: TrackingPilotRunnerPhase): void {
    phase = next;
    options.onPhaseChange?.(next);
  }

  function requireManifest(): TrackingPilotManifest {
    if (manifest === undefined) throw new Error('TrackingPilotRunner has not been started');
    return manifest;
  }

  async function startBlock(blockIndex: number, attemptNumber: number): Promise<void> {
    const plan = requireManifest();
    const block = plan.orderedBlocks[blockIndex];
    if (block === undefined) {
      setPhase({ kind: 'done' });
      options.onStatus?.('Tracking pilot manifest 完成：所有 block 已完成。');
      return;
    }
    const role = trackingPilotBlockRole(block.drillId);
    await options.loadDrillConfig(resolveTrackingPilotBlockConfig(block));
    setPhase({ kind: 'running', block, blockIndex, role, attempt: attemptNumber });
    options.onStatus?.(`Block ${blockIndex + 1}/${plan.orderedBlocks.length}（${role}）：${block.drillId}`);
  }

  function runTransition<T>(action: () => Promise<T>): Promise<T> {
    if (disposed) return Promise.resolve() as Promise<T>;
    const next = (transition ?? Promise.resolve()).then(action);
    transition = next;
    // Bookkeeping only — the caller of runTransition() is responsible for handling a rejection;
    // without this .catch() the derived `.finally()` promise would report its own separate
    // "unhandled rejection" even when `next` is handled (same as SessionRunner.ts's precedent).
    next
      .finally(() => {
        if (transition === next) transition = undefined;
      })
      .catch(() => {});
    return next;
  }

  return {
    get phase(): TrackingPilotRunnerPhase {
      return phase;
    },
    get records(): readonly TrackingPilotBlockRunRecord[] {
      return records;
    },
    get retryLog(): readonly TrackingPilotRetryLogEntry[] {
      return retryLog;
    },
    start(plan): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'idle' && phase.kind !== 'done') {
          throw new Error('TrackingPilotRunner is already active');
        }
        manifest = parseTrackingPilotManifest(plan);
        records.length = 0;
        retryLog.length = 0;
        restStartedAt = undefined;
        await startBlock(0, 1);
      });
    },
    poll(nowMs): void {
      if (phase.kind !== 'rest' || disposed || transition !== undefined) return;
      const restDurationMs = requireManifest().restSeconds * 1000;
      restStartedAt ??= nowMs;
      const remainingMs = Math.max(0, restDurationMs - (nowMs - restStartedAt));
      if (remainingMs === 0) {
        const nextBlockIndex = phase.nextBlockIndex;
        void runTransition(async () => {
          restStartedAt = undefined;
          await startBlock(nextBlockIndex, 1);
        }).catch((error: unknown) => {
          options.onStatus?.(
            `Block 切換失敗，本次 manifest run 已中止：${error instanceof Error ? error.message : String(error)}`,
          );
          setPhase({ kind: 'done' });
        });
        return;
      }
      setPhase({ ...phase, remainingMs });
    },
    completeCurrentBlock(): Promise<TrackingPilotBlockRunRecord> {
      return runTransition(async () => {
        if (phase.kind !== 'running') throw new Error('No block is currently running');
        const { block, blockIndex, role, attempt: attemptNumber } = phase;
        const payload = await options.exportBlock();
        const eligibility = role === 'practice' ? undefined : evaluateEligibility(payload);
        const record: TrackingPilotBlockRunRecord = {
          drillId: block.drillId,
          blockIndex,
          role,
          seedFamily: block.seedFamily,
          attempt: attemptNumber,
          outcome: 'completed',
          eligibility,
          payload,
          abortReason: undefined,
        };
        records.push(record);
        options.onBlockRecord?.(record);
        setPhase({ kind: 'block-outcome', block, blockIndex, role, attempt: attemptNumber, eligibility });
        return record;
      });
    },
    retryCurrentBlock(reason): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'block-outcome') throw new Error('No completed block is awaiting a retry decision');
        if (reason.trim() === '') throw new Error('retry reason must be a non-empty string');
        const { block, blockIndex, attempt: previousAttempt } = phase;
        retryLog.push({ drillId: block.drillId, blockIndex, previousAttempt, reason });
        await startBlock(blockIndex, previousAttempt + 1);
      });
    },
    abortCurrentBlock(reason): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'running') throw new Error('No block is currently running to abort');
        if (reason.trim() === '') throw new Error('abort reason must be a non-empty string');
        const { block, blockIndex, role, attempt: attemptNumber } = phase;
        const record: TrackingPilotBlockRunRecord = {
          drillId: block.drillId,
          blockIndex,
          role,
          seedFamily: block.seedFamily,
          attempt: attemptNumber,
          outcome: 'aborted',
          eligibility: undefined,
          payload: undefined,
          abortReason: reason,
        };
        records.push(record);
        options.onBlockRecord?.(record);
        await advanceFromBlock(blockIndex);
      });
    },
    advance(): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'block-outcome') throw new Error('No block outcome is awaiting advance');
        await advanceFromBlock(phase.blockIndex);
      });
    },
    dispose(): void {
      disposed = true;
      manifest = undefined;
      restStartedAt = undefined;
      records.length = 0;
      retryLog.length = 0;
      setPhase({ kind: 'idle' });
    },
  };

  async function advanceFromBlock(blockIndex: number): Promise<void> {
    const plan = requireManifest();
    const nextBlockIndex = blockIndex + 1;
    if (nextBlockIndex >= plan.orderedBlocks.length) {
      setPhase({ kind: 'done' });
      options.onStatus?.('Tracking pilot manifest 完成：所有 block 已完成。');
      return;
    }
    restStartedAt = undefined;
    setPhase({ kind: 'rest', nextBlockIndex, remainingMs: plan.restSeconds * 1000 });
    options.onStatus?.(`休息中，下一個 block: ${plan.orderedBlocks[nextBlockIndex].drillId}`);
  }
}
