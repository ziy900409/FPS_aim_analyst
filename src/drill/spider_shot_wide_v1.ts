import type { DrillConfig, TargetHitboxConfig } from './DrillConfig.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_HITBOX_DIAMETER_U,
  SPIDER_WIDE_SCREEN_MARGIN,
  SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  SPIDER_WIDE_YAW_EDGE_FACTOR,
  resolveSpiderWideYawPitch,
  spiderWideResolveInput,
} from './spiderShotWide.ts';

/**
 * WP-57 / T1 —— `spider-shot-wide-v1`：researcher-only／practice 的**大幅度拉槍**drill。
 *
 * 與 `spider-shot-v1`（WP-36/39 凍結）、`spider-shot-v2`（WP-44 分層）是**同輩不同構念**而非後繼
 * 版本（OQ-57.1／D-57.P13：故不叫 `v3`）：刺激的眼睛所見角位移從 v2 的 ~10–25° 提升到 ~40–70°，
 * 且周邊落點貼近當次 FOV／aspect 的水平極限。v1/v2 的參數、幾何與凍結狀態不因本 drill 改變。
 *
 * **本 drill 的 config 不是常數**：`peripheral.yawMagDegRange` 必須在 arm 時依當下 FOV／aspect
 * 解析（`resolveSpiderShotWideV1()`），故此處只放與顯示狀態無關的 template。T6 負責把 resolve
 * 接到 `main.ts` 的 `activeDrillConfig` 賦值處（`createTargetManager` 消費 config 之前）。
 *
 * Delivery policy（v1）：practice-only —— 不寫入 participant 歷史、不產生 compatibility cell、
 * 不進 `DrillMetricRegistry`；時序參數為未校準候選值（OQ-57.4）。
 */
export const SPIDER_SHOT_WIDE_DRILL_ID = 'spider-shot-wide-v1' as const;
export const WIDE_FLICK_ARENA_SCENE_ID = 'wide-flick-arena' as const;

/** 與 v1/v2 獨立的 RNG 串流（GD-5：seed 進匯出 metadata）。 */
export const SPIDER_SHOT_WIDE_SEED = 57001;
/** side（恆 2）× pitchBands 的分層佇列維度；pitch 分層是**平衡**手段，不是條件變因。 */
export const SPIDER_SHOT_WIDE_PITCH_BANDS = 2;
/** 未校準候選值（OQ-57.4）：Fitts 難度由 v2 的 4.09 bit 升到 5.64 bit（≈ +155 ms）。 */
export const SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS = 2500;
/**
 * OQ-57.4（2026-09-08 由使用者拍板為 **60 s**，見 D-57.T6-2）。
 *
 * 規劃期選 90 s 的理由是每 cell 樣本數（≈14）；T6 實機掃描顯示那個數字只在 ≤800 ms 的 per-trial
 * 節奏成立（1,000 ms → 11/cell、1,200 ms → 9/cell），而 60 s 在同樣節奏下降到約 9–12/cell。
 * 使用者仍選 60 s：v1 是 practice-only、**明確不宣稱信度**（C-D3），故樣本量不是交付條件；
 * 晉升 Assessment 的 WP 必須自行重新解決樣本量（README §5 handoff）。
 */
export const SPIDER_SHOT_WIDE_TIME_LIMIT_MS = 60000;

/** Sphere subtending 2.0° at the fixed 8u wide-flick distance（GD-7：命中與 `W_deg` 同源）。 */
export const SPIDER_SHOT_WIDE_HITBOX: TargetHitboxConfig = {
  widthU: SPIDER_WIDE_HITBOX_DIAMETER_U,
  heightU: SPIDER_WIDE_HITBOX_DIAMETER_U,
  depthU: SPIDER_WIDE_HITBOX_DIAMETER_U,
  shape: 'sphere',
};

/** 未解析的 template：缺 `spiderShot`，因為那一段要等 arm 時的 FOV／aspect。 */
export const spiderShotWideV1Template: Omit<DrillConfig, 'spiderShot'> = {
  drillId: SPIDER_SHOT_WIDE_DRILL_ID,
  mode: 'practice',
  // FR-57.8：yaw/pitch 是相對 `eye = sim 原點` 定義的，玩家一旦橫移刺激的角度語意即失效。
  // 滑鼠視角、Pointer Lock 與開火路徑不受影響（WP-56 交付的既有 seam）。
  playerControl: { translation: 'locked' },
  targets: {
    // Safety ceiling only; the 90s time limit is the actual completion condition.
    count: 300,
    distance: SPIDER_WIDE_DISTANCE_U,
    hitbox: SPIDER_SHOT_WIDE_HITBOX,
  },
  // Required legacy compatibility field; ignored by the spiderShot branch.
  sequence: { alternation: 'LR' },
  timing: {
    countdownMs: 3000,
    peekTimeoutMs: SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS,
  },
  endCondition: { type: 'timeLimit', value: SPIDER_SHOT_WIDE_TIME_LIMIT_MS },
};

export interface SpiderShotWideV1Binding {
  readonly id: typeof SPIDER_SHOT_WIDE_DRILL_ID;
  readonly sceneId: typeof WIDE_FLICK_ARENA_SCENE_ID;
}

/**
 * Scene binding 在此宣告，實際的寬場 arena config 與註冊由 T3 交付（同一 sceneId）。預設
 * `[10, 10, 3]` 房間在**任一 FOV 的整段 yaw 窗**都會讓目標穿側牆，故本 drill 不可綁預設場景。
 */
export const spiderShotWideV1Binding: SpiderShotWideV1Binding = {
  id: SPIDER_SHOT_WIDE_DRILL_ID,
  sceneId: WIDE_FLICK_ARENA_SCENE_ID,
};

/**
 * Arm-time resolve：讀一次當下的垂直 FOV 與 camera aspect，產出完整 `DrillConfig`。
 * 之後 run 內的 resize／解析度切換**不重解析**（NFR-57.5：spawn 序列逐位不變）。
 */
export function resolveSpiderShotWideV1(fovDegVertical: number, aspect: number): DrillConfig {
  const resolved = resolveSpiderWideYawPitch(spiderWideResolveInput(fovDegVertical, aspect));
  return {
    ...spiderShotWideV1Template,
    spiderShot: {
      kind: 'center-peripheral-yawpitch',
      seed: SPIDER_SHOT_WIDE_SEED,
      distanceU: SPIDER_WIDE_DISTANCE_U,
      peripheral: {
        yawMagDegRange: resolved.yawMagDegRange,
        pitchDegRange: resolved.pitchDegRange,
      },
      grid: { pitchBands: SPIDER_SHOT_WIDE_PITCH_BANDS },
      centerExemptFromTimeout: true,
      resolvedFrom: {
        fovDegVertical,
        aspect,
        screenMargin: SPIDER_WIDE_SCREEN_MARGIN,
        kLo: SPIDER_WIDE_YAW_EDGE_FACTOR,
        targetAngularDiameterDeg: SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
      },
    },
  };
}
