import * as THREE from 'three/webgpu';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { resolveSpiderShotWideV1 } from '../../src/drill/spider_shot_wide_v1.ts';
import type { DrillConfig } from '../../src/drill/DrillConfig.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { PLAYER_EYE_HEIGHT_U } from '../../src/sim/playerEye.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import { resolveMouseGain } from '../../src/input/mouseGain.ts';
import { uspSLaser } from '../../src/weapon/weapons.ts';

/**
 * WP-57 / T2 —— `spider-shot-wide-v1` 的跨 render FPS 決定性（NFR-57.1）與 aspect 不變性
 * （NFR-57.5）harness。
 *
 * 沿用 `movingTargetDeterminismFixture` 的完整-sim 慣例：同一條合成輸入序列在不同 render FPS 幀
 * 切法下驅動生產同源管線——`createSimLoop`（`translation: 'locked'`，對齊 drill 的
 * `playerControl`）+ `TargetManager`（新的 `center-peripheral-yawpitch` spawn 分支）+
 * `DrillRunner`（countdown／`peekTimeoutMs` 撤除）+ `HitDetector` + `DataRecorder`（逐 tick
 * `tx/ty/tz` 與 `replayTargetId`）——斷言**逐 tick sim 狀態**與 render FPS 無關。
 *
 * **為什麼要開火**：本 drill 的 `centerExemptFromTimeout: true` 讓中心目標不會逾時撤除，因此若
 * 完全不開火，整段 run 會停在第一顆中心目標上，spawn 序列退化成單一樣本、測不到分層佇列。這裡改用
 * 「射中心 → 周邊 spawn → 周邊逾時撤除 → 中心 spawn」的循環驅動：中心目標恰在準心正前方
 * `(0, 眼高, −distanceU)`，故固定 aim 即可命中，不需要合成滑鼠軌跡（那會把 harness 自身的幀邊界
 * 帶進刺激，反而汙染 FPS parity 的歸因）。
 *
 * 武器用 `usp_s_laser`（recoil / inaccuracy 全 0）而非 `ak47`：本 fixture 要驗的是 spawn 幾何的
 * 決定性，不是彈道；零散佈讓每個循環的命中成為結構事實，circle 不會因後座力抽樣而斷開。彈道決定性
 * 另有 `spray-determinism` / `projectile-determinism` 專責。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0;

/** 出貨的 arm-time 解析參數（FOV 75 / 16:9）；aspect 不變性測試會在 run 中改 camera，不改這裡。 */
export const FIXTURE_FOV_DEG = 75;
export const FIXTURE_ASPECT = 16 / 9;

/** 首次開火在 countdown（3000ms）之後；週期 > `peekTimeoutMs`，見上方循環說明。 */
export const FIRST_FIRE_MS = 3100;
export const FIRE_PERIOD_MS = 2600;
export const FIRE_COUNT = 8;
export const END_MS = FIRST_FIRE_MS + FIRE_COUNT * FIRE_PERIOD_MS; // 23,900ms ≈ 3,059 ticks

/** 逐 tick 的 sim 狀態切片：tick index 對應的 active target id 與位置（NFR-57.1 的斷言對象）。 */
export interface WideTickSample {
  readonly targetId: string | null;
  readonly tx: number | null;
  readonly ty: number | null;
  readonly tz: number | null;
  /**
   * WP-60 / T2：該 tick 窗的 mouse 積分結果（`mouseCapture` 省略 ⇒ 恆 `null`，故既有 WP-57 斷言
   * 兩側同形、逐位不變）。raw sample 錄製屬唯寫旁路，開／關這兩欄必須逐位一致（NFR-60.1）。
   */
  readonly dYaw: number | null;
  readonly dPitch: number | null;
}

export interface WideRun {
  readonly ticks: number;
  readonly phase: string;
  readonly fireCount: number;
  readonly hitCount: number;
  readonly samples: readonly WideTickSample[];
  /** 出現過的相異 target id 序列（= spawn 序列）；證明 run 真的走完多個佇列 cell。 */
  readonly spawnIds: readonly string[];
  /** 各 spawn 的首見位置，依 spawn 順序。 */
  readonly spawnPositions: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /**
   * WP-57 / T4：原始 recorder snapshot（additive）。匯出 round-trip 需要真實的 `visible`／`fire`
   * 事件與逐 tick 紀錄，而不是本 fixture 為 parity 斷言壓縮過的 `samples`。決定性測試不讀此欄位。
   */
  readonly snapshot: DataRecorderSnapshot;
}

