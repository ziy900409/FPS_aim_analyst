import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder } from './DataRecorder.ts';
import { capacityForDrill } from './RingBuffer.ts';

describe('DataRecorder tick arena', () => {
  it('estimates capacity from drill duration and sim rate with spare ticks', () => {
    expect(capacityForDrill(128, 300, 128)).toBe(38_528);
  });

  it('records tick rows in order and snapshots keys/crosshair at export time', () => {
    const recorder = createDataRecorder({ capacity: 4 });

    recorder.recordTick({ t: 1, vx: 10, vz: 0, crosshair: [2, 3], keys: ['D'] });
    recorder.recordTick({ t: 2, vx: -10, vz: 5, crosshair: [4, 5], keys: ['KeyA'] });

    expect(recorder.snapshot().ticks).toEqual([
      { t: 1, vx: 10, vz: 0, crosshair: [2, 3], keys: ['D'] },
      { t: 2, vx: -10, vz: 5, crosshair: [4, 5], keys: ['A'] },
    ]);
  });

  it('does not wrap on overflow and preserves the oldest rows', () => {
    const recorder = createDataRecorder({ capacity: 2 });

    recorder.recordTick({ t: 1, vx: 1, vz: 0, crosshair: [0, 0], keys: [] });
    recorder.recordTick({ t: 2, vx: 2, vz: 0, crosshair: [0, 0], keys: [] });
    recorder.recordTick({ t: 3, vx: 3, vz: 0, crosshair: [0, 0], keys: ['D'] });

    const snapshot = recorder.snapshot();
    expect(snapshot.recorderOverflow).toBe(true);
    expect(recorder.recorderOverflow).toBe(true);
    expect(snapshot.ticks.map((tick) => tick.t)).toEqual([1, 2]);
  });

  it('records directly from shared state without per-tick record objects', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 100_000 });
    state.held.right = true;
    state.crosshair.cx = 7;
    state.crosshair.cy = -4;

    for (let i = 0; i < 100_000; i++) {
      state.player.vx = i;
      recorder.recordTickFromState(i, state);
    }

    const snapshot = recorder.snapshot();
    expect(snapshot.recorderOverflow).toBe(false);
    expect(snapshot.ticks).toHaveLength(100_000);
    expect(snapshot.ticks[0]).toEqual({ t: 0, vx: 0, vz: 0, crosshair: [7, -4], keys: ['D'] });
    expect(snapshot.ticks[99_999].vx).toBe(99_999);
  });

  it('reset reuses the arena and clears overflow state', () => {
    const recorder = createDataRecorder({ capacity: 1 });
    recorder.recordTick({ t: 1, vx: 1, vz: 0, crosshair: [0, 0], keys: [] });
    recorder.recordTick({ t: 2, vx: 2, vz: 0, crosshair: [0, 0], keys: [] });

    recorder.reset();
    recorder.recordTick({ t: 3, vx: 3, vz: 0, crosshair: [1, 1], keys: ['A'] });

    expect(recorder.snapshot()).toEqual({
      ticks: [{ t: 3, vx: 3, vz: 0, crosshair: [1, 1], keys: ['A'] }],
      events: [],
      recorderOverflow: false,
    });
  });
});
