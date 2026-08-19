# T2 — `hold-track-v1` 協定 + 追蹤/停止轉換指標

> Part of [WP-35 hold-track](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(`fireLocked`/`tStop` 落地) |
| **Risk / Cplx** | Med / Med |
| **Touches** | `src/drill/hold_track_v1.ts`(新)、`src/metrics/trackingTransitions.ts`(新)、`src/metrics/stopTransitionDerivation.ts`(新) |
| **狀態** | ✅ (2026-08-19) |

## Objective

組裝 `hold-track-v1` drill config,並交付 FR-F7 剩餘的兩類指標:掉靶次數/重新取得時間(消費既有 `TrackingSample[]`)、停止轉換三指標(`t_fire − t_stop`、停止後首發命中、停止後開火角度偏差,複用既有首發判定)。追蹤窗核心指標(TOT%/RMS/median/P95/`tAcquire`)**直接複用** `deriveTrackingMetrics`,不重推。

## In scope

1. `src/drill/hold_track_v1.ts`(新,比照 [`tracking_br_v1.ts`](../../../../../src/drill/tracking_br_v1.ts) 的 variant 產生器形狀,但**不繼承**其 weapon/motion 常數——hold-track-v1 是獨立條件格):
   - 目標 motion(移動速度/角尺寸)、T1 新增的 `trackingStopMs`(或 T0 拍板的等價欄位)、`sequence`/`endCondition` 依框架 v1 §"架槍挑戰"的共同條件(L/R 平衡、seeded)。
   - `mode: 'assessment'`(WP-33 契約)。
2. `src/metrics/trackingTransitions.ts`:實作 README §5 `deriveTrackingTransitions`——消費 `deriveTrackingSamples()` 輸出,逐 presentation 掃描 on-target 轉換,產出掉靶次數與重新取得時間陣列(未重新取得者依 T0/T2 拍板的排除規則處理,OQ-S6-15)。
3. `src/metrics/stopTransitionDerivation.ts`:實作 README §5 `deriveStopTransitions`——讀 `state.tStop`(經由匯出後的等價欄位,需確認 `ExportPayload`/`meta` 是否已攜帶 `tStop`,若無則本 task 一併補上匯出面,additive)+ 既有首發判定(`compute.ts`/`peekWindows.ts`)+ 既有角度誤差計算(`eyeOrigin.ts`),組出三指標。
4. 合成 fixture:追蹤窗右界不受提早/準時/逾時開火影響的直接驗證(README §2⑤ 不變式)。

## Out of scope

- 追蹤窗核心指標(TOT%/RMS/median/P95/`tAcquire`)的計算邏輯——直接呼叫既有 `deriveTrackingMetrics`,不重寫。
- 診斷規則對這些指標的解讀(WP-38)。
- 結果頁呈現(WP-38 落點待其 T0 拍板)。

## Steps

- [x] `tStop` 未存在於 `ExportPayload`;已以 additive `target_stop` event 匯出時間戳與凍結座標(比照 `visible` event)。
- [x] 實作 `hold_track_v1.ts`。
- [x] 實作 `deriveTrackingTransitions`,合成 fixture 覆蓋:持續 on-target 無掉靶 / 單次掉靶後重新取得 / 掉靶至窗口結束未重新取得三案例。
- [x] 實作 `deriveStopTransitions`,合成 fixture 覆蓋:停止後立即開火 / 延遲開火 / 完全未開火三案例。
- [x] 合成 drill fixture:提早開火(命中)/準時開火/逾時未開火三案例,斷言追蹤窗(`windowEndMs − tVisibleMs`)三案例數值相同(不受開火時機影響)。
- [x] 確認新 drill 不誤用 WP-31/既有 research-only 指標(本 task 只到指標計算,不涉及呈現)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 追蹤窗核心指標由既有 `deriveTrackingMetrics` 產出,零重寫幾何 | code review 檢查點(`trackingDerivation.ts` diff 為空) |
| ② | 掉靶次數/重新取得時間三案例合成 fixture 綠 | 單元測試 |
| ③ | 停止轉換三指標三案例合成 fixture 綠 | 單元測試 |
| ④ | 追蹤窗右界不受提早/準時/逾時開火影響(不變式) | 端到端合成 drill 測試 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-35): T2 — hold-track-v1 協定 + 追蹤/停止轉換指標(FR-F7)`