export const wideFrameSequences: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, END_MS),
  '抖動 144 Hz ±50%（rAF 節流）': jitterFrames(1000 / 144, END_MS),
};

/** Ground truth：每幀恰一 tick → canonical per-tick 軌跡。 */
export function canonicalWideFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k * TICK_MS <= END_MS; k++) abs.push(k * TICK_MS);
  return abs;
}

export function wideDrillConfig(): DrillConfig {
  return loadDrill(resolveSpiderShotWideV1(FIXTURE_FOV_DEG, FIXTURE_ASPECT));
}

/** WP-60 / T2：合成 sub-frame 滑鼠樣本（絕對 ms，須嚴格升冪；`dx`/`dy` 為 raw counts）。 */
export interface WideMouseSample {
  readonly dx: number;
  readonly dy: number;
  readonly t: number;
}

/**
 * WP-60 / T2 的滑鼠擷取佈線。給定 `samples` 即啟用 tick 窗積分（`FIXTURE_MOUSE_GAIN`）並把樣本
 * 漸進推入輸入 ring；`recordMouseSamples` 則額外開啟 raw 擷取旁路，兩者的差集正是 NFR-60.1 要證
 * 明「不改任何既有行為」的那一項。省略整個欄位 ⇒ run 逐位沿用 WP-57 的既有行為。
 */
export interface WideMouseCaptureOptions {
  readonly samples: readonly WideMouseSample[];
  /** 省略／`false` = 決定性對照組（只跑既有聚合流）。 */
  readonly recordMouseSamples?: boolean;
  /** 溢位情境用的容量覆寫；省略走 `mouseSampleCapacityForDrill()` 的預設推導。 */
  readonly mouseSampleCapacity?: number;
}

export interface WideRunOptions {
  /**
   * NFR-57.5：在**第 n 個幀邊界之後**改變 camera 的 aspect／FOV（模擬 run 內 resize 或解析度模式
   * 切換）。spawn 幾何若真的只在 arm 時解析一次，這裡怎麼改都不能動到 spawn 序列。
   */
  readonly resizeAfterFrame?: { readonly frameIndex: number; readonly aspect: number; readonly fovDeg: number };
  /** WP-60 / T2：見 [`WideMouseCaptureOptions`](#)。 */
  readonly mouseCapture?: WideMouseCaptureOptions;
}

/**
 * WP-60 / T2：本 fixture 的感度 gain 單一來源（`sensitivity: 1` × 出貨 hip FOV）。走生產的
 * `resolveMouseGain()`，故測試不可能與 app 的換算發散（KI-005 / A 的單一定義紀律）。
 */
export const FIXTURE_MOUSE_GAIN = resolveMouseGain({ sensitivity: 1, hipFovDeg: FIXTURE_FOV_DEG });

