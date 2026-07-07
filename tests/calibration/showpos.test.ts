import { describe, expect, it } from 'vitest';
import accelFixture from '../golden/calibration/clshowpos-accel.json';
import stopFixture from '../golden/calibration/clshowpos-stop.json';
import { simStep } from '../../src/loop/SimLoop.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { CS2_PROFILE } from '../../src/sim/MovementController.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';

const SHOWPOS_TOLERANCE_U_PER_S = 1;
const FIXTURE_HZ = 64;
const SIM_TICKS_PER_FIXTURE_TICK = SIM_HZ / FIXTURE_HZ;

interface FixtureMeta {
  sourceType: string;
  tickrate: number;
  dtSec: number;
  constants: {
    svAccelerate: number;
    svFriction: number;
    svStopSpeed: number;
  };
  methodologyNotes: string[];
}

interface ShowposSample {
  tick: number;
  velocity: number;
  speed: number;
}

interface ShowposSeries {
  profileId: string;
  maxSpeed: number;
  wishspeed: number;
  samples: ShowposSample[];
  zeroCrossing?: {
    betweenTicks: [number, number];
    estimatedTick: number;
  };
}

interface ShowposFixture {
  meta: FixtureMeta;
  primary: ShowposSeries;
}

function assertFixtureMeta(fixture: ShowposFixture): void {
  expect(fixture.meta.sourceType).toBe('theory-derived-surrogate');
  expect(fixture.meta.tickrate).toBe(FIXTURE_HZ);
  expect(fixture.meta.dtSec).toBe(1 / FIXTURE_HZ);
  expect(fixture.meta.methodologyNotes.join('\n')).toContain('not a cl_showpos recording');
  expect(fixture.primary.profileId).toBe('knife_250');
  expect(fixture.primary.maxSpeed).toBe(CS2_PROFILE.maxSpeed);
}

function assertProductionProfileMatchesFixture(fixture: ShowposFixture): void {
  expect(CS2_PROFILE.accelerate).toBe(fixture.meta.constants.svAccelerate);
  expect(CS2_PROFILE.friction).toBe(fixture.meta.constants.svFriction);
  expect(CS2_PROFILE.stopSpeed).toBe(fixture.meta.constants.svStopSpeed);
}

function collect64HzSamples(
  state: SharedState,
  count: number,
  configureBeforeSimTick: (state: SharedState, simTick: number) => void,
): ShowposSample[] {
  const samples: ShowposSample[] = [];

  for (let fixtureTick = 0; fixtureTick < count; fixtureTick++) {
    for (let subTick = 0; subTick < SIM_TICKS_PER_FIXTURE_TICK; subTick++) {
      const simTick = fixtureTick * SIM_TICKS_PER_FIXTURE_TICK + subTick;
      configureBeforeSimTick(state, simTick);
      simStep(state, 1 / SIM_HZ, (simTick + 1) * (1000 / SIM_HZ));
    }

    samples.push({
      tick: fixtureTick,
      velocity: state.player.vx,
      speed: Math.abs(state.player.vx),
    });
  }

  return samples;
}

function expectSeriesWithinTolerance(actual: ShowposSample[], expected: ShowposSample[]): void {
  expect(actual).toHaveLength(expected.length);

  let maxDelta = 0;
  let maxDeltaTick = -1;
  for (let i = 0; i < expected.length; i++) {
    const delta = Math.abs(actual[i].velocity - expected[i].velocity);
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaTick = expected[i].tick;
    }
  }

  expect(maxDelta, `max velocity delta ${maxDelta} u/s at fixture tick ${maxDeltaTick}`).toBeLessThanOrEqual(
    SHOWPOS_TOLERANCE_U_PER_S,
  );
}

describe('WP-15 T1 cl_showpos surrogate calibration', () => {
  const accel = accelFixture as ShowposFixture;
  const stop = stopFixture as ShowposFixture;

  it('documents the approved surrogate fixture contract', () => {
    assertFixtureMeta(accel);
    assertFixtureMeta(stop);
    assertProductionProfileMatchesFixture(accel);
    assertProductionProfileMatchesFixture(stop);
  });

  it('matches 64Hz D-key acceleration samples within OQ-S2-2 tolerance', () => {
    assertProductionProfileMatchesFixture(accel);

    const state = createSharedState();
    state.held.right = true;

    // Fixture tick 0 is the first complete 64Hz movement step after input is active.
    // The 128Hz sim therefore samples every two fixed sim ticks.
    const actual = collect64HzSamples(state, accel.primary.samples.length, () => {});

    expectSeriesWithinTolerance(actual, accel.primary.samples);
  });

  it('matches 64Hz counter-strafe stop samples and zero-crossing bracket', () => {
    assertProductionProfileMatchesFixture(stop);

    const state = createSharedState();
    state.player.vx = stop.primary.maxSpeed;
    state.held.left = true;

    const actual = collect64HzSamples(state, stop.primary.samples.length, () => {});

    expectSeriesWithinTolerance(actual, stop.primary.samples);
    expect(stop.primary.zeroCrossing).toEqual({ betweenTicks: [6, 7], estimatedTick: 6.6930059564155195 });
    expect(actual[6].velocity).toBeGreaterThan(0);
    expect(actual[7].velocity).toBeLessThan(0);
  });
});
