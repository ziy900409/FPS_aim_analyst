import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder } from './DataRecorder.ts';
import { capacityForDrill } from './RingBuffer.ts';
import { resolveMouseGain } from '../input/mouseGain.ts';

const HIP_GAIN = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75 });
const ADS_GAIN = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75, ads: { fovDeg: 40, sensitivityRatio: 1 } });

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
      // WP-54 / T7：`SharedState` 一律帶 `heldFire`，故 state-sourced tick 恆輸出 `fire`。
      fire: false,
    });
    expect(snapshot.ticks[99_999].vx).toBe(99_999);
  });

  it('mirrors heldFire onto every state-sourced tick, and omits `fire` when the source has none', () => {
    // D-54.50 counts held-fire coverage per tick, so "not recorded" and "recorded as released"
    // must stay distinguishable — a hand-built TickRecordInput without `fire` emits no key at all.
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 3 });
    state.heldFire = true;
    recorder.recordTickFromState(0, state);
    state.heldFire = false;
    recorder.recordTickFromState(1, state);
    recorder.recordTick({ t: 2, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });

    const ticks = recorder.snapshot().ticks;
    expect(ticks[0].fire).toBe(true);
    expect(ticks[1].fire).toBe(false);
    expect('fire' in ticks[2]).toBe(false);
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
      hitbox: { width: 1, height: 2, depth: 1, shape: 'box' },
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

  it('recordAnnotationEvents defaults to false and is opt-in (WP-61 / T1)', () => {
    expect(createDataRecorder({ capacity: 1 }).recordAnnotationEvents).toBe(false);
    expect(createDataRecorder({ capacity: 1, recordAnnotationEvents: false }).recordAnnotationEvents).toBe(false);
    expect(createDataRecorder({ capacity: 1, recordAnnotationEvents: true }).recordAnnotationEvents).toBe(true);
  });

  it('recordMouseSamples defaults to false and omits raw sample fields from snapshots (WP-60 / T1)', () => {
    const recorder = createDataRecorder({ capacity: 1 });

    expect(recorder.recordMouseSamples).toBe(false);
    expect(recorder.recordMouseSample(1, 2, 3)).toBe(false);
    expect(recorder.snapshot()).toEqual({ ticks: [], events: [], recorderOverflow: false });
  });

  it('recordMouseSamples opt-in captures a columnar raw sample block with provenance', () => {
    const recorder = createDataRecorder({ capacity: 1, recordMouseSamples: true, mouseSampleCapacity: 3 });

    expect(recorder.recordMouseSamples).toBe(true);
    expect(recorder.recordMouseSample(2, -1, 100)).toBe(true);
    expect(recorder.recordMouseSample(0, 3, 101)).toBe(true);
    expect(recorder.recordMouseSample(-4, 5, 102.5)).toBe(true);

    expect(recorder.snapshot()).toEqual({
      ticks: [],
      events: [],
      recorderOverflow: false,
      mouseSamples: { t0Ms: 100, dtUs: [0, 1000, 1500], dx: [2, 0, -4], dy: [-1, 3, 5] },
      mouseSampling: {
        recorded: 3,
        capacity: 3,
        overflow: false,
        timeSource: 'event.timeStamp',
        deltaUnit: 'counts',
        observedRateHz: 800,
      },
    });
  });

  it('raw sample overflow is independent from tick recorder overflow', () => {
    const recorder = createDataRecorder({ capacity: 2, recordMouseSamples: true, mouseSampleCapacity: 1 });

    recorder.recordMouseSample(1, 1, 10);
    expect(recorder.recordMouseSample(2, 2, 11)).toBe(false);

    const snapshot = recorder.snapshot();
    expect(snapshot.recorderOverflow).toBe(false);
    expect(snapshot.mouseSampling?.overflow).toBe(true);
    expect(snapshot.mouseSampling?.recorded).toBe(1);
    expect(snapshot.mouseSamples).toEqual({ t0Ms: 10, dtUs: [0], dx: [1], dy: [1] });
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

  it('stores additive annotation events verbatim without touching fire/hit counts (WP-61 / T1)', () => {
    const recorder = createDataRecorder({ capacity: 1, recordAnnotationEvents: true });

    recorder.recordEvent({ type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 5 });
    recorder.recordEvent({ type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: false, t: 20 });

    expect(recorder.fireCount).toBe(0);
    expect(recorder.hitCount).toBe(0);
    expect(recorder.snapshot().events).toEqual([
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 5 },
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: false, t: 20 },
    ]);
  });

  it('stores additive pointer_lock events verbatim without touching fire/hit counts (WP-60 / T1)', () => {
    const recorder = createDataRecorder({ capacity: 1, recordMouseSamples: true });

    recorder.recordEvent({ type: 'pointer_lock', locked: true, t: 5 });
    recorder.recordEvent({ type: 'pointer_lock', locked: false, t: 20 });

    expect(recorder.fireCount).toBe(0);
    expect(recorder.hitCount).toBe(0);
    expect(recorder.snapshot().events).toEqual([
      { type: 'pointer_lock', locked: true, t: 5 },
      { type: 'pointer_lock', locked: false, t: 20 },
    ]);
  });
});

