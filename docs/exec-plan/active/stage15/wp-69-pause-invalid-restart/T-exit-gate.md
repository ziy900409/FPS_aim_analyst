# WP-69 T-exit — 驗收閘

## Objective

逐條證明 pause invalidation、timestamp discard 與 full restart 的整體契約已成立；不能用「測試全綠」取代具名行為證據。

## Steps

1. 對 README FR-69.1～69.12、NFR-69.1～69.8 建 acceptance matrix，連到測試名稱、命令、exit code 與實機證據。
2. 重跑 CodeGraph impact，確認所有 finalization/advance/save/download caller 已經過 central gate；pending files 直接讀檔。
3. 執行 T6 全量 gate；記錄 exact pass/skip counts、瀏覽器版本、COI、display/pointer-lock 條件與 git SHA。
4. 執行 schema/fixture diff、zero-pause digest、invalid/discard call matrix 與 same-seed restart parity。
5. 將 GD-46 狀態翻為 ✅ 並補實作證據；更新 top/stage index、checklist/progress，確認 OQ/風險/技術債沒有被靜默遺留。

## Definition of Done

- [x] FR-69.1～69.12 與 NFR-69.1～69.8 無任何「完成」但無證據的列
- [x] invalid/discarded 對正式保存、trend、threshold、advance 的零呼叫有 unit + live evidence
- [x] timestamp corrupt 案例證明 payload/metrics/download/replay 均未建立
- [x] full restart 同 seed/input fresh-run parity 通過，且只 clean retry 能前進
- [x] 全量驗證綠；任何 skip/替代證據有 owner、原因與後續處置
- [x] GD-46、README index、stage index、task checklist、progress 狀態一致

## Commit

```text
docs(wp-69): T-exit evidence for pause validity
```

---

## 落閘結果（2026-09-15）

✅ 六條 DoD 全數達成，逐條證據與對帳見 [progress.md §T-exit](progress.md)（§TE.7 為 DoD 逐條對帳）。production diff = 空。

本 gate 另查出並修復三處文件不一致（§TE.6），其中 `operator-manual.md` 的 Esc 語意過期屬操作員會實際踩到的缺口，非 nit。
