import { FAMILY_BY_DRILL_ID } from './drillFamily.ts';
import type { SessionFamilyId } from './sessionSchedule.ts';

/**
 * WP-58 T2 (FR-58.4~58.8) — the session program compiler.
 *
 * A session plan is an ordered list of `(drillId, reps)` plus two rest durations. This module turns
 * it into a flat `ProgramStep[]`: every repetition and every rest is decided here, once, before the
 * session starts. `SessionRunner` (T3) then degenerates into a cursor over that array — it never has
 * to look ahead to work out what kind of boundary it is standing on, because the boundary was
 * already resolved at compile time (D-58-P6).
 *
 * The compiler is pure by contract (NFR-58.1): no DOM, no Three, no `node:*`, no clock, no random,
 * no module-level mutable state. Same input, bit-identical output, forever. `sessionProgram.test.ts`
 * pins that with a source scan rather than trusting the reviewer to notice.
 */

export interface SessionProgramItem {
  readonly drillId: string;
  /** Whole number of runs of this drill, >= 1. Reps repeat the drill; they never touch its config. */
  readonly reps: number;
}

export interface SessionProgramPlan {
  readonly items: readonly SessionProgramItem[];
  /** Rest between two runs of the same item (rep boundary) and between same-family items. */
  readonly drillRestSeconds: number;
  /** Rest between two items from different families. */
  readonly familyRestSeconds: number;
}

/**
 * Which kind of seam two adjacent runs sit on. `'rep'` and `'drill'` both take `drillRestSeconds` —
 * the distinction is kept because the operator needs to see it in the preview table (FR-58.13 /
 * R-58.8): two adjacent counterstrafe drills getting 30 s rather than 60 s is the model working as
 * designed, and it should be visible before the session starts, not afterwards in the export.
 */
export type ProgramBoundary = 'rep' | 'drill' | 'family';

export interface RunStep {
  readonly kind: 'run';
  readonly drillId: string;
  readonly family: SessionFamilyId;
  /** Index into `plan.items` — lets an export locate itself in the program (FR-58.15). */
  readonly itemIndex: number;
  /** 0-based repetition within the item. */
  readonly repIndex: number;
  /** The item's `reps`, carried so the UI can render "2 / 3" without re-reading the plan. */
  readonly repCount: number;
}

export interface RestStep {
  readonly kind: 'rest';
  /** Always > 0: zero-second rests are dropped at compile time (FR-58.6). */
  readonly seconds: number;
  readonly boundary: ProgramBoundary;
  /** The drill this rest leads into. Every rest has one — a program never ends on a rest. */
  readonly nextDrillId: string;
}

export type ProgramStep = RunStep | RestStep;

/** Which part of the plan a compile error is about; lets the form highlight a row (FR-58.7). */
export type SessionProgramErrorField =
  | 'items'
  | 'drillId'
  | 'reps'
  | 'drillRestSeconds'
  | 'familyRestSeconds';

/**
 * Typed compile failure. The compiler never truncates, never substitutes a default and never returns
 * a partial program: an invalid plan is a plan that must not reach the runtime, so the only outcome
 * is a throw. `field` (plus `itemIndex` where one applies) is the classification channel — callers
 * must not parse the message.
 */
export class SessionProgramCompileError extends Error {
  readonly field: SessionProgramErrorField;
  readonly itemIndex?: number;

  constructor(field: SessionProgramErrorField, message: string, itemIndex?: number) {
    const where = itemIndex === undefined ? field : `items[${itemIndex}].${field}`;
    super(`Session program 編譯失敗: ${where} ${message}`);
    this.name = 'SessionProgramCompileError';
    this.field = field;
    if (itemIndex !== undefined) this.itemIndex = itemIndex;
  }
}

function requireRestSeconds(value: number, field: 'drillRestSeconds' | 'familyRestSeconds'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SessionProgramCompileError(field, '必須為有限非負數');
  }
  return value;
}

