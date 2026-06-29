# T0 — Entry gate

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-0 exit-gate ✅ |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only：`progress.md`、`README.md`（OQ 狀態） |
| **Status** | ⬜ TODO |

## Objective
確認 WP-0 地基可承接 WP-1：空場景可跑、`createRenderer` seam 可用、`crossOriginIsolated===true`。鎖定 OQ-1.1（sensitivity 換算）、OQ-1.2（房間尺寸佔位）、OQ-1.3（面板可見時機）。

## In scope
- 驗證 WP-0 exit 綠燈（`npm run dev` 空場景 + console backend）。
- 在 README §1 + progress.md 翻 OQ-1.1/1.2/1.3。

## Out of scope
- 任何 `src/` 程式（→ T1+）。

## Steps
- [ ] 確認 [WP-0 exit-gate](../wp-0-environment-setup/T6-exit-gate.md) 已 ✅；`npm run dev` 空場景可見、console 印 backend。
- [ ] 鎖 OQ-1.1：sensitivity = counts→radians 線性係數，可調。
- [ ] 鎖 OQ-1.2：房間 10×10×3 m、目標距離 ~8 m（佔位，WP-6 取代）。
- [ ] 鎖 OQ-1.3：面板鎖定中隱藏、解除時顯示。
- [ ] README §1 + progress.md ledger 翻 ✅；加 dated log。

## Definition of Done
- WP-0 exit 綠燈確認記入 progress.md。
- OQ-1.1/1.2/1.3 翻 ✅。
- **PASS 條件**：WP-0 場景可跑 + `createRenderer` seam 存在；否則 STOP 回 WP-0。

## Commit
`docs(wp-1): T0 entry gate — 確認 WP-0 地基 + 鎖 OQ-1.1/1.2/1.3`
