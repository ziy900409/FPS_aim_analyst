import { createRecoilState, recoilOnFire, recoilTick } from '../recoil/punch.ts';
import { generateRecoilTable, type RecoilTableEntry } from '../recoil/recoilTable.ts';
import { punchToThreeRad } from '../recoil/adapter.ts';
import type { WeaponConfig } from '../weapon/WeaponConfig.ts';
import type { ReplayRecording, ReplaySample } from './contracts.ts';

/**
 * WP-50 / T4 (D-50-P6/D-50-P15) — reconstructs the per-tick visual recoil punch
 * (`aimPunchPitchDeg`/`aimPunchYawDeg`, Source-deg convention) for an entire recording, by replaying
 * `recoilTick`/`recoilOnFire` (`src/recoil/punch.ts`) in tick order — the exact functions and cadence
 * `simStep` uses (128Hz sim, 64Hz decay sub-cadence on even tick index, decay before that tick's own
 * fires). `recording.ticks[i]` is assumed to be sim tickIndex `i` of the SimLoop that produced this
 * recording: `main.ts` always builds a fresh `SimLoop`/`DataRecorder` pair per drill run (`tickIndex`
 * and the recorder both reset to 0 together), so a full recording's tick array position always lines
 * up with the original tickIndex parity — this is what T0's PoC already established for pure-function
 * recoil replay-from-any-tick parity (`recoil-seek-purity` finding, README §0 PoC Evidence item 1).
 *
 * `pitchDeg[i]`/`yawDeg[i]` store the **end-of-tick-i** punch snapshot — the same boundary
 * `state.recoil.curr` captures live (`SimLoop.ts` `simStep`). Consecutive recorded ticks are already
 * each one full-tick snapshot (mirrors how `NormalizedReplayTick.px/pz/yaw/pitch` are themselves the
 * per-tick prev/curr boundary, per `sampleReplay.ts`), so `samplePunchDeg` below can lerp between two
 * adjacent entries exactly the way `sampleReplay` lerps `px`/`pz`/yaw/pitch — no separate prev/curr
 * bookkeeping needed.
 */
export interface ReplayPunchTimeline {
  readonly pitchDeg: Float64Array;
  readonly yawDeg: Float64Array;
}

export function buildReplayPunchTimeline(
  recording: ReplayRecording,
  weapon: WeaponConfig,
  table: readonly RecoilTableEntry[] = generateRecoilTable(weapon.recoil),
): ReplayPunchTimeline {
  const n = recording.ticks.length;
  const pitchDeg = new Float64Array(n);
  const yawDeg = new Float64Array(n);
  const state = createRecoilState();
  const events = recording.events;
  let eventIndex = 0;

  for (let i = 0; i < n; i++) {
    if ((i & 1) === 0) recoilTick(state, 1 / 64);
    const tickEndMs = recording.tickTimes[i];
    // Half-open-window catch-up (GD-3): every fire scheduled at-or-before this tick's end has, by
    // construction, already fired by the time the original simStep call for tick i returned — mirrors
    // `scheduleFire`'s own `untilMs = tickEndMs` catch-up call at the end of each tick.
    while (eventIndex < events.length && events[eventIndex].timeMs <= tickEndMs) {
      if (events[eventIndex].raw.type === 'fire') recoilOnFire(state, weapon, table);
      eventIndex++;
    }
    pitchDeg[i] = state.aimPunchPitchDeg;
    yawDeg[i] = state.aimPunchYawDeg;
  }

  return { pitchDeg, yawDeg };
}

/** Linear-interpolated punch (Source deg) at a `ReplaySample`'s own `(tickBefore, tickAfter, alpha)`
 * — mirrors the live `recoil.prev/curr` lerp in `main.ts` `liveFrame` exactly (same tick boundaries,
 * same lerp), just reading from the reconstructed timeline instead of `SharedState.recoil`. */
export function samplePunchDeg(
  timeline: ReplayPunchTimeline,
  tickBefore: number,
  tickAfter: number,
  alpha: number,
): { readonly pitchDeg: number; readonly yawDeg: number } {
  const pitchDeg = lerp(timeline.pitchDeg[tickBefore], timeline.pitchDeg[tickAfter], alpha);
  const yawDeg = lerp(timeline.yawDeg[tickBefore], timeline.yawDeg[tickAfter], alpha);
  return { pitchDeg, yawDeg };
}

export interface ReplayCameraVisualState {
  /** three local-X punch offset (rad) to add on top of the sampled base pitch before composing the
   * camera quaternion — must be summed with base pitch/yaw BEFORE `qYaw`/`qPitch` are built
   * (`ReplaySceneAdapter#applySample`), not multiplied in afterward: `qYaw(a)·qPitch(b)` does not
   * commute with a separately-composed `qYaw(c)·qPitch(d)` for different axes, so post-multiplying a
   * punch quaternion would NOT reproduce live's single combined `qYaw(yaw+punchYaw)·qPitch(pitch+
   * punchPitch)` composition (`CameraController#applyToCamera`). */
  readonly punchPitchRad: number;
  readonly punchYawRad: number;
  readonly fovDeg: number;
  readonly adsActive: boolean;
}

/** Maps a sample + the weapon's precomputed punch timeline to what `ReplaySceneAdapter` needs to
 * reproduce the live camera's ADS FOV / recoil punch (WP-50 / T4 step 2). No render-frame transition
 * accumulator (README T4 Steps #2, "seek 不依賴前一 render frame transition accumulator") — FOV is a
 * pure function of the sampled tick's `ads` flag, not a 120ms lerp like live `CameraController#setAds`
 * (that transition is a render-only visual nicety on top of a live, continuously-advancing clock;
 * replay's `t` can jump arbitrarily via seek, so a stored "previous FOV" would make the same `t`
 * render differently depending on playback history — violating FR-50.10 seek purity). */
export function resolveReplayCameraVisualState(
  sample: ReplaySample,
  timeline: ReplayPunchTimeline,
  weapon: WeaponConfig,
  hipFovDeg: number,
): ReplayCameraVisualState {
  const punch = samplePunchDeg(timeline, sample.tickBefore, sample.tickAfter, sample.alpha);
  const rad = punchToThreeRad(punch.pitchDeg, punch.yawDeg);
  const adsActive = sample.input.ads && weapon.ads !== undefined;
  return {
    punchPitchRad: rad.pitchRad,
    punchYawRad: rad.yawRad,
    fovDeg: adsActive && weapon.ads !== undefined ? weapon.ads.fovDeg : hipFovDeg,
    adsActive,
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}
