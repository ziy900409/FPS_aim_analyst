# T0 — Entry gate

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-0 exit-gate ✅ |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only：`progress.md`、`README.md`（OQ 狀態） |
| **Status** | ✅ DONE（2026-06-30）— WP-0 地基綠燈確認 + OQ-1.1/1.2/1.3 鎖定 |

## Objective
確認 WP-0 地基可承接 WP-1：空場景可跑、`createRenderer` seam 可用、`crossOriginIsolated===true`。鎖定 OQ-1.1（sensitivity 換算）、OQ-1.2（房間尺寸佔位）、OQ-1.3（面板可見時機）。

## In scope
- 驗證 WP-0 exit 綠燈（`npm run dev` 空場景 + console backend）。
- 在 README §1 + progress.md 翻 OQ-1.1/1.2/1.3。

## Out of scope
- 任何 `src/` 程式（→ T1+）。

## Steps
- [x] 確認 [WP-0 exit-gate](../wp-0-environment-setup/T6-exit-gate.md) 已 ✅；空場景可跑、console 印 backend（WP-0/T6 e2e 3 passed, backend=webgpu）。本 session 另以 `npx tsc --noEmit` exit 0 重驗地基可編譯。
- [x] 鎖 OQ-1.1：sensitivity = counts→radians 線性係數（`yaw += dx × sensitivity × k`），可調。
- [x] 鎖 OQ-1.2：房間 10×10×3 m、目標距離 ~8 m（佔位，WP-6 取代）。
- [x] 鎖 OQ-1.3：面板鎖定中隱藏、解除時顯示。
- [x] README §1 + progress.md ledger 翻 ✅；加 dated log。

## Definition of Done
- [x] WP-0 exit 綠燈確認記入 progress.md。
- [x] OQ-1.1/1.2/1.3 翻 ✅。
- [x] **PASS 條件**：WP-0 場景可跑 + `createRenderer` seam 存在（[src/render/createRenderer.ts](../../../../src/render/createRenderer.ts) → `{ renderer, backend }`，main.ts L14 消費）→ 成立，不需 STOP 回 WP-0。

## Commit
`docs(wp-1): T0 entry gate — 確認 WP-0 地基 + 鎖 OQ-1.1/1.2/1.3`
