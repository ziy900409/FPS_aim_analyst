# T0 — Entry gate

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-2 ✅、WP-4 ✅、WP-5 ✅（M2） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認事件來源（WP-4 t_visible、WP-5 fire/hit/firstShot/counter）與 metadata 來源（WP-0 backend seam、WP-1 sensitivity、WP-0 T2 COI）就緒；敲定 ring buffer 容量/欄位/CSV 結構（OQ-7.1~7.4）。

## Steps
- [ ] 確認 WP-4/5 產生 t_visible/fire/hit/firstShot/counter；sim tick 有 recorder 掛點。
- [ ] 確認 WP-0 `createRenderer().backend` seam + WP-1 sensitivity getter + `crossOriginIsolated` 可讀。
- [ ] 鎖 OQ-7.1：arena 容量 = `maxDrillSeconds`×simHz + 餘裕、**非環狀**、超量升 `recorderOverflow`（不覆寫）。
- [ ] 鎖 OQ-7.2：tick 欄位 `{t,vx,vz,crosshair,keys}`（附錄 C）。
- [ ] 鎖 OQ-7.3：JSON 主 + ticks.csv/events.csv。
- [ ] 鎖 OQ-7.4：記錄重用、匯出一次性序列化。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：事件 + metadata 來源齊備；否則 STOP（缺源無法完整記錄）。
- OQ-7.1~7.4 翻 ✅。

## Commit
`docs(wp-7): T0 entry gate — 確認事件/metadata 來源 + 鎖 OQ-7.1~7.4`
