# WP-57 T0 — Entry Gate／幾何 PoC／GD-32 入帳

## Objective

在不寫 production feature 前，覆驗 README §0 的十四項 discovery、以可重現數字證明四組幾何推導（resolver／NDC／地板／arena）、把 eye-frame vs origin-frame 分歧寫入全域決策帳本，並凍結 OQ-57.1／57.2。**T0 未通過不得開始 T1～T6。**

## Inputs to read

- [README.md](README.md) §0～§3。
- `CLAUDE.md` §3 執行協議 + §4 硬約束；`docs/exec-plan/README.md` §2/§3；`docs/exec-plan/DECISIONS.md`（GD-6／GD-7／GD-10／GD-30／GD-31）。
- `CONTEXT.md` 第 51～54 列（`spiderShot` schedule／`zone`／`D_deg`/`W_deg`/象限／五類指標）。
- `docs/operational/analysis-spider-shot.md`。
- `src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/drill/spider_shot_v1.ts`、`src/drill/spider_shot_v2.ts`、`src/drill/micro_flick_three_target_test_v1.ts`。
- `src/sim/TargetManager.ts`（`peripheralPos`／`angularSpawnPose`／`buildSpiderZoneCells`／`sampleSpiderShotPose`）。
- `src/scene/eyePose.ts`、`src/scene/clearance.ts`、`src/metrics/eyeOrigin.ts`、`src/metrics/spiderShotConditions.ts`、`src/metrics/spiderShotMetrics.ts`。
- `src/ui/SettingsPanel.ts`、`src/render/SceneManager.ts`、`src/main.ts`（roster 與 `activeDrillConfig` 兩個賦值點）。
- `graphify-out/GRAPH_REPORT.md` 與當時 CodeGraph status。

## Steps

1. 記錄 HEAD、`git status --short`、CodeGraph pending 與 baseline build/test 結果；不處理 unrelated changes。
2. 對 `DrillConfig`／`SpiderShotScheduleConfig`／`createTargetManager`／`deriveSpiderShotTransitions`／scene registry 執行 CodeGraph impact，列 local／cross-module blast radius，與 README §0.1 的估計對帳。
3. 逐項覆驗 README §0 的十四點，每點附 `file:line`。任一點與現況不符時**先改 README 再繼續**，不得帶著過期前提進 T1。
4. **PoC A — resolver 數值**：以 throwaway script 算出 §2.4 表格的四列（FOV 60/75/90/120 × aspect 16:9），與文件逐位對帳；再補 aspect 21:9 與 4:3 兩組，確認 `yawMax` 隨 aspect 單調遞增且無 NaN。
5. **PoC B — on-screen**：對 12 組（4 FOV × 3 aspect）各 10,000 個 seeded (yaw, pitch) 樣本，驗證 `ndc_x`／`ndc_y` 兩條不等式，記錄最壞邊界值與失敗數（必須為 0）。
6. **PoC C — 地板／天花板**：以 `eyeHeightU = 1.6`、`hitboxDiameterU = 0.279281`、`distanceU = 8` 反推 `pitchMax` 在 `floorClearanceU ∈ {0, 0.25, 0.5}` 三種取值下的結果，並確認純幾何極限。<br>**T0 實測（已更正原預期值 `11.31° / 7.97° / 6.89°`）：`10.5180° / 8.7020° / 6.8947°`**；純幾何極限（球心貼地）在本 WP 的球面參數化下為 `asin(1.6/8) = 11.5370°`，**不是** `atan(1.6/8) = 11.3099°`（後者屬 `angularSpawnPose()` 的圓柱參數化，§0 item 4 明確不沿用）。
7. **PoC D — arena 幾何**：算出 §2.5 全表；同時對預設 `[10, 10, 3]` 房間產生**負向**證據（FOV 60/75/90/120 四檔的側向落點皆 > 5 u）。
8. 對 `spiderShotMetrics.ts` 做「零修改可行性」確認：逐函式檢查是否有任何對 azimuth／radius／origin-frame 的隱含依賴。若發現有，立即回 README §2.7 重新評估並升級風險。
9. **OQ-57.1／57.2 已於 2026-09-07 由使用者凍結**（`drillId = 'spider-shot-wide-v1'`、`pitchDegRange = [−6.5, 6.5]` 且 `floorClearanceU = 0.5`，見 [progress.md](progress.md) D-57.P13／P14）。T0 的職責因此不是收斂，而是**覆驗**：確認 PoC C 在 `floorClearanceU = 0.5` 下算出 `pitchMax = 6.894°`（故 `±6.5°` 有餘裕且非硬貼邊界），並確認 `spider-shot-wide-v1` 未與任何既有 exact `drillId` 衝突（含 near-miss 負向檢查）。其餘 OQ（57.3～57.5）維持 blocked owner/deadline，**不得**把 recommended default 當成產品決策寫進常數。
10. 把 **GD-32** 寫入 `docs/exec-plan/DECISIONS.md`：eye-frame（新 drill）與 origin-frame（v1/v2）兩套幾何並存的理由、影響範圍、v1/v2 明確不修的決定、以及跨版本合併分析的前置條件。
11. 清除只位於已驗證 temp root 的 PoC artifacts，把 commands／measurements／CodeGraph 結果寫入 [progress.md](progress.md)。

