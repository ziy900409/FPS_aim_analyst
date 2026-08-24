import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';

export const WINDOW_EPSILON_MS = 1e-9;

export type VisibleEvent = Extract<DrillEvent, { type: 'visible' }>;
export type CounterEvent = Extract<DrillEvent, { type: 'counter' }>;
export type FireEvent = Extract<DrillEvent, { type: 'fire' }>;
export type CueEvent = Extract<DrillEvent, { type: 'cue' }>;

export interface PeekWindowTs {
  readonly index: number;
  readonly targetId: string;
  readonly side: 'L' | 'R';
  readonly tVisible: number;
  readonly tEnd: number;
  readonly tCounter?: number;
  readonly counterKey?: 'A' | 'D';
  readonly tRelease?: number;
  readonly releaseKey?: 'A' | 'D';
  readonly tFirstShot?: number;
  readonly fires: readonly number[];
  readonly tHit?: number;
  readonly outcome: 'hit' | 'timeout' | 'no_shot';
  readonly ads?: boolean;
  readonly flags: readonly string[];
  readonly visible: VisibleEvent;
  /** Cues issued for this target: foreperiod cues, or same-tick-visible reversal cues and their follow-up. */
  readonly cues: readonly CueEvent[];
  readonly nextVisible?: VisibleEvent;
  readonly counter?: CounterEvent;
  readonly firstFire?: FireEvent;
  readonly reactionMs?: number;
  readonly tickRange: { readonly start: number; readonly end: number };
}

export function buildPeekWindows(payload: Pick<ExportPayload, 'ticks' | 'events'>): PeekWindowTs[] {
  const events = payload.events.slice().sort((a, b) => a.t - b.t);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = events.filter((event): event is VisibleEvent => event.type === 'visible');
  const counterEvents = events.filter((event): event is CounterEvent => event.type === 'counter');
  const fireEvents = events.filter((event): event is FireEvent => event.type === 'fire');
  const cueEvents = events.filter((event): event is CueEvent => event.type === 'cue');
  const hitEvents = events.filter((event) => event.type === 'hit');
  const hitTimesByShot = hitTimesByShotSeq(hitEvents);

  return visibleEvents.map((visible, index) => {
    const nextVisible = visibleEvents[index + 1];
    const priorVisibleT = index === 0 ? -Infinity : visibleEvents[index - 1].t;
    const windowEnd = nextVisible?.t ?? Infinity;
    const tickRange = tickRangeForWindow(ticks, visible.t, windowEnd);
    const windowTicks = ticks.slice(tickRange.start, tickRange.end);
    const counters = counterEvents.filter((event) => event.t >= visible.t && event.t < windowEnd);
    const fires = fireEvents.filter((event) => event.t >= visible.t && event.t < windowEnd);
    const counter = counters[0];
    const firstFire = firstCompatibleFire(fires, visible.targetId);
    const reactionMs = counter !== undefined ? counter.t - visible.t : undefined;
    const flags: string[] = [];
    if (windowTicks.length === 0) flags.push('empty_window');
    if (counter === undefined) flags.push('no_counter');
    if (counters.length > 1) flags.push('multiple_counters');

    const counterKey = counter !== undefined ? normalizeStrafeKey(counter.key) : undefined;
    if (counter !== undefined && counterKey === undefined) flags.push('unsupported_counter_key');
    const [tRelease, releaseKey] =
      counter !== undefined && counterKey === undefined
        ? [undefined, undefined]
        : releaseAnchor(windowTicks, counterKey);
    if (counter === undefined && tRelease !== undefined) flags.push('release_inferred_no_counter');
    if (tRelease === undefined) flags.push('no_key_transition');
    if (firstFire === undefined) flags.push('no_first_shot');

    const fireTimes = fires.map((event) => event.t);
    const hitTimes = windowHitTimes(fires, hitTimesByShot);
    const tHit = hitTimes.length > 0 ? Math.min(...hitTimes) : undefined;
    if (hitTimes.some((hitTime) => hitTime >= windowEnd)) flags.push('hit_outside_window');
    const outcome = fireTimes.length === 0 ? 'no_shot' : hitTimes.length > 0 ? 'hit' : 'timeout';
    const ads = windowTicks.length > 0 ? windowTicks.some((tick) => tick.ads) : undefined;
    // single-cue protocols stamp the cue in the preceding foreperiod; hold-reversal stamps its
    // first cue in the same tick as visibility and its second cue later in this target window.
    // A same-tick cue unambiguously selects the latter association without adding target IDs to
    // the frozen cue event contract.
    const hasVisibleCue = cueEvents.some((event) => event.t === visible.t);
    const cues = hasVisibleCue
      ? cueEvents.filter((event) => event.t >= visible.t && event.t < windowEnd)
      : cueEvents.filter((event) => event.t >= priorVisibleT && event.t < visible.t);

    return {
      index,
      targetId: visible.targetId,
      side: visible.side,
      tVisible: visible.t,
      tEnd: windowEnd,
      tCounter: counter?.t,
      counterKey,
      tRelease,
      releaseKey,
      tFirstShot: firstFire?.t,
      fires: fireTimes,
      tHit,
      outcome,
      ads,
      flags: unique(flags),
      visible,
      cues,
      nextVisible,
      counter,
      firstFire,
      reactionMs,
      tickRange,
    };
  });
}

