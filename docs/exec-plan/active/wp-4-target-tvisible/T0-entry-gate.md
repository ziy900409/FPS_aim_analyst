# T0 — Entry gate

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-1 exit ✅、WP-2 exit ✅（M1） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認 M1 達成、WP-1 場景可承接目標，並敲定目標幾何/可見性/交替/消失語意（OQ-4.1~4.4），尤其 `t_visible` 的「在 sim tick 內蓋一次」契約。

## Steps
- [ ] 確認 WP-1 exit ✅（場景）+ WP-2 exit ✅（M1，sim tick + clock）。
- [ ] 確認 `SimLoop` 有 simStep 掛點可呼叫 `TargetManager.tick`，且 sim clock 可取 `nowMs`。
- [ ] 鎖 OQ-4.1：膠囊/方塊 + **單一 hitbox（H1）**，`part` 選填保留。
- [ ] 鎖 OQ-4.2：spawn 即可見、`t_visible`=spawn tick 時間。
- [ ] 鎖 OQ-4.3：內建確定性輪替序列。
- [ ] 鎖 OQ-4.4：擊殺標記 → 消失 → 生成對側。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M1 達成 + WP-1 場景 + sim tick 可蓋戳；否則 STOP。
- OQ-4.1~4.4 翻 ✅。

## Commit
`docs(wp-4): T0 entry gate — 確認 M1/場景 + 鎖 OQ-4.1~4.4`
