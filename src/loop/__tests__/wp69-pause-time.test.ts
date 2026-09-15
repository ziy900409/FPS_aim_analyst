import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { DataRecorder } from '../../data/DataRecorder.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { createSharedState } from '../../state/SharedState.ts';
import type { SharedState } from '../../state/SharedState.ts';
import type { InputEvent } from '../../state/types.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createPausableTimeMapper } from '../pausableTimeMapper.ts';
import type { PausableTimeMapper } from '../pausableTimeMapper.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * WP-69 / T2 — `PausableTimeMapper` driving the **real** `createSimLoop`, in the same shape
 * `main.ts` wires it: the loop is constructed with a mapped clock and pumped every frame with
 * `mapper.mapWallTime(rafNow)`, pause included. `SimLoop.pump()` itself is untouched by this WP;
 * these tests exist to prove the mapper is enough, and that it costs the never-paused path nothing.
 *
 * T0.4 ran this comparison as a throwaway spike and recorded the numbers in `progress.md`, then
 * deleted the file. The naive-pause half is reinstated here as a permanent test: it is the only
 * executable statement of *why* the mapper exists, and without it a future refactor can quietly
 * reintroduce "just stop pumping" with nothing going red.
 *
 * T0.4 surprise #2 is load-bearing in every assertion below: the re-anchor damage is **not** on the
 * catch-up frame. `simTimeMs = nowMs` runs after that frame has already stamped its ticks, so the
 * multi-second discontinuity only appears on the frame after. Assertions that stop at the resume
 * frame see nothing wrong.
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125 — a power of two, exactly representable
const FPS_60 = 1000 / 60;
const START_WALL = 1_000;
const PAUSE_MS = 3_000;

interface Frame {
  readonly ticks: number;
  /** `tickEndMs` of every tick this frame produced, in order. */
  readonly tickEnds: readonly number[];
}

interface TickState {
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
}

interface Rig {
  readonly mapper: PausableTimeMapper;
  readonly state: SharedState;
  readonly recorder: DataRecorder;
  /** Per-tick sim state, indexed by tick index — the determinism contract's assertion target. */
  readonly tickStates: readonly TickState[];
  /** One rAF frame: map the wall time, then pump. Exactly what `liveFrame()` does. */
  frame(wallMs: number): Frame;
  /** One rAF frame that bypasses the mapper — the naive "stop pumping" contrast. */
  rawFrame(wallMs: number): Frame;
}

function createRig(options: { inputs?: readonly InputEvent[]; startWall?: number } = {}): Rig {
  const startWall = options.startWall ?? START_WALL;
  const mapper = createPausableTimeMapper();
  const state = createSharedState();
  for (const ev of options.inputs ?? []) pushEvent(state, ev);
  const recorder = createDataRecorder();
  const tickStates: TickState[] = [];
  let pending: number[] = [];

  // Mirrors `buildSimLoop()`: the loop anchors itself off the *mapped* clock, so a loop rebuilt
  // after a pause cannot end up with `lastMs` in the wall domain while `pump()` feeds it active ms.
  const clock: Clock = { now: () => mapper.mapWallTime(startWall) };
  const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, undefined, undefined, {
    afterTick(s, tickEndMs): void {
      pending.push(tickEndMs);
      tickStates.push({ x: s.curr.x, z: s.curr.z, vx: s.player.vx, vz: s.player.vz });
    },
  });

  const pump = (atMs: number): Frame => {
    pending = [];
    const { ticks } = sim.pump(atMs);
    return { ticks, tickEnds: pending };
  };

  return {
    mapper,
    state,
    recorder,
    tickStates,
    frame: (wallMs) => pump(mapper.mapWallTime(wallMs)),
    rawFrame: (wallMs) => pump(wallMs),
  };
}

/** Absolute wall timestamps for `count` frames at `periodMs`, starting one period after `from`. */
function framesAt(periodMs: number, from: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(from + i * periodMs);
  return out;
}

