import { describe, expect, it } from 'vitest';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { buildExportPayload } from '../../src/data/export.ts';
import type { Meta } from '../../src/data/metadata.ts';
import { createAimIntegrator } from '../../src/input/mouseGain.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { simStep } from '../../src/loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import {
  canonicalWideFrames,
  FIXTURE_MOUSE_GAIN,
  runWide,
  wideFrameSequences,
  type WideMouseSample,
  type WideRun,
} from './spiderWideDeterminismFixture.ts';

/**
 * WP-60 / T2 —— raw mouse sample 擷取接在 sim 消費點上的證明。
 *
 * 四條互相獨立的斷言軸：
 * - **NFR-60.1（決定性）** 錄製是唯寫旁路 ⇒ 既有四 FPS parity fixture 的「開／關」兩組逐 tick
 *   `replayTargetId` + `tx/ty/tz` + `dYaw`/`dPitch` + spawn 序列必須逐位一致（`Object.is` 級，
 *   非 `toBeCloseTo`）；且開啟後仍維持跨 render FPS 決定性。
 * - **FR-60.1/60.7（同源可對齊）** 匯出區塊逐筆保留 raw counts 與事件自身時間戳，且以同一個
 *   `resolveMouseGain()` 結果重播落在各 tick 窗內的樣本，能**逐位**重現該 tick 的 `dYaw`/`dPitch`。
 *   兩個資料流同源於 `SimLoop` 的同一個消費點，故這不是巧合而是結構事實。
 * - **NFR-60.2（零額外配置）** 以 `Array.prototype.push` 計數（D-57.T2-4 手法）證明開啟錄製後
 *   sim 熱路徑的 push 次數與關閉時相同。
 * - **F3（溢位）+ D-60.P5** 溢位以獨立旗標呈現、`recorded === capacity`、tick 資料仍完整、
 *   `meta.suspect` 不變。
 *
 * 時間戳網格：所有合成樣本落在 **0.125 ms 網格**上。0.125 為 dyadic ⇒ 相鄰樣本差與其 ×1000 皆為
 * 精確整數 µs ⇒ `MouseSampleArena` 的 `Math.round(...)` 量化無損，匯出區塊可逐位還原回饋入的時間
 * （NFR-60.5 的前提；真實硬體的量化誤差由 T0 的實機 PoC 量測，本檔不假裝量到）。
 */

const TICK_MS = 1000 / SIM_HZ;

/** 一段 1000 Hz 拉槍 → 事件空洞 → 再一段 1000 Hz 拉槍（模擬感測器離地產生的時間間隙）。 */
const STROKE_SAMPLE_COUNT = 300;
const STROKE_GAP_MS = 360;

function syntheticStroke(startMs: number, seed: number): WideMouseSample[] {
  let s = seed;
  // 決定性 LCG（非 `Math.random`，守測試可重現；與 fixture 的抖動幀序列同一手法）。
  const nextDelta = (span: number): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % (2 * span + 1)) - span;
  };
  const jitterGrid = [0, 0.125, 0.25, 0.375];
  const out: WideMouseSample[] = [];
  for (const burst of [0, 1]) {
    for (let k = 0; k < STROKE_SAMPLE_COUNT; k++) {
      out.push({
        dx: nextDelta(9),
        dy: nextDelta(5),
        t: startMs + burst * STROKE_GAP_MS + k + jitterGrid[(k + burst) & 3],
      });
    }
  }
  return out;
}

/** 兩段拉槍分別落在 run 的前段與中段（皆在 countdown 之後、END_MS 之前）。 */
const MOUSE_SAMPLES: readonly WideMouseSample[] = [...syntheticStroke(5000, 7), ...syntheticStroke(15000, 13)];

function offArm(): { readonly samples: readonly WideMouseSample[] } {
  return { samples: MOUSE_SAMPLES };
}

function onArm(): { readonly samples: readonly WideMouseSample[]; readonly recordMouseSamples: true } {
  return { samples: MOUSE_SAMPLES, recordMouseSamples: true };
}

