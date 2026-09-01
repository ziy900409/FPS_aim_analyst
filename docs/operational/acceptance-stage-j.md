# 階段 J（stage10）驗收清單 J — WP-51 T-exit / M18 draft dossier

> M18（stage10 交付：本機歷史紀錄中心與 3D 重播 prototype）的驗收對照草案，逐項對應 [stage10 README §10 M18 驗收條件](../exec-plan/active/stage10/README.md#10-m18-驗收條件) 與 WP-51 [README §1 FR/NFR](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md#1-需求壓縮requirements)。由 WP-48／WP-49／WP-50 各自 T-exit 證據 + WP-51 T0～T4 新增的跨模組驗收證據覆核。
>
> **狀態：T-exit automated gates 已重跑（2026-08-31），M18 尚未宣告。** T4 measurement gate 已在較乾淨環境重跑通過，build/typecheck/Vitest/Playwright/Stage10 runner/critical repeat 皆有 pass evidence；KI-017 已於 2026-09-01 由 WP-50 owner 修復。manual browser/GPU/a11y walkthrough、獨立 operator 重跑、KI-018 owner 收斂與 Chrome/WebGL2 coverage gap 尚未完成——本文件如實記錄未完成項，不把它們標成 pass。
>
> Companion：[T5 task spec](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/T5-operations-manual-release.md) · [WP-51 progress.md](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/progress.md) · [history-center-replay.md](history-center-replay.md)

---

## 0. 執行基線

| 項目 | 值 |
|---|---|
| Commit | working tree based on HEAD `d142baf`（WP-51 T-exit automated gate run；local harness/docs changes not yet committed） |
| OS | Windows 11 Enterprise 10.0.26100 64-bit |
| Node | v25.9.0 |
| GPU | NVIDIA GeForce RTX 4070 Laptop GPU（driver 32.0.15.7703，供 WebGPU 人工驗收）+ Intel UHD Graphics（內顯，供 WebGL2 fallback 對照） |
| Browser（自動化） | 系統安裝 Edge 151.0.4129.101（Playwright `channel:'msedge'`） |
| Browser（人工，待執行） | 需另外安裝的 latest Chrome（本機未安裝，見 §4） |

| 命令 | 結果 |
|---|---|
| `npm run typecheck` | ✅ exit 0（browser + `tsconfig.node.json` 兩層） |
| `npm run test`（Vitest） | ✅ exit 0，186 passed + 1 skipped files（187 total）／1654 passed + 2 skipped tests（1656 total） |
| `npm run build` | ✅ exit 0（Vite build 2.06s；既有 >500kB chunk warning） |
| `npm run test:e2e`（Playwright `edge` project） | ✅ exit 0，71/71 passed |
| `npm run test:ci` | ✅ exit 0（typecheck + Vitest + Playwright 71/71） |
| `npm run test:stage10` | ✅ exit 0，wall time 39.0s（< 600s NFR-51.5 budget） |
| `npx playwright test tests/e2e/stage10-assessment.spec.ts tests/e2e/stage10-preview.spec.ts tests/e2e/stage10-failure-recovery.spec.ts tests/e2e/stage10-accessibility.spec.ts tests/e2e/stage10-lifecycle-scale.spec.ts tests/e2e/stage10-projection-shape.spec.ts tests/e2e/replay.spec.ts --project=edge --repeat-each=5 --retries=0` | ✅ exit 0，100/100 passed |
| `npm run test:stage10:scale`（opt-in measurement） | ✅ exit 0；History first-100 P95 244ms、100-run analysis cold/warm 269/267ms、42k Replay cached-reopen P95 480ms |

---

## 1. Stage10 README §10 — M18 驗收條件對照

| # | 條件 | 判定方式 | 證據入口 | 狀態 |
|---|---|---|---|---|
| 1 | 完成 Assessment 後，JSON 自動且原子地寫入正確 Participant／drillId 目錄 | automated | `tests/history/historyRepository.test.ts`（WP-48 atomic write）+ [`tests/e2e/stage10-assessment.spec.ts`](../../tests/e2e/stage10-assessment.spec.ts)（真實完成→autosave→History 全端） | ✅ |
| 2 | API 重啟後仍可從磁碟重建索引，不依賴瀏覽器記憶體／IndexedDB | automated (integration) | [`tests/stage10/stage10-restart.integration.test.ts`](../../tests/stage10/stage10-restart.integration.test.ts)（close→reopen 同 root，兩次 snapshot deep-equal） | ✅ |
| 3 | Participant、drill、run 列表正確，run 依 `startedAt` 新到舊 | automated | 同上 T2 restart test（tie-break／排序具名斷言）+ WP-49 `history-library.spec.ts` | ✅ |
| 4 | 完成 Practice 後仍可查看當次結果與手動匯出，但不呼叫保存 API、不產生歷史檔案，也不出現在 Participant 歷史紀錄 | automated | `src/history/HistoryPersistence.test.ts`（`payload.meta.assessment===undefined`→`excluded`，零 API 呼叫）+ [`Stage10FixtureFactory.test.ts`](../../tests/stage10/Stage10FixtureFactory.test.ts)（Practice 排除 round-trip） | ✅ |
| 5 | 不同 `drillId` 不會被合併；同 drill 的不相容 Assessment 不會被靜默混算 | automated | T2 restart test cohort 分離斷言 + [`tests/e2e/stage10-preview.spec.ts`](../../tests/e2e/stage10-preview.spec.ts)（incompatible cohort 在 production bundle 上仍分離） | ✅ |
| 6 | 未註冊主要 metric 的 drill 仍可完整使用歷史列表、結果與重播 | automated | `stage10-preview.spec.ts`（`hold_click_v1` unregistered-metric → 明確 empty-state，而非臨時 composite score） | ✅ |
| 7 | 支援的 JSON 可進行第一人稱 3D 重播、seek、調速與 event navigation | automated + measurement | `tests/replay/ReplayPlayer.test.ts`（WP-50）+ [`stage10-assessment.spec.ts`](../../tests/e2e/stage10-assessment.spec.ts)（live/historical `full` replay parity）；42k-tick cached-reopen P95 見 §1.1 | ✅ |
| 8 | `unsupported`／`partial`／`invalid` 記錄有明確 UI，不 crash、不假裝完整重播 | automated | `stage10-preview.spec.ts`（`partial` banner + transport 仍可用、`unsupported` 面板+返回鍵）；`invalid` 經確認是目前程式碼中不可達的保留分支（schema 層即拒絕，永遠不進 History 列表，見 WP-51 progress.md 2026-08-31「T2 範圍收斂」段） | ✅ |
| 9 | API 不接受 history root 外的讀寫路徑，且重複保存不會靜默覆寫不同內容 | automated (injected failure) | `tests/history/historyRepository.test.ts`（symlink/traversal 拒絕）+ [`tests/e2e/stage10-failure-recovery.spec.ts`](../../tests/e2e/stage10-failure-recovery.spec.ts)（path-traversal participantId + outside-sentinel 全端驗證、duplicate idempotent/conflict） | ✅ |
| 10 | Unit／integration／E2E 全綠；測試不寫入真實歷史資料夾 | automated + inspection | §0 baseline；`Stage10AcceptanceEnvironment.ts` containment guard + outside-sentinel（NFR-51.3） | ✅ |
| 11 | `npm run build` 與既有回歸測試全綠，live gameplay 的 determinism 與結果計算未被 replay path 改變 | automated | §0 baseline；`src/sim/*.test.ts`／`src/drill/*.test.ts` 等既有 determinism 測試零修改全綠（WP-50 T-exit 已對帳，WP-51 未觸碰這些檔案） | ✅ |

### 1.1 條件 7 的效能子項

`42,000-tick Replay cached-reopen` P95（`tests/stage10/stage10-scale.perf.ts`，opt-in benchmark）曾在 T4 本機背景負載較高時落在 884ms～1927ms，未強行判定通過。T-exit 於同一 reference machine 重跑 `RUN_STAGE10_SCALE_BENCHMARK=1 npm run test:stage10:scale`，結果：cold open 272ms、cached-reopen P95 480ms（15 samples：480, 364, 300, 369, 301, 328, 313, 363, 326, 330, 300, 346, 314, 303, 357ms），低於 1500ms budget。此效能子項已由 measurement evidence 補齊。

---

## 2. WP-51 FR/NFR traceability（延伸 README §4.1，補上實際狀態）

| Requirement | Owner task | 狀態 | 備註 |
|---|---|---|---|
| FR-51.1／FR-51.17 | T0 | ✅ | WP-48/49/50 handoff矩陣（progress.md T0 段）；KI-017/KI-018 已依此規則回流，其中 KI-017 已修復、KI-018 仍待 WP-49（見 §3） |
| FR-51.2／FR-51.11／FR-51.14 | T1 | ✅ | isolated dev/preview roots、`npm run test:stage10` 單一命令+report |
| FR-51.3～FR-51.8 | T2 | ✅ | canonical/restart/parity/Practice/support 全數見 §1 条件1-8 |
| FR-51.9～FR-51.10 | T3 | ✅ | failure/recovery/race，repeat×5 zero-failure（既有 flake 除外，如實記錄） |
| FR-51.12 | T4 | ✅ | scale/lifecycle gates 全綠，42k P95 重跑見 §1.1 |
| FR-51.13 | T4 | ✅ | [`stage10-accessibility.spec.ts`](../../tests/e2e/stage10-accessibility.spec.ts) keyboard/focus/ARIA journey |
| FR-51.15 | T5 | ✅ | [history-center-replay.md](history-center-replay.md) |
| FR-51.16 | T5 | 🔴 blocked（見 §4） | 人工 browser/GPU walkthrough 尚未執行 |
| NFR-51.1 | T4 | ✅ | 同 §1.1 |
| NFR-51.2 | T3/T4 | ✅ | repeat×5 --retries=0，既有 flake 已標明非本次改動造成 |
| NFR-51.3 | T1/T3 | ✅ | outside-sentinel + containment |
| NFR-51.4 | T4 | ✅ | abort <100ms + 50-cycle baseline |
| NFR-51.5 | T4 | ✅ | wall time 38.5s/41.6s |
| NFR-51.6 | T4/T5 | 🟡 | automated 部分✅；manual screen-reader smoke 見 §4 |
| NFR-51.7 | T0/T1 | ✅ | loopback-only、無 CORS wildcard、`src/history/HistoryClient.ts` 無 `node:*` import |
| NFR-51.8 | 全部 | ✅ | 見 §0 baseline |
| NFR-51.9 | 全部 | ✅ | fixtures 全用 synthetic identifier；evidence reporter 對 artifact/command/notes 做 forbidden-absolute-path 掃描 |

狀態圖例：✅ pass ／🟡 partial（原因已記錄，非阻塞單項但可能阻塞整體）／🔴 blocked（owner／deadline見下）／N/A 需 rationale（本表目前無 N/A 項）。

---

## 3. Known limitations（記錄，不以此豁免 M18 核心條件）

| 項目 | Owner | 狀態 | 說明 |
|---|---|---|---|
| [KI-017](../known_issue/KI-017-history-replay-tdz-referenceerror-on-early-replay-click.md) — Run Detail「3D 重播」過早點擊 TDZ ReferenceError | WP-50 | ✅ 已修 | 2026-09-01：`replayController` 提早宣告並加 early-click 可見訊息 guard；新增 WP-50 Playwright regression |
| [KI-018](../known_issue/KI-018-history-search-keystroke-focus-steal.md) — History 搜尋欄逐字輸入焦點被搶走 | WP-49 | 🔴 待修 | `navigator.replace()` 每次給 focus-guard 全新物件引發誤判；WP-51 測試側已繞開 |
| Chrome 未安裝在目前開發機 | T5 前置 | 🔴 阻塞人工 walkthrough | 需另一台機器或先安裝 Chrome 才能執行 §4 的 Chrome 人工 WebGPU walkthrough |
| Playwright 無 Chrome project／無 WebGL2 fallback project | T4／T5 | 🟡 尚未建立 | OQ-51.2 已凍結方向（見 WP-51 README/progress.md），實際 harness 尚未新增 |

這些項目**不得**作為豁免 M18 核心條件（README §10 條件 1～11）的理由；剩餘阻塞是：KI-018 阻塞 History 搜尋鍵盤路徑在「所有情況下」都正確（非阻塞已驗證的 automated happy-path），Chrome 缺席與缺少 project 阻塞 §4 的人工/自動化涵蓋範圍完整性。

---

## 4. Manual walkthrough checklist（v1，尚未執行）

> 版本：v1（2026-08-31 由 WP-51 T5 建立）。依 [T5-operations-manual-release.md](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/T5-operations-manual-release.md) §「Manual walkthrough」制定。**這是尚未執行的 checklist 模板**——本 session 由 AI agent 撰寫文件與自動化測試，不具備操作真實硬體滑鼠/Pointer Lock/GPU 視覺判斷的能力,依專案協議不得代為宣告 pass。每一列由實際執行的人填入 commit／OS-GPU-driver／browser-version／date／signer／pass-or-fail／notes 後才算完成證據。

### 4.1 前置條件

- [ ] Latest Chrome 已安裝且可用（目前開發機缺，見 §3）
- [ ] 系統 Edge 版本已記錄（本 dossier §0 已記錄：151.0.4129.101）
- [ ] 乾淨 synthetic Participant（不得使用真實姓名/資料）
- [ ] WebGPU-capable desktop GPU 可用（本 dossier §0 已記錄：RTX 4070 Laptop）
- [ ] 內顯或其他 WebGL2-only 裝置可用，供 fallback 對照

### 4.2 Participant flow

| # | 步驟 | Chrome pass/fail | Edge pass/fail | Notes |
|---|---|---|---|---|
| P1 | 完成一次 Assessment，觀察 Result 畫面與 save feedback | ⬜ | ⬜ | |
| P2 | 進 History 找到自己剛完成的紀錄 | ⬜ | ⬜ | |
| P3 | 查看 Result／趨勢卡片 | ⬜ | ⬜ | |
| P4 | 3D Replay：play/seek/rate/event navigation、Back 返回 | ⬜ | ⬜ | |

### 4.3 Researcher flow

| # | 步驟 | Chrome pass/fail | Edge pass/fail | Notes |
|---|---|---|---|---|
| R1 | 瀏覽多 Participant／exact drill，確認未合併 family | ⬜ | ⬜ | |
| R2 | 確認時間排序（新到舊） | ⬜ | ⬜ | |
| R3 | 未註冊 metric／不相容 cohort 的說明文字清楚 | ⬜ | ⬜ | |
| R4 | `partial`／`unsupported` 記錄可正確辨識，UI 說明清楚 | ⬜ | ⬜ | |

### 4.4 Practice flow

| # | 步驟 | Chrome pass/fail | Edge pass/fail | Notes |
|---|---|---|---|---|
| Pr1 | Practice 完成後 Result／下載可用 | ⬜ | ⬜ | |
| Pr2 | 重啟 server 後 History 完全沒有該 Practice | ⬜ | ⬜ | |
| Pr3 | 當次 Replay 行為符合 OQ-50.2 已核准決策 | ⬜ | ⬜ | |

### 4.5 真實視覺與輸入（GPU-critical，僅 WebGPU-capable 裝置）

| # | 步驟 | Pass/fail | Notes |
|---|---|---|---|
| V1 | Camera/target/ADS/recoil/shot-hit cue 與記錄事件視覺一致 | ⬜ | |
| V2 | 無 live gameplay/input 在 Replay 期間背景執行 | ⬜ | |
| V3 | Pointer Lock 與滑鼠完成流程無回歸（正常 gameplay，非 Replay） | ⬜ | |
| V4 | WebGL2-only 裝置：fallback 渲染可接受，console 印 `[render backend] webgl2` | ⬜ | |

### 4.6 Failure/recovery spot check

| # | 步驟 | Pass/fail | Notes |
|---|---|---|---|
| F1 | 停用 History API 時訊息與 retry/download 可理解 | ⬜ | |
| F2 | 場景載入失敗時訊息與 retry/back 可理解 | ⬜ | |

### 4.7 Keyboard/focus/screen reader

| # | 步驟 | Pass/fail | Notes |
|---|---|---|---|
| K1 | 至少一次 screen reader smoke（History→Replay 主要流程） | ⬜ | |
| K2 | 錯誤/partial/loading 狀態不只靠顏色表達 | ⬜ | 對應自動化：[`stage10-accessibility.spec.ts`](../../tests/e2e/stage10-accessibility.spec.ts) 已涵蓋鍵盤路徑，此項聚焦真人 screen reader 體感 |

### 4.8 簽核

| 欄位 | 值 |
|---|---|
| Commit | _(執行時填入)_ |
| Signer | _(執行時填入，需為未撰寫本 WP 主要程式碼者，對應 T5 DoD「由未撰寫主要功能者依runbook重跑」)_ |
| Date | _(執行時填入)_ |
| Overall result | _(執行時填入：pass / fail / blocked)_ |

---

## 5. M18 判定

**尚未判定通過。** README §10 的 11 項條件中，automated/measurement 部分皆有 pass evidence（見 §0～§2），但整體 M18 宣告依 WP-51 README §2.6／stage10 README 的紀律，還需要：

1. [KI-018](../known_issue/KI-018-history-search-keystroke-focus-steal.md) 由 WP-49 承接修復並重跑受影響的 Stage10 suite。KI-017 已於 2026-09-01 由 WP-50 owner 修復並補 regression。
2. §4 的人工 browser／GPU／a11y walkthrough 由實際執行者完成並簽核（依 OQ-51.1 預設決策，這是阻塞項；若使用者/產品 owner 最終決定改為非阻塞，需回頭更新 WP-51 README OQ-51.1 段與本節）。
3. 依 T5 DoD，需有一位未撰寫本 WP 主要程式碼者依 [history-center-replay.md](history-center-replay.md) 重新走一次啟動→定位 synthetic 紀錄→Replay→處理至少一個 failure state，證明文件本身足夠、不依賴作者記憶。
4. 依 OQ-51.2 補齊或正式豁免 Chrome 人工 walkthrough 與 WebGL2 fallback 自動化 project 的 coverage gap。

以上 4 項均非「重新設計」或「新增產品語意」——皆是既有已核准範圍內的收尾動作，記錄於此以便下一位 operator/owner 接手，不在本次草案中假裝已完成。