describe('DataRecorder mouse 積分 — KI-005 / A（FR-A-1/4）', () => {
  it('mouseIntegration 預設未配置：不出現 dYaw/dPitch key（NFR-A-2）', () => {
    const recorder = createDataRecorder({ capacity: 2 });
    expect(recorder.mouseIntegration).toBeUndefined();

    recorder.accumulateMouse(5, -2, false); // 未配置時為 no-op（防呆）
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });

    const tick = recorder.snapshot().ticks[0];
    expect(Object.keys(tick)).not.toContain('dYaw');
    expect(Object.keys(tick)).not.toContain('dPitch');
  });

  it('累加多筆 mouse delta 後寫入 tick，寫入後立即歸零（下一 tick 不殘留）', () => {
    const recorder = createDataRecorder({ capacity: 2, mouseIntegration: { gain: HIP_GAIN } });

    recorder.accumulateMouse(3, 1, false);
    recorder.accumulateMouse(-1, 2, false);
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    recorder.recordTick({ t: 2, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] }); // 無新 mouse delta

    const [first, second] = recorder.snapshot().ticks;
    expect(first.dYaw).toBeCloseTo(-(3 + -1) * HIP_GAIN.hipStep, 15);
    expect(first.dPitch).toBeCloseTo(-(1 + 2) * HIP_GAIN.hipStep, 15);
    expect(second.dYaw).toBe(0); // 歸零後、無新輸入 → 0（非缺席，仍是 number key）
    expect(second.dPitch).toBe(0);
  });

  it('ads=true 時使用 adsStep，false 時使用 hipStep', () => {
    const recorder = createDataRecorder({
      capacity: 2,
      mouseIntegration: { gain: { hipStep: HIP_GAIN.hipStep, adsStep: ADS_GAIN.adsStep } },
    });

    recorder.accumulateMouse(4, 0, true);
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });

    expect(recorder.snapshot().ticks[0].dYaw).toBeCloseTo(-4 * ADS_GAIN.adsStep, 15);
  });

  it('recordTickFromState 走相同的累加/歸零路徑', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 2, mouseIntegration: { gain: HIP_GAIN } });

    recorder.accumulateMouse(2, 0, false);
    recorder.recordTickFromState(1, state);
    recorder.recordTickFromState(2, state);

    const [first, second] = recorder.snapshot().ticks;
    expect(first.dYaw).toBeCloseTo(-2 * HIP_GAIN.hipStep, 15);
    expect(second.dYaw).toBe(0);
  });

  it('configureMouseIntegration 可在執行期切換啟用/停用', () => {
    const recorder = createDataRecorder({ capacity: 2 });
    recorder.accumulateMouse(9, 9, false); // 尚未配置 → no-op
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    expect(Object.keys(recorder.snapshot().ticks[0])).not.toContain('dYaw');

    recorder.configureMouseIntegration({ gain: HIP_GAIN });
    expect(recorder.mouseIntegration).toEqual({ gain: HIP_GAIN });
    recorder.accumulateMouse(1, 0, false);
    recorder.recordTick({ t: 2, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
    expect(recorder.snapshot().ticks[1].dYaw).toBeCloseTo(-1 * HIP_GAIN.hipStep, 15);
  });

  it('overflow 時累加/寫入呼叫仍安全（不拋錯），且 overflow 旗標正確浮現（C-7 / arena 滿）', () => {
    const recorder = createDataRecorder({ capacity: 1, mouseIntegration: { gain: HIP_GAIN } });

    recorder.accumulateMouse(5, 0, false);
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] }); // 寫入 slot 0，累加器歸零
    expect(recorder.recorderOverflow).toBe(false);

    recorder.accumulateMouse(7, 0, false);
    // arena 已滿：consumeMouseAccum 在呼叫 ticks.recordTick 之前即已把累加器歸零（見 DataRecorder.recordTick
    // 實作），與 arena 本身是否接受寫入無關——overflow 之後每次呼叫恆重新歸零，不會累積成長。
    expect(() => recorder.recordTick({ t: 2, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] })).not.toThrow();
    expect(recorder.recorderOverflow).toBe(true);
    expect(recorder.snapshot().ticks).toHaveLength(1); // 第二筆被拒收，最舊的一筆保留（GD-2）
  });

  it('reset() 重置累加器與內部 AimIntegrator（drill restart）', () => {
    const recorder = createDataRecorder({ capacity: 2, mouseIntegration: { gain: HIP_GAIN } });

    recorder.accumulateMouse(6, 0, false);
    recorder.reset();
    recorder.recordTick({ t: 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });

    expect(recorder.snapshot().ticks[0].dYaw).toBe(0); // 累加器已隨 reset 歸零
  });
});
