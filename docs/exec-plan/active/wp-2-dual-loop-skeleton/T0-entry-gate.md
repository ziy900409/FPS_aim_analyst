# T0 — Entry gate

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-0 exit ✅、WP-1 exit ✅ |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認 scaffold（WP-0）+ camera（WP-1）就緒，並**敲定決定性驗證的設計**——這是 M1 成敗的關鍵，必須在寫迴圈前定清楚。鎖 OQ-2.1~2.4。

## Steps
- [ ] 確認 WP-0/WP-1 exit ✅；`createRenderer` + `CameraController` 可用。
- [ ] 鎖 OQ-2.1：佔位 sim 邏輯 = 等速位移 + 合成輸入切換 velocity。
- [ ] 鎖 OQ-2.2：決定性測試以多組 frame delta 序列（含抖動 + 一次 spike）餵同一 `pump`。
- [ ] 鎖 OQ-2.3：抽 `clock.ts`（注入式 now）。
- [ ] 鎖 OQ-2.4：`simStep` 設為純函式邊界（不引 worker）。
- [ ] README §1 + progress.md ledger 翻 ✅；加 dated log。

## Definition of Done
- WP-0/WP-1 綠燈確認 + 決定性測試設計（OQ-2.1/2.2）寫入 progress.md。
- OQ-2.1~2.4 翻 ✅。
- **PASS 條件**：camera 可用 + 決定性測試方案明確；否則 STOP。

## Commit
`docs(wp-2): T0 entry gate — 鎖定決定性驗證設計 + OQ-2.1~2.4`
