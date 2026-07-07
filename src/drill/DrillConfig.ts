import type { TargetMotion } from '../state/types.ts';

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
  /** 選填武器 id；省略時使用預設 AK-47（`ak47`）。 */
  weaponId?: string;
  targets: {
    /** 目標總數（正整數;與 endCondition.targetCount 搭配,見 §endCondition）。 */
    count: number;
    /** 目標距玩家前方（-Z）距離（u,source unit）。 */
    distance: number;
    /** F5 接縫（規格附錄 G）:省略＝static（向後相容）。階段 A 不實作移動,WP-6.5 接管。 */
    motion?: TargetMotion;
  };
  /** 左右交替序列:`alternation` 首字定首側（對齊 `TargetManager.reset(seq)`）;`seed` 供未來隨機化。 */
  sequence: { alternation: 'LR' | 'RL'; seed?: number };
  timing: {
    /** 開始前倒數（ms;DrillRunner countdown phase,T4）。 */
    countdownMs: number;
    /** kill→下一目標延遲（ms;counter-strafe 預設 0=立即補生,OQ-6.1）。省略＝0。 */
    spawnDelayMs?: number;
    /** 逾時未 kill → 記 timeout 並推進（ms;防生命週期卡 phase,OQ-6.1）。省略＝不逾時。 */
    peekTimeoutMs?: number;
    /** 全 drill 時限（ms;endCondition.type='timeLimit' 的後援閘,OQ-6.3）。 */
    timeLimitMs?: number;
  };
  /**
   * 結束條件（雙閘,OQ-6.3）:預設 `targetCount`（目標數達標,如 20 個 peek）;`timeLimit` 為時限後援。
   * `value` 語意隨 `type`:targetCount=目標數、timeLimit=毫秒。
   */
  endCondition: { type: 'targetCount' | 'timeLimit'; value: number };
}