describe('WP-69 T2 — never-paused runs are bit-for-bit the pre-WP-69 runs (NFR-69.1)', () => {
  const inputs: InputEvent[] = [
    { type: 'key', code: 'KeyD', down: true, t: START_WALL + 10 },
    { type: 'key', code: 'KeyD', down: false, t: START_WALL + 100 },
    { type: 'key', code: 'KeyA', down: true, t: START_WALL + 150 },
    { type: 'key', code: 'KeyA', down: false, t: START_WALL + 300 },
  ];

  for (const fps of [30, 60, 144, 240]) {
    it(`${fps} FPS: mapped and unmapped traces are Object.is identical, tick for tick`, () => {
      const wallFrames = framesAt(1000 / fps, START_WALL, Math.ceil(fps * 0.6));
      const mapped = createRig({ inputs });
      const raw = createRig({ inputs });

      for (const wall of wallFrames) {
        const a = mapped.frame(wall);
        const b = raw.rawFrame(wall);
        expect(a.ticks).toBe(b.ticks);
        expect(a.tickEnds.length).toBe(b.tickEnds.length);
        for (let i = 0; i < a.tickEnds.length; i++) {
          // Object.is, not toBeCloseTo: identity is the claim, and one ULP of drift here would
          // mean every committed golden export digest is now a lie.
          expect(Object.is(a.tickEnds[i], b.tickEnds[i])).toBe(true);
        }
      }

      expect(mapped.tickStates.length).toBeGreaterThan(0);
      expect(mapped.tickStates).toEqual(raw.tickStates);
      expect(mapped.recorder.tickCount).toBe(raw.recorder.tickCount);
      expect(mapped.mapper.excludedWallMs).toBe(0);
    });
  }
});

describe('WP-69 T2 — active time is frozen for the whole pause (FR-69.1 / NFR-69.2)', () => {
  for (const pauseSeconds of [1, 10, 300]) {
    it(`${pauseSeconds}s pause: every frame returns ticks=0 and nothing advances`, () => {
      const rig = createRig();
      for (const wall of framesAt(FPS_60, START_WALL, 30)) rig.frame(wall);

      const pauseWall = START_WALL + 30 * FPS_60;
      rig.mapper.pause(pauseWall);
      const before = {
        ticks: rig.tickStates.length,
        state: rig.tickStates[rig.tickStates.length - 1],
        recorderTicks: rig.recorder.tickCount,
        fires: rig.recorder.fireCount,
        hits: rig.recorder.hitCount,
        ammo: rig.state.weapon.ammo,
      };

      const pausedFrames = framesAt(FPS_60, pauseWall, Math.round((pauseSeconds * 1000) / FPS_60));
      let maxTicks = 0;
      let sumTicks = 0;
      for (const wall of pausedFrames) {
        const f = rig.frame(wall);
        maxTicks = Math.max(maxTicks, f.ticks);
        sumTicks += f.ticks;
      }

      expect(pausedFrames.length).toBeGreaterThan(50);
      expect(sumTicks).toBe(0);
      expect(maxTicks).toBe(0);
      expect(rig.tickStates.length).toBe(before.ticks);
      expect(rig.tickStates[rig.tickStates.length - 1]).toEqual(before.state);
      expect(rig.recorder.tickCount).toBe(before.recorderTicks);
      expect(rig.recorder.fireCount).toBe(before.fires);
      expect(rig.recorder.hitCount).toBe(before.hits);
      expect(rig.state.weapon.ammo).toBe(before.ammo);
    });
  }
});

