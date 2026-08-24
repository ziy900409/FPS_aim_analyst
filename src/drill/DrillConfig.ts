import type { TargetMotion } from '../state/types.ts';
import type { AssessmentMode } from './assessmentContract.ts';

export interface TargetHitboxConfig {
  widthU: number;
  heightU: number;
  depthU: number;
}

export interface TargetHitboxSize {
  width: number;
  height: number;
  depth: number;
}

/** Single-source default H1 hitbox (source units). Omitted drill config must resolve to this exactly. */
export const DEFAULT_TARGET_HITBOX: TargetHitboxSize = { width: 1, height: 2, depth: 1 } as const;
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

export interface SpiderShotScheduleConfig {
  kind: 'center-peripheral';
  seed: number;
  /** Center target distance from the player origin (source units). */
  centerDistanceU: number;
  peripheral: SpiderPeripheralConfig;
}

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
  return { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU };
}

export function targetHitboxToConfig(hitbox: TargetHitboxSize): TargetHitboxConfig {
  return { widthU: hitbox.width, heightU: hitbox.height, depthU: hitbox.depth };
}
