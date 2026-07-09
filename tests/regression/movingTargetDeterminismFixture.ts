import * as THREE from 'three/webgpu';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { trackingV1 } from '../../src/drill/tracking_v1.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { ak47 } from '../../src/weapon/weapons.ts';

/**
 * 移動目標跨 render FPS 決定性回歸 fixture（WP-18 / T5，CLAUDE.md §4 移動目標決定性硬約束）。
 *
 * 沿用 `spray-determinism` / `determinism` 的完整-sim harness：同一條合成輸入序列（held fire）在
 * 不同 render FPS 幀切法下驅動生產同源管線——`createSimLoop` + `TargetManager`（**每 tick 依 `age`
 * 純函式驅動移動目標 pos**，WP-18 T1）+ `DrillRunner`（timed presentation，命中不撤除，T3）+
 * `HitDetector`（**sub-tick 命中內插**，fire 時間戳 → subAlpha，T2）+ `DataRecorder`（逐 tick
 * `tx/ty/tz` + fire 事件）——斷言**逐 tick sim 狀態**與**整份記錄資料集**皆 render-FPS 無關。
 *
 * 守護對象：任何後續改動若把 frame delta 偷渡進 motion drive（誤把 frame dt 當 age 步長、把命中
 * 內插綁到 rAF 幀邊界），會使不同 FPS 的 per-tick 目標 `pos` 或 sub-tick 命中序列分歧 → 本測試紅燈
 * 擋下。這是移動目標決定性契約的回歸防線（README failure-mode「motion drive 誤用變動 dt / 讀時鐘」）。
 *
 * 玩家靜止（純追蹤，GD-7）：camera + `state.aim` 固定對準 pingpong 中心，故命中判定只由目標的
 * sub-tick 內插位置（+ seeded recoil/spread）決定，非每-幀 camera 耦合——移動目標因此可在 headless
 * 決定性 harness 內被 sub-tick 命中覆蓋（有別於 counter-strafe 決定性測試刻意不注入 camera）。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0;
const CAMERA_EYE_HEIGHT = 1.6;

/** pingpong 中心（trackingV1：首側 L → x=-2、distance 4 → z=-4、TARGET_Y=1.5）。aim 固定對此。 */
const TRACK_CENTER = { x: -2, y: 1.5, z: -4 } as const;

/** held-fire 窗：countdown（3000ms）之後、running 相位開火;up 遠在末端以維持整段 held。 */
export const FIRE_DOWN_MS = 3100;
export const FIRE_UP_MS = 6000;
/** 總模擬時間落在第 EXPECTED_TICKS 個 tick 窗中段;覆蓋 countdown→running + ≥1 presentation。 */
export const EXPECTED_TICKS = 780;
export const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS; // ≈6097.66ms

export interface MovingTargetRun {
  snapshot: DataRecorderSnapshot;
  phase: string;
  ticks: number;
  fireCount: number;
  hitCount: number;
  /** 記錄期間出現過的相異 tx 值個數（>1 證明目標真的在移動，非常數）。 */
  distinctTx: number;
}

export const movingTargetFrameSequences: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, END_MS),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
};

/** Ground truth：每幀恰一 tick（`pump(k·tickMs)`）→ canonical per-tick 軌跡 + 記錄資料集。 */
export function canonicalMovingTargetFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k <= EXPECTED_TICKS; k++) abs.push(k * TICK_MS);
  return abs;
}

export function runMovingTarget(absTimes: readonly number[]): MovingTargetRun {
  const config = loadDrill(trackingV1);
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const camera = createCamera();
  const seed = config.sequence.seed ?? 1;
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, camera, drillRunner, recorder, ak47, seed);

  drillRunner.start(config); // 先 start（resetState 會 clear 輸入 ring）……
  applyAimFixture(state); //     ……固定 aim 對準 pingpong 中心（玩家靜止）……
  pushEvent(state, { type: 'fire', down: true, t: FIRE_DOWN_MS }); // ……再推 held fire。
  pushEvent(state, { type: 'fire', down: false, t: FIRE_UP_MS });

  let ticks = 0;
  for (const now of absTimes) ticks += sim.pump(now).ticks;

  const snapshot = recorder.snapshot();
  const distinctTx = new Set(snapshot.ticks.filter((tk) => tk.tx !== null).map((tk) => tk.tx)).size;
  return {
    snapshot,
    phase: drillRunner.phase,
    ticks,
    fireCount: recorder.fireCount,
    hitCount: recorder.hitCount,
    distinctTx,
  };
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

/** 抖動幀序列：決定性 LCG（非 Math.random，守測試可重現）在 basePeriod 上下抖 ±50%。 */
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
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, CAMERA_EYE_HEIGHT, 0);
  camera.lookAt(TRACK_CENTER.x, TRACK_CENTER.y, TRACK_CENTER.z);
  camera.updateMatrixWorld(true); // Raycaster / getWorldPosition 讀 matrixWorld（測試須顯式更新）
  return camera;
}

/** 固定 aim 對準 pingpong 中心（眼位 0,1.6,0）——與 trackingDerivation 的 aimAtCenter 同慣例。 */
function applyAimFixture(state: SharedState): void {
  const dx = TRACK_CENTER.x - 0;
  const dy = TRACK_CENTER.y - CAMERA_EYE_HEIGHT;
  const dz = TRACK_CENTER.z - 0;
  const len = Math.hypot(dx, dy, dz);
  state.aim.yaw = Math.atan2(-dx, -dz);
  state.aim.pitch = Math.asin(dy / len);
}
