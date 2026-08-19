import type { ExportPayload } from '../data/export.ts';
import { angularEccentricityDeg, resolveEyeOrigin } from './eyeOrigin.ts';
import { buildPeekWindows } from './peekWindows.ts';

type TargetStopEvent = Extract<ExportPayload['events'][number], { type: 'target_stop' }>;
type FireEvent = Extract<ExportPayload['events'][number], { type: 'fire' }>;

export interface StopTransition {
  targetId: string;
  tStopMs: number;
  tFireMs?: number;
  fireToStopMs?: number;
  firstShotHitAfterStop?: boolean;
  fireAngleErrorDeg?: number;
}

/**
 * Derive hold-track stop-to-first-shot metrics from exported target_stop events. First-shot selection
 * deliberately reuses buildPeekWindows(), preserving the project's shared peek semantics.
 */
export function deriveStopTransitions(payload: ExportPayload): StopTransition[] {
  const stops = payload.events
    .filter((event): event is TargetStopEvent => event.type === 'target_stop')
    .slice()
    .sort((a, b) => a.t - b.t);
  const peeksByTarget = new Map(buildPeekWindows(payload).map((peek) => [peek.targetId, peek]));
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const eyeOrigin = resolveEyeOrigin(payload);

  return stops.map((stop) => {
    const firstFire = peeksByTarget.get(stop.targetId)?.firstFire;
    if (firstFire === undefined || firstFire.t < stop.t) return { targetId: stop.targetId, tStopMs: stop.t };

    return {
      targetId: stop.targetId,
      tStopMs: stop.t,
      tFireMs: firstFire.t,
      fireToStopMs: firstFire.t - stop.t,
      firstShotHitAfterStop: firstFire.hit,
      ...fireAngleError(firstFire, stop, ticks, eyeOrigin),
    };
  });
}

function fireAngleError(
  fire: FireEvent,
  stop: TargetStopEvent,
  ticks: readonly ExportPayload['ticks'][number][],
  eyeOrigin: ReturnType<typeof resolveEyeOrigin>,
): Pick<StopTransition, 'fireAngleErrorDeg'> {
  const tick = lastTickAtOrBefore(ticks, fire.t);
  if (tick === undefined) return {};
  return {
    fireAngleErrorDeg: angularEccentricityDeg(
      {
        px: tick.px,
        pz: tick.pz,
        aim: { yaw: fire.viewYaw ?? tick.aim.yaw, pitch: fire.viewPitch ?? tick.aim.pitch },
      },
      { x: stop.targetX, y: stop.targetY, z: stop.targetZ },
      eyeOrigin,
    ),
  };
}

function lastTickAtOrBefore<T extends { t: number }>(ticks: readonly T[], t: number): T | undefined {
  for (let index = ticks.length - 1; index >= 0; index--) {
    if (ticks[index].t <= t) return ticks[index];
  }
  return undefined;
}
