import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import { spiderShotV1 } from '../drill/spider_shot_v1.ts';
import { findSessionPlanPreset } from './sessionPlanPresets.ts';
import { buildFamilyOrder, type TestFamilyId } from './sessionSchedule.ts';

export interface SessionPlan {
  readonly participantId: string;
  readonly sessionIndex: number;
  readonly families: readonly TestFamilyId[];
  readonly presetId: string;
  readonly includeWarmup: boolean;
}

export type WarmupAvailability = 'available' | 'unavailable';

export type SessionRunnerPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'warmup'; readonly family: TestFamilyId; readonly availability: WarmupAvailability }
  | { readonly kind: 'family'; readonly family: TestFamilyId; readonly familyIndex: number }
  | { readonly kind: 'rest'; readonly nextFamily: TestFamilyId; readonly remainingMs: number }
  | { readonly kind: 'done' };

export interface SessionRunnerHandle {
  readonly phase: SessionRunnerPhase;
  start(plan: SessionPlan): Promise<void>;
  /** Called from the existing render loop; never interacts with simulation state. */
  poll(nowMs: number): void;
  /** Advance after a warmup/family completes, or automatically after rest expires. */
  advance(): Promise<void>;
  dispose(): void;
}

export interface SessionRunnerOptions {
  readonly loadDrillById: (drillId: string) => Promise<void>;
  /** Status is rendered by the UI owner; this module remains DOM-agnostic. */
  readonly onStatus?: (text: string) => void;
  readonly onPhaseChange?: (phase: SessionRunnerPhase) => void;
}

export function resolveWarmupDrillId(
  family: TestFamilyId,
): { availability: WarmupAvailability; drillId?: string } {
  return family === 'counterstrafe'
    ? { availability: 'available', drillId: counterstrafeFreeV1.drillId }
    : { availability: 'unavailable' };
}

export function resolveFamilyDrillId(family: TestFamilyId): string {
  switch (family) {
    case 'hold-click':
      return holdClickV1.id;
    case 'hold-track':
      return holdTrackV1.id;
    case 'spider-shot':
      return spiderShotV1.drillId;
    case 'counterstrafe':
      return counterstrafeReversalV1.drillId;
  }
}

export function createSessionRunner(options: SessionRunnerOptions): SessionRunnerHandle {
  let phase: SessionRunnerPhase = { kind: 'idle' };
  let families: readonly TestFamilyId[] = [];
  let presetRestMs = 0;
  let restStartedAt: number | undefined;
  let disposed = false;
  let transition: Promise<void> | undefined;

  function setPhase(next: SessionRunnerPhase): void {
    phase = next;
    options.onPhaseChange?.(next);
  }

  async function startFamily(familyIndex: number): Promise<void> {
    const family = families[familyIndex];
    if (family === undefined) {
      setPhase({ kind: 'done' });
      options.onStatus?.('Session Plan 完成：所有家族已完成。');
      return;
    }
    await options.loadDrillById(resolveFamilyDrillId(family));
    setPhase({ kind: 'family', family, familyIndex });
    options.onStatus?.(`正式測試 ${familyIndex + 1}/${families.length}: ${family}`);
  }

  async function startWarmupOrFamily(familyIndex: number): Promise<void> {
    const family = families[familyIndex];
    if (family === undefined) return startFamily(familyIndex);
    const warmup = resolveWarmupDrillId(family);
    if (warmup.availability === 'unavailable') {
      options.onStatus?.('本家族無熱身，直接開始正式測試。');
      return startFamily(familyIndex);
    }
    setPhase({ kind: 'warmup', family, availability: warmup.availability });
    await options.loadDrillById(warmup.drillId!);
    options.onStatus?.(`熱身: ${family}`);
  }

  function runTransition(action: () => Promise<void>): Promise<void> {
    if (disposed) return Promise.resolve();
    const next = (transition ?? Promise.resolve()).then(action);
    transition = next;
    // Bookkeeping only — the caller of runTransition() (start/advance's own return value) is
    // responsible for handling a rejection; without this .catch() the derived `.finally()`
    // promise would report its own separate "unhandled rejection" even when `next` is handled.
    next
      .finally(() => {
        if (transition === next) transition = undefined;
      })
      .catch(() => {});
    return next;
  }

  return {
    get phase(): SessionRunnerPhase {
      return phase;
    },
    start(plan): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'idle' && phase.kind !== 'done') throw new Error('SessionRunner is already active');
        if (!Number.isInteger(plan.sessionIndex) || plan.sessionIndex < 0) {
          throw new Error('sessionIndex must be a non-negative integer');
        }
        const preset = findSessionPlanPreset(plan.presetId);
        if (preset === undefined) throw new Error(`Unknown session plan preset: ${plan.presetId}`);
        families = buildFamilyOrder(plan.participantId, plan.sessionIndex).filter((family) =>
          plan.families.includes(family),
        );
        if (families.length === 0) throw new Error('Session plan must include at least one family');
        presetRestMs = preset.restSeconds * 1000;
        restStartedAt = undefined;
        if (plan.includeWarmup) await startWarmupOrFamily(0);
        else await startFamily(0);
      });
    },
    poll(nowMs): void {
      if (phase.kind !== 'rest' || disposed || transition !== undefined) return;
      restStartedAt ??= nowMs;
      const remainingMs = Math.max(0, presetRestMs - (nowMs - restStartedAt));
      if (remainingMs === 0) {
        // Auto-advance runs unattended (no caller to await it); a rejection here (e.g. the next
        // family's drill/scene fails to load) must not leave `phase` stuck at 'rest' forever —
        // that would freeze the rest overlay on screen with no recovery (see SessionRunnerPoll.test.ts).
        void this.advance().catch((error: unknown) => {
          options.onStatus?.(
            `Session Plan 家族切換失敗，本次 session 已中止：${error instanceof Error ? error.message : String(error)}`,
          );
          setPhase({ kind: 'done' });
        });
        return;
      }
      setPhase({ ...phase, remainingMs });
    },
    advance(): Promise<void> {
      return runTransition(async () => {
        if (phase.kind === 'warmup') {
          const index = families.indexOf(phase.family);
          await startFamily(index);
          return;
        }
        if (phase.kind === 'family') {
          const nextFamily = families[phase.familyIndex + 1];
          if (nextFamily === undefined) {
            setPhase({ kind: 'done' });
            options.onStatus?.('Session Plan 完成：所有家族已完成。');
            return;
          }
          restStartedAt = undefined;
          setPhase({ kind: 'rest', nextFamily, remainingMs: presetRestMs });
          options.onStatus?.(`休息後開始: ${nextFamily}`);
          return;
        }
        if (phase.kind === 'rest') {
          const index = families.indexOf(phase.nextFamily);
          restStartedAt = undefined;
          await startFamily(index);
        }
      });
    },
    dispose(): void {
      disposed = true;
      families = [];
      restStartedAt = undefined;
      setPhase({ kind: 'idle' });
    },
  };
}
