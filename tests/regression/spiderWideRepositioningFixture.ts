import type { ExportPayload } from '../../src/data/export.ts';
import type { Meta } from '../../src/data/metadata.ts';
import { SPIDER_WIDE_DISTANCE_U } from '../../src/drill/spiderShotWide.ts';
import {
  SPIDER_SHOT_WIDE_DRILL_ID,
  SPIDER_SHOT_WIDE_HITBOX,
  SPIDER_SHOT_WIDE_SEED,
} from '../../src/drill/spider_shot_wide_v1.ts';
import type { RepositioningSuspicionOptions } from '../../src/metrics/spiderShotRepositioning.ts';

/**
 * WP-57 / T5 —— wide-flick 合成訊號產生器（分類測試與門檻敏感度表共用）。
 *
 * **為什麼是合成的**：T5 的判準需要「窗內存在長時間近零 ω」這個訊號的**已知 ground truth**，而
 * T6（實機）尚未執行，repo 內唯一走生產管線的 wide run（`spiderWideDeterminismFixture`）刻意把
 * aim 釘在 `yaw = pitch = 0`（見該檔頁首：合成滑鼠軌跡會把 harness 自身的幀邊界帶進刺激），
 * 因此它一個可推導的偵測窗都產不出來 —— 這件事由 sensitivity 測試實測入帳，不是假設。
 *
 * **單一產生器**：四類訊號只差在停滯的長度與位置，其餘（幾何、tick 節奏、reaction、抵達方式）
 * 逐格相同，故分類差異只能來自判準本身。
 *
 * 幾何取自出貨常數（`SPIDER_WIDE_DISTANCE_U`／`SPIDER_SHOT_WIDE_HITBOX`），不另立尺寸常數。
 * 眼睛在原點、目標 `y = 0` ⇒ 純 yaw 平面，pitch 恆 0：這讓 ω 完全由 `dYaw` 決定，停滯的注入
 * 與量測之間沒有第二個自由度。
 */

/** 合成 tick 節奏（ms）。刻意用整數 10 ms 而非 7.8125，讓時間斷言是精確值而非浮點近似。 */
export const TICK_MS = 10;

export const CENTER_ID = 'center-0';
export const PERIPHERAL_ID = 'peripheral-1';
export const TRAILING_CENTER_ID = 'center-1';

/** 周邊目標的 eye-frame yaw 幅度（deg）；WP-57 的窗是 47.5–51.6°，取其中段。 */
export const PERIPHERAL_YAW_DEG = 50;

/** `visible` 於 600 ms，讓預設 `preStimulusMs = 500` 的基線窗完整落在靜止段內。 */
export const PERIPHERAL_VISIBLE_MS = 600;

export const DEFAULT_REACTION_MS = 200;
export const DEFAULT_MOVE_MS = 300;
export const DEFAULT_DWELL_MS = 300;

/**
 * 分類測試用的門檻。**這不是凍結值** —— OQ-57.5 要以真實資料收斂（見 progress.md 的敏感度表）。
 * 此處只需要一組能把「250 ms 停滯」與「60 ms 刻意停頓」分開的值。
 */
export const REPOSITIONING_OPTIONS: RepositioningSuspicionOptions = {
  stallMinMs: 150,
  stallOmegaDegPerSec: 10,
};

