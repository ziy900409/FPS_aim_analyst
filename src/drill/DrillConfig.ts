import type { TargetMotion } from '../state/types.ts';
import type { AssessmentMode } from './assessmentContract.ts';

/** WP-52 masked-visual pilot：render-only 尺寸（widthU/heightU/depthU），無獨立 shape。 */
export interface TargetVisualSizeConfig {
  widthU: number;
  heightU: number;
  depthU: number;
}

export interface TargetHitboxConfig {
  widthU: number;
  heightU: number;
  depthU: number;
  /** 省略 = 'box'(既有行為逐位不變)。'sphere' 要求 widthU === heightU === depthU（schema.ts 驗證）。 */
  shape?: 'box' | 'sphere';
  /**
   * WP-52 masked-visual pilot（GD-7 記名例外，見 DECISIONS.md）：render mesh 套用的固定尺寸，
   * 與 widthU/heightU/depthU 分離——命中判定（HitDetector/SimLoop.targetAabb）、scene clearance、
   * occlusion 可見度取樣**仍一律讀 widthU/heightU/depthU**，不讀這裡。省略＝視覺與 hitbox 同尺寸
   * （既有行為逐位不變）。僅供 `peek_click_transfer_pilot_v2_masked` 使用，不得用於其他 drill。
   */
  visualSize?: TargetVisualSizeConfig;
}

/** WP-52 masked-visual pilot：resolved 形態，對齊 TargetHitboxSize 的欄位命名慣例（無 U 後綴）。 */
export interface TargetVisualSize {
  width: number;
  height: number;
  depth: number;
}

export interface TargetHitboxSize {
  width: number;
  height: number;
  depth: number;
  /** resolveTargetHitbox() 恆填實值,預設 'box'。 */
  shape: 'box' | 'sphere';
  /** 見 {@link TargetHitboxConfig.visualSize}；省略＝視覺讀本物件的 width/height/depth。 */
  visualSize?: TargetVisualSize;
}

/** Single-source default H1 hitbox (source units). Omitted drill config must resolve to this exactly. */
export const DEFAULT_TARGET_HITBOX: TargetHitboxSize = { width: 1, height: 2, depth: 1, shape: 'box' } as const;
export const MAX_TARGET_HITBOX_U = 10;

export interface SpawnAreaConfig {
  /** 水平偏心角範圍（deg）；0 = 玩家正前方 -Z，正值往 +X（右側）。 */
  yawDegRange: [number, number];
  /** 與玩家原點的前方距離範圍（u, source unit）。 */
  distanceURange: [number, number];
}

/** Center/peripheral schedule for spider-shot; independent from legacy L/R sequencing. */
export interface SpiderPeripheralConfig {
  /** Angular displacement from the center sightline (degrees). */
  angularRadiusDegRange: [number, number];
  /** 0° = up, 90° = right, 180° = down, 270° = left around the center sightline. */
  azimuthDegRange: [number, number];
  /** Peripheral target distance from the player origin (source units). */
  distanceURange: [number, number];
}

export interface SpiderShotCenterPeripheralConfig {
  kind: 'center-peripheral';
  seed: number;
  /** Center target distance from the player origin (source units). */
  centerDistanceU: number;
  peripheral: SpiderPeripheralConfig;
  /** true 時中心目標不受 timing.peekTimeoutMs 撤除；省略/false 維持既有行為。 */
  centerExemptFromTimeout?: boolean;
}

/**
 * Spawn-scheduling partition for {@link SpiderShotStratifiedConfig} (WP-44): how many equal-width
 * azimuth bins and equal-solid-angle radius bins make up the shuffled zone queue. This is a
 * scheduling-only concept — independent from the presentation-layer `SpiderQuadrant` labels
 * (`horizontal`/`vertical`/`oblique`) derived downstream in `spiderShotConditions.ts`; the two
 * partitions use different boundaries and serve different purposes (spawn balance vs. reporting).
 */
