import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder, type DataRecorder } from './DataRecorder.ts';
import { capacityForDrill } from './RingBuffer.ts';
import { resolveMouseGain, type MouseGain } from '../input/mouseGain.ts';
import { createSettingsPanel } from '../ui/SettingsPanel.ts';

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

/**
 * KI-035 / BD-039（WP-63 T2）— 感度／FOV 變更後 recorder 的 mouse gain 必須跟著換。
 *
 * 為什麼測試放在 data 層卻拉進 `ui/SettingsPanel`：這個 bug **不在任何一層裡面**，它在兩層之間
 * 的那條線上——`configureMouseIntegration()` 本來就正確（上方既有測試已證），`resolveMouseGain()`
 * 也正確，缺的是「設定一變就呼叫它」這一步。只測 data 層的任何寫法，在 bug 仍在時都會通過。
 *
 * 下面的 harness 逐字重現 `main.ts` 的佈線**與其順序陷阱**：`createSettingsPanel()` 在建構當下就
 * 把兩個預設值推過 callback 一次，而那時 recorder 還不存在（`main.ts` 內是 TDZ）⇒ 佈線必須帶一個
 * 就緒旗標。`main.ts` 本身跑不動 vitest（WebGPU + top-level await 的 DOM 腳本），故「main.ts 真的
 * 這樣接了」由本檔最後一個 describe 以 source 掃描釘死，沿用 `sessionWeaponActivation.test.ts`
 * 的既有慣例。
 */

class FakeSettingsElement {
  id = '';
  textContent = '';
  value = '';
  valueAsNumber = 0;
  type = '';
  min = '';
  max = '';
  step = '';
  disabled = false;
  readonly style: Record<string, string> = { cssText: '' };
  readonly children: FakeSettingsElement[] = [];
  readonly listeners = new Map<string, Array<() => void>>();

  append(...children: FakeSettingsElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeSettingsElement): void {
    this.children.push(child);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  /** 模擬操作員拖動滑桿：設值後發 `input`，與 SettingsPanel 綁的是同一個事件。 */
  slideTo(value: number): void {
    this.valueAsNumber = value;
    this.value = String(value);
    for (const listener of this.listeners.get('input') ?? []) listener();
  }
}

class FakeSettingsDocument {
  readonly body = new FakeSettingsElement();
  /** 依建立順序收集 `input`：SettingsPanel 先建 Sensitivity 那列，再建 FOV 那列。 */
  readonly inputs: FakeSettingsElement[] = [];

  createElement(tag: string): FakeSettingsElement {
    const element = new FakeSettingsElement();
    if (tag === 'input') this.inputs.push(element);
    return element;
  }
}

const USP_ADS = { fovDeg: 40, sensitivityRatio: 1 };

/** `main.ts` 佈線的最小忠實複製：settingsPanel → currentMouseGain() → recorder。 */
function wireSettingsToRecorder(ads?: { fovDeg: number; sensitivityRatio: number }) {
  const fakeDocument = new FakeSettingsDocument();
  vi.stubGlobal('document', fakeDocument);

  let wired = false;
  const currentMouseGain = (): MouseGain =>
    resolveMouseGain({
      sensitivity: panel.sensitivity,
      hipFovDeg: panel.fov,
      ...(ads !== undefined ? { ads } : {}),
    });
  // main.ts `refreshRecorderMouseGain()` 的逐字對應，含就緒旗標。
  const refreshRecorderMouseGain = (): void => {
    if (!wired) return;
    recorder.configureMouseIntegration({ gain: currentMouseGain() });
  };

  const panel = createSettingsPanel({
    onSensitivityChange: () => refreshRecorderMouseGain(),
    onFovChange: () => refreshRecorderMouseGain(),
  });
  const recorder = createDataRecorder({ capacity: 8, mouseIntegration: { gain: currentMouseGain() } });
  wired = true;

  const [sensitivityInput, fovInput] = fakeDocument.inputs;
  return { panel, recorder, currentMouseGain, sensitivityInput, fovInput };
}

/** 積一筆 delta 進新的一個 tick，回傳該 tick 的 dYaw。 */
function integrateOneTick(recorder: DataRecorder, dx: number, dy: number, ads: boolean): number {
  recorder.accumulateMouse(dx, dy, ads);
  recorder.recordTick({ t: recorder.tickCount + 1, vx: 0, vz: 0, aim: { yaw: 0, pitch: 0 }, keys: [] });
  const ticks = recorder.snapshot().ticks;
  return ticks[ticks.length - 1].dYaw as number;
}

describe('KI-035 / BD-039 — 感度／FOV 變更後 ticks[].dYaw 用新 gain', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sensitivity 變更後，積分用新 gain，且與 meta.mouseIntegration 會報的值同源', () => {
    const { recorder, panel, sensitivityInput } = wireSettingsToRecorder();
    const beforeGain = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75 });
    expect(integrateOneTick(recorder, 4, 0, false)).toBeCloseTo(-4 * beforeGain.hipStep, 15);

    sensitivityInput.slideTo(2.5);

    // (1) recorder 手上的 gain === 匯出時 buildCurrentExportPayload() 會重算的那一份（同一組輸入）。
    const afterGain = resolveMouseGain({ sensitivity: panel.sensitivity, hipFovDeg: panel.fov });
    expect(recorder.mouseIntegration?.gain).toEqual(afterGain);
    // (2) 新 gain 真的進了積分路徑。修復前這裡會拿到 beforeGain 的刻度。
    expect(integrateOneTick(recorder, 4, 0, false)).toBeCloseTo(-4 * afterGain.hipStep, 15);
    // (3) 兩組 gain 確實不同 ⇒ 上一條不是「新舊剛好一樣」的空斷言。
    expect(afterGain.hipStep).not.toBe(beforeGain.hipStep);
  });

  it('FOV 變更後，ADS 態積分用新 adsStep（hip 態本就不隨 FOV 變，見斷言 4）', () => {
    const { recorder, panel, fovInput } = wireSettingsToRecorder(USP_ADS);
    const beforeGain = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75, ads: USP_ADS });
    expect(integrateOneTick(recorder, 4, 0, true)).toBeCloseTo(-4 * beforeGain.adsStep, 15);

    fovInput.slideTo(100);

    const afterGain = resolveMouseGain({ sensitivity: panel.sensitivity, hipFovDeg: panel.fov, ads: USP_ADS });
    expect(recorder.mouseIntegration?.gain).toEqual(afterGain);
    expect(integrateOneTick(recorder, 4, 0, true)).toBeCloseTo(-4 * afterGain.adsStep, 15);
    expect(afterGain.adsStep).not.toBe(beforeGain.adsStep);
    // (4) `resolveMouseGain` 的 hipStep 只看 sensitivity ⇒ 無 ads 的武器（例如 v8 的 usp_s_laser）
    //     改 FOV 不會動到 hip 態的 dYaw。KI-035 的 FOV 半邊只咬得到可開鏡的武器；記在這裡免得
    //     後續讀者以為每個 drill 都有這條風險。
    expect(afterGain.hipStep).toBe(beforeGain.hipStep);
  });

  it('未變更設定時不重設 gain，dYaw 與從未接過面板的 recorder 逐位相同', () => {
    const { recorder } = wireSettingsToRecorder();
    const constructionGain = recorder.mouseIntegration;
    const control = createDataRecorder({
      capacity: 8,
      mouseIntegration: { gain: resolveMouseGain({ sensitivity: 1, hipFovDeg: 75 }) },
    });

    for (const [dx, dy] of [
      [3, 1],
      [-1, 2],
      [0, 0],
      [7, -4],
    ] as const) {
      expect(Object.is(integrateOneTick(recorder, dx, dy, false), integrateOneTick(control, dx, dy, false))).toBe(true);
    }
    // 物件同一性：`configureMouseIntegration()` 每次都換上一個新物件，故「沒被呼叫過」才會維持
    // 建構時傳進去的那一個。
    expect(recorder.mouseIntegration).toBe(constructionGain);
  });
});