describe('WP-69 T2 — resume neither catches up nor re-anchors (NFR-69.2 / NFR-69.3)', () => {
  const PRE_FRAMES = 30;
  const POST_FRAMES = 4;
  const pauseWall = START_WALL + PRE_FRAMES * FPS_60;

  /**
   * Three strategies over one schedule: `PRE_FRAMES` at 60 FPS, a `pauseMs` gap, `POST_FRAMES`
   * more.
   *
   * - `mapped`   — the app keeps pumping through the gap, on mapped time.
   * - `naive`    — the rejected design: simply stop calling `pump()` for the gap.
   * - `control`  — no gap at all. Because the mapper subtracts exactly the pause duration, the
   *                post-resume frames of `mapped` land on the *same active times* as `control`'s
   *                frames, so the two must agree tick for tick. That equality is the real
   *                invariant; absolute tick counts are not, because the accumulator carries a
   *                residual whose size depends on where in the 7.8125 ms grid the pause lands.
   */
  function runStrategy(strategy: 'mapped' | 'naive' | 'control', pauseMs = PAUSE_MS): Rig {
    const rig = createRig();
    const pre = framesAt(FPS_60, START_WALL, PRE_FRAMES);
    for (const wall of pre) {
      if (strategy === 'naive') rig.rawFrame(wall);
      else rig.frame(wall);
    }

    if (strategy === 'mapped') {
      rig.mapper.pause(pauseWall);
      for (const wall of framesAt(FPS_60, pauseWall, Math.round(pauseMs / FPS_60))) rig.frame(wall);
      rig.mapper.resume(pauseWall + pauseMs);
    }
    // `naive` is the absence of the above: no pump calls at all for the gap.
    // `control` never has a gap, so its post frames simply continue from `pauseWall`.

    const gap = strategy === 'control' ? 0 : pauseMs;
    for (const wall of framesAt(FPS_60, pauseWall + gap, POST_FRAMES)) {
      if (strategy === 'naive') rig.rawFrame(wall);
      else rig.frame(wall);
    }
    return rig;
  }

  /** Every tick timestamp the recorder arena holds, in order — what the export is built from. */
  const tickAxis = (rig: Rig): number[] => rig.recorder.snapshot().ticks.map((tick) => tick.t);

  /** Time the tick axis jumped beyond the ticks actually simulated (0 for a healthy loop). */
  function maxInjectedGapMs(axis: readonly number[]): number {
    let worst = 0;
    for (let i = 1; i < axis.length; i++) worst = Math.max(worst, axis[i]! - axis[i - 1]! - TICK_MS);
    return worst;
  }

  it('a pause is invisible in the output: mapped equals a never-paused run, tick for tick', () => {
    const mapped = runStrategy('mapped');
    const control = runStrategy('control');

    const a = tickAxis(mapped);
    const b = tickAxis(control);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(Object.is(a[i], b[i])).toBe(true);
    expect(mapped.tickStates).toEqual(control.tickStates);
    expect(maxInjectedGapMs(a)).toBe(0); // exact: re-anchor never fired
  });

  it('reproduces the T0.4 naive-pause failure — the reason the mapper exists', () => {
    const naive = runStrategy('naive');
    const control = runStrategy('control');
    const axis = tickAxis(naive);

    // A catch-up burst: the 250 ms clamp converted into ticks, against 2-3 for a normal frame.
    expect(axis.length - tickAxis(control).length).toBeGreaterThan(28);
    // And, one frame later, a multi-second hole in the axis (T0.4 measured 2766.667 ms here; the
    // exact figure moves by up to one tick with the accumulator residual, so bound it instead).
    expect(maxInjectedGapMs(axis)).toBeGreaterThan(2_700);
    expect(maxInjectedGapMs(axis)).toBeLessThan(PAUSE_MS);
  });

  it('a 300 s pause is equally invisible — length does not matter, only the mapping', () => {
    const mapped = runStrategy('mapped', 300_000);
    const control = runStrategy('control');
    const a = tickAxis(mapped);
    const b = tickAxis(control);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(Object.is(a[i], b[i])).toBe(true);
    expect(maxInjectedGapMs(a)).toBe(0);
  });

  it('a sub-tick resume frame produces at most one tick (T2 DoD)', () => {
    const rig = createRig();
    for (const wall of framesAt(FPS_60, START_WALL, PRE_FRAMES)) rig.frame(wall);
    rig.mapper.pause(pauseWall);
    for (const wall of framesAt(FPS_60, pauseWall, 60)) rig.frame(wall);
    rig.mapper.resume(pauseWall + 1_000);
    // 1 ms of active time after resume. It can still be 1 tick rather than 0: the accumulator
    // residual carried across the pause is deliberately *not* discarded — losing it would be a
    // different flavour of the same bug (time vanishing at the pause boundary).
    expect(rig.frame(pauseWall + 1_001).ticks).toBeLessThanOrEqual(1);
  });

  it('holds 128 Hz across three pause cycles and stays exactly on the tick grid', () => {
    const rig = createRig();
    let wall = START_WALL;
    const advance = (frames: number): void => {
      for (let i = 0; i < frames; i++) {
        wall += FPS_60;
        rig.frame(wall);
      }
    };
    advance(20);
    for (let cycle = 0; cycle < 3; cycle++) {
      rig.mapper.pause(wall);
      advance(120); // 2 s of paused frames — still pumping, still zero ticks
      rig.mapper.resume(wall);
      advance(20);
    }

    // Read the tick axis off the recorder arena — the artefact the export is actually built from,
    // not the afterTick hook that recorded it.
    const all = rig.recorder.snapshot().ticks.map((tick) => tick.t);
    expect(all.length).toBeGreaterThan(80);
    for (let i = 1; i < all.length; i++) {
      expect(all[i]! - all[i - 1]!).toBe(TICK_MS); // bit-exact grid, per D-69-T0-2
    }
    expect(rig.mapper.excludedWallMs).toBeCloseTo(3 * 120 * FPS_60, 6);
  });
});