export interface SpiderShotStratifiedGridConfig {
  /** Number of equal-width bins spanning `peripheral.azimuthDegRange`. */
  azimuthQuadrants: number;
  /** Number of equal-solid-angle bins spanning `peripheral.angularRadiusDegRange`. */
  radiusTiers: number;
}

/**
 * Stratified center/peripheral schedule (WP-44): peripheral targets are drawn from a shuffled
 * queue of `azimuthQuadrants × radiusTiers` cells (rebuilt and reshuffled whenever exhausted) so
 * consecutive peripheral spawns don't repeat the same azimuth bin/radius tier before the others
 * have appeared. `angularRadiusDegRange` must be non-degenerate (`min < max`) — a fixed radius has
 * nothing to tier. Center-zone spawning and all downstream metrics/condition-cell derivation are
 * unchanged from `center-peripheral`.
 */
export interface SpiderShotStratifiedConfig {
  kind: 'center-peripheral-stratified';
  seed: number;
  centerDistanceU: number;
  peripheral: SpiderPeripheralConfig;
  grid: SpiderShotStratifiedGridConfig;
  /** true 時中心目標不受 timing.peekTimeoutMs 撤除；省略/false 維持既有行為。 */
  centerExemptFromTimeout?: boolean;
}

export type SpiderShotScheduleConfig = SpiderShotCenterPeripheralConfig | SpiderShotStratifiedConfig;

/** Counter-strafe cue schedule. `hold-reversal` is activated by WP-37/T2. */
export type CueScheduleConfig =
  | { readonly kind: 'single'; readonly holdDurationMs?: never }
  | { readonly kind: 'hold-reversal'; readonly holdDurationMs: number };

/**
 * DrillConfig — WP-6 / T1（FR-6.1，OQ-6.1~6.3）
 *
 * F4 的核心資料契約:drill 以 **config（資料）定義**——目標數/位置/時序/交替/結束條件。
 * 新增 drill = 新增一份符合本型別的 JSON,零引擎程式碼改動（規格 §1.2 F4、README 非功能需求）。
 * `TargetManager`（T2）改為**消費本 config** 驅動 spawn/位置/交替/結束,取代 WP-4 內建佔位序列。
 *
 * **位置抽象（OQ-6.2）**:階段 A 用「L/R peek 槽位 + 距離」貼合 counter-strafe,對齊現有
 * `TargetManager.sideX`;絕對座標延後。故 `targets` 只帶 `count`/`distance`,不放座標。
 *
 * **正規單位（ADR-9）**:`distance` 與（未來）`motion.speed/range` 一律 source unit（u、u/s),非公尺。
 *
 * 欄位形狀對齊 WP-6 README §2 interface contract。執行期驗證見 `schema.ts` `validateDrill`。
 */