/**
 * 逐 tick trace 攤平成單一序列，供 `Object.is` 級逐位比對（`toEqual` 不區分 +0 / −0）。
 *
 * 刻意涵蓋 `TickRecord` 的**每一個**欄位，不只 DoD 點名的 `replayTargetId`/`tx,ty,tz`/`dYaw,dPitch`：
 * 錄製是否真的「唯寫」的失效模式包含寫到 player 位置或速度上，而只比目標欄位的 trace 抓不到那種
 * 突變（本檔以 `state.player.x += 1e-12` 的手動突變實測過，窄 trace 全綠通過）。
 */
function tickTrace(run: WideRun): (number | string | null)[] {
  const out: (number | string | null)[] = [];
  for (const tick of run.snapshot.ticks) {
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
      String(tick.ads),
      String(tick.fire),
      tick.dYaw ?? null,
      tick.dPitch ?? null,
      tick.replayTargetId ?? null,
    );
  }
  return out;
}

function expectBitIdentical(
  actual: readonly (number | string | null)[],
  expected: readonly (number | string | null)[],
  label: string,
): void {
  expect(actual.length).toBe(expected.length);
  const mismatches: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      mismatches.push(`${label}[${i}]: ${String(actual[i])} !== ${String(expected[i])}`);
    }
  }
  expect(mismatches).toEqual([]);
}

describe('WP-60 T2 — NFR-60.1：raw 擷取為唯寫旁路（開／關逐位一致）', () => {
  const canonicalFrames = canonicalWideFrames();
  const canonicalOff = runWide(canonicalFrames, { mouseCapture: offArm() });
  const canonicalOn = runWide(canonicalFrames, { mouseCapture: onArm() });

  it('對照組本身有資料可比（積分非零、raw 樣本全數擷取、關閉時區塊缺席）', () => {
    // 若 dYaw 恆 0 或 raw 區塊為空，下面的 parity 斷言比較的是兩份空資料，毫無證明力。
    expect(canonicalOff.samples.some((sample) => sample.dYaw !== null && sample.dYaw !== 0)).toBe(true);
    expect(canonicalOn.snapshot.mouseSampling?.recorded).toBe(MOUSE_SAMPLES.length);
    expect(canonicalOn.snapshot.mouseSampling?.overflow).toBe(false);
    // FR-60.2：關閉時 snapshot 逐位維持 pre-WP-60 形狀（兩個欄位都不存在，而非存在但為空）。
    expect(canonicalOff.snapshot.mouseSamples).toBeUndefined();
    expect(canonicalOff.snapshot.mouseSampling).toBeUndefined();
    expect('mouseSamples' in canonicalOff.snapshot).toBe(false);
    expect('mouseSampling' in canonicalOff.snapshot).toBe(false);
  });

  it.each(Object.entries(wideFrameSequences))(
    '%s：開啟錄製後逐 tick trace 與關閉時逐位一致',
    (_name, frames) => {
      const off = runWide(frames, { mouseCapture: offArm() });
      const on = runWide(frames, { mouseCapture: onArm() });

      expect(on.ticks).toBe(off.ticks);
      expect(on.phase).toBe(off.phase);
      expect(on.fireCount).toBe(off.fireCount);
      expect(on.hitCount).toBe(off.hitCount);
      expectBitIdentical(tickTrace(on), tickTrace(off), 'tick');
      expect(on.spawnIds).toEqual(off.spawnIds);
      expect(on.spawnPositions).toEqual(off.spawnPositions);
      // 唯寫旁路不得動到既有 overflow 語意（D-60.P5）。
      expect(on.snapshot.recorderOverflow).toBe(off.snapshot.recorderOverflow);
      expect(on.snapshot.events).toEqual(off.snapshot.events);
    },
  );

  it.each(Object.entries(wideFrameSequences))(
    '%s：開啟錄製後仍與 canonical 每幀一 tick 跨 render FPS 逐位一致',
    (_name, frames) => {
      const run = runWide(frames, { mouseCapture: onArm() });

      expect(run.ticks).toBe(canonicalOn.ticks);
      expectBitIdentical(tickTrace(run), tickTrace(canonicalOn), 'tick');
      expect(run.spawnIds).toEqual(canonicalOn.spawnIds);
      // 事件落哪個 tick 只由 timeStamp 與固定 tick 邊界決定（GD-3）⇒ 幀切法不得改變擷取結果。
      expect(run.snapshot.mouseSampling).toEqual(canonicalOn.snapshot.mouseSampling);
      expect(run.snapshot.mouseSamples).toEqual(canonicalOn.snapshot.mouseSamples);
    },
  );
});

