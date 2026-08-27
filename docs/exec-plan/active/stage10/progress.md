# Stage 10 — progress.md

> Running log。Stage spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**：完成需求釐清與 stage10 規劃。當時使用者確認 Practice／Assessment 皆可瀏覽但 Practice 不進正式趨勢；此項已由下方較新的 Assessment-only 決策取代。其餘決策維持：3D 場景重建重播；JSON 固定存於本專案資料夾；接受 Node History API；只合併完全相同 `drillId`；Participant 與研究員共用且 prototype 不做權限；各 drill metric 後續設計，本階段保留 registry 擴充點。
- **2026-08-27**：建立 stage-level spec、master task checklist 與 M18 驗收條件。尚未開始 WP-48 T0，尚未修改程式碼。
- **2026-08-27**：依使用者指定的 `.claude/skills/engineering-planning/SKILL.md` 把 WP-48 展開為自足 tech spec + T0～T5 + T-exit。新增 strict payload contract、typed API、failure modes、concurrency model、FR/NFR traceability 與客觀 DoD；仍未開始 production implementation。
- **2026-08-27**：使用者修改範圍：歷史紀錄改為 Assessment-only。Practice 不自動保存、不依 Participant 瀏覽，也不進任何歷史清單；當次 Result Screen 與手動匯出維持可用。同步修訂 stage10 與 WP-48 規劃。
- **2026-08-27**：**WP-48 完成 T0～T5＋T-exit**，全部 automated gates／acceptance scenarios／data-safety／architecture-regression 檢查有客觀證據（見 [wp-48-local-history-foundation/progress.md](wp-48-local-history-foundation/progress.md) T-exit 條目）。M18 stage 內首個 WP 落地；WP-49／WP-50 可視 WP-48 對外面（`HistoryClient` 六 method＋typed error codes）為穩定地基開工。

## Decision Log

- **D-S10-1 / Replay**：採 recorded-state playback；以 tick／event 與 metadata 驅動隔離的 Three.js replay scene，不用輸入重新跑 live simulation，也不錄製影片。
- **D-S10-2 / Storage**：JSON 為唯一 source of truth，預設 root 為 `data/session-history/`，實體階層對齊 `Participant ID → exact drillId → startedAt`。
- **D-S10-3 / Filesystem boundary**：新增 Node History API；browser UI 只透過 typed `HistoryClient` 存取，不引入 Node `fs` 或任意路徑選擇。
- **D-S10-4 / Assessment-only history（取代原 Trend policy）**：只有 Assessment 會持久化與依 Participant 瀏覽；Practice 僅保留當次結果及手動匯出，不建立可供日後瀏覽／重播的歷史 run。Assessment 趨勢仍須通過 quality、compatibility 與 metric id/unit gate。
- **D-S10-5 / Metric evolution**：不建立 composite score。未註冊 primary metric 不阻擋 history／result／replay，只顯示明確 empty state。
- **D-S10-6 / Prototype security boundary**：不做登入與角色權限；Node API 仍必須防 path traversal、root escape、半寫入及靜默覆寫。

## Surprises

- 現有應用是純 Vite browser runtime；目前 `downloadJSON()` 只建立 Blob 並觸發 `<a download>`，不能自行寫入或掃描專案資料夾。因此固定路徑歷史庫必須新增本機 server boundary，不能只改 UI。
- 現有 `ticks`／`events` 已提供第一人稱重建所需的大部分狀態，但尚未證明每個 drill 的 target lifecycle、scene 與 weapon visual 都能完整還原。WP-50 T0 必須逐 drill audit，不可用單一 schema version 推定 full replay。
- 現有 `SessionSummary` 固定為 speed／accuracy 兩指標；stage10 需以 registry 包住其既有行為，避免新歷史 UI 永久被兩欄資料形狀限制。

## Open Questions（狀態）

- **OQ-S10-1**：Node API 啟動形式。WP-48 讀碼後推薦 Vite dev/preview plugin middleware（既有 plugin 先例、無需 process orchestrator），最終於 WP-48 T0 收斂。
- **OQ-S10-2**：history root。預設 `data/session-history/`；測試只允許啟動參數注入 temporary root，UI 不提供任意路徑輸入。
- **OQ-S10-3**：逐 drill replay 支援矩陣。待 WP-50 T0 audit；不阻塞 WP-48／WP-49。
- **OQ-S10-4**：各 drill primary metrics。後續另行設計；不阻塞 storage、navigation 與 replay MVP。
- **OQ-S10-5（已關閉）**：researcher Practice 不需要 Participant context；Practice 已由使用者明確排除於持久化與 Participant 歷史之外。
