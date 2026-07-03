# T4 — 緩衝 + 附錄 E 驗收

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1, T2, T3 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `docs/operational/acceptance-stage-a.md`；MODIFY 整合期發現的任何缺陷 |
| **Status** | ✅ 完成（2026-07-03） |

## Objective
處理整合期未預期問題（緩衝），並逐項 map 規格**附錄 E 驗收清單**到證據，確保階段 A 可交付（FR-9.4）。

## In scope
- 緩衝：修整合期暴露的 bug（小修，不擴範圍）。
- `acceptance-stage-a.md`：附錄 E 10 項逐一對照證據（自動測試 / 手動驗收，OQ-9.4）。

## 附錄 E 驗收項（逐項 map）
- [ ] `crossOriginIsolated===true`、`performance.now()` 5 µs → WP-0 T2 / WP-9 T1（E2E COI）
- [ ] 渲染後端正確偵測寫入 metadata → WP-0 T3 / WP-7 T3
- [ ] sim 穩定 128 Hz、決定性多 FPS 通過 → WP-2 T4 / WP-9 T3
- [ ] A/D 橫移 + 反向鍵急停、停止 gate 開火 → WP-5 T3/T4
- [ ] 目標左右交替、`t_visible` 正確 → WP-4 T2/T3
- [ ] 首發命中判定不被掃射稀釋 → WP-5 T2
- [ ] 1 個完整 counter-strafe drill 可端到端遊玩 → WP-6 T3 / WP-9 T1
- [ ] 資料可匯出 JSON/CSV、schema 與文件一致 → WP-7 T4/T5 / WP-9 T1
- [ ] drill 後統計顯示 §5 全部指標 → WP-8 T1/T2
- [ ] 反應時間分布落合理範圍（150–250 ms）→ WP-9 T2

## Out of scope
- 新功能；階段 B。

## Steps
- [x] 跑全套測試 + 手動遊玩，列出整合期缺陷並小修。（tsc + vitest 185 + playwright 7 全綠；整合期無新缺陷）
- [x] 寫 `acceptance-stage-a.md`：附錄 E 逐項證據連結（自動/手動標註）。
- [x] 確認 10 項皆有證據（綠燈或手動通過）。

## Definition of Done
- [x] 整合期缺陷已修；附錄 E 10 項全部對照證據（無漏項）。

## Commit
`docs(wp-9): 緩衝修正 + 附錄 E 階段 A 驗收對照（FR-9.4）`