describe('WP-60 T2 — FR-60.1/60.7：raw 樣本與 tick 窗積分同源可對齊', () => {
  const run = runWide(canonicalWideFrames(), { mouseCapture: onArm() });
  const block = run.snapshot.mouseSamples;

  it('逐筆保留 raw counts，不做跨事件聚合（FR-60.1）', () => {
    expect(block).toBeDefined();
    expectBitIdentical(
      [...block!.dx],
      MOUSE_SAMPLES.map((sample) => sample.dx),
      'dx',
    );
    expectBitIdentical(
      [...block!.dy],
      MOUSE_SAMPLES.map((sample) => sample.dy),
      'dy',
    );
  });

  it('`t0Ms` + Σ`dtUs` 逐位還原事件自身時間戳（同一時鐘域，FR-60.7 / NFR-60.5）', () => {
    // 累加在 µs 整數空間進行：`dtUs / 1000` 不是 dyadic，逐筆除再累加會引入捨入漂移。
    const expectedUs = MOUSE_SAMPLES.map((sample) => (sample.t - MOUSE_SAMPLES[0].t) * 1000);
    const actualUs: number[] = [0];
    for (let i = 1; i < block!.dtUs.length; i++) actualUs.push(actualUs[i - 1] + block!.dtUs[i]);

    expect(block!.t0Ms).toBe(MOUSE_SAMPLES[0].t);
    expect(block!.dtUs[0]).toBe(0);
    expectBitIdentical(actualUs, expectedUs, 'tUs');
  });

  it('每個 tick 的 `dYaw`/`dPitch` = 落在該 tick 窗內 raw 樣本經同一 gain 換算的總和（逐位）', () => {
    const ticks = run.snapshot.ticks;
    // 與 recorder 同構的重播：同一個 `createAimIntegrator()`（跨 tick 連續、pitch 夾角同源）、
    // 同一個 gain、同一個累加順序 ⇒ 浮點結果必須逐位相同，否則兩個資料流已經發散。
    const integrator = createAimIntegrator();
    const expectedYaw = new Array<number>(ticks.length).fill(0);
    const expectedPitch = new Array<number>(ticks.length).fill(0);
    let cursor = 0;
    for (let i = 0; i < ticks.length; i++) {
      // consume 窗為半開 `[.., tick.t)`、嚴格 `<`（GD-3）—— 這裡逐字沿用同一邊界。
      while (cursor < MOUSE_SAMPLES.length && MOUSE_SAMPLES[cursor].t < ticks[i].t) {
        const sample = MOUSE_SAMPLES[cursor];
        const delta = integrator.applyDelta(sample.dx, sample.dy, FIXTURE_MOUSE_GAIN.hipStep);
        expectedYaw[i] += delta.dYaw;
        expectedPitch[i] += delta.dPitch;
        cursor++;
      }
    }

    expect(cursor).toBe(MOUSE_SAMPLES.length); // 每筆樣本都落在某個已記錄的 tick 窗內
    expectBitIdentical(
      ticks.map((tick) => tick.dYaw ?? null),
      expectedYaw,
      'dYaw',
    );
    expectBitIdentical(
      ticks.map((tick) => tick.dPitch ?? null),
      expectedPitch,
      'dPitch',
    );
  });

  it('樣本落點與其所屬 tick 窗互為索引，且時間間隙在匯出中可見（FR-60.7 的用途）', () => {
    const dtMs = block!.dtUs.slice(1).map((us) => us / 1000);
    // 兩段拉槍之間的空洞（≈ 60 ms）在 dtUs 中恰好各出現一次；其餘皆為 ~1 ms 的 1000 Hz 間隔。
    const gaps = dtMs.filter((dt) => dt > 30);
    expect(gaps.length).toBe(2 * 2 - 1); // 兩段 stroke × 兩個 burst，中間三個空洞
    expect(Math.max(...dtMs.filter((dt) => dt <= 30))).toBeLessThanOrEqual(2);
    // 觀測事件率 ≈ 1000 Hz（空洞把平均拉低，故只斷言量級落在合理區間）。
    expect(run.snapshot.mouseSampling!.observedRateHz).toBeGreaterThan(50);
  });
});

