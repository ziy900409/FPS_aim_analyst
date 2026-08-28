import type { ExportPayload } from '../data/export.ts';
import { classifyReplaySupport } from './replayCompatibility.ts';
import type { NormalizedReplayEvent, NormalizedReplayTick, ReplayRecording, ReplaySceneDescriptor } from './contracts.ts';

export interface NormalizeReplayRecordingOptions {
  readonly runId?: string;
}

export type NormalizeReplayResult =
  | { readonly ok: true; readonly recording: ReplayRecording }
  | { readonly ok: false; readonly status: 'unsupported'; readonly reasonCodes: readonly string[] };

/**
 * WP-50 / T2 — strict `ExportPayload -> ReplayRecording` normalizer (README §2.5). Builds the
 * immutable, time-origin-zeroed recording plus its typed binary-search indexes once; `sampleReplay`
 * never re-scans the full tick/event arrays (NFR-50.2).
 *
 * `classifyReplaySupport` already gates `unsupported` on a trustworthy camera timeline (non-empty,
 * monotonic ticks) for every registered profile's `minimumPlayable` (README §2.4/D-50-P10) — so by
 * the time this function proceeds past that check, `payload.ticks` is guaranteed non-empty and
 * non-decreasing in `t`. This function does not re-validate finiteness: `ExportPayload` is only ever
 * constructed by `parseExportPayload`'s strict boundary, which already rejects non-finite fields.
 */
export function normalizeReplayRecording(payload: ExportPayload, options: NormalizeReplayRecordingOptions = {}): NormalizeReplayResult {
  const support = classifyReplaySupport(payload);
  if (support.status === 'unsupported') {
    return { ok: false, status: 'unsupported', reasonCodes: support.reasonCodes };
  }

  const originMs = payload.ticks[0].t;

  const tickTimes = new Float64Array(payload.ticks.length);
  const ticks: NormalizedReplayTick[] = new Array(payload.ticks.length);
  for (let i = 0; i < payload.ticks.length; i++) {
    const tick = payload.ticks[i];
    const timeMs = tick.t - originMs;
    tickTimes[i] = timeMs;
    ticks[i] = {
      timeMs,
      px: tick.px,
      pz: tick.pz,
      vx: tick.vx,
      vz: tick.vz,
      yaw: tick.aim.yaw,
      pitch: tick.aim.pitch,
      keys: tick.keys,
      ads: tick.ads,
      targetId: tick.replayTargetId ?? null,
      tx: tick.tx,
      ty: tick.ty,
      tz: tick.tz,
    };
  }

  // Stable sort by (timeMs, original array position) — README §2.5 "duplicate timestamps 採 stable
  // source-order"; `sourceIndex` records the pre-sort position so a caller can still reference the
  // original `payload.events` array position (e.g. for debugging) after reordering.
  const sortedIndices = payload.events.map((_, index) => index).sort((a, b) => {
    const byTime = payload.events[a].t - payload.events[b].t;
    return byTime !== 0 ? byTime : a - b;
  });

  const eventTimes = new Float64Array(sortedIndices.length);
  const events: NormalizedReplayEvent[] = new Array(sortedIndices.length);
  for (let i = 0; i < sortedIndices.length; i++) {
    const sourceIndex = sortedIndices[i];
    const raw = payload.events[sourceIndex];
    const timeMs = raw.t - originMs;
    eventTimes[i] = timeMs;
    events[i] = { timeMs, sourceIndex, raw };
  }

  const durationMs = tickTimes[tickTimes.length - 1];

  return {
    ok: true,
    recording: {
      ...(options.runId !== undefined ? { runId: options.runId } : {}),
      drillId: payload.meta.drillId,
      durationMs,
      support,
      ticks,
      tickTimes,
      events,
      eventTimes,
      ...(payload.meta.scene !== undefined ? { scene: toSceneDescriptor(payload.meta.scene) } : {}),
      // WP-50 / T4: pass-through only — no defaulting here (README §2.7 keeps normalization and
      // hitbox/FOV fallback resolution separate; `ReplayTargetView`/`replayRecoil.ts` own the defaults).
      weaponId: payload.meta.weaponId,
      ...(payload.meta.targets?.hitbox !== undefined ? { targetHitbox: payload.meta.targets.hitbox } : {}),
      ...(payload.meta.fovDeg !== undefined ? { hipFovDeg: payload.meta.fovDeg } : {}),
    },
  };
}

function toSceneDescriptor(scene: NonNullable<ExportPayload['meta']['scene']>): ReplaySceneDescriptor {
  return {
    sceneId: scene.sceneId,
    assetPackVersion: scene.assetPackVersion,
    clutterTier: scene.clutterTier,
    fallback: scene.fallback,
    ...(scene.eye !== undefined ? { eye: scene.eye } : {}),
  };
}
