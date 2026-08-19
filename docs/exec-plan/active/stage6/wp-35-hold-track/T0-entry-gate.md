# T0 — entry-gate:驗上游 exit + fire-gating/target_stop 讀碼拍板

> Part of [WP-35 hold-track](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-34 T-exit |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;產出決策記錄於 `progress.md` + 本 WP README §2/§7 覆核 |
| **狀態** | ⬜ |

## Objective

驗上游 WP-34 exit 已綠燈;覆核 [README §0 讀碼對帳](README.md) 的五條發現在執行當下仍成立(WP-34 落地過程可能改動 `TargetState`/`SharedState` 形狀);拍板本 WP 兩個懸而未決的設計決策——fire-gating 判定式的確切落點(OQ-S6-9)與 `target_stop` 修飾欄位的命名/形狀(OQ-S6-14)。零程式碼,零測試異動。

## In scope

1. **驗 WP-34 T-exit**:讀 [`wp-34-hold-click-visibility/progress.md`](../wp-34-hold-click-visibility/progress.md) 確認 T-exit 已完成且 `npm run test:ci` 綠燈證據存在。
2. **覆核 README §0 五條讀碼發現**:逐條對照當下 `src/state/types.ts`(`TargetState.persistent`)、`src/loop/SimLoop.ts`(`scheduleFire`)、`src/sim/TargetManager.ts`、`src/drill/DrillRunner.ts`、`src/metrics/trackingDerivation.ts` 是否與規劃階段讀到的行/邏輯一致;若 WP-34 落地時改了這幾個檔案的相關段落,更新對帳結論並記錄於 Decision Log。
3. **拍板 OQ-S6-9**(fire-gating 落點):確認 `scheduleFire`(`SimLoop.ts` 現行行號待覆核)的 while 迴圈判定式加入 `fireLocked` 條件是否會與 `nextFireT` 的累加語意衝突——特別是「解鎖瞬間」與「`nextFireT` 到期瞬間」重疊時是否產生非預期的多發判定。寫一段最小合成情境(紙上推演或最小 harness 腳本,不必是正式測試)驗證判定順序。
4. **拍板 OQ-S6-14**(`target_stop` 修飾欄位):在 `DrillConfig.timing` 新增獨立欄位(如 `trackingStopMs`)vs 讓 `presentationMs` 帶一個到期行為判別子,兩案的維護成本與 `schema.ts` 驗證複雜度比較,選一案並記錄理由。
5. **確認掉靶次數/重新取得時間的函式邊界**(README §0-5):讀 `deriveTrackingSamples()` 的輸出形狀,確認新函式可以純粹消費 `TrackingSample[]`,不需要碰 `trackingDerivation.ts` 內部任何私有輔助函式。

## Out of scope

- 任何程式碼實作(T1/T2)。
- 停止轉換指標公式的最終細節(T2)。

## Steps

- [ ] 讀 `wp-34-hold-click-visibility/progress.md` 確認 T-exit 證據。
- [ ] `grep -rn "persistent\|fireLocked\|tStop" src/state/ src/sim/ src/loop/` 覆核 §0 讀碼發現是否仍準確。
- [ ] 針對 OQ-S6-9 寫一段判定順序推演(可用現有 `SimLoop.test.ts` 的既有測試型態起草一個手動草稿,不必落地為正式測試檔)。
- [ ] 針對 OQ-S6-14 選案並記錄理由。
- [ ] 覆核 `trackingDerivation.ts` 匯出面(`export` 關鍵字)確認 `TrackingSample`/`deriveTrackingSamples` 為 public API,可安全被新模組 import。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | WP-34 T-exit 證據已覆核 | progress.md 記錄核對結果 |
| ② | OQ-S6-9 拍板(fire-gating 判定式落點 + 邊界案例結論) | Decision Log D-35.1 |
| ③ | OQ-S6-14 拍板(`trackingStopMs` 或等價設計) | Decision Log D-35.2 |
| ④ | §0-5 函式邊界確認(掉靶/重新取得時間函式不需碰 `trackingDerivation.ts` 私有邏輯) | progress.md 記錄 |
| ⑤ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-35): T0 — entry-gate(fire-gating 落點 + target_stop 欄位拍板)`
