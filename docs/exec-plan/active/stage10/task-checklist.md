# Stage 10 — Master Task Checklist

> Stage spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 本清單先固定垂直切片、相依與 exit gate。每個 task 正式開工前，依 `docs/exec-plan/README.md` 規則補成自足 task file，並在讀碼後更新具體檔案與 blast radius；未完成前不得把預計路徑當成既成事實。

## WP-48 — Local History Foundation

> 自足 spec：[wp-48-local-history-foundation/README.md](wp-48-local-history-foundation/README.md) · checklist：[wp-48-local-history-foundation/task-checklist.md](wp-48-local-history-foundation/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate／filesystem PoC／決策凍結 | [T0-entry-gate.md](wp-48-local-history-foundation/T0-entry-gate.md) | 無 | High |
| ⬜ | **T1** Strict ExportPayload runtime contract | [T1-export-payload-contract.md](wp-48-local-history-foundation/T1-export-payload-contract.md) | T0 | High |
| ⬜ | **T2** Filesystem repository | [T2-filesystem-repository.md](wp-48-local-history-foundation/T2-filesystem-repository.md) | T1 | High |
| ⬜ | **T3** Node History API／Vite adapter | [T3-node-history-api.md](wp-48-local-history-foundation/T3-node-history-api.md) | T2 | High |
| ⬜ | **T4** HistoryClient／persistence state machine | [T4-history-client.md](wp-48-local-history-foundation/T4-history-client.md) | T3 | Med |
| ⬜ | **T5** Assessment-only auto-save wiring | [T5-auto-persistence-wiring.md](wp-48-local-history-foundation/T5-auto-persistence-wiring.md) | T4 | High |
| ⬜ | **T-exit** Foundation acceptance／handoff | [T-exit-gate.md](wp-48-local-history-foundation/T-exit-gate.md) | T1～T5 | Med |

WP-48 Definition of Done：瀏覽器完成一場 Assessment 後，不需人工下載／選檔即可在專案 history root 得到完整 JSON，重新啟動服務後仍可列出並載入；Practice 明確略過持久化但保留當次結果與手動匯出；Practice submission、missing Participant、path escape、partial write、duplicate conflict 與 API unavailable 皆有負向證據。

## WP-49 — History Library and Trends

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Navigation model | 定義 route/view state、breadcrumb、back/forward、loading／empty／error state；固定 `Participant → exact drillId → startedAt desc` | WP-48 T4 | Med |
| ⬜ | **T1** Participant／drill browser | Participant 搜尋與摘要；drill 卡片顯示 exact `drillId`、Assessment 數量、最後測試時間 | T0 + WP-48 API | Low |
| ⬜ | **T2** Run list／historical result | Assessment runs 時間倒序、quality／trend eligibility badges；從磁碟 payload 重建既有 Result Screen | T1 | Med |
| ⬜ | **T3** DrillMetricRegistry | 建立 metric descriptor／formatter／direction registry；未知 drill／未設定 primary metric 有可用 empty state，不發明 composite score | T2 | Med |
| ⬜ | **T4** Assessment trend | 只使用同 `drillId`、quality-ok、compatible、同 metric id/unit 的 Assessment runs；被排除資料仍可見且說明原因 | T3 | High（研究語意） |
| ⬜ | **T-exit** History UI gate | UI unit tests + navigation E2E；至少驗證多 Participant、多 drill、Practice 不進歷史、incompatible 排除、未知 metric 五種情境 | T1～T4 | — |

WP-49 Definition of Done：Participant 與研究員可不接觸檔案選擇器完成歷史瀏覽；即使某 drill 尚無 primary metric，結果與紀錄列表仍完整可用。

## WP-50 — 3D State Replay

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Replay sufficiency audit | 逐 drill 對帳 scene、player/camera、target lifecycle、weapon/fire visual 所需資料；定義 replay schema v1 與 full／partial／unsupported 判定 | WP-48 可載入 payload | High |
| ⬜ | **T1** Playback core | 純函式 playback clock、binary tick lookup、相鄰 tick interpolation、seek、speed、event cursor；決定性 unit tests | T0 | Med |
| ⬜ | **T2** Replay scene adapter | 建立與 live gameplay 隔離的 Three.js scene；由 metadata + sampled state 重建 camera／player／target，不啟動 Pointer Lock、InputSampler 或 live SimLoop | T1 | High |
| ⬜ | **T3** Replay transport UI | 第一人稱 viewport、播放／暫停、seek、0.25×～2×、上一／下一事件、keys／ADS／speed HUD、support badge | T2 | Med |
| ⬜ | **T4** Result/history entry points | 從剛完成的 Result Screen 與歷史 Run Detail 進入同一 Replay Screen；返回時保留來源頁狀態 | T3 + WP-49 T2 | Low |
| ⬜ | **T-exit** Replay gate | golden payload replay tests、seek invariants、partial／unsupported UI、瀏覽器手動驗證；證明 live gameplay determinism 未受影響 | T1～T4 | — |

WP-50 Definition of Done：至少一個代表性正式 drill 可由磁碟 JSON 完成第一人稱 3D 重播、任意 seek 與事件跳轉；其餘 drill 依 T0 audit 如實顯示支援程度。

## WP-51 — Integration and M18 Acceptance

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** End-to-end happy path | Assessment：`完成測試 → 自動保存 → Result → History → Run Detail → Replay`；Practice：`完成測試 → Result／手動匯出` 且無歷史紀錄 | WP-48～50 | Med |
| ⬜ | **T1** Failure／recovery | API 未啟動、無寫入權限、invalid/corrupt JSON、duplicate conflict、partial/unsupported replay、空資料夾與 retry/download fallback | T0 | Med |
| ⬜ | **T2** Scale／responsiveness | 以合成 fixtures 驗證大量 Participant／run 的掃描與 UI responsiveness；必要時只新增可重建的 summary index/cache，JSON 仍為 source of truth | T0 | Med |
| ⬜ | **T3** Documentation／operations | 更新啟動指令、資料夾契約、schema、使用者操作與 troubleshooting；標示 prototype 無權限邊界 | T1～T2 | Low |
| ⬜ | **T-exit** M18 gate | 執行 README §10 全部驗收、`npm run build`／unit／E2E 全綠、人工重播驗收、CodeGraph／graphify／exec-plan 對帳 | T0～T3 | — |

WP-51 Definition of Done：README §10 全數通過後才可宣告 M18；不可只因 happy-path demo 可操作就略過資料安全、重啟持久性、Practice 歷史排除或 unsupported replay。

## 執行順序

```text
WP-48 T0→T5→T-exit
       ├──→ WP-49 T0→T4→T-exit ──┐
       └──→ WP-50 T0→T3 ──────────┤
                    WP-49 T2 ─→ WP-50 T4→T-exit
                                      └──→ WP-51 T0→T-exit
```

- WP-49 與 WP-50 在 WP-48 可穩定讀取 payload 後可並行，但不得同時改動同一 History navigation／Result Screen 熱區。
- WP-50 T0 是實作 gate；audit 沒有結論前不得先做一個看似可播、實際默默遺失狀態的播放器。
- WP-51 只收斂跨模組與 acceptance，不在最後一刻新增未經單元測試的新 domain logic。

## 全階段紀律

1. 一個 task = 一個垂直切片 = 一個原子 commit；先驗證再進下一 task。
2. 修改既有 symbol 前依專案規範執行 CodeGraph impact，記錄 affected files／symbols 與 local 或 cross-module 判斷。
3. 所有 filesystem tests 使用 workspace 內明確的 temporary root，先驗證 resolved path；不得刪除或改寫 `data/session-history/` 的真實資料。
4. JSON 是 source of truth；任何 index/cache 必須可從 JSON 重建。
5. Replay path 不得呼叫 live `SimLoop`、注入 InputSampler 或改寫當前 session 的 `SharedState`。
6. Practice 不持久化／不進歷史與 exact `drillId` 分組必須同時有 domain test 與 UI/E2E 證據。
7. 每個 WP 完成時更新 [progress.md](progress.md)；程式碼修改後執行 `graphify update .`。