export interface FlickPlan {
  /** `visible` 之後、開始移動之前的靜止時間（ms）。窗左界之外的停滯即由加長它產生。 */
  readonly reactionMs?: number;
  /** 實際移動的總時間（ms，不含停滯）。 */
  readonly moveMs?: number;
  /**
   * 注入一段停滯：移動了 `afterMovedMs` 之後，把角速度降到 `residualDegPerSec`（預設 0 =
   * 真正的抬滑鼠，準心完全不動）持續 `durationMs`。非零殘餘速度模擬「猶豫但仍在微調」的刻意
   * 停頓 —— 那正是 `stallOmegaDegPerSec` 這個門檻要分開的東西。
   */
  readonly stall?: {
    readonly afterMovedMs: number;
    readonly durationMs: number;
    readonly residualDegPerSec?: number;
  };
  /** 抵達後停在目標上的時間（ms）。窗右界之外的停滯即由加長它產生。 */
  readonly dwellMs?: number;
  /** false = 拉槍停在距目標 20° 處，整段 presentation 都不會 on-target（acquisition failure）。 */
  readonly arrive?: boolean;
  /** true = 整段完全不動 ⇒ detection `timeout` ⇒ 窗不存在。 */
  readonly neverMoves?: boolean;
  /** 覆寫 `meta.sensitivity`，讓 `deriveMouseThrow()` 推導出不同的 `cm/360`（T5 步驟 5）。 */
  readonly sensitivity?: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 未抵達時距目標的殘餘角距（deg）；遠大於 1° 的目標角半徑，故必然 acquisition failure。 */
const SHORTFALL_DEG = 20;

export const CENTER_POINT: Point = pointAtYaw(0);
export const PERIPHERAL_POINT: Point = pointAtYaw(PERIPHERAL_YAW_DEG);

export function buildWideFlickPayload(plan: FlickPlan): ExportPayload {
  const reactionMs = plan.reactionMs ?? DEFAULT_REACTION_MS;
  const moveMs = plan.moveMs ?? DEFAULT_MOVE_MS;
  const dwellMs = plan.dwellMs ?? DEFAULT_DWELL_MS;
  const stallMs = plan.stall?.durationMs ?? 0;
  const residualDegPerMs = (plan.stall?.residualDegPerSec ?? 0) / 1000;
  const onsetMs = PERIPHERAL_VISIBLE_MS + reactionMs;
  // 停滯期間的殘餘位移**算進**總行程，故全速段恆為 `moveMs`、抵達恆在 onset + moveMs + stallMs。
  const travelDeg = (plan.arrive ?? true) ? PERIPHERAL_YAW_DEG : PERIPHERAL_YAW_DEG - SHORTFALL_DEG;
  const degPerMs = (travelDeg - residualDegPerMs * stallMs) / moveMs;
  const endMs = onsetMs + moveMs + stallMs + dwellMs;

  const yawAt = (t: number): number => {
    if (plan.neverMoves === true || t <= onsetMs) return 0;
    const since = t - onsetMs;
    if (plan.stall === undefined) return degToRad(Math.min(since, moveMs) * degPerMs);

    const stallStart = plan.stall.afterMovedMs;
    const stallEnd = stallStart + plan.stall.durationMs;
    if (since <= stallStart) return degToRad(since * degPerMs);
    if (since <= stallEnd) return degToRad(stallStart * degPerMs + (since - stallStart) * residualDegPerMs);
    const beforeResume = stallStart * degPerMs + plan.stall.durationMs * residualDegPerMs;
    return degToRad(Math.min(beforeResume + (since - stallEnd) * degPerMs, travelDeg));
  };

  const ticks: ExportPayload['ticks'] = [];
  let previousYaw = 0;
  for (let t = 0; t <= endMs; t += TICK_MS) {
    const target = t + 1e-9 >= PERIPHERAL_VISIBLE_MS && t < endMs ? PERIPHERAL_POINT : CENTER_POINT;
    const yaw = yawAt(t);
    ticks.push({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      aim: { yaw, pitch: 0 },
      keys: [],
      ads: false,
      dYaw: yaw - previousYaw,
      dPitch: 0,
    });
    previousYaw = yaw;
  }

  return {
    meta: plan.sensitivity === undefined ? META : { ...META, sensitivity: plan.sensitivity },
    ticks,
    events: [
      visible(CENTER_ID, 'center', CENTER_POINT, 0),
      visible(PERIPHERAL_ID, 'peripheral', PERIPHERAL_POINT, PERIPHERAL_VISIBLE_MS),
      visible(TRAILING_CENTER_ID, 'center', CENTER_POINT, endMs),
    ],
  };
}

/** aim yaw 的慣例是 `atan2(-x, -z)`，故 yaw φ 的落點為 `(-d·sinφ, 0, -d·cosφ)`。 */
function pointAtYaw(yawDeg: number): Point {
  const yaw = degToRad(yawDeg);
  return {
    x: -SPIDER_WIDE_DISTANCE_U * Math.sin(yaw),
    y: 0,
    z: -SPIDER_WIDE_DISTANCE_U * Math.cos(yaw),
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: Point,
  t: number,
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}

/**
 * `meta.scene.eye` + `meta.simToWorld` 皆有效 ⇒ `resolveEyeOrigin()` 走 `'meta'` 分支，眼睛在
 * 原點，與上面的落點幾何同源（不落到 `legacy-default` 的猜測 z）。
 */
const META: Meta = {
  schemaVersion: 2,
  drillId: SPIDER_SHOT_WIDE_DRILL_ID,
  weaponId: 'usp_s_laser',
  weaponSeed: 0,
  rngSeed: SPIDER_SHOT_WIDE_SEED,
  backend: 'webgpu',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 2,
  dpi: 800,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-07T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  scene: {
    sceneId: 'wide-flick-arena',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    fallback: false,
    eye: { x: 0, y: 0, z: 0 },
  },
  targets: { hitbox: SPIDER_SHOT_WIDE_HITBOX },
  spawn: { seed: SPIDER_SHOT_WIDE_SEED, spiderShot: { kind: 'center-peripheral-yawpitch' } },
};