/**
 * `resetRunPresentation()` resets the mapper to identity; `buildSimLoop()` anchors the new loop off
 * the mapped clock. Run them in that order and a restarted attempt starts clean. Reset without
 * rebuilding and the surviving loop keeps `lastMs` in the *old* active domain while `pump()` starts
 * feeding it the new one — a forward jump, i.e. exactly the catch-up this WP exists to prevent.
 * Today all four full-restart paths pair them correctly; this is the guard for the fifth one.
 */
describe('WP-69 T2 — the restart ordering in main.ts stays intact', () => {
  const source = import.meta.glob<string>('../../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../../main.ts']!;

  it('pairs every resetRunPresentation() call with a buildSimLoop() right after it', () => {
    const lines = source.split('\n');
    const callSites = lines
      .map((line, i) => ({ line: line.trim(), i }))
      .filter(({ line }) => line === 'resetRunPresentation();');

    expect(callSites.length).toBeGreaterThanOrEqual(4);
    for (const { i } of callSites) {
      expect(lines.slice(i + 1, i + 3).join('\n')).toMatch(/buildSimLoop\(\)/);
    }
  });
});

describe('WP-69 T2 — a restarted attempt is indistinguishable from a fresh one (NFR-69.8)', () => {
  const offsets = [10, 100, 150, 300];

  function inputsFrom(base: number): InputEvent[] {
    return [
      { type: 'key', code: 'KeyD', down: true, t: base + offsets[0]! },
      { type: 'key', code: 'KeyD', down: false, t: base + offsets[1]! },
      { type: 'key', code: 'KeyA', down: true, t: base + offsets[2]! },
      { type: 'key', code: 'KeyA', down: false, t: base + offsets[3]! },
    ];
  }

  it('replays the same tick-index states after a pause, resume and full restart', () => {
    // Reference: a clean run that never paused.
    const fresh = createRig({ inputs: inputsFrom(START_WALL) });
    for (const wall of framesAt(FPS_60, START_WALL, 40)) fresh.frame(wall);

    // Polluted: the same rig pauses and resumes, then the operator presses Restart.
    const dirty = createRig();
    for (const wall of framesAt(FPS_60, START_WALL, 25)) dirty.frame(wall);
    const pauseWall = START_WALL + 25 * FPS_60;
    dirty.mapper.pause(pauseWall);
    for (const wall of framesAt(FPS_60, pauseWall, 300)) dirty.frame(wall);
    dirty.mapper.resume(pauseWall + 5_000);
    for (const wall of framesAt(FPS_60, pauseWall + 5_000, 10)) dirty.frame(wall);

    // `restartActiveDrill()`: reset the mapper *first*, then rebuild the loop — the rebuilt loop
    // anchors off the mapped clock, so the order is what keeps both in the same domain.
    const restartWall = pauseWall + 5_000 + 10 * FPS_60;
    dirty.mapper.restart(restartWall);
    expect(dirty.mapper.excludedWallMs).toBe(0);

    const restarted = createRig({ inputs: inputsFrom(restartWall), startWall: restartWall });
    // Carry the *already restarted* mapper into the new rig's frame calls to prove no residue.
    for (const wall of framesAt(FPS_60, restartWall, 40)) {
      restarted.frame(dirty.mapper.mapWallTime(wall));
    }

    expect(restarted.tickStates.length).toBe(fresh.tickStates.length);
    expect(restarted.tickStates).toEqual(fresh.tickStates);
    expect(restarted.recorder.tickCount).toBe(fresh.recorder.tickCount);
  });
});
