import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions } from '../scene/clearance.ts';
import { angularSizeToHitboxWidthU } from './peek_click_transfer_pilot_v1.ts';
import {
  PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS,
  PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG,
} from './peek_click_transfer_pilot_v2.ts';

/**
 * peek_click_transfer_v1 — WP-53 / T1 — PLACEHOLDER SCAFFOLD, NOT A FORMAL FREEZE
 *
 * GD-28（DECISIONS.md）：WP-53 的 formal freeze gate（T0）尚未通過——WP-52 真人 pilot evidence
 * 仍未收集（見 wp-52 T4-manual-pilot-gate.md「No-go, pending manual execution」）。使用者明確
 * override，允許先建 config/metadata/registry 骨架，但**不得**引用任何真人 evidence 拍板的凍結值。
 * 本檔的角尺寸/protocol version 只是沿用 `peek_click_transfer_pilot_v2` 的 2.5° 預設候選作占位；
 * 真人 pilot evidence 到位、WP-53 T0 真正拍板後，必須把這裡的值換成 freeze decision 的實際結果，
 * 並移除 PROVISIONAL 標記（見 progress.md 2026-09-01 條目的收尾清單）。
 *
 * Shape 沿用 pilot v1/v2 的 wrapper pattern（sceneId + clearanceOptions 隨 drill 一起帶），因為正式
 * 版沿用同一個 `peek-ad-corridor-v1` 場景/occlusion 設定，T4 Session Plan 整合需要這兩個欄位。
 */

/** PLACEHOLDER — 帶 `-provisional` 後綴，刻意不使用 OQ-53-1 預定的正式字串，避免被誤認為已凍結。 */
export const PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION = 'peek-click-transfer-v1.0.0-provisional';

/** PLACEHOLDER：沿用 pilot v2 的 2.5° 預設候選（唯一有手動走查紀錄的候選），非 freeze decision 產出。 */
export const PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG = PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG;

/** 沿用 `peek-ad-corridor-v1` 場景校準距離（D-45.10），與 pilot v1/v2 相同，非 freeze 決策項。 */
export const PEEK_CLICK_TRANSFER_V1_DISTANCE_U = 8;

export const PEEK_CLICK_TRANSFER_V1_TARGET_COUNT = 20;

/** PLACEHOLDER：沿用 pilot v1/v2 既有 timing，未經 freeze decision 拍板。 */
export const PEEK_CLICK_TRANSFER_V1_TIMING = {
  countdownMs: 3000,
  peekTimeoutMs: 3000,
  timeLimitMs: 120000,
} as const;

export const PEEK_CLICK_TRANSFER_V1_VISIBILITY = { sampleCount: 9, onsetThreshold: 0.5 } as const;

export const PEEK_CLICK_TRANSFER_V1_ID = 'peek_click_transfer_v1';

/**
 * Formal-only seed — distinct from pilot v1's 94000-series and pilot v2's 95000/95100/95200
 * series, so a formal run's seed can never collide with a pilot cohort's exported seed.
 */
const PEEK_CLICK_TRANSFER_V1_SEED = 96000;

const PEEK_CLICK_TRANSFER_V1_WIDTH_U = angularSizeToHitboxWidthU(
  PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG,
  PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
);

export interface PeekClickTransferV1Config {
  readonly id: string;
  readonly sceneId: 'peek-ad-corridor-v1';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: typeof PEEK_CLICK_TRANSFER_V1_VISIBILITY;
  readonly protocolVersion: string;
}

/**
 * PLACEHOLDER formal Assessment config（WP-53 T1）。`mode:'assessment'` + 獨立 `drillId`，不沿用
 * 任何 pilot drill id（FR-53-2）。凍結數值全數為 GD-28 記載的 provisional 占位值。
 */
export const peekClickTransferV1: PeekClickTransferV1Config = {
  id: PEEK_CLICK_TRANSFER_V1_ID,
  sceneId: 'peek-ad-corridor-v1',
  clearanceOptions: PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS,
  visibility: PEEK_CLICK_TRANSFER_V1_VISIBILITY,
  protocolVersion: PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION,
  drill: {
    drillId: PEEK_CLICK_TRANSFER_V1_ID,
    mode: 'assessment',
    cue: { kind: 'single' },
    targets: {
      count: PEEK_CLICK_TRANSFER_V1_TARGET_COUNT,
      distance: PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
      hitbox: {
        widthU: PEEK_CLICK_TRANSFER_V1_WIDTH_U,
        heightU: PEEK_CLICK_TRANSFER_V1_WIDTH_U,
        depthU: 1,
      },
    },
    sequence: { alternation: 'LR', seed: PEEK_CLICK_TRANSFER_V1_SEED, spawnDelayMsRange: [500, 500] },
    timing: PEEK_CLICK_TRANSFER_V1_TIMING,
    endCondition: { type: 'targetCount', value: PEEK_CLICK_TRANSFER_V1_TARGET_COUNT },
  },
};
