import { afterEach, describe, expect, it, vi } from 'vitest';
import drillJson from '../../../drills/counterstrafe_ad_v1.json';
import { createDataRecorder, type DataRecorderSnapshot } from '../../data/DataRecorder.ts';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { createDrillRunner } from '../../drill/DrillRunner.ts';
import { detectionPopinV1 } from '../../drill/detection_popin_v1.ts';
import { applyResolutionMode, type DisplayState, type ResolutionMode } from '../../display/resolutionMode.ts';
import { createSharedState, type SharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import type { InputEvent } from '../../state/types.ts';
import type { SceneConfig } from '../../scene/SceneConfig.ts';
import { fieldLow } from '../../scene/scenes/field-low.ts';
import { placeholderRoom } from '../../scene/scenes/placeholder-room.ts';
import { urbanHigh } from '../../scene/scenes/urban-high.ts';
import { createTargetManager } from '../../sim/TargetManager.ts';
import { ak47 } from '../../weapon/weapons.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

const TICK_MS = 1000 / SIM_HZ;
const CLOCK_BASE = 0;
const COUNTERSTRAFE_EXPECTED_TICKS = 499;
const COUNTERSTRAFE_END_MS = (COUNTERSTRAFE_EXPECTED_TICKS + 0.5) * TICK_MS;
const DETECTION_EXPECTED_TICKS = 1408;

interface TickSnap {
  tickIndex: number;
  t: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  stopped: boolean;
  targetX: number | null;
  targetY: number | null;
  targetZ: number | null;
}

interface SimTrace {
  tickSnaps: TickSnap[];
  snapshot: DataRecorderSnapshot;
  phase: string;
  display?: Pick<DisplayState, 'mode' | 'bufferW' | 'bufferH'>;
}

class FakeRenderer {
  readonly domElement = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as HTMLCanvasElement;

  pixelRatio = 1;

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
  }

  setSize(width: number, height: number, updateStyle = true): void {
    this.domElement.width = Math.round(width * this.pixelRatio);
    this.domElement.height = Math.round(height * this.pixelRatio);
    if (updateStyle) {
      this.domElement.style.width = `${width}px`;
      this.domElement.style.height = `${height}px`;
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function syntheticInputs(): InputEvent[] {
  return [
    { type: 'key', code: 'KeyD', down: true, t: 3100 },
    { type: 'key', code: 'KeyA', down: true, t: 3250 },
    { type: 'key', code: 'KeyD', down: false, t: 3350 },
    { type: 'key', code: 'KeyA', down: false, t: 3350 },
    { type: 'key', code: 'KeyA', down: true, t: 3450 },
    { type: 'key', code: 'KeyD', down: true, t: 3600 },
    { type: 'key', code: 'KeyA', down: false, t: 3700 },
    { type: 'key', code: 'KeyD', down: false, t: 3700 },
  ];
}

function counterstrafeFrames(): number[] {
  return framesAt(1000 / 144, COUNTERSTRAFE_END_MS);
}

function canonicalFrames(nTicks: number): number[] {
  const abs: number[] = [];
  for (let k = 1; k <= nTicks; k++) abs.push(k * TICK_MS);
  return abs;
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

function runCounterstrafeTrace(args: { scene?: SceneConfig; mode?: ResolutionMode } = {}): SimTrace {
  const display = args.mode === undefined ? undefined : applyMode(args.mode);
  const config = loadDrill(drillJson, args.scene);
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const tickSnaps: TickSnap[] = [];
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, 1, {
    afterTick: (s, t, tickIndex) => tickSnaps.push(snapTick(s, t, tickIndex)),
  });

  drillRunner.start(config);
  for (const ev of syntheticInputs()) pushEvent(state, ev);
  for (const now of counterstrafeFrames()) sim.pump(now);

  return { tickSnaps, snapshot: recorder.snapshot(), phase: drillRunner.phase, display };
}

function runDetectionSpawnSequence(seed: number): Array<Extract<DataRecorderSnapshot['events'][number], { type: 'visible' }>> {
  const config = loadDrill({
    ...detectionPopinV1,
    sequence: { ...detectionPopinV1.sequence, seed },
  });
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, seed);

  drillRunner.start(config);
  for (const now of canonicalFrames(DETECTION_EXPECTED_TICKS)) sim.pump(now);

  return recorder
    .snapshot()
    .events.filter((event): event is Extract<DataRecorderSnapshot['events'][number], { type: 'visible' }> => {
      return event.type === 'visible';
    });
}

function runLegacySlotSpawnSequence(seed: number): DataRecorderSnapshot {
  const config = loadDrill({
    ...drillJson,
    sequence: { ...drillJson.sequence, seed },
  });
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, seed);

  drillRunner.start(config);
  for (const now of canonicalFrames(420)) sim.pump(now);
  return recorder.snapshot();
}

function snapTick(state: SharedState, t: number, tickIndex: number): TickSnap {
  const target = state.targets.find((candidate) => candidate.visible && candidate.alive);
  return {
    tickIndex,
    t,
    x: state.curr.x,
    z: state.curr.z,
    vx: state.player.vx,
    vz: state.player.vz,
    stopped: state.player.stopped,
    targetX: target?.pos.x ?? null,
    targetY: target?.pos.y ?? null,
    targetZ: target?.pos.z ?? null,
  };
}

function applyMode(mode: ResolutionMode): Pick<DisplayState, 'mode' | 'bufferW' | 'bufferH'> {
  stubDisplayGlobals();
  const state = applyResolutionMode(new FakeRenderer(), mode);
  return { mode: state.mode, bufferW: state.bufferW, bufferH: state.bufferH };
}

function stubDisplayGlobals(): void {
  vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 });
  vi.stubGlobal('screen', { width: 1920, height: 1080 });
  vi.stubGlobal('document', { fullscreenElement: {} });
}

