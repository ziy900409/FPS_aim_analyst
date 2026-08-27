# T-exit — 驗收 + 文件對帳

> Part of [WP-47](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 |
| **Risk / Cplx** | — |
| **Touches** | 本 WP 文件狀態收尾;視結果可能新增 `docs/operational/` 使用說明(非必要,見 Steps) |
| **狀態** | ✅ |

## Objective

驗收 WP-47 全部交付內容(自動測試 + 手動瀏覽器驗證),並依 stage9 既有先例誠實記錄哪些跨文件對帳動作被有意延後。

## Steps

- [x] `npm run test:ci`(`tsc --noEmit` + `vitest run` + `playwright test`)全綠(137 test files / 1081 vitest + 31 playwright,含本次新增的 4 個 WP-47 e2e)。
- [x] Code review(five-axis)發現一個真實 correctness bug 並已修復,見下方「T-exit 期間發現並修復的問題」。
- [x] 覆核 T2 手動驗證四項:③④以自動化 e2e 覆核(不需 Pointer Lock、可穩定重現);①②的**正向路徑**(真實開火時的射速手感/ADS 縮放視覺)需 Pointer Lock,而 Pointer Lock 需真實使用者手勢、無法在自動化中穩定取得(比照 `wp-3-input-sampler/manual-verification.md`/WP-9 header 既有慣例)——這兩項的機制層(`activeWeaponConfig()`/`cameraController.setAdsConfig`/`currentMouseGain()` 隨換武器正確重算)已用 `__aimDebug.recorder.mouseIntegration.gain`（adsStep vs hipStep）自動化覆核,真人肉眼/手感驗留待使用者。詳見 [`tests/e2e/weapon-select.spec.ts`](../../../../../tests/e2e/weapon-select.spec.ts)。
- [x] `task-checklist.md`/`progress.md`/本 WP `README.md` 狀態更新為 ✅。
- [x] 更新 [../README.md](../README.md) §5 WP 索引 WP-47 一列為 ✅ T-exit——已確認當下無其他並行工作正在改動該共用檔案(僅 WP-44 進行中,未觸及 WP-47 那一列)。
- [ ]（有意延後,見下方)`docs/exec-plan/DECISIONS.md`/`docs/exec-plan/README.md` §2/§4/§6/`docs/MAP.md`:正式 WP/GD/里程碑編號指派——比照 stage8(WP-43)/stage9(WP-44/45/46)先例,留給使用者決定何時正式採納。

## T-exit 期間發現並修復的問題

Five-axis code review(`code-review-and-quality` skill)在 correctness 軸發現 `loadSceneById()`(`src/main.ts`)有一個 early-return 順序 bug:`activeWeaponOverride = undefined`(reset-per-drill)寫在「重選同一場景 → 提早 return」的判斷**之前**,導致使用者重選當前已在用的場景並按「Scene」按鈕時,override 被靜默清空,但因為提早 return,`buildSimLoop()`/`controls?.setSelectedWeapon()` 都不會被呼叫——下拉選單仍顯示手動選的武器、`state.weapon`(magSize/ammo)快照也不變,使用者/自動化都看不出任何異狀,但下一次即時讀取 `activeWeaponConfig()` 的地方(例如匯出當下的 `meta.weapon.id`)會悄悄變回 drill 預設武器,造成「UI 顯示 A、實際生效 B」的研究效度風險。

修復:把 `activeWeaponOverride = undefined` 移到早退判斷**之後**,只在真的要重建 scene 時才 reset。已新增 [`tests/e2e/weapon-select.spec.ts`](../../../../../tests/e2e/weapon-select.spec.ts) 的「重選同一場景不靜默清空 override」案例把關 —— 已驗證此案例在修復前失敗(`meta.weapon.id` 錯誤地變回 `'ak47'`)、修復後通過。

## 誠實記錄:本次刻意不做的事

比照 WP-44/45/46 的處置方式,本 WP 在交付時**不**佔用具體 GD 編號、**不**寫入 `DECISIONS.md`/`exec-plan/README.md` §2/§4/§6/`docs/MAP.md` 的正式索引項,只在 `stage9/README.md`(視 T-exit 當下是否有並行工作衝突而定)與本 WP 文件內用「暫用 WP-47」標記,留待使用者確認要正式開工/編號時一次性補上。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | 執行輸出 |
| ② | T2 四項手動驗證全部通過 | 本檔 Steps 勾選 + 手動記錄 |
| ③ | 本 WP 內部文件(task-checklist/progress/README)狀態一致,全部 ✅ | 本檔 diff |
| ④ | 誠實記錄延後的跨文件對帳項,不擅自佔用編號 | 本檔「誠實記錄」段 |

## Commit

`docs(wp-47): T-exit — 驗收 + 文件對帳(WP/GD 編號正式指派延後)`