/**
 * NFR-60.2 / F3 用的微型 harness：直呼 `simStep`（WP-2 向後相容路徑，無 targetManager／camera／
 * drillRunner）以便把 `Array.prototype.push` 計數**只**包住 sim tick，樣本入 ring 留在計數區外。
 */
interface MicroRun {
  readonly snapshot: DataRecorderSnapshot;
  readonly pushCalls: number;
  readonly tickCount: number;
}

function runMicro(
  samples: readonly WideMouseSample[],
  tickCount: number,
  options: { readonly recordMouseSamples?: boolean; readonly mouseSampleCapacity?: number } = {},
): MicroRun {
  const state: SharedState = createSharedState();
  const recorder = createDataRecorder({
    simHz: SIM_HZ,
    mouseIntegration: { gain: FIXTURE_MOUSE_GAIN },
    ...(options.recordMouseSamples === true ? { recordMouseSamples: true } : {}),
    ...(options.mouseSampleCapacity !== undefined ? { mouseSampleCapacity: options.mouseSampleCapacity } : {}),
  });

  const originalPush = Array.prototype.push;
  let counting = false;
  let pushCalls = 0;
  let cursor = 0;
  try {
    // 不能用 `vi.spyOn`：spy 自己會 push 進 `mock.calls` 而無限遞迴（D-57.T2-4）。
    Array.prototype.push = function patchedPush<T>(this: T[], ...items: T[]): number {
      if (counting) pushCalls++;
      return originalPush.apply(this, items);
    };
    for (let i = 1; i <= tickCount; i++) {
      const tickEndMs = i * TICK_MS;
      counting = false;
      while (cursor < samples.length && samples[cursor].t < tickEndMs) {
        pushEvent(state, { type: 'mouse', dx: samples[cursor].dx, dy: samples[cursor].dy, t: samples[cursor].t });
        cursor++;
      }
      counting = true;
      simStep(state, 1 / SIM_HZ, tickEndMs, undefined, undefined, undefined, undefined, undefined, recorder);
      counting = false;
    }
  } finally {
    Array.prototype.push = originalPush;
  }

  return { snapshot: recorder.snapshot(), pushCalls, tickCount: recorder.tickCount };
}

describe('WP-60 T2 — NFR-60.2：sim 熱路徑零額外配置', () => {
  const MICRO_TICKS = 128; // 一秒 sim ≈ 1000 筆 1000 Hz 樣本
  const microSamples = syntheticStroke(0.5, 21).filter((sample) => sample.t < MICRO_TICKS * TICK_MS);

  it('微型 harness 真的消費到樣本（否則 push 計數比較的是兩個 0）', () => {
    expect(microSamples.length).toBeGreaterThan(500);
    const on = runMicro(microSamples, MICRO_TICKS, { recordMouseSamples: true, mouseSampleCapacity: 4096 });
    expect(on.snapshot.mouseSampling?.recorded).toBe(microSamples.length);
  });

  it('開啟 raw 錄製後 `Array.prototype.push` 計數與關閉時相同', () => {
    const off = runMicro(microSamples, MICRO_TICKS);
    const on = runMicro(microSamples, MICRO_TICKS, { recordMouseSamples: true, mouseSampleCapacity: 4096 });

    expect(on.pushCalls).toBe(off.pushCalls);
    expect(on.tickCount).toBe(off.tickCount);
  });
});

