import { resolveFamilyDrillId, resolveWarmupDrillId, type WarmupAvailability } from './drillFamily.ts';
import {
  compileSessionProgram,
  type ProgramStep,
  type RestStep,
  type RunStep,
  type SessionProgramItem,
} from './sessionProgram.ts';
import { KNOWN_SESSION_FAMILY_IDS, type SessionFamilyId } from './sessionSchedule.ts';

// WP-58 T1 — the drill<->family mapping now lives in `drillFamily.ts` (FR-58.1), so this module no
// longer imports drill modules at all. Re-exported here because these two names are part of the
// runner's established public surface (`SessionRunner.test.ts`, and `main.ts`'s wiring comments).
export { resolveFamilyDrillId, resolveWarmupDrillId, type WarmupAvailability };

/**
 * WP-58 T3 (FR-58.9~58.11) — the runner is a cursor, nothing more.
 *
 * Before this task the runner *was* the schedule: it held the family order, decided which drill each
 * family meant, and kept a single module-level `restDurationMs`. Every one of those decisions now
 * happens once, at compile time, in `compileSessionProgram()` (D-58-P6). What is left here is a
 * cursor over `ProgramStep[]` plus the two things that genuinely belong to runtime: awaiting the
 * drill load, and counting down a rest against the render clock.
 *
 * Both tracks — the frozen Assessment protocol and a custom operator program — run on this one
 * runtime (FR-58.10). They differ only in who produced the program.
 */

export type SessionPlanMode = 'frozen' | 'custom';

export interface SessionPlan {
  readonly participantId: string;
  readonly sessionIndex: number;
  /** Which track produced this program. Carried for the export audit trail (FR-58.14, T5). */
  readonly mode: SessionPlanMode;
  /** The plan the program was compiled from — kept so an export can restate it (FR-58.14, T5). */
  readonly items: readonly SessionProgramItem[];
  /** The single source of truth for this session's schedule. Compiled before `start()`. */
  readonly program: readonly ProgramStep[];
}

export type SessionRunnerPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'run'; readonly step: RunStep; readonly cursor: number }
  | { readonly kind: 'rest'; readonly step: RestStep; readonly cursor: number; readonly remainingMs: number }
  | { readonly kind: 'done' };

export interface SessionRunnerHandle {
  readonly phase: SessionRunnerPhase;
  start(plan: SessionPlan): Promise<void>;
  /** Called from the existing render loop; never interacts with simulation state. */
  poll(nowMs: number): void;
  /** Advance after a run completes, or automatically after rest expires. */
  advance(): Promise<void>;
  dispose(): void;
}

export interface SessionRunnerOptions {
  readonly loadDrillById: (drillId: string) => Promise<void>;
  /** Status is rendered by the UI owner; this module remains DOM-agnostic. */
  readonly onStatus?: (text: string) => void;
  readonly onPhaseChange?: (phase: SessionRunnerPhase) => void;
}

export interface FrozenSessionPlanInput {
  readonly participantId: string;
  readonly sessionIndex: number;
  readonly families: readonly SessionFamilyId[];
  readonly restSeconds: number;
  readonly includeWarmup: boolean;
}

export interface FrozenSessionPlanBuild {
  readonly plan: SessionPlan;
  /**
   * Whether a warmup drill was actually found for the leading family — `'unavailable'` both when the
   * family has none and when the operator did not ask for one. The caller owns the operator-facing
   * message, so this module stays DOM-free.
   */
  readonly warmupAvailability: WarmupAvailability;
}

function requireFamilyOrder(value: readonly SessionFamilyId[]): readonly SessionFamilyId[] {
  if (value.length === 0) throw new Error('Session plan must include at least one family');
  const seen = new Set<SessionFamilyId>();
  for (const family of value) {
    if (!KNOWN_SESSION_FAMILY_IDS.has(family)) throw new Error(`Unknown session plan family: ${family}`);
    // Still forbidden on the frozen track only (FR-58.8): the counterbalanced protocol is defined
    // over a permutation of distinct families. A custom program may repeat and interleave freely.
    if (seen.has(family)) throw new Error('Session plan families must not contain duplicates');
    seen.add(family);
  }
  return [...value];
}

/**
 * FR-58.10 — the frozen Assessment track, expressed as a program instead of as runner state.
 *
 * The mapping is exact, not approximate. `drillRestSeconds` is 0 on purpose: the only non-family
 * seam a frozen program can contain is warmup -> first family (the warmup drill belongs to the very
 * family it warms up), and that seam carried no rest before WP-58. A zero-second rest is dropped at
 * compile time (FR-58.6), so the compiled program has a rest exactly where the old state machine had
 * one, of exactly the same length. Families are distinct by `requireFamilyOrder`, so every remaining
 * seam is a family seam and takes `restSeconds`.
 *
 * @throws Error on an empty/duplicate/unknown family order or a non-finite/negative `restSeconds` —
 * the same messages the runner used to throw from `start()`, now raised before a runtime exists.
 */
