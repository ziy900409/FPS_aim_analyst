import type { DataRecorderSnapshot, DrillEvent } from '../data/DataRecorder.ts';

export interface Stat {
  mean: number;
  p50: number;
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
  recoilCompensationError: CompensationError;
  switchTimeMs: Stat;
  rhythmStability: number;
  leftRightSymmetry: { left: Stat; right: Stat; diff: number };
}

export interface AimOffset {
  pitchDeg: number;
  yawDeg: number;
}

export interface PunchSample {
  aimPunchPitch: number;
  aimPunchYaw: number;
}

export interface CompensationError {
  meanDeg: number;
  rmsDeg: number;
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
  const recoilCompensationError = computeRecoilCompensationError(fireEvents);
  const switchTimes = computeSwitchTimes(fireEvents);
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
    recoilCompensationError,
    switchTimeMs: stat(switchTimes),
    rhythmStability: coefficientOfVariation(rhythmIntervals),
    leftRightSymmetry: {
      left,
      right,
      diff: left.n > 0 && right.n > 0 ? Math.abs(left.mean - right.mean) : 0,
    },
  };
}

export function buildIdealPath(punchSeq: readonly PunchSample[]): AimOffset[] {
  const path = new Array<AimOffset>(punchSeq.length);
  for (let i = 0; i < punchSeq.length; i++) {
    const punch = punchSeq[i];
    path[i] = {
      pitchDeg: mirrorPunch(punch.aimPunchPitch),
      yawDeg: mirrorPunch(punch.aimPunchYaw),
    };
  }
  return path;
}

export function compensationError(aimSeq: readonly AimOffset[], idealSeq: readonly AimOffset[]): CompensationError {
  const count = Math.min(aimSeq.length, idealSeq.length);
  if (count === 0) return { meanDeg: 0, rmsDeg: 0 };

  let sum = 0;
  let sumSquares = 0;
  let valid = 0;
  for (let i = 0; i < count; i++) {
    const pitchDelta = aimSeq[i].pitchDeg - idealSeq[i].pitchDeg;
    const yawDelta = aimSeq[i].yawDeg - idealSeq[i].yawDeg;
    if (!Number.isFinite(pitchDelta) || !Number.isFinite(yawDelta)) continue;

    const error = Math.hypot(pitchDelta, yawDelta);
    sum += error;
    sumSquares += error * error;
    valid++;
  }

  return valid > 0 ? { meanDeg: sum / valid, rmsDeg: Math.sqrt(sumSquares / valid) } : { meanDeg: 0, rmsDeg: 0 };
}

export function stat(values: readonly number[]): Stat {
  const finite = finiteValues(values);
  if (finite.length === 0) return { mean: 0, p50: 0, sd: 0, n: 0, values: [] };

  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  return { mean, p50: percentile(finite, 0.5), sd: Math.sqrt(variance), n: finite.length, values: finite };
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

// 切換時間 = t_next_acquisition − t_prev_kill（CONTEXT:23）：擊殺一目標，到「對下一目標有效對齊」
// 的時間。有效對齊以玩家實際動作為錨——擊殺後對「不同目標」的第一個首發 fire——而非目標補生
// 瞬間（spawnDelayMs=0 下，用 t_next_visible 會塌縮成 1~2 tick 的引擎 respawn latency，非玩家技能）。
function computeSwitchTimes(fireEvents: readonly FireEvent[]): number[] {
  const values: number[] = [];
  for (let i = 0; i < fireEvents.length; i++) {
    const kill = fireEvents[i];
    if (!kill.hit) continue;
    const acquisition = fireEvents.find(
      (fire, j) => j > i && fire.firstShot && fire.targetId !== undefined && fire.targetId !== kill.targetId,
    );
    if (acquisition !== undefined) values.push(acquisition.t - kill.t);
  }
  return values;
}

function computeRecoilCompensationError(fireEvents: readonly FireEvent[]): CompensationError {
  const aimSeq: AimOffset[] = [];
  const punchSeq: PunchSample[] = [];
  let baseViewPitch = 0;
  let baseViewYaw = 0;

  for (const event of fireEvents) {
    if (
      event.viewPitch === undefined ||
      event.viewYaw === undefined ||
      event.aimPunchPitch === undefined ||
      event.aimPunchYaw === undefined
    ) {
      continue;
    }

    if (aimSeq.length === 0) {
      baseViewPitch = event.viewPitch;
      baseViewYaw = event.viewYaw;
    }

    aimSeq.push({
      pitchDeg: radToDeg(event.viewPitch - baseViewPitch),
      yawDeg: radToDeg(shortestAngleDeltaRad(event.viewYaw, baseViewYaw)),
    });
    punchSeq.push({
      aimPunchPitch: event.aimPunchPitch,
      aimPunchYaw: event.aimPunchYaw,
    });
  }

  return compensationError(aimSeq, buildIdealPath(punchSeq));
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

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function mirrorPunch(value: number): number {
  const mirrored = -value * 2;
  return Object.is(mirrored, -0) ? 0 : mirrored;
}

function shortestAngleDeltaRad(value: number, origin: number): number {
  return Math.atan2(Math.sin(value - origin), Math.cos(value - origin));
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;

  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
