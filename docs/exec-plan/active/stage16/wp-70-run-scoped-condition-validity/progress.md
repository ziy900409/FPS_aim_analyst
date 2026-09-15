# WP-70 — Progress

## Snapshot

- **狀態**：⬜ 規劃完成（2026-09-15），未開工
- **分支**：`chore/agents-skills-tree`（開工時依實況更新）
- **規劃日期**：2026-09-15
- **下一步**：T0 entry gate —— 重查編號、凍結 baseline、**實測 OQ-70.1（Playwright fullscreen 可行性）**
- **來源**：[KI-040](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
- **決策**：`GD-47`（預約，T0 重查）

## Planning evidence

規劃依 `.claude/skills/engineering-planning/SKILL.md`，已讀 `CLAUDE.md` §3/§4、
`docs/exec-plan/README.md`（WP 狀態與編號）、`DECISIONS.md`（GD-10 原文、GD-15 編號規則、GD-46）、
上游 [WP-69](../../stage15/wp-69-pause-invalid-restart/README.md) 的 README/progress，
以及 `references/design_standards.md` 與 `assets/tech_spec_template.md`。

### 規劃期讀碼確認的事實（T0 須以當前行號複核，不得沿用本節行號）

| 事實 | 位置 | 對本 WP 的意義 |
|---|---|---|
| `experimentSession.suspect` 只有兩個賦值（初值 `false`、失效 `true`），無 reset | `src/display/experimentSession.ts:44,63` | 缺陷 A 的根 |
| `frames.summary.p95 > PERF_FLOOR_MS` 為 **per-run**（`frameLog` 每場 reset/freeze） | `src/main.ts:915`、`:1417`、`:1828`、`:2440` | ⭐ suspect 的兩個成分 scope 不一致，本 WP 只是對齊 |
| `pointerLockLostDuringRun` 已是 per-run，由 DOM 事件寫、`resetState()` 歸零、`meta.validity` 匯出 | `SharedState.ts:390,521,577`、`main.ts:927,1877` | ⭐ **逐字同型的先例**，T1 照抄即可 |
| `resetState()` 由 `DrillRunner.start()` 呼叫 | `src/drill/DrillRunner.ts:190` | per-run 歸零點已存在，不需新建 |
| `meta.validity` 目前**沒有** fullscreen 欄位 | `src/main.ts:919-932` | 現行 payload 無法區分 suspect 來自 fullscreen 或 perf ⇒ FR-70.2 |
| protocol 路徑未套用 `recording` 閘 | `src/main.ts:674-675` | 第二套判準（C-D4）⇒ T2 |
| `requestFullscreen` / `hideSuspectWarning` 各為 production 單一呼叫點，皆綁資格閘 | `src/main.ts:633`、`:642` | 缺陷 B/C ⇒ T3/T4 |
| `SessionRunner.start()` 非 idle/done 即 throw；否則 `enterStep(0)` | `src/session/SessionRunner.ts:220-234` | 重開資格閘救不了進行中的 plan ⇒ T4 必須解耦 |

### ⚠️ 規劃期對 KI-040 的兩處修正

1. **KI-040 §6.2 高估了變更規模。** 該節寫「`experimentSession` 應從 session 級累加器改為 per-run
   計算 —— 比原先估的變更大」。實際上 `pointerLockLostDuringRun` 已提供逐字同型的 per-run 儲存與
   歸零點，T1 照抄該 pattern 即可，`experimentSession` 只需停止供應 export 路徑。
2. **KI-040 對 GD-10 的衝擊判讀過重。** 先前記為「改動 GD-10」。逐字重讀 GD-10 ① 後：該條文把
   "session 標 suspect" 綁在**效能地板**上，而該成分實作上早已 per-run；「fullscreen 退出 ⇒ session
   級 sticky」是 WP-20 T2 的實作延伸，不在 GD-10 條文內。⇒ 預設為**補澄清註記**而非修訂 GD-10
   （見 README §0.2）。T0 須複核此判讀；若判定仍屬實質修改，改為修訂並在 `GD-47` 註明。

## Task log

| Task | 狀態 | 證據 / 決策 / 意外 |
|---|---|---|
| T0 | ⬜ | — |
| T1 | ⬜ | — |
| T2 | ⬜ | — |
| T3 | ⬜ | — |
| T4 | ⬜ | — |
| T5 | ⬜ | — |
| T6 | ⬜ | — |
| T-exit | ⬜ | — |

## Decision log

| ID | 決定 | 狀態 |
|---|---|---|
| D-70.P1 | 效力單位＝**單次 run**（產生一份 payload 的那一次），非 drill 型別、非 session plan 的一個 item | 使用者 2026-09-15 拍板（逐字：「session 斷掉沒關係，只要同一個 drill 沒有中斷即可」）；讀法見 README §6 Assumption 1 |
| D-70.P2 | 入口採 **E2**（重跑條件檢查、不重啟 plan），非 E1（暫停面板直接取鎖） | 使用者 2026-09-15 拍板 |
| D-70.P3 | KI-007 的錄製窗定義**不改**（含「暫停期間仍屬錄製窗」） | 使用者 2026-09-15 拍板（KI-040 OQ-KI-040-1） |
| D-70.P4 | T1 照抄 WP-65 T5 的 `pointerLockLostDuringRun` pattern，不重新設計 `experimentSession` | 規劃期採納（見上方修正 1） |
| D-70.P5 | GD-10 預設**補澄清而非修訂**；T0 複核 | 規劃期採納（見上方修正 2） |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| **OQ-70.1** 🔴 | Playwright 能否在 `--project=edge` 下可靠進入真 fullscreen 並觸發 `fullscreenchange`？ | T0 | T0 結束 | **T5 的形狀**（e2e 任務 vs 手動清單＋單元注入） |
| **OQ-70.2** 🟡 | `experimentSession.suspect` 被切斷 export 路徑後是否仍有消費者？刪除或保留為 session 級稽核？ | T1 | T1 | T1 的刪改範圍 |
| **OQ-70.3** 🟡 | 恢復流程要不要重驗**原生解析度**？（session 中途通常不變，除非使用者換螢幕——而那正是會變的情況） | T4 | T4 | T4 的檢查項與失敗率 |
| **OQ-70.4** 🟡 | 已下載的匯出檔（瀏覽器下載資料夾，repo 掃不到）是否需要操作員自查清單？`data/session-history/` 已確認零筆（KI-040 §8） | 使用者 | T6 | T6 的文件範圍；不阻塞程式修改 |

## Surprises

（開工後填寫）
