import type {
  NormalizedReplayEvent,
  NormalizedReplayTick,
  ReplayEffectState,
  ReplayRecording,
  ReplaySample,
  ReplayTargetState,
} from './contracts.ts';

/**
 * WP-50 / T2 — pure recorded-state sampling (README §2.5). `sampleReplay(recording, t)` is the only
 * function that turns a `ReplayRecording` + a point in time into an observable frame; it never reads
 * accumulated/mutable state, so a direct `seek(t)` and a sequential walk from `0` to `t` always
 * produce an identical `ReplaySample` for the same `t` (README FR-50.10 / D-50-P4 seek-purity).
 *
 * No DOM/Three/fs/wall-clock/random import here (README §2.1 replay domain purity rule).
 */

/** Fixed window every recorded event stays "active" for once its time has passed (README §2.5
 * "cue/shot/impact 等短效視覺由 `eventTime <= t < eventTime + fixedDuration` 純查詢"). T2 owns one
 * generic, kind-independent window; per-kind visual timing is a later view-adapter concern (T4) that
 * can filter/re-window this list without touching the pure binary-search core here. */
export const EFFECT_WINDOW_MS = 200;

/** Reusable scratch arrays for the hot per-frame path (NFR-50.4): `sampleReplay` truncates and
 * refills these in place instead of allocating a fresh `targets`/`effects` array every call when a
 * buffer is supplied. The returned `ReplaySample.targets`/`.effects` are these same array instances. */
export interface ReplaySampleBuffer {
  targets: ReplayTargetState[];
  effects: ReplayEffectState[];
}

export function createReplaySampleBuffer(): ReplaySampleBuffer {
  return { targets: [], effects: [] };
}

export function sampleReplay(recording: ReplayRecording, timeMs: number, reuse?: ReplaySampleBuffer): ReplaySample {
  const clamped = clamp(timeMs, 0, recording.durationMs);

  const tickBefore = lowerBoundIndex(recording.tickTimes, clamped);
  const tickAfter = Math.min(tickBefore + 1, recording.ticks.length - 1);
  const before = recording.ticks[tickBefore];
  const after = recording.ticks[tickAfter];

  const tBefore = recording.tickTimes[tickBefore];
  const tAfter = recording.tickTimes[tickAfter];
  const denom = tAfter - tBefore;
  const alpha = denom > 0 ? clamp((clamped - tBefore) / denom, 0, 1) : 0;

  const targets = reuse !== undefined ? reuse.targets : [];
  targets.length = 0;
  fillTargets(targets, before, after, alpha);

  const eventCursor = eventCursorAt(recording.eventTimes, clamped);

  const effects = reuse !== undefined ? reuse.effects : [];
  effects.length = 0;
  fillActiveEffects(effects, recording.events, eventCursor, clamped);

  return {
    timeMs: clamped,
    tickBefore,
    tickAfter,
    alpha,
    camera: { yaw: lerpAngle(before.yaw, after.yaw, alpha), pitch: lerp(before.pitch, after.pitch, alpha) },
    player: { px: lerp(before.px, after.px, alpha), pz: lerp(before.pz, after.pz, alpha), speed: Math.hypot(before.vx, before.vz) },
    input: { keys: before.keys, ads: before.ads },
    targets,
    effects,
    eventCursor,
  };
}

function fillTargets(out: ReplayTargetState[], before: NormalizedReplayTick, after: NormalizedReplayTick, alpha: number): void {
  if (before.targetId === null || before.tx === null || before.ty === null || before.tz === null) return;

  // Same-ID, same-lifecycle-segment: interpolate. Otherwise (spawn/death boundary, or a different
  // target on the right tick) hold the left tick's discrete state — README §2.5 "target 只在相同 ID
  // 且兩端同一 lifecycle segment 時插值...latest-at-or-before 離散 state".
  if (after.targetId === before.targetId && after.tx !== null && after.ty !== null && after.tz !== null) {
    out.push({
      id: before.targetId,
      x: lerp(before.tx, after.tx, alpha),
      y: lerp(before.ty, after.ty, alpha),
      z: lerp(before.tz, after.tz, alpha),
    });
    return;
  }

  out.push({ id: before.targetId, x: before.tx, y: before.ty, z: before.tz });
}

/** Walks backward from `cursor` (the latest event at-or-before `t`) collecting events whose window
 * still covers `t`. Safe to stop at the first miss: `event.timeMs` only decreases going backward, so
 * once `event.timeMs + EFFECT_WINDOW_MS <= t` fails once it fails for every earlier event too. */
function fillActiveEffects(out: ReplayEffectState[], events: readonly NormalizedReplayEvent[], cursor: number, t: number): void {
  for (let i = cursor; i >= 0; i--) {
    const event = events[i];
    if (event.timeMs + EFFECT_WINDOW_MS <= t) break;
    out.push({ event });
  }
  out.reverse();
}

/** Largest index `i` such that `times[i] <= t`, given `times` is non-decreasing and non-empty. */
function lowerBoundIndex(times: Float64Array, t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  if (t <= times[0]) return 0;
  if (t >= times[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Index of the latest event at-or-before `t`, or `-1` if none (`t` is before the first event or
 * there are no events). Used both for `ReplaySample.eventCursor` and effect-window collection. */
function eventCursorAt(eventTimes: Float64Array, t: number): number {
  if (eventTimes.length === 0 || t < eventTimes[0]) return -1;
  return lowerBoundIndex(eventTimes, t);
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/** Shortest-arc yaw interpolation (README FR-50.5): wraps the raw `b - a` delta into `(-PI, PI]`
 * before scaling by `alpha`, so a yaw crossing `+PI`/`-PI` never spins the long way around. */
function lerpAngle(a: number, b: number, alpha: number): number {
  const TAU = Math.PI * 2;
  let delta = (b - a) % TAU;
  if (delta > Math.PI) delta -= TAU;
  else if (delta < -Math.PI) delta += TAU;
  return a + delta * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