describe('WP-22 T3 — 跨場景 sim 狀態不變性', () => {
  it('placeholder-room / field-low / urban-high 使用同輸入序列時逐 tick 狀態與記錄資料 bit-exact 一致', () => {
    const placeholder = runCounterstrafeTrace({ scene: placeholderRoom });
    const field = runCounterstrafeTrace({ scene: fieldLow });
    const urban = runCounterstrafeTrace({ scene: urbanHigh });

    expect(field.tickSnaps).toEqual(placeholder.tickSnaps);
    expect(field.snapshot).toEqual(placeholder.snapshot);
    expect(field.phase).toBe(placeholder.phase);
    expect(urban.tickSnaps).toEqual(placeholder.tickSnaps);
    expect(urban.snapshot).toEqual(placeholder.snapshot);
    expect(urban.phase).toBe(placeholder.phase);
  });
});

describe('WP-22 T3 — 跨解析度模式 sim 狀態不變性', () => {
  it('native / fhd-1080 / qhd-1440 已套用 buffer 後，完整 sim 逐 tick 狀態與記錄資料仍一致', () => {
    const native = runCounterstrafeTrace({ mode: 'native' });
    const fhd = runCounterstrafeTrace({ mode: 'fhd-1080' });
    const qhd = runCounterstrafeTrace({ mode: 'qhd-1440' });

    expect(native.display).toEqual({ mode: 'native', bufferW: 1920, bufferH: 1080 });
    expect(fhd.display).toEqual({ mode: 'fhd-1080', bufferW: 1920, bufferH: 1080 });
    expect(qhd.display).toEqual({ mode: 'qhd-1440', bufferW: 2560, bufferH: 1440 });
    expect(fhd.tickSnaps).toEqual(native.tickSnaps);
    expect(fhd.snapshot).toEqual(native.snapshot);
    expect(fhd.phase).toBe(native.phase);
    expect(qhd.tickSnaps).toEqual(native.tickSnaps);
    expect(qhd.snapshot).toEqual(native.snapshot);
    expect(qhd.phase).toBe(native.phase);
  });
});

describe('WP-22 T3 — seeded spawn 序列重現', () => {
  it('detection_popin_v1 同 seed 產生固定 spawn golden', () => {
    const sequence = runDetectionSpawnSequence(21021);

    expect(sequence).toEqual([
      {
        type: 'visible',
        targetId: 't0',
        side: 'R',
        t: 5117.1875,
        targetX: 0.7239966401139047,
        targetY: 1.5,
        targetZ: -3.4012409867511715,
      },
      {
        type: 'visible',
        targetId: 't1',
        side: 'R',
        t: 7468.75,
        targetX: 0.786818106628821,
        targetY: 1.5,
        targetZ: -3.107224876113357,
      },
      {
        type: 'visible',
        targetId: 't2',
        side: 'R',
        t: 10695.3125,
        targetX: 0.42955745782154425,
        targetY: 1.5,
        targetZ: -3.28080828990762,
      },
    ]);
    expect(runDetectionSpawnSequence(21021)).toEqual(sequence);
  });

  it('legacy L/R slot drill 不啟用 seeded spawn 時，不因 sequence.seed 改變 spawn 位置', () => {
    expect(runLegacySlotSpawnSequence(1)).toEqual(runLegacySlotSpawnSequence(999));
  });
});
