# T3 — 五類指標組裝(切換反應/移動執行/停止控制/首發/節奏)

> Part of [WP-36 spider-shot](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(條件格 + `spider-shot-v1` drill config) |
| **Risk / Cplx** | Med(停止控制子項視 §0-5/OQ-S6-16 讀碼結果可能上修) / Med |
| **Touches** | ADD `src/metrics/spiderShotMetrics.ts`;可能 ADD 一個消費 `TrackingSample[]` 的加法擴充函式(視 OQ-S6-16 結論);REUSE `detectionDerivation.ts`/`angularKinematics.ts`/`peekWindows.ts`/`trackingDerivation.ts`/`eyeOrigin.ts`(皆不改既有簽名/語意) |
| **狀態** | ⬜ |

## Objective

交付 FR-F9:五類指標——切換反應(視覺—動作代理值)、移動執行(movement time/峰值角速度)、停止控制(overshoot/逸出/微調次數)、首發(命中/角度偏差)、節奏(transition interval 分布)。四類複用既有函式組裝,一類(停止控制)視讀碼結果決定是否需要新的加法擴充函式。

## In scope

1. **切換反應**:對每個 `visible` 事件呼叫既有 [`deriveDetectionMetrics`](../../../../../src/metrics/detectionDerivation.ts)(不重推),取 `tDetectMs`/`reactionMs`,並在文件中明示為視覺—動作代理值(呼應框架 v1 §"明確不做"的量測用語警告)。
2. **移動執行**:對每個 transition 的 [`buildPeekWindows`](../../../../../src/metrics/peekWindows.ts) `tickRange` 呼叫既有 [`omegaDegPerSec`](../../../../../src/metrics/angularKinematics.ts),取窗內峰值 `|ω|` 為 peak angular velocity;movement time = `tDetectMs`(或 `tFirstOnTargetMs`,依 T0/T3 讀碼何者對 Spider Shot 更貼切)減 `tVisibleMs`。
3. **停止控制**:先執行 OQ-S6-16 的最終確認——`grep` `trackingDerivation.ts` 是否已有 overshoot 角度量/微調次數;若無,新增消費既有 `TrackingSample[]` 的加法擴充函式(不修改 `derivePresentation`/`isOnTarget`/`rms`/`percentile` 等既有幾何,比照 WP-35 `deriveTrackingTransitions` 的先例——甚至評估能否直接 import WP-35 交付的函式而非重新寫一份,若其輸出形狀相容)。
4. **首發**:複用 `buildPeekWindows` 的 `firstFire`/`outcome`/`tFirstShot`,角度偏差複用 `angularEccentricityDeg`(於 `tFirstShot` 對應 tick 計算)。
5. **節奏**:連續 `visible.t` 差值的分布(median/P95),純加總,無既有函式衝突。
6. `spiderShotMetrics.ts` 匯出 `deriveSpiderShotMetrics(payload, options): SpiderShotMetrics`(見 [README §5 interface contract](README.md))。
7. 端到端測試:合成 drill 跑一輪,驗證各指標數值與時間點合理;OQ-S6-17 若拍板納入回中心 transition,補對應案例。

## Out of scope

- 任何既有構念(`t_detect`/on-target/首發/ω(t))的重新定義——一律呼叫既有函式(C-D4)。
- 診斷規則對五類指標的解讀(WP-38)。

## Steps

- [ ] 讀碼確認 OQ-S6-16(`trackingDerivation.ts`/WP-35 `trackingTransitions.ts` 的覆蓋面),決定停止控制的實作路徑(直接複用 vs 新增加法擴充函式)。
- [ ] 切換反應/移動執行/首發/節奏四類指標組裝函式,逐一複用既有函式,不重推。
- [ ] 停止控制指標函式(依上一步結論)。
- [ ] `deriveSpiderShotMetrics()` 彙整五類輸出。
- [ ] 端到端合成 drill 測試(涵蓋 center→peripheral、peripheral→center、若拍板納入則含回中心案例)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 五類指標皆不重新定義既有構念(`t_detect`/on-target/首發/ω(t) 皆呼叫既有函式) | `deriveSpiderShotMetrics()` 的呼叫圖可審(呼叫 `deriveDetectionMetrics`/`omegaDegPerSec`/`buildPeekWindows`/`angularEccentricityDeg`,及依 OQ-S6-16 結論的追蹤消費函式) |
| ② | 停止控制若新增函式,僅消費既有 `TrackingSample[]`,未修改既有幾何 | 既有 `trackingDerivation.test.ts`/`epsilon-parity.test.ts` 零修改全綠 |
| ③ | 端到端合成 drill 測試綠(含 OQ-S6-17 拍板後的案例範圍) | `spiderShotMetrics.test.ts` 綠 |
| ④ | 框架 v1 驗收條件「Spider Shot 每次 transition 保存方向/角距/角尺寸」的資料基礎齊備(T2 條件格 + T3 五類指標可共同重建) | 測試斷言逐 transition 的條件格與五類指標欄位皆非空(除既有記錄的缺席理由 flag) |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-36): T3 — 五類指標組裝(切換反應/移動執行/停止控制/首發/節奏,FR-F9)`
