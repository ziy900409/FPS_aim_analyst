# Stage 15 — 暫停失效、紀錄完整性與整場重測

> 上層索引：[`docs/exec-plan/README.md`](../../README.md) · 全域決策：[`GD-46`](../../DECISIONS.md#gd-46--wp-69-暫停後永久失去實驗效力時間戳不可信即丟棄只有整場-restart-可恢復資格2026-09-15規劃)

本 stage 把測試中的 Pointer Lock 遺失（包含 `Esc`、切換視窗及瀏覽器主動掉鎖）提升為正式的 pause lifecycle。它解決的不是一般遊戲選單，而是「暫停後這一輪資料還能不能被採納」以及「哪一個動作才能產生新的合格嘗試」。

| WP | 目標 | 相依 | 估時 | 狀態 |
|---|---|---|---:|---|
| **WP-69** | [`wp-69-pause-invalid-restart/`](wp-69-pause-invalid-restart/README.md)：暫停即 sticky invalid；時間戳完整則只保留 invalid diagnostic export，否則丟棄；只有 full restart 建立新的 eligible candidate | WP-65 ✅；與未開工 WP-67 的 schema 接面須在 T0 對帳 | 12.5–18 d | ⬜ 規劃完成，未開工 |

本 stage 暫無獨立 milestone；WP-69 的 `T-exit` 即交付判定。編號依 [GD-15](../../DECISIONS.md)「正式進 §2 索引才算採納」取得；stage14 的 WP-69～71 仍是未批准候選，不構成佔號。

## Stage 級不變式

1. `armed` 期間的取鎖／釋鎖不算 pause；`countdown` 或 `running` 一旦掉鎖，該 attempt 永久失去實驗效力。
2. Resume 只讓受試者完成操作，不恢復資格；只有 full restart 能建立新的 eligible candidate。
3. invalid attempt 若記錄時間軸仍可證明完整，可輸出具名 invalid diagnostic record，但不得存入正式 history、trend、threshold 或自動推進下一條件。
4. 時間戳完整性無法證明時，不建立 payload、不下載、不保存、不 replay，立即清空 recorder 並要求 restart 或離開。
5. `DrillPhase` 不新增 `paused`；pause 是 application/runtime 的正交狀態，底層 phase 原樣保存。
