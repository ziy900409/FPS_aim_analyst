import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder } from './DataRecorder.ts';
import { capacityForDrill } from './RingBuffer.ts';

describe('DataRecorder tick arena', () => {
  it('estimates capacity from drill duration and sim rate with spare ticks', () => {
    expect(capacityForDrill(128, 300, 128)).toBe(41_528);
  });

  it('records tick rows in order and snapshots keys/aim at export time', () => {
    const recorder = createDataRecorder({ capacity: 4 });

    recorder.recordTick({ t: 1, vx: 10, vz: 0, aim: { yaw: 2, pitch: 3 }, keys: ['D'] });
    recorder.recordTick({ t: 2, vx: -10, vz: 5, aim: { yaw: 4, pitch: 5 }, keys: ['KeyA'] });

    expect(recorder.snapshot().ticks).toEqual([
      { t: 1, vx: 10, vz: 0, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 2, pitch: 3 }, keys: ['D'], ads: false },
      { t: 2, vx: -10, vz: 5, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 4, pitch: 5 }, keys: ['A'], ads: false },
    ]);
  });

  it('does not wrap on overflow and preserves the oldest rows', () => {
    const recorder = createDataRecorder({ capacity: 2 });

    recorder.recordTick({ t: 1, vx: 1, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    recorder.recordTick({ t: 2, vx: 2, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    recorder.recordTick({ t: 3, vx: 3, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: ['D'] });

    const snapshot = recorder.snapshot();
    expect(snapshot.recorderOverflow).toBe(true);
    expect(recorder.recorderOverflow).toBe(true);
    expect(snapshot.ticks.map((tick) => tick.t)).toEqual([1, 2]);
  });

  it('records directly from shared state without per-tick record objects', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 100_000 });
    state.held.right = true;
    state.heldAds = true;
    state.aim.yaw = 7;
    state.aim.pitch = -4;

    for (let i = 0; i < 100_000; i++) {
      state.player.vx = i;
      recorder.recordTickFromState(i, state);
    }

    const snapshot = recorder.snapshot();
    expect(snapshot.recorderOverflow).toBe(false);
    expect(snapshot.ticks).toHaveLength(100_000);
    expect(snapshot.ticks[0]).toEqual({
      t: 0,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: null,
      ty: null,
      tz: null,
      aim: { yaw: 7, pitch: -4 },
      keys: ['D'],
      ads: true,
    });
    expect(snapshot.ticks[99_999].vx).toBe(99_999);
  });

  it('records player and active target position fields from shared state', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 1 });
    state.player.x = 12;
    state.player.z = -3;
    state.targets.push({
      id: 't0',
      side: 'R',
      pos: { x: 4, y: 1.6, z: -8 },
      visible: true,
      alive: true,
      hitbox: { width: 1, height: 2, depth: 1 },
    });

    recorder.recordTickFromState(10, state);

    expect(recorder.snapshot().ticks[0]).toMatchObject({ px: 12, pz: -3, tx: 4, ty: 1.6, tz: -8 });
  });

  it('records drill events and clears them on reset', () => {
    const recorder = createDataRecorder({ capacity: 1 });

    expect(recorder.fireCount).toBe(0);
    expect(recorder.hitCount).toBe(0);

    recorder.recordEvent({ type: 'visible', targetId: 't0', side: 'R', t: 10 });
    recorder.recordEvent({ type: 'counter', key: 'A', t: 20 });
    recorder.recordEvent({ type: 'ads', down: true, t: 25 });
    recorder.recordEvent({
      type: 'fire',
      t: 30,
      hit: true,
      firstShot: true,
      residualSpeed: 0,
      targetId: 't0',
      offsetDeg: 1.5,
      part: 'head',
    });
    recorder.recordEvent({ type: 'fire', t: 40, hit: false, firstShot: false, residualSpeed: 250 });
    recorder.recordEvent({ type: 'hit', t: 55, timeOfFlightMs: 25, shotSeq: 2, targetId: 't0', part: 'body' });

    expect(recorder.fireCount).toBe(2);
    expect(recorder.hitCount).toBe(2);

    expect(recorder.snapshot().events).toEqual([
      { type: 'visible', targetId: 't0', side: 'R', t: 10 },
      { type: 'counter', key: 'A', t: 20 },
      { type: 'ads', down: true, t: 25 },
      {
        type: 'fire',
        t: 30,
        hit: true,
        firstShot: true,
        residualSpeed: 0,
        targetId: 't0',
        offsetDeg: 1.5,
        part: 'head',
      },
      { type: 'fire', t: 40, hit: false, firstShot: false, residualSpeed: 250 },
      { type: 'hit', t: 55, timeOfFlightMs: 25, shotSeq: 2, targetId: 't0', part: 'body' },
    ]);

    recorder.reset();

    expect(recorder.snapshot().events).toEqual([]);
    expect(recorder.fireCount).toBe(0);
    expect(recorder.hitCount).toBe(0);
  });

  it('reset reuses the arena and clears overflow state', () => {
    const recorder = createDataRecorder({ capacity: 1 });
    recorder.recordTick({ t: 1, vx: 1, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    recorder.recordTick({ t: 2, vx: 2, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });

    recorder.reset();
    recorder.recordTick({ t: 3, vx: 3, vz: 0, aim: { yaw: 1, pitch: 1 }, keys: ['A'] });

    expect(recorder.snapshot()).toEqual({
      ticks: [{ t: 3, vx: 3, vz: 0, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 1, pitch: 1 }, keys: ['A'], ads: false }],
      events: [],
      recorderOverflow: false,
    });
  });

  it('recordKeyEvents defaults to false and is opt-in (WP-29 / T3)', () => {
    expect(createDataRecorder({ capacity: 1 }).recordKeyEvents).toBe(false);
    expect(createDataRecorder({ capacity: 1, recordKeyEvents: false }).recordKeyEvents).toBe(false);
    expect(createDataRecorder({ capacity: 1, recordKeyEvents: true }).recordKeyEvents).toBe(true);
  });

  it('stores additive key events verbatim without touching fire/hit counts (WP-29 / T3)', () => {
    const recorder = createDataRecorder({ capacity: 1, recordKeyEvents: true });

    recorder.recordEvent({ type: 'key', code: 'A', down: true, t: 5 });
    recorder.recordEvent({ type: 'key', code: 'A', down: false, t: 20 });

    expect(recorder.fireCount).toBe(0);
    expect(recorder.hitCount).toBe(0);
    expect(recorder.snapshot().events).toEqual([
      { type: 'key', code: 'A', down: true, t: 5 },
      { type: 'key', code: 'A', down: false, t: 20 },
    ]);
  });
});