describe('WP-60 T2 — F3 / D-60.P5：溢位以獨立旗標呈現，不污染既有效度旗標', () => {
  const MICRO_TICKS = 64;
  const microSamples = syntheticStroke(0.5, 31).filter((sample) => sample.t < MICRO_TICKS * TICK_MS);
  const CAPACITY = 100;

  const control = runMicro(microSamples, MICRO_TICKS, { recordMouseSamples: true, mouseSampleCapacity: 4096 });
  const overflowed = runMicro(microSamples, MICRO_TICKS, {
    recordMouseSamples: true,
    mouseSampleCapacity: CAPACITY,
  });

  it('溢位旗標為 true', () => {
    expect(microSamples.length).toBeGreaterThan(CAPACITY);
    expect(overflowed.snapshot.mouseSampling?.overflow).toBe(true);
  });

  it('`recorded === capacity`（滿了丟棄末端而非繞圈，D-60.P6）', () => {
    expect(overflowed.snapshot.mouseSampling?.recorded).toBe(CAPACITY);
    expect(overflowed.snapshot.mouseSamples?.dtUs.length).toBe(CAPACITY);
    // 保留的是最舊的連續前綴 ⇒ `t0Ms + Σ dtUs` 的重建仍然誠實。
    expect(overflowed.snapshot.mouseSamples?.t0Ms).toBe(control.snapshot.mouseSamples?.t0Ms);
    expectBitIdentical(
      [...(overflowed.snapshot.mouseSamples?.dx ?? [])],
      (control.snapshot.mouseSamples?.dx ?? []).slice(0, CAPACITY),
      'dx',
    );
  });

  it('tick 資料仍完整（tick 數與逐 tick 積分不受影響）', () => {
    expect(overflowed.tickCount).toBe(control.tickCount);
    expect(overflowed.snapshot.ticks.length).toBe(control.snapshot.ticks.length);
    expectBitIdentical(
      overflowed.snapshot.ticks.map((tick) => tick.dYaw ?? null),
      control.snapshot.ticks.map((tick) => tick.dYaw ?? null),
      'dYaw',
    );
  });

  it('`meta.suspect` 與 `meta.recorderOverflow` 不變（FR-60.9）', () => {
    expect(overflowed.snapshot.recorderOverflow).toBe(false);
    const payload = buildExportPayload(microMeta(), overflowed.snapshot);
    expect(payload.meta.suspect).toBe(false);
    expect(payload.meta.recorderOverflow).toBe(false);
    // 退化只透過新增的那一維具名呈現。
    expect(payload.meta.mouseSampling?.overflow).toBe(true);
  });
});

describe('WP-60 T2 — ADR-2：raw 擷取不新增跨迴圈通道', () => {
  const inputAndRenderModules = {
    ...import.meta.glob<string>('../../src/input/**/*.ts', { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob<string>('../../src/render/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  };

  it('`src/input/**` 與 render 層皆不得 import `mouseSampleArena`', () => {
    // 錄製點必須留在 sim loop（D-60.P3）：input loop 直接寫 data 層 arena 就是新的跨迴圈通道。
    expect(Object.keys(inputAndRenderModules).length).toBeGreaterThan(10);
    const violations = Object.entries(inputAndRenderModules)
      .filter(([, source]) => /mouseSampleArena/.test(source))
      .map(([path]) => path);

    expect(violations).toEqual([]);
  });
});

/** `buildExportPayload` 只讀 `recorderOverflow` / `suspect` / `validity`；其餘欄位僅為型別完整性。 */
function microMeta(): Meta {
  return {
    schemaVersion: 2,
    drillId: 'wp60-micro',
    weaponId: 'ak47',
    weaponSeed: 223,
    rngSeed: 1,
    backend: 'webgl2',
    displayHz: 144,
    simHz: SIM_HZ,
    browser: 'test-browser',
    sensitivity: 1,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    crossOriginIsolated: true,
    startedAt: '2026-09-08T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 300,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    weapon: { id: 'ak47' },
  };
}