export interface DrillConfig {
  /** 對齊匯出 metadata（規格附錄 C `"drillId": "counterstrafe_ad_v1"`）——drill 的穩定識別。 */
  drillId: string;
  /** WP-33 Assessment/Practice 契約;省略 = practice 語意,保留既有 drill 行為。 */
  mode?: AssessmentMode;
  /** 選填武器 id；省略時使用預設 AK-47（`ak47`）。 */
  weaponId?: string;
  /** Optional counter-strafe cue protocol; omitted preserves legacy drill timing exactly. */
  cue?: CueScheduleConfig;
  targets: {
    /** 目標總數（正整數;與 endCondition.targetCount 搭配,見 §endCondition）。 */
    count: number;
    /** 目標距玩家前方（-Z）距離（u,source unit）。 */
    distance: number;
    /** H1 target hitbox size (source units). Omitted = DEFAULT_TARGET_HITBOX, preserving existing drills. */
    hitbox?: TargetHitboxConfig;
    /**
     * WP-52 T5：balanced-shuffle seeded 候選集合（每個候選在 `count` 內出現次數相等,需搭配
     * `sequence.seed`）。與 `hitbox` 互斥（`schema.ts` 驗證）；`count` 必須整除
     * `hitboxCandidates.length`。省略＝既有單一 `hitbox` 行為逐位不變。
     */
    hitboxCandidates?: readonly TargetHitboxConfig[];
    /** WP-21 seeded spawn:以 polar yaw/distance 範圍取樣 pop-in 位置；需搭配 `sequence.seed`。 */
    spawnArea?: SpawnAreaConfig;
    /** F5 接縫（規格附錄 G）:省略＝static（向後相容）。階段 A 不實作移動,WP-6.5 接管。 */
    motion?: TargetMotion;
  };
  /** 左右交替序列:`alternation` 首字定首側（對齊 `TargetManager.reset(seq)`）;`seed` 驅動 WP-21 seeded spawn。 */
  sequence: { alternation: 'LR' | 'RL'; seed?: number; spawnDelayMsRange?: [number, number] };
  /** WP-36 spider-shot schedule. Presence selects an independent center/peripheral spawn path. */
  spiderShot?: SpiderShotScheduleConfig;
  timing: {
    /** 開始前倒數（ms;DrillRunner countdown phase,T4）。 */
    countdownMs: number;
    /** kill→下一目標延遲（ms;counter-strafe 預設 0=立即補生,OQ-6.1）。省略＝0。 */
    spawnDelayMs?: number;
    /** 逾時未 kill → 記 timeout 並推進（ms;防生命週期卡 phase,OQ-6.1）。省略＝不逾時。 */
    peekTimeoutMs?: number;
    /** 全 drill 時限（ms;endCondition.type='timeLimit' 的後援閘,OQ-6.3）。 */
    timeLimitMs?: number;
    /**
     * 追蹤 drill 每目標「呈現時長」（ms;WP-18 / T3,OQ-18.2）。提供即啟用 **timed presentation**
     * 推進政策:目標可見後計時,達 `presentationMs` → 推進下一目標(撤舊 spawn 新),窗內目標**持續
     * 存活移動、命中不撤除**（連續控制;守 GD-7 追蹤窗口右界）。與 `peekTimeoutMs` 語意不同(後者為
     * detection 的「peek→到期撤除」),故獨立欄位;兩者不應併用同一 drill。省略＝不啟用(既有政策)。
     */
    presentationMs?: number;
    /**
     * hold-track-v1：可見後達此時長即 target_stop——原地凍結、解鎖開火並記錄 tStop。
     * 與 `presentationMs` 互斥；省略時既有 presentation/advance 語意不變。
     */
    trackingStopMs?: number;
  };
  /**
   * 結束條件（雙閘,OQ-6.3）:預設 `targetCount`（目標數達標,如 20 個 peek）;`timeLimit` 為時限後援。
   * `value` 語意隨 `type`:targetCount=目標數、timeLimit=毫秒。
   */
  endCondition: { type: 'targetCount' | 'timeLimit'; value: number };
}

export function resolveTargetHitbox(config?: DrillConfig): TargetHitboxSize {
  const hitbox = config?.targets.hitbox;
  if (hitbox === undefined) return DEFAULT_TARGET_HITBOX;
  return {
    width: hitbox.widthU,
    height: hitbox.heightU,
    depth: hitbox.depthU,
    shape: hitbox.shape ?? 'box',
    ...(hitbox.visualSize !== undefined
      ? {
          visualSize: {
            width: hitbox.visualSize.widthU,
            height: hitbox.visualSize.heightU,
            depth: hitbox.visualSize.depthU,
          },
        }
      : {}),
  };
}

export function targetHitboxToConfig(hitbox: TargetHitboxSize): TargetHitboxConfig {
  return {
    widthU: hitbox.width,
    heightU: hitbox.height,
    depthU: hitbox.depth,
    shape: hitbox.shape,
    ...(hitbox.visualSize !== undefined
      ? {
          visualSize: {
            widthU: hitbox.visualSize.width,
            heightU: hitbox.visualSize.height,
            depthU: hitbox.visualSize.depth,
          },
        }
      : {}),
  };
}