describe('KI-035 / BD-039 — main.ts 真的接了這條線（source 掃描）', () => {
  const MAIN_SOURCE = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');

  /** 取 `const settingsPanel = createSettingsPanel({ ... })` 的選項字面量。 */
  function settingsPanelOptions(): string {
    const start = MAIN_SOURCE.indexOf('const settingsPanel = createSettingsPanel({');
    expect(start, 'main.ts should still build the settings panel').toBeGreaterThan(-1);
    const end = MAIN_SOURCE.indexOf('\n});', start);
    expect(end).toBeGreaterThan(start);
    return MAIN_SOURCE.slice(start, end);
  }

  it.each([['onSensitivityChange'], ['onFovChange']])('%s 變更後推新 gain 進 recorder（BD-039 (a)）', (callback) => {
    const options = settingsPanelOptions();
    const callbackAt = options.indexOf(`${callback}:`);
    expect(callbackAt).toBeGreaterThan(-1);
    expect(options.slice(callbackAt)).toMatch(/refreshRecorderMouseGain\(\)/);
  });

  it('refreshRecorderMouseGain() 走既有的 currentMouseGain()，不另算一份 gain', () => {
    expect(MAIN_SOURCE).toMatch(
      /function refreshRecorderMouseGain\(\): void \{[\s\S]*?recorder\.configureMouseIntegration\(\{ gain: currentMouseGain\(\) \}\);[\s\S]*?\n\}/,
    );
    // 就緒旗標必須在 recorder 建好之後才翻開，否則建構時的預設值推送會撞 TDZ。
    const createdAt = MAIN_SOURCE.indexOf('const recorder = createDataRecorder({');
    const wiredAt = MAIN_SOURCE.indexOf('recorderMouseGainWired = true;');
    expect(createdAt).toBeGreaterThan(-1);
    expect(wiredAt).toBeGreaterThan(createdAt);
  });

  it('錄製中停用兩個滑桿，判準沿用 countdown/running（BD-039 (b)）', () => {
    expect(MAIN_SOURCE).toMatch(
      /function syncAimSettingsLock\(\): void \{[\s\S]*?settingsPanel\.lockAim\(phase === 'countdown' \|\| phase === 'running'\);[\s\S]*?\n\}/,
    );
    // 掛在既有的 UI 同步點上，且在 `controls === undefined` 的 early return 之前。
    const body = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('function syncControlsVisibility(): void {'));
    expect(body.indexOf('syncAimSettingsLock();')).toBeLessThan(body.indexOf('if (controls === undefined) return;'));
  });

  it('舊的「不可能發散」宣稱已從 currentMouseGain() 之前的註解移除', () => {
    const head = MAIN_SOURCE.slice(0, MAIN_SOURCE.indexOf('function currentMouseGain()'));
    expect(head).not.toContain('故兩者不可能發散');
  });
});