export function runWide(absTimes: readonly number[], options: WideRunOptions = {}): WideRun {
  const config = wideDrillConfig();
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const mouseCapture = options.mouseCapture;
  const recorder = createDataRecorder({
    simHz: SIM_HZ,
    ...(mouseCapture !== undefined ? { mouseIntegration: { gain: FIXTURE_MOUSE_GAIN } } : {}),
    ...(mouseCapture?.recordMouseSamples === true ? { recordMouseSamples: true } : {}),
    ...(mouseCapture?.mouseSampleCapacity !== undefined
      ? { mouseSampleCapacity: mouseCapture.mouseSampleCapacity }
      : {}),
  });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const camera = createCamera();
  const sim = createSimLoop(
    state,
    clock,
    SIM_HZ,
    targetManager,
    camera,
    drillRunner,
    recorder,
    uspSLaser,
    config.spiderShot?.seed ?? 1,
    { translation: 'locked' },
  );

  drillRunner.start(config); // 先 start（resetState 會 clear 輸入 ring）……
  aimAtCenterTarget(state); //  ……再固定 aim 對準中心目標（yaw = pitch = 0）……
  for (let i = 0; i < FIRE_COUNT; i++) {
    // ……最後推入單發開火（down/up 成對，避免連發把週期與 cycletime 綁在一起）。
    const downMs = FIRST_FIRE_MS + i * FIRE_PERIOD_MS;
    pushEvent(state, { type: 'fire', down: true, t: downMs });
    pushEvent(state, { type: 'fire', down: false, t: downMs + 20 });
  }

  // WP-60 / T2：合成樣本**漸進**入 ring（輸入 ring 只有 512 槽，一次全推會溢位並靜默丟資料）。
  // 每幀 pump 前推入 `t <= 該幀時間` 的樣本 —— sim 邏輯時鐘恆 ≤ 幀時間，故本 tick 需要的樣本必然
  // 已在 ring 內；事件落哪個 tick 只由 `t` 與固定 tick 邊界決定（GD-3），與推入時機無關。
  let mouseCursor = 0;
  function pushDueMouseSamples(untilMs: number): void {
    if (mouseCapture === undefined) return;
    const samples = mouseCapture.samples;
    while (mouseCursor < samples.length && samples[mouseCursor].t <= untilMs) {
      const sample = samples[mouseCursor];
      // 拒收即代表 ring 已滿 —— 靜默丟樣本會讓 parity 斷言比較兩份都殘缺的資料，故立即爆掉。
      if (!pushEvent(state, { type: 'mouse', dx: sample.dx, dy: sample.dy, t: sample.t })) {
        throw new Error(`input ring full while feeding mouse sample #${mouseCursor} (t=${sample.t})`);
      }
      mouseCursor++;
    }
  }

  let ticks = 0;
  for (let i = 0; i < absTimes.length; i++) {
    pushDueMouseSamples(absTimes[i]);
    ticks += sim.pump(absTimes[i]).ticks;
    const resize = options.resizeAfterFrame;
    if (resize !== undefined && i === resize.frameIndex) {
      camera.aspect = resize.aspect;
      camera.fov = resize.fovDeg;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }
  }

  const snapshot = recorder.snapshot();
  const samples: WideTickSample[] = snapshot.ticks.map((tick) => ({
    targetId: tick.replayTargetId ?? null,
    tx: tick.tx ?? null,
    ty: tick.ty ?? null,
    tz: tick.tz ?? null,
    dYaw: tick.dYaw ?? null,
    dPitch: tick.dPitch ?? null,
  }));

  const spawnIds: string[] = [];
  const spawnPositions: { x: number; y: number; z: number }[] = [];
  for (const sample of samples) {
    if (sample.targetId === null || sample.targetId === spawnIds[spawnIds.length - 1]) continue;
    spawnIds.push(sample.targetId);
    spawnPositions.push({ x: sample.tx!, y: sample.ty!, z: sample.tz! });
  }

  return {
    ticks,
    phase: drillRunner.phase,
    fireCount: recorder.fireCount,
    hitCount: recorder.hitCount,
    samples,
    spawnIds,
    spawnPositions,
    snapshot,
  };
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

/** 抖動幀序列：決定性 LCG（非 `Math.random`，守測試可重現）在 basePeriod 上下抖 ±50%。 */
function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand()); // [0.5, 1.5)·basePeriod，恆 < 250ms（不夾）
    if (t + d >= endMs) break;
    t += d;
    abs.push(t);
  }
  abs.push(endMs);
  return abs;
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(FIXTURE_FOV_DEG, FIXTURE_ASPECT, 0.1, 1000);
  camera.position.set(0, PLAYER_EYE_HEIGHT_U, 0);
  camera.lookAt(0, PLAYER_EYE_HEIGHT_U, -1);
  camera.updateMatrixWorld(true); // Raycaster / getWorldPosition 讀 matrixWorld（測試須顯式更新）
  return camera;
}

/** 中心目標在 `(0, 眼高, −distanceU)`，故正前方即命中；yaw = pitch = 0。 */
function aimAtCenterTarget(state: SharedState): void {
  state.aim.yaw = 0;
  state.aim.pitch = 0;
}
