# WP-35 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 WP-34 T-exit + 讀碼確認 README §0 對帳結論 + 拍板 fire-gating 落點/OQ-S6-9/target_stop 修飾欄位命名;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-34 T-exit | Low |
| ✅ | **T1** `TargetState.fireLocked` + `tStop` 記錄 + `scheduleFire` additive 閘 + `TargetManager` 原地凍結到期分支 | [T1-fire-gating-stop.md](T1-fire-gating-stop.md) | T0 | Med |
| ✅ | **T2** `hold-track-v1` drill config + 掉靶/重新取得時間函式 + 停止轉換三指標(複用既有首發判定) | [T2-tracking-stop-metrics.md](T2-tracking-stop-metrics.md) | T1 | Med |
| ⬜ | **T-exit** 驗收(追蹤窗不因提早擊殺而縮短)+ `analysis-hold-track.md` 定稿 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T2 | — |

**T1 是關鍵路徑瓶頸**(觸碰 `SimLoop.ts` 熱路徑,零回溯相容成本要求最高);T2 依賴 T1 交付的 `fireLocked`/`tStop`,無法並行。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-35 狀態翻 ✅,開放 WP-38 entry 的其中一個條件(尚需 WP-36/37 一併 T-exit)。
- **單一閘貼證據**:`npm run test:ci`(本 WP 不動 `research/`,不需要 `uv run pytest`)。

## 本 WP 特有的三條紀律

1. **既有開火/目標生命週期行為零回溯相容成本**:`fireLocked`/凍結分支必須完全可省略;既有 `SimLoop.test.ts`/`fire-determinism.test.ts`/`recoil-wiring.test.ts`/`ballistic-compose.test.ts`/`tracking_br_v1` 相關測試零修改全綠是機械判準。
2. **既有追蹤幾何禁第二定義(C-D4)**:on-target/ε(t)/首發判定一律呼叫既有 `trackingDerivation.ts`/`compute.ts`/`peekWindows.ts`;新指標函式只做加法擴充。
3. **`fireLocked` 解鎖與 `tStop` 記錄同 tick 完成**:T1 單元測試須直接斷言,避免製造系統性的 `t_fire − t_stop` 偏移。