## Required audit artifact

| 項目 | 需要的證據 |
|---|---|
| discovery 覆驗 | §0 十四項各一個 `file:line` |
| blast radius | CodeGraph 對 5 個 symbol 的 caller/consumer 計數與 local/cross-module 判定 |
| PoC A | 6 組 (FOV × aspect) 的 `halfHFOV`／`yawMax`／`yawMagDegRange` 數字 |
| PoC B | 12 組的最壞 `abs(ndc_x)`／`abs(ndc_y)` 與失敗數 |
| PoC C | 3 個 `floorClearanceU` 對應的 `pitchMax` + 幾何極限 |
| PoC D | §2.5 全表 + 預設房間四檔負向數字 |
| metrics 零修改 | `spiderShotMetrics.ts` 逐函式的依賴判定 |

## Definition of Done

- [x] (2026-09-07) README §0 十四項全數有 `file:line` 證據；**item 1／9／13／14 與現況不符，已改 README**（詳見 [progress.md](progress.md) §T0 audit ①）。
- [x] (2026-09-07) CodeGraph impact 已跑，5 個 symbol 的 blast radius 已記錄並與 §0.1 對帳（`DrillConfig` 123、`createTargetManager` 44、`deriveSpiderShotTransitions` 1 且 production caller 為零、`SpiderShotScheduleConfig` 3、scene registry = `main.ts:133-141` 無獨立檔）。§0.1 已依實測改寫。**Caveat：查詢時 index auto-sync 停用**，已記錄於 audit ②。
- [x] (2026-09-07) PoC A～D 四組數字可重現；**§2.4 表（FOV 75/90/120 進位誤差 + `abs(ndc_y)` 欄數值錯誤）、§2.4 pitch 極限推導（`floorClearanceU` 0 與 0.25 兩列 + `atan` vs `asin`）、§2.5 全表（`eyeZ`／`roomSize`／z 值）皆已更正**。
- [x] (2026-09-07) 預設 `[10, 10, 3]` 房間穿牆的負向數字已取得 —— 四個 FOV 檔位的**整段 yaw 窗**側向落點皆 > 5 u（最小 `5.1520`）。**另更正原規劃的錯誤斷言**：「pitch 亦在原 3 u 牆高下受限」不成立。
- [x] (2026-09-07) `spiderShotMetrics.ts` 零修改的可行性有逐函式判定（9 個函式，audit ⑦），非直覺結論；並得出比原規劃更強的理由（該檔已是 eye-frame）。
- [x] (2026-09-07) OQ-57.1／57.2 的凍結值已覆驗：`pitchMax` 在 `floorClearanceU = 0.5` 下為 `6.8947°`（`±6.5°` 餘裕 `0.3947°`）；`spider-shot-wide-v1` 與 17 個既有 exact `drillId` 無衝突，near-miss 負向面由 `DrillMetricRegistry` 的 exact-match 語意保證。
- [x] (2026-09-07) OQ-57.3～57.5 維持明確 blocked owner 與 deadline，且**未被寫成產品常數**。
- [x] (2026-09-07) GD-32 已寫入 `docs/exec-plan/DECISIONS.md`（§2 OPEN，狀態 🟡）並在 [progress.md](progress.md) Decision Log 建立 D-57.T0-1／T0-2／T0-3 三條對應條目。
- [x] (2026-09-07) production code diff = 0；PoC artifacts 已清除；**baseline 無 failure**（typecheck exit 0、Vitest 223 files / 2179 tests 全綠、vite build exit 0）。
- [x] (2026-09-07) **超出原 DoD 的新發現已入帳**：conditions 路徑的 frame 不同源 → **OQ-57.7（阻塞 T4）** + GD-32 影響面 (A)；arena `eyeZ` 的 KI-012 陷阱 → D-57.T0-1；`ndc_x` 上界 tight-by-construction → D-57.T0-2。

## Outcome

T0 **通過**，T1 放行。四組 PoC 全部可重現，但**與規劃文件逐位對帳後共更正 8 處**（3 個 discovery item 的 `file:line`／計數、§2.4 兩處推導與一張表、§2.5 整節含 arena 選型、§0.1 五個 blast-radius 判定、一處錯誤的負向證據斷言）。最重要的產出不是「確認規劃可行」，而是攔下兩件會在 T3／T4 才爆的事：arena 若吃 `eyeZ` fallback 會讓匯出 `W_deg` 誤差 43.6% 並隨條件變因漂移；若改設契約要求的 `eyeZ: 0` 而不加深房間則直接踩 KI-012 後牆遮擋。

**T1／T2／T3 可立即開工**（config 契約、resolver、eye-frame 投影、arena 皆已定案）。**T4 需先由使用者拍板 OQ-57.7**。

## Commit

```text
docs(stage12): complete WP-57 spider wide flick entry gate
```
