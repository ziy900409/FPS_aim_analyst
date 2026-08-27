# session-history

本目錄是 WP-48 History API 的**預設 history root**（`data/session-history/`，D-48.P9，可用
`FPS_HISTORY_ROOT` 環境變數覆寫，僅供 test/Playwright 使用）。

- 只有已完成 **Assessment**（`meta.assessment` 存在）的匯出會被自動保存於此；Practice 一律不落地。
- 內容為研究參與者的真實量測資料，**永遠不進 git**（見專案根目錄 `.gitignore`）。此 `README.md`
  是唯一被追蹤的檔案，用途是讓目錄結構在 clone 後即存在，並說明其用途。
- 磁碟佈局、identity 推導規則見
  [docs/exec-plan/active/stage10/wp-48-local-history-foundation/README.md](../../docs/exec-plan/active/stage10/wp-48-local-history-foundation/README.md) §2.3。
- 測試（Vitest/Playwright）一律使用獨立的 temporary root，不得讀寫此目錄（NFR-48.6）。
