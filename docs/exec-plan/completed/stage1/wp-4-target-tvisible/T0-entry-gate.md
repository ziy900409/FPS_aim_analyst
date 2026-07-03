# T0 — Entry gate

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-1 exit ✅、WP-2 exit ✅（M1） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE（2026-07-01）|

## Objective
確認 M1 達成、WP-1 場景可承接目標，並敲定目標幾何/可見性/交替/消失語意（OQ-4.1~4.4），尤其 `t_visible` 的「在 sim tick 內蓋一次」契約。

## Steps
- [x] 確認 WP-1 exit ✅（場景）+ WP-2 exit ✅（M1，sim tick + clock）。**證據**：頂層索引 §2/§3 WP-1/WP-2 皆 ✅、M1 ✅（2026-07-01）；兩者 T-exit-gate 文件 Status 皆 ✅ DONE。
- [x] 確認 `SimLoop` 有 simStep 掛點可呼叫 `TargetManager.tick`，且 sim clock 可取 `nowMs`。**證據**：[SimLoop.ts](../../../../src/loop/SimLoop.ts) `simStep(state, dtSec, tickEndMs)` 已由 `pump()` 以 `simTimeMs`（累加 tickMs 的邏輯 sim 時鐘，量測時鐘域）呼叫；`tickEndMs` 即為 `TargetManager.tick` 需要的 `nowMs`，T2 只需在 `simStep` 內插入一行呼叫。`SharedState`（WP-2 T1）已預留 `targets: TargetState[]` 與 `tVisible: Map<string, number>` 欄位（[SharedState.ts:24-26](../../../../src/state/SharedState.ts)）。
- [x] 鎖 OQ-4.1：膠囊/方塊 + **單一 hitbox（H1）**，`part` 選填保留。**對齊** CONTEXT.md `HitDetector` 條目（「階段 A 單一 hitbox…`part` 欄位保留選填」）——一致，鎖定。
- [x] 鎖 OQ-4.2：spawn 即可見、`t_visible`=spawn tick 時間。**對齊** CONTEXT.md `t_visible` 條目（「狀態翻轉那個 sim tick 執行當下蓋…」）——一致，鎖定。
- [x] 鎖 OQ-4.3：內建確定性輪替序列。WP-6 drill loader 接管前的暫定實作，不影響 WP-2 決定性契約（輪替本身是確定性函式，無隨機源）；鎖定。
- [x] 鎖 OQ-4.4：擊殺標記 → 消失 → 生成對側。命中訊號延後至 WP-5，本 WP 用測試/佔位觸發 `markKilled`；鎖定。
- [x] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M1 達成 + WP-1 場景 + sim tick 可蓋戳；否則 STOP。→ **PASS**。
- OQ-4.1~4.4 翻 ✅。→ 已全部翻 ✅（見上）。

## Surprise
`src/state/types.ts` 現有 `TargetState`（WP-2 T1 佔位：`{ id, x, y, z, active }`）與本 WP README §2 interface contract 的新設計（`{ id, side, pos, visible, alive, hitbox, motion?, age? }`）欄位不同——**預期中的落差**（README 已標注 `SharedState.ts` 為 MODIFY，WP-2 只立佔位結構供編譯通過）。T1 需同步 MODIFY `src/state/types.ts` 的 `TargetState` 定義，而非只動 `SharedState.ts`。已記入 progress.md 供 T1 承接。

## Commit
`docs(wp-4): T0 entry gate — 確認 M1/場景 + 鎖 OQ-4.1~4.4`
