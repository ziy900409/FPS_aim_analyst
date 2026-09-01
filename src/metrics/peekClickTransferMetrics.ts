import type { ExportPayload } from '../data/export.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { isOutsideCorridor } from '../scene/corridor.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { deriveCounterstrafeMetrics, type CounterstrafeMetrics } from './counterstrafeMetrics.ts';
import { deriveHoldClickMetrics, type HoldClickMetricsOptions } from './holdClickMetrics.ts';
import { buildPeekWindows, type PeekWindowTs } from './peekWindows.ts';

const EPSILON = 1e-9;

export interface PeekClickTransferPresentation {
  readonly targetId: string;
  readonly side: 'L' | 'R';
  /** WP-52 T5: this presentation's hitbox width (u), when the drill's hitbox varies by presentation
   * (`hitboxCandidates`); omitted for a fixed-hitbox drill, whose value lives in `meta.targets.hitbox`. */
  readonly hitboxWidthU?: number;
  readonly tMeasurementOnsetMs?: number;
  readonly tFirstShotMs?: number;
  readonly onsetToFirstShotMs?: number;
  readonly onsetToHitMs?: number;
  readonly shotsToKill?: number;
  readonly firstShotHit: boolean;
  readonly validFirstShot: boolean;
  readonly flags: readonly string[];
}

export interface PeekClickTransferMetrics {
  readonly presentations: readonly PeekClickTransferPresentation[];
  readonly validFirstShotRate: number;
  readonly firstShotHitRate: number;
  readonly fireBeforeGateRate: number;
  readonly counterstrafe: CounterstrafeMetrics;
  readonly anticipationRate: number;
}

/**
 * Assembles the self-motion-exposure transfer test from frozen hold-click exposure/acquisition and
 * counter-strafe braking/sync results, joined by `targetId`; only `validFirstShot`/`shotsToKill`/
 * onset-relative timings and flags are newly derived here. Never exports a composite score.
 */
export function derivePeekClickTransferMetrics(
  payload: ExportPayload,
  scene: SceneConfig,
  options: HoldClickMetricsOptions,
): PeekClickTransferMetrics {
  const holdClick = deriveHoldClickMetrics(payload, scene, options);
  const counterstrafe = deriveCounterstrafeMetrics(payload);
  const peeks = buildPeekWindows(payload);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const holdClickByTargetId = new Map(holdClick.presentations.map((presentation) => [presentation.targetId, presentation]));

  const presentations = peeks.map((peek) => {
    const holdClickPresentation = holdClickByTargetId.get(peek.targetId);
    const tMeasurementOnsetMs = holdClickPresentation?.tMeasurementOnsetMs;
    const tFirstShotMs = holdClickPresentation?.tFirstShotMs;
    const tHit = peek.tHit;
    const firstShotHit = holdClickPresentation?.firstShotHit ?? false;
    const validFirstShot =
      peek.firstFire !== undefined &&
      peek.firstFire.hit &&
      tFirstShotMs !== undefined &&
      tMeasurementOnsetMs !== undefined &&
      tFirstShotMs + EPSILON >= tMeasurementOnsetMs &&
      peek.firstFire.residualSpeed < CS2_PROFILE.accuracyThreshold;
    const shotsToKill =
      peek.outcome === 'hit' && tHit !== undefined
        ? peek.fires.filter((fireTime) => fireTime <= tHit + EPSILON).length
        : undefined;
    const fireBeforeGate = peek.firstFire !== undefined && peek.firstFire.residualSpeed >= CS2_PROFILE.accuracyThreshold;
    const timeout = peek.outcome !== 'hit';
    const corridorExceeded = windowExceedsCorridor(ticks, peek, scene, payload.meta.simToWorld);

    const flags: string[] = [];
    if (holdClickPresentation?.fireBeforeFirstVisible === true) flags.push('fire_before_first_visible');
    if (holdClickPresentation?.fireBeforeMeasurementOnset === true) flags.push('fire_before_measurement_onset');
    if (tMeasurementOnsetMs === undefined) flags.push('no_measurement_onset');
    if (peek.flags.includes('no_counter')) flags.push('no_counter');
    if (fireBeforeGate) flags.push('fire_before_gate');
    if (timeout) flags.push('timeout');
    if (timeout && tMeasurementOnsetMs === undefined) flags.push('timeout_before_onset');
    if (corridorExceeded) flags.push('player_corridor_exceeded');
    if (payload.meta.suspect) flags.push('suspect');

    return {
      targetId: peek.targetId,
      side: peek.side,
      ...(peek.visible.hitboxWidthU !== undefined ? { hitboxWidthU: peek.visible.hitboxWidthU } : {}),
      ...(tMeasurementOnsetMs !== undefined ? { tMeasurementOnsetMs } : {}),
      ...(tFirstShotMs !== undefined ? { tFirstShotMs } : {}),
      ...(tFirstShotMs !== undefined && tMeasurementOnsetMs !== undefined
        ? { onsetToFirstShotMs: tFirstShotMs - tMeasurementOnsetMs }
        : {}),
      ...(tHit !== undefined && tMeasurementOnsetMs !== undefined ? { onsetToHitMs: tHit - tMeasurementOnsetMs } : {}),
      ...(shotsToKill !== undefined ? { shotsToKill } : {}),
      firstShotHit,
      validFirstShot,
      flags: unique(flags),
    };
  });

  const validCount = presentations.filter((presentation) => presentation.validFirstShot).length;

  return {
    presentations,
    validFirstShotRate: presentations.length > 0 ? validCount / presentations.length : 0,
    firstShotHitRate: counterstrafe.firstShotHitRate,
    fireBeforeGateRate: counterstrafe.fireBeforeGateRate,
    counterstrafe,
    anticipationRate: holdClick.anticipationRate,
  };
}

function windowExceedsCorridor(
  ticks: readonly ExportPayload['ticks'][number][],
  peek: PeekWindowTs,
  scene: SceneConfig,
  simToWorld: number | undefined,
): boolean {
  if (simToWorld === undefined) return false;
  const windowTicks = ticks.slice(peek.tickRange.start, peek.tickRange.end);
  return windowTicks.some((tick) => isOutsideCorridor(tick.px, scene.playerCorridor.halfWidthU, simToWorld));
}

function unique(flags: readonly string[]): string[] {
  return [...new Set(flags)];
}
