import { describe, expect, it } from 'vitest';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import type { InputEvent } from '../../src/state/types.ts';

const TICK_MS = 1000 / SIM_HZ;
const ANNOTATION_INPUTS: readonly InputEvent[] = [
  { type: 'key', code: 'KeyL', down: true, t: 10 },
  { type: 'key', code: 'KeyL', down: false, t: 40 },
];
const END_MS = 16.5 * TICK_MS;

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand());
    if (t + d >= endMs) break;
    t += d;
    abs.push(t);
  }
  abs.push(endMs);
  return abs;
}

const FRAME_SEQUENCES: Record<string, readonly number[]> = {
  'stable 60 Hz': framesAt(1000 / 60, END_MS),
  'stable 144 Hz': framesAt(1000 / 144, END_MS),
  'stable 240 Hz': framesAt(1000 / 240, END_MS),
  'jittered 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
};

interface MicroRun {
  readonly state: SharedState;
  readonly snapshot: DataRecorderSnapshot;
  readonly pushCalls: number;
}

function tickTrace(snapshot: DataRecorderSnapshot): (number | string | boolean | null | undefined)[] {
  const out: (number | string | boolean | null | undefined)[] = [];
  for (const tick of snapshot.ticks) {
    out.push(
      tick.t,
      tick.vx,
      tick.vz,
      tick.px,
      tick.pz,
      tick.tx,
      tick.ty,
      tick.tz,
      tick.aim.yaw,
      tick.aim.pitch,
      tick.keys.join('|'),
      tick.ads,
      tick.fire,
      tick.dYaw,
      tick.dPitch,
      tick.replayTargetId,
    );
  }
  return out;
}

function stateTrace(state: SharedState): (number | string | boolean | null | undefined)[] {
  return [
    state.curr.x,
    state.curr.z,
    state.player.x,
    state.player.z,
    state.player.vx,
    state.player.vz,
    state.player.stopped,
    state.held.left,
    state.held.right,
    state.heldFire,
    state.heldAds,
    state.aim.yaw,
    state.aim.pitch,
  ];
}

function expectBitIdentical(
  actual: readonly (number | string | boolean | null | undefined)[],
  expected: readonly (number | string | boolean | null | undefined)[],
  label: string,
): void {
  expect(actual.length).toBe(expected.length);
  const mismatches: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) mismatches.push(`${label}[${i}]: ${String(actual[i])} !== ${String(expected[i])}`);
  }
  expect(mismatches).toEqual([]);
}

function runFrames(recordAnnotationEvents: boolean, absTimes: readonly number[]): MicroRun {
  const state = createSharedState();
  const clock: Clock = { now: () => 0 };
  const recorder = createDataRecorder({ simHz: SIM_HZ, recordAnnotationEvents });
  const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder);
  for (const ev of ANNOTATION_INPUTS) pushEvent(state, ev);

  const originalPush = Array.prototype.push;
  let counting = false;
  let pushCalls = 0;
  try {
    Array.prototype.push = function patchedPush<T>(this: T[], ...items: T[]): number {
      if (counting) pushCalls++;
      return originalPush.apply(this, items);
    };
    for (const now of absTimes) {
      counting = true;
      sim.pump(now);
      counting = false;
    }
  } finally {
    Array.prototype.push = originalPush;
  }

  return { state, snapshot: recorder.snapshot(), pushCalls };
}

describe('WP-61 T1 annotation channel — sim-inert opt-in recorder path', () => {
  it('records KeyL down/up only when recordAnnotationEvents is enabled', () => {
    const off = runFrames(false, FRAME_SEQUENCES['stable 240 Hz']);
    const on = runFrames(true, FRAME_SEQUENCES['stable 240 Hz']);

    expect(off.snapshot.events).toEqual([]);
    expect(on.snapshot.events).toEqual([
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 10 },
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: false, t: 40 },
    ]);
  });

  it.each(Object.entries(FRAME_SEQUENCES))(
    'keeps every TickRecord field Object.is-identical with the channel off versus on at %s',
    (_name, absTimes) => {
      const off = runFrames(false, absTimes);
      const on = runFrames(true, absTimes);

      expectBitIdentical(tickTrace(on.snapshot), tickTrace(off.snapshot), 'tick');
      expectBitIdentical(stateTrace(on.state), stateTrace(off.state), 'state');
    },
  );

  it('does not enter KeyL into held state or TickRecord.keys', () => {
    const run = runFrames(true, FRAME_SEQUENCES['stable 240 Hz']);

    expect(run.state.held).toEqual({ left: false, right: false });
    expect(run.snapshot.ticks.every((tick) => tick.keys.length === 0)).toBe(true);
  });

  it('adds Array.prototype.push calls equal to the number of actual annotation events', () => {
    const off = runFrames(false, FRAME_SEQUENCES['stable 240 Hz']);
    const on = runFrames(true, FRAME_SEQUENCES['stable 240 Hz']);

    expect(off.pushCalls).toBe(0);
    expect(on.pushCalls).toBe(2);
    expect(on.pushCalls - off.pushCalls).toBe(ANNOTATION_INPUTS.length);
  });
});