function requireFamily(drillId: string, itemIndex: number): SessionFamilyId {
  // Unregistered means unschedulable, full stop — there is deliberately no fallback family
  // (D-58-P3). A drill with no declared construct has no defensible rest boundary either side of it.
  const family = FAMILY_BY_DRILL_ID.get(drillId);
  if (family === undefined) {
    throw new SessionProgramCompileError('drillId', `${drillId} 不是可排程 drill`, itemIndex);
  }
  return family;
}

function requireReps(reps: number, itemIndex: number): number {
  if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1) {
    throw new SessionProgramCompileError('reps', '必須為 >= 1 的整數', itemIndex);
  }
  return reps;
}

/**
 * FR-58.5. Same item -> the two runs are repetitions of one block; same family across two items ->
 * still inside one construct; otherwise the program crosses into a new construct and earns the long
 * rest.
 */
function resolveBoundary(previous: RunStep, next: RunStep): ProgramBoundary {
  if (previous.itemIndex === next.itemIndex) return 'rep';
  return previous.family === next.family ? 'drill' : 'family';
}

/**
 * FR-58.4~58.8. Five rules, all decided here:
 *
 * 1. each item expands into `reps` `run` steps, `repIndex` counting from 0;
 * 2. exactly one `rest` may sit between two adjacent runs, its `boundary` from `resolveBoundary`;
 * 3. `seconds` = family rest on a family boundary, drill rest otherwise;
 * 4. no rest before the first run or after the last;
 * 5. a zero-second rest is omitted outright, so the runtime never shows an overlay for one frame.
 *
 * @throws SessionProgramCompileError on any invalid input; never returns a partial program.
 */
export function compileSessionProgram(plan: SessionProgramPlan): readonly ProgramStep[] {
  if (plan.items.length === 0) {
    throw new SessionProgramCompileError('items', '不得為空');
  }
  // Everything is validated before a single step is built, so a throw can never leave the caller
  // holding a half-compiled program.
  const drillRestSeconds = requireRestSeconds(plan.drillRestSeconds, 'drillRestSeconds');
  const familyRestSeconds = requireRestSeconds(plan.familyRestSeconds, 'familyRestSeconds');
  const validated = plan.items.map((item, itemIndex) => ({
    drillId: item.drillId,
    family: requireFamily(item.drillId, itemIndex),
    reps: requireReps(item.reps, itemIndex),
  }));

  const steps: ProgramStep[] = [];
  let previous: RunStep | undefined;
  for (let itemIndex = 0; itemIndex < validated.length; itemIndex++) {
    const { drillId, family, reps } = validated[itemIndex];
    for (let repIndex = 0; repIndex < reps; repIndex++) {
      const run: RunStep = { kind: 'run', drillId, family, itemIndex, repIndex, repCount: reps };
      if (previous !== undefined) {
        const boundary = resolveBoundary(previous, run);
        const seconds = boundary === 'family' ? familyRestSeconds : drillRestSeconds;
        if (seconds > 0) steps.push({ kind: 'rest', seconds, boundary, nextDrillId: drillId });
      }
      steps.push(run);
      previous = run;
    }
  }
  return steps;
}

export interface ProgramSummary {
  readonly runCount: number;
  readonly totalRestSeconds: number;
}

/**
 * For the form's preview header (FR-58.13). Deliberately excludes drill duration: how long a drill
 * takes depends on the participant, so an estimate that pretended otherwise would be worse than no
 * estimate. Rest seconds, by contrast, are exactly known at compile time.
 */
export function summarizeProgram(program: readonly ProgramStep[]): ProgramSummary {
  let runCount = 0;
  let totalRestSeconds = 0;
  for (const step of program) {
    if (step.kind === 'run') runCount += 1;
    else totalRestSeconds += step.seconds;
  }
  return { runCount, totalRestSeconds };
}