function tickRangeForWindow(
  ticks: readonly { readonly t: number }[],
  windowStart: number,
  windowEnd: number,
): { readonly start: number; readonly end: number } {
  const start = firstTickIndexAtOrAfter(ticks, windowStart);
  const end = Number.isFinite(windowEnd) ? firstTickIndexAtOrAfter(ticks, windowEnd) : ticks.length;
  return { start, end };
}

function firstTickIndexAtOrAfter(ticks: readonly { readonly t: number }[], t: number): number {
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i].t + WINDOW_EPSILON_MS >= t) return i;
  }
  return ticks.length;
}

function normalizeStrafeKey(value: string): 'A' | 'D' | undefined {
  return value === 'A' || value === 'D' ? value : undefined;
}

function releaseAnchor(
  ticks: readonly { readonly t: number; readonly keys: readonly string[] }[],
  counterKey: 'A' | 'D' | undefined,
): [number | undefined, 'A' | 'D' | undefined] {
  if (counterKey !== undefined) {
    const originalKey = counterKey === 'D' ? 'A' : 'D';
    const release = lastReleaseTransition(ticks, originalKey);
    return [release, release !== undefined ? originalKey : undefined];
  }

  const candidates = (['A', 'D'] as const)
    .map((key) => ({ key, release: lastReleaseTransition(ticks, key) }))
    .filter((candidate): candidate is { key: 'A' | 'D'; release: number } => candidate.release !== undefined);
  if (candidates.length === 0) return [undefined, undefined];
  candidates.sort((a, b) => a.release - b.release || a.key.localeCompare(b.key));
  const latest = candidates[candidates.length - 1];
  return [latest.release, latest.key];
}

function lastReleaseTransition(
  ticks: readonly { readonly t: number; readonly keys: readonly string[] }[],
  key: 'A' | 'D',
): number | undefined {
  let release: number | undefined;
  for (let i = 0; i < Math.max(ticks.length - 1, 0); i++) {
    const held = new Set(ticks[i].keys.map(String));
    const nextHeld = new Set(ticks[i + 1].keys.map(String));
    if (held.has(key) && !nextHeld.has(key)) release = ticks[i].t;
  }
  return release;
}

function firstCompatibleFire(fires: readonly FireEvent[], targetId: string): FireEvent | undefined {
  return fires.find(
    (event) => event.firstShot && (event.targetId === undefined || event.targetId === targetId),
  );
}

function hitTimesByShotSeq(hitEvents: readonly Extract<DrillEvent, { type: 'hit' }>[]): ReadonlyMap<number, readonly number[]> {
  const values = new Map<number, number[]>();
  for (const hit of hitEvents) {
    const shotSeq = hit.shotSeq;
    if (Number.isFinite(shotSeq)) {
      const times = values.get(shotSeq) ?? [];
      times.push(hit.t);
      values.set(shotSeq, times);
    }
  }
  return values;
}

function windowHitTimes(
  fires: readonly FireEvent[],
  hitTimesByShot: ReadonlyMap<number, readonly number[]>,
): number[] {
  const hitTimes: number[] = [];
  for (const fire of fires) {
    if (fire.hit) hitTimes.push(fire.t);
    if (fire.shotSeq !== undefined && Number.isFinite(fire.shotSeq)) {
      hitTimes.push(...(hitTimesByShot.get(fire.shotSeq) ?? []));
    }
  }
  return hitTimes;
}

function unique(flags: readonly string[]): string[] {
  return [...new Set(flags)];
}
