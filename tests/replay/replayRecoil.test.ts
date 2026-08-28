import { describe, expect, it } from 'vitest';
import { createRecoilState, recoilOnFire, recoilTick } from '../../src/recoil/punch.ts';
import { generateRecoilTable } from '../../src/recoil/recoilTable.ts';
import { punchToThreeRad } from '../../src/recoil/adapter.ts';
import { ak47, m4a4 } from '../../src/weapon/weapons.ts';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import {
  buildReplayPunchTimeline,
  resolveReplayCameraVisualState,
  samplePunchDeg,
  type ReplayPunchTimeline,
} from '../../src/replay/replayRecoil.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import { makeMeta, makePayload, makeTick } from './fixtures.ts';

const TICK_MS = 1000 / 128;
const table = generateRecoilTable(ak47.recoil);

/** Independent reference replay (same functions/cadence `buildReplayPunchTimeline` uses, but driven
 * tick-by-tick here instead of bucketed from an events array) — the oracle this suite checks the
 * module under test against. `fireAtTick` may list the same tick index more than once (full-auto
 * catch-up: multiple fires resolved within one tick's half-open window). */
function reference(tickCount: number, fireAtTick: readonly number[]) {
  const state = createRecoilState();
  const currPitch: number[] = [];
  const currYaw: number[] = [];
  const fireEvents: DrillEvent[] = [];
  let fireCursor = 0;

  for (let i = 0; i < tickCount; i++) {
    if ((i & 1) === 0) recoilTick(state, 1 / 64);
    while (fireCursor < fireAtTick.length && fireAtTick[fireCursor] === i) {
      fireEvents.push({
        type: 'fire',
        t: i * TICK_MS,
        hit: false,
        firstShot: false,
        residualSpeed: 0,
        aimPunchPitch: state.aimPunchPitchDeg,
        aimPunchYaw: state.aimPunchYawDeg,
      });
      recoilOnFire(state, ak47, table);
      fireCursor++;
    }
    currPitch.push(state.aimPunchPitchDeg);
    currYaw.push(state.aimPunchYawDeg);
  }

  return { currPitch, currYaw, fireEvents };
}

function buildTimeline(tickCount: number, fireEvents: readonly DrillEvent[]): ReplayPunchTimeline {
  const ticks = Array.from({ length: tickCount }, (_, i) => makeTick({ t: i * TICK_MS }));
  const payload = makePayload({ meta: makeMeta({ weaponId: 'ak47' }), ticks, events: fireEvents });
  const result = normalizeReplayRecording(payload);
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
  return buildReplayPunchTimeline(result.recording, ak47, table);
}

describe('WP-50 T4 — buildReplayPunchTimeline', () => {
  it('reproduces a tick-by-tick recoilTick/recoilOnFire reference replay exactly, including multiple fires within one tick', () => {
    // Ticks 4 (even, catch-up second shot) get two fires resolved in the same tick's window;
    // 10/11 are consecutive ticks (odd/even) each with one fire — exercises decay ordering too.
    const ref = reference(30, [4, 4, 10, 11, 20]);
    const timeline = buildTimeline(30, ref.fireEvents);

    expect(Array.from(timeline.pitchDeg)).toEqual(ref.currPitch);
    expect(Array.from(timeline.yawDeg)).toEqual(ref.currYaw);
  });

  it('with zero fire events, decays smoothly to (and stays at) zero — matches an unfired weapon', () => {
    const ref = reference(20, []);
    const timeline = buildTimeline(20, ref.fireEvents);
    expect(Array.from(timeline.pitchDeg)).toEqual(new Array(20).fill(0));
    expect(Array.from(timeline.yawDeg)).toEqual(new Array(20).fill(0));
  });

  it('the pre-kick punch at a single fire matches the value recorded on the fire DrillEvent (production convention)', () => {
    // Tick 5 is odd -> no decay call happens for tick 5 itself, so the state right before this
    // fire equals tick 4's end-of-tick snapshot exactly (SimLoop.ts: decay precedes consume/fire
    // within the SAME tick only; it does not reach across into the next tick).
    const ref = reference(10, [5]);
    const timeline = buildTimeline(10, ref.fireEvents);
    const fireEvent = ref.fireEvents[0] as Extract<DrillEvent, { type: 'fire' }>;

    expect(timeline.pitchDeg[4]).toBe(fireEvent.aimPunchPitch);
    expect(timeline.yawDeg[4]).toBe(fireEvent.aimPunchYaw);
  });
});

describe('WP-50 T4 — samplePunchDeg', () => {
  it('linearly interpolates between the two tick-boundary punch snapshots (mirrors sampleReplay field lerp)', () => {
    const timeline: ReplayPunchTimeline = { pitchDeg: Float64Array.from([0, 10]), yawDeg: Float64Array.from([0, -4]) };
    const mid = samplePunchDeg(timeline, 0, 1, 0.25);
    expect(mid.pitchDeg).toBeCloseTo(2.5, 10);
    expect(mid.yawDeg).toBeCloseTo(-1, 10);
  });
});

describe('WP-50 T4 — resolveReplayCameraVisualState', () => {
  const timeline: ReplayPunchTimeline = { pitchDeg: Float64Array.from([-8]), yawDeg: Float64Array.from([2]) };
  function sampleWith(ads: boolean) {
    return {
      timeMs: 0,
      tickBefore: 0,
      tickAfter: 0,
      alpha: 0,
      camera: { yaw: 0, pitch: 0 },
      player: { px: 0, pz: 0, speed: 0 },
      input: { keys: [], ads },
      targets: [],
      effects: [],
      eventCursor: -1,
    };
  }

  it('hip (ads=false): fovDeg = hipFovDeg, adsActive=false, punch converted via punchToThreeRad', () => {
    const state = resolveReplayCameraVisualState(sampleWith(false), timeline, ak47, 103);
    expect(state.adsActive).toBe(false);
    expect(state.fovDeg).toBe(103);
    const expected = punchToThreeRad(-8, 2);
    expect(state.punchPitchRad).toBeCloseTo(expected.pitchRad, 12);
    expect(state.punchYawRad).toBeCloseTo(expected.yawRad, 12);
  });

  it('ads=true with a weapon that has ADS optics: fovDeg = weapon.ads.fovDeg, adsActive=true', () => {
    const state = resolveReplayCameraVisualState(sampleWith(true), timeline, ak47, 103);
    expect(state.adsActive).toBe(true);
    expect(state.fovDeg).toBe(ak47.ads?.fovDeg);
  });

  it('ads=true but the weapon has no ADS optics: stays hip (no-op ADS, matches CameraController#setAds)', () => {
    const state = resolveReplayCameraVisualState(sampleWith(true), timeline, m4a4, 103);
    expect(state.adsActive).toBe(false);
    expect(state.fovDeg).toBe(103);
  });
});
