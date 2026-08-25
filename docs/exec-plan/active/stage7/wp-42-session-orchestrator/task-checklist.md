# WP-42 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(覆核 §0 讀碼發現;正式拍板引擎選擇/availableDrills 缺口範圍/熱身降級語意;關閉 OQ-S7-2;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Med |
| 🟡 | **T1** `availableDrills` 補三個缺口 config;`SessionPlan`/`sessionPlanPresets.ts`/`SessionRunner`(手動固定順序)+ 熱身降級;`SessionPlanSetup.ts`;`main.ts` 接線;`metadata.ts` additive `sessionPlanPreset`（已實作並提交，待實機 drill 驗證） | [T1-session-plan-runner.md](T1-session-plan-runner.md) | T0 | **Med–High** |
| 🟡 | **T2** `RestOverlay.ts` + `SessionRunner.poll(nowMs)` 接入既有 renderLoop（已實作並提交，待實機 session-plan 驗證） | [T2-rest-overlay.md](T2-rest-overlay.md) | T1 | Low |
| ✅ | **T3** 接入 WP-41 `buildFamilyOrder()`,取代手動固定順序 | [T3-family-order-wiring.md](T3-family-order-wiring.md) | T1 + WP-41 T-exit | Low |
| ⬜ | **T-exit** 驗收清單 G(`acceptance-stage-g.md`,新)全項通過;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T2 + T3 | — |

T0 決定 T1 的骨架設計(README §2①引擎選擇);T1 是本 WP 工作量最大的 task(涵蓋 README §0-2 的 `availableDrills` 缺口接線,需要逐一手動驗證新增的三個家族 config 能真的走完整條 `loadDrillById()` 鏈路,不只是 TypeScript 編譯通過)。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-42 狀態列翻 ✅,確認 M17 驗收清單 G 全項通過。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的五條紀律

1. **`SessionRunner`/`RestOverlay` 不得讀寫 `SharedState` 或呼叫 `drillRunner`/`activeTargetManager` 的任何推進方法**:只能呼叫既有 `loadDrillById()`(README §2⑤/§3)。
2. **`availableDrills` 新增項目一律 additive,不修改既有 9 個項目或其消費者既有行為**(README §2②)。
3. **`sessionPlanPreset` 只能是 metadata 記錄欄位,不得流入 `src/sim`/`src/metrics` 任何計算或判定**(README §3/§6)。
4. **新增 preset 走具名常數 + commit + progress.md,UI 不得渲染自由數字輸入**(README §2④/§6)。
5. **熱身缺口不得靜默跳過**:`resolveWarmupDrillId()` 回傳 `'unavailable'` 時必須有對應 UI 訊息(README §3/§6)。
