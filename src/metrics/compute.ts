import type { DataRecorderSnapshot, DrillEvent } from '../data/DataRecorder.ts';

export interface Stat {
  mean: number;
  sd: number;
  n: number;
  values?: number[];
}

export interface Metrics {
  counterReactionMs: Stat;
  residualSpeed: Stat;
  fireTimingAlignmentMs: Stat;
  firstShotHitRate: number;
  crosshairOffset: Stat;
  switchTimeMs: Stat;
  rhythmStability: number;
  leftRightSymmetry: { left: Stat; right: Stat; diff: number };
}

type VisibleEvent = Extract<DrillEvent, { type: 'visible' }>;
type CounterEvent = Extract<DrillEvent, { type: 'counter' }>;
type FireEvent = Extract<DrillEvent, { type: 'fire' }>;

interface PeekWindow {
  visible: VisibleEvent;
  nextVisible?: VisibleEvent;
  counter?: CounterEvent;
  firstFire?: FireEvent;
  reactionMs?: number;
}

export function computeMetrics(snapshot: DataRecorderSnapshot): Metrics {
  const events = snapshot.events.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = events.filter((event): event is VisibleEvent => event.type === 'visible');
  const counterEvents = events.filter((event): event is CounterEvent => event.type === 'counter');
  const fireEvents = events.filter((event): event is FireEvent => event.type === 'fire');

  const peeks = buildPeekWindows(visibleEvents, counterEvents, fireEvents);
  const reactions = finiteValues(peeks.map((peek) => peek.reactionMs));
  const firstShotFires = peeks.map((peek) => peek.firstFire).filter((fire): fire is FireEvent => fire !== undefined);

  const residualSpeeds = finiteValues(fireEvents.map((event) => event.residualSpeed));
  const fireAlignments = finiteValues(
    peeks.map((peek) =>
      peek.counter !== undefined && peek.firstFire !== undefined ? peek.firstFire.t - peek.counter.t : undefined,
    ),
  );
  const offsets = finiteValues(fireEvents.map((event) => event.offsetDeg));
  const switchTimes = computeSwitchTimes(visibleEvents, fireEvents);
  const rhythmIntervals = computeVisibleIntervals(visibleEvents);
  const leftReactions = finiteValues(peeks.filter((peek) => peek.visible.side === 'L').map((peek) => peek.reactionMs));
  const rightReactions = finiteValues(peeks.filter((peek) => peek.visible.side === 'R').map((peek) => peek.reactionMs));
  const left = stat(leftReactions);
  const right = stat(rightReactions);

  return {
    counterReactionMs: stat(reactions),
    residualSpeed: stat(residualSpeeds),
    fireTimingAlignmentMs: stat(fireAlignments),
    firstShotHitRate: visibleEvents.length > 0 ? (firstShotFires.filter((fire) => fire.hit).length / visibleEvents.length) * 100 : 0,
    crosshairOffset: stat(offsets),
    switchTimeMs: stat(switchTimes),
    rhythmStability: coefficientOfVariation(rhythmIntervals),
    leftRightSymmetry: {
      left,
      right,
      diff: left.n > 0 && right.n > 0 ? Math.abs(left.mean - right.mean) : 0,
    },
  };
}

export function stat(values: readonly number[]): Stat {
  const finite = finiteValues(values);
  if (finite.length === 0) return { mean: 0, sd: 0, n: 0, values: [] };

  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  return { mean, sd: Math.sqrt(variance), n: finite.length, values: finite };
}

function buildPeekWindows(
  visibleEvents: readonly VisibleEvent[],
  counterEvents: readonly CounterEvent[],
  fireEvents: readonly FireEvent[],
): PeekWindow[] {
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
    return { visible, nextVisible, counter, firstFire, reactionMs };
  });
}

function computeSwitchTimes(visibleEvents: readonly VisibleEvent[], fireEvents: readonly FireEvent[]): number[] {
  const values: number[] = [];
  for (const fire of fireEvents) {
    if (!fire.hit) continue;
    const nextVisible = visibleEvents.find((visible) => visible.t > fire.t && visible.targetId !== fire.targetId);
    if (nextVisible !== undefined) values.push(nextVisible.t - fire.t);
  }
  return values;
}

function computeVisibleIntervals(visibleEvents: readonly VisibleEvent[]): number[] {
  const values: number[] = [];
  for (let i = 1; i < visibleEvents.length; i++) {
    values.push(visibleEvents[i].t - visibleEvents[i - 1].t);
  }
  return values;
}

function coefficientOfVariation(values: readonly number[]): number {
  const summary = stat(values);
  return summary.n > 0 && summary.mean !== 0 ? summary.sd / summary.mean : 0;
}

function finiteValues(values: readonly (number | undefined)[]): number[] {
  return values.filter((value): value is number => value !== undefined && Number.isFinite(value));
}