export function buildFrozenSessionPlan(input: FrozenSessionPlanInput): FrozenSessionPlanBuild {
  const families = requireFamilyOrder(input.families);
  if (!Number.isFinite(input.restSeconds) || input.restSeconds < 0) {
    throw new Error('restSeconds must be a non-negative finite number');
  }
  const warmup = input.includeWarmup
    ? resolveWarmupDrillId(families[0])
    : ({ availability: 'unavailable' } as const);
  const items: SessionProgramItem[] = [];
  if (warmup.availability === 'available' && warmup.drillId !== undefined) {
    items.push({ drillId: warmup.drillId, reps: 1, warmup: true });
  }
  for (const family of families) items.push({ drillId: resolveFamilyDrillId(family), reps: 1 });
  return {
    plan: {
      participantId: input.participantId,
      sessionIndex: input.sessionIndex,
      mode: 'frozen',
      items,
      program: compileSessionProgram({ items, drillRestSeconds: 0, familyRestSeconds: input.restSeconds }),
    },
    warmupAvailability: warmup.availability,
  };
}

/**
 * The rest phase is one reused object whose `remainingMs` is written in place. `poll()` runs every
 * frame and the fixed-layout discipline (CLAUDE.md §4 / NFR-58.3) forbids allocating there — the
 * previous implementation rebuilt the phase object on every frame of every rest.
 */
interface MutableRestPhase {
  readonly kind: 'rest';
  readonly step: RestStep;
  readonly cursor: number;
  remainingMs: number;
}

export function createSessionRunner(options: SessionRunnerOptions): SessionRunnerHandle {
  let phase: SessionRunnerPhase = { kind: 'idle' };
  let program: readonly ProgramStep[] = [];
  let restPhase: MutableRestPhase | undefined;
  let restStartedAt: number | undefined;
  /** Measured runs only: a warmup is not "test 1 of 4", exactly as before WP-58. */
  let measuredRunTotal = 0;
  let measuredRunOrdinal = 0;
  let disposed = false;
  let transition: Promise<void> | undefined;

  function setPhase(next: SessionRunnerPhase): void {
    phase = next;
    options.onPhaseChange?.(next);
  }

  async function enterStep(index: number): Promise<void> {
    const step = program[index];
    if (step === undefined) {
      restPhase = undefined;
      setPhase({ kind: 'done' });
      options.onStatus?.('Session Plan 完成：所有家族已完成。');
      return;
    }
    if (step.kind === 'run') {
      // Load first, then publish the phase: a failed load must not leave the UI (and the rest
      // overlay driven by onPhaseChange) claiming a run is in progress. The rejection propagates to
      // whoever called advance()/start() — for the unattended auto-advance that is poll()'s catch.
      await options.loadDrillById(step.drillId);
      restPhase = undefined;
      setPhase({ kind: 'run', step, cursor: index });
      if (step.warmup === true) {
        options.onStatus?.(`熱身: ${step.family}`);
      } else {
        measuredRunOrdinal += 1;
        options.onStatus?.(`正式測試 ${measuredRunOrdinal}/${measuredRunTotal}: ${step.family}`);
      }
      return;
    }
    restStartedAt = undefined;
    restPhase = { kind: 'rest', step, cursor: index, remainingMs: step.seconds * 1_000 };
    setPhase(restPhase);
    // A rest is never the last step (compiler rule 4), so the next step is always a run.
    const next = program[index + 1];
    options.onStatus?.(`休息後開始: ${next !== undefined && next.kind === 'run' ? next.family : step.nextDrillId}`);
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
        if (plan.program.length === 0) throw new Error('Session plan program must not be empty');
        program = plan.program;
        measuredRunTotal = 0;
        for (const step of program) if (step.kind === 'run' && step.warmup !== true) measuredRunTotal += 1;
        measuredRunOrdinal = 0;
        restStartedAt = undefined;
        restPhase = undefined;
        await enterStep(0);
      });
    },
    poll(nowMs): void {
      if (phase.kind !== 'rest' || disposed || transition !== undefined) return;
      const rest = restPhase;
      if (rest === undefined) return;
      restStartedAt ??= nowMs;
      const remainingMs = Math.max(0, rest.step.seconds * 1_000 - (nowMs - restStartedAt));
      if (remainingMs === 0) {
        // Auto-advance runs unattended (no caller to await it); a rejection here (e.g. the next
        // step's drill/scene fails to load) must not leave `phase` stuck at 'rest' forever —
        // that would freeze the rest overlay on screen with no recovery (see SessionRunnerPoll.test.ts).
        void this.advance().catch((error: unknown) => {
          options.onStatus?.(
            `Session Plan 家族切換失敗，本次 session 已中止：${error instanceof Error ? error.message : String(error)}`,
          );
          setPhase({ kind: 'done' });
        });
        return;
      }
      // Written in place, not rebuilt (NFR-58.3). The phase object keeps one identity for the whole
      // rest, so the overlay owner must read `remainingMs` per callback rather than retain the phase.
      if (remainingMs !== rest.remainingMs) {
        rest.remainingMs = remainingMs;
        options.onPhaseChange?.(rest);
      }
    },
    advance(): Promise<void> {
      return runTransition(async () => {
        if (phase.kind !== 'run' && phase.kind !== 'rest') return;
        await enterStep(phase.cursor + 1);
      });
    },
    dispose(): void {
      disposed = true;
      program = [];
      restPhase = undefined;
      restStartedAt = undefined;
      measuredRunTotal = 0;
      measuredRunOrdinal = 0;
      setPhase({ kind: 'idle' });
    },
  };
}
