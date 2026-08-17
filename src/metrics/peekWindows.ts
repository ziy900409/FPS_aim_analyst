import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';

export const WINDOW_EPSILON_MS = 1e-9;

export type VisibleEvent = Extract<DrillEvent, { type: 'visible' }>;
export type CounterEvent = Extract<DrillEvent, { type: 'counter' }>;
export type FireEvent = Extract<DrillEvent, { type: 'fire' }>;

export interface PeekWindowTs {
  readonly index: number;
  readonly targetId: string;
  readonly side: 'L' | 'R';
  readonly tVisible: number;
  readonly tEnd: number;
  readonly visible: VisibleEvent;
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

  return visibleEvents.map((visible, index) => {
    const nextVisible = visibleEvents[index + 1];
    const windowEnd = nextVisible?.t ?? Infinity;
    const counter = counterEvents.find((event) => event.t >= visible.t && event.t < windowEnd);
    const firstFire = fireEvents.find(
      (event) =>
        event.firstShot &&
        event.t >= visible.t &&
        event.t < windowEnd &&
        (event.targetId === undefined || event.targetId === visible.targetId),
    );
    const reactionMs = counter !== undefined ? counter.t - visible.t : undefined;
    return {
      index,
      targetId: visible.targetId,
      side: visible.side,
      tVisible: visible.t,
      tEnd: windowEnd,
      visible,
      nextVisible,
      counter,
      firstFire,
      reactionMs,
      tickRange: tickRangeForWindow(ticks, visible.t, windowEnd),
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
