# WP-70 — Progress

## Snapshot

- **狀態**：🟡 **T0 ✅ 通過**（2026-09-15），T1 未開工
- **分支**：`chore/agents-skills-tree`
- **規劃日期**：2026-09-15
- **下一步**：**T1** per-run fullscreen 旗標（T0 已放行：編號確認、baseline 四閘全綠、KI-040 四缺陷全數複核成立、digest 預測 3 筆、OQ-70.1 實測可行）
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
| T0 | ✅ | 2026-09-15。production diff = 空。編號 WP-70／GD-47 確認可用；四閘 baseline 全 exit 0（Vitest **3709 passed／2 skipped**、regression **324**）；KI-040 四缺陷逐條以當前行號複核**全數仍成立**；digest 預測 **3 筆**（具名）；**OQ-70.1 實測可行 ⇒ T5 = e2e 任務**，但帶三條具名限制（L1～L3）。見 [§T0](#t0-entry-gate2026-09-15) |
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
| D-70.P5 | GD-10 預設**補澄清而非修訂**；T0 複核 | 規劃期採納（見上方修正 2）→ **T0 複核維持，但理由改寫**（見 D-70-T0-2） |
| **D-70-T0-1** | 編號 **WP-70 / GD-47 維持**，不順延；連帶修 stage14 §3 的過期順延註記（→ `WP-71`／`WP-72`／`WP-73`） | T0 採納（見 [§T0.1](#t01-編號重查步驟-1)） |
| **D-70-T0-2** | GD-10 **補澄清註記、不修訂**——但澄清範圍必須比規劃期大：GD-10 ① 的字面是「**session** 標 suspect」且該句綁在效能地板上，而效能地板成分自實作起就是 per-run ⇒ 條文沒規定 fullscreen sticky（規劃期判讀成立），但「session」這個**用詞**本身早就與實作不符。澄清註記必須一併澄清用詞，不得只談 fullscreen | T0 採納（見 [§T0.4](#t04-gd-10-複核步驟-1-的延伸d-70p5-複核)） |
| **D-70-T0-3** | canonical digest 預測 **3 筆**移動：`09_18_05`／`09_24_18`／`09_37_24`；其餘 **5 筆逐位不變**。**第 4 筆變動即 bug，回頭修程式不准改表** | T0 採納（見 [§T0.6](#t06-canonical-digest-預測步驟-5)） |
| **D-70-T0-4** | **T5 = e2e 任務**（OQ-70.1 實測可行）。但 **FM-70.4 明確不在 e2e 涵蓋範圍**（限制 L1）：本環境下 `page.evaluate()` 自帶 user activation，錯誤實作照樣全綠 ⇒ FM-70.4 的守衛**只能**是 T4 的 source-scan ＋ 實機手動，**不得**以 T5 綠燈宣稱已守 | T0 採納（見 [§T0.7](#t07-oq-701-實測步驟-6)） |
| **D-70-T0-5** | 恢復流程**重跑三項全部**，沿用既有純函式 `runEligibilityGate()`，不另開「只驗 fullscreen＋perf」的兩項變體 —— 代價為零（同一個純函式、呼叫點讀 `screen`/`dpr`/`fullscreenElement` 三個環境訊號），且避免生出第二套資格判準（C-D4） | T0 採納，關閉 OQ-70.3（見 [§T0.8](#t08-oq-關閉與降級步驟-8)） |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| ~~**OQ-70.1**~~ ✅ | ~~Playwright 能否在 `--project=edge` 下可靠進入真 fullscreen 並觸發 `fullscreenchange`？~~ | T0 | — | **已關閉（2026-09-15）**：實測**可行** ⇒ T5 = e2e 任務，帶 L1～L3 三條具名限制。見 [§T0.7](#t07-oq-701-實測步驟-6) |
| **OQ-70.2** 🟢 | `experimentSession.suspect` 被切斷 export 路徑後是否仍有消費者？刪除或保留為 session 級稽核？ | T1 | T1 | **已降級**（T0 把事實查完，只剩取捨）：`.suspect` 的 production **讀取點恰為 1 個**（`main.ts:914`），T1 切斷後歸 **0**；但該欄位在模組**內部仍承重**（`handleFullscreenChange` 的 `\|\| suspect` 早退＝「同一次退出只觸發一次 `onSuspect`」的去重閂）。⇒ T1 的預設動作 = **只切 export 路徑、不刪欄位**；是否連 `onSuspect`／欄位一起刪，待 T3 決定橫幅真值驅動後再回頭收。見 [§T0.8](#t08-oq-關閉與降級步驟-8) |
| ~~**OQ-70.3**~~ ✅ | ~~恢復流程要不要重驗**原生解析度**？~~ | T4 | — | **已關閉（2026-09-15）**：重跑**三項全部**（D-70-T0-5）。`runEligibilityGate()` 是純函式、呼叫時現讀三個環境訊號 ⇒ 重跑解析度的邊際成本為零，而「使用者把視窗拖到另一個螢幕」正是解析度會變的那個情況 |
| **OQ-70.4** 🟡 | 已下載的匯出檔（瀏覽器下載資料夾，repo 掃不到）是否需要操作員自查清單？`data/session-history/` 已確認零筆（KI-040 §8） | 使用者 | T6 | T6 的文件範圍；不阻塞程式修改 |

## Surprises

### S-70-T0-1 ⭐ — Playwright 的 `page.evaluate()` 自帶 user activation，差點讓 T0 得出反向錯誤的結論

OQ-70.1 的第一輪 spike（A/B）**全綠**：synthetic click → 真 fullscreen → `fullscreenchange` 觸發。
若就此收工，T0 會寫下「synthetic click 足以走通 user-activation 路徑」——**而那是錯的**。

加上控制組後翻盤：

| Spike | 做什麼 | 預期 | 實測 |
|---|---|---|---|
| C | `page.evaluate()` 內直接呼叫（**無**任何點擊） | 應被拒 | **`ok` / `fullscreenElement != null`** ❌ |
| D | `evaluate` 內 `dispatchEvent`（untrusted click） | 應被拒 | **`ok` / `fullscreenElement != null`** ❌ |
| F | 頁面自己的 `DOMContentLoaded` → `setTimeout`（Playwright 完全沒碰） | 應被拒 | **`rejected: TypeError`** ✅ |

⇒ 以排除法定位：activation 閘在本環境**確實生效**（F 為證），C/D 之所以過，是因為
**Playwright 的 `page.evaluate()` 對 CDP 帶 `userGesture: true`**。

**為什麼這條重要**：它決定 T5 能宣稱什麼。詳見 [§T0.7](#t07-oq-701-實測步驟-6) 的
限制 **L1** —— 若不知道這件事，T5 會寫一支「點按鈕 → 進 fullscreen」的 e2e 並宣稱守住了 FM-70.4，
但**把 `requestFullscreen()` 錯排到 `await` 之後的實作照樣會全綠**。那正是 [KI-040 §5](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
「修完沒有迴歸防線」的同一個坑，只是換成假綠燈的版本。

### S-70-T0-2 — 退出的 `fullscreenchange` 相對 `fullscreenElement` 轉 null 是**非同步**的

Spike E 以 `waitForFunction(() => document.fullscreenElement == null)` 為準再讀事件記錄，拿到
`["enter"]`（漏掉 exit）；Spike G 改成等**事件記錄長度**才拿到 `["enter","exit"]`。
⇒ T5 的等待條件必須掛在事件記錄上，不能掛在 `fullscreenElement`，否則會是一支間歇性假失敗的測試。

---

## T0 entry gate（2026-09-15）

**判定：✅ 通過，放行 T1。** `git diff -- src tests` 為空（本 task 零 production code）。
唯一落盤的非本 WP 檔案是 `docs/exec-plan/active/stage14/README.md` 的編號順延註記（見 T0.1）。

### T0.1 編號重查（步驟 1）

依 [GD-15](../../../DECISIONS.md)「正式進 §2 索引才算採納」：

| 查核 | 依據 | 結果 |
|---|---|---|
| `exec-plan/README.md` §2 目前最大採納 WP | `grep -oE 'WP-[0-9]+' … 排序取尾` | **WP-70**（即本案，`README.md:186` 已於規劃 commit `4efef1d` 入索引）；本案以外最大為 **WP-69** |
| `WP-71` 是否已被取用 | `grep -cE '^\| \*\*WP-71\*\*' docs/exec-plan/README.md` | **0** ⇒ 無人越過本案 |
| `DECISIONS.md` 已落帳最大 GD | `grep -oE 'GD-[0-9]+' … 排序取尾` | **GD-46** |
| `GD-47` 標題命中數 | `grep -c "^### GD-47 " docs/exec-plan/DECISIONS.md` | **0** ✅（`GD-44`/`45`/`46` 各為 1，作為計數法的對照） |
| stage16 資料夾命名 vs README stage 區塊 | `README.md:178`「Stage 16（`active/stage16/`…）」vs `ls docs/exec-plan/active/` | **一致** |

⇒ **WP-70 / GD-47 維持，不順延**（D-70-T0-1）。

**連帶修好一處過期註記**：`stage14/README.md` §3 最新一條順延註記（2026-09-14）寫「未採納候選為
`WP-69`／`WP-70`／`WP-71`」，但 WP-69（stage15）與 WP-70（stage16）**均已採納** ⇒ 該註記已失真。
已依該檔既有體例**追加**一條 2026-09-15 的具名註記，順延為 `WP-71`／`WP-72`／`WP-73`（不改寫舊註記，
保留歷史）。此即 [WP-69 T-exit §TE.6](../../stage15/wp-69-pause-invalid-restart/progress.md) 抓到的
「單點漏翻不會被任何測試抓到，只會被下一個 gate 抓到」同一類問題。

### T0.2 上游 exit-gate（步驟 2）

- [WP-69 progress.md](../../stage15/wp-69-pause-invalid-restart/progress.md) §Snapshot：
  ✅ 已交付（2026-09-15，T-exit），T0–T6 + T-exit 全數完成，FR-69.1～69.12／NFR-69.1～69.8 逐條具名證據。
- **focused 重跑（本 gate 實測，非引用）**：

```text
npx vitest run src/attempt src/loop/__tests__/wp69-pause-time.test.ts
Test Files  8 passed (8)
     Tests  216 passed (216)
exit 0
```

⇒ WP-69 交付未被後續 commit 破壞。**上游綠燈成立。**

### T0.3 Baseline 四閘（步驟 3）

| 閘 | exit code | 精確計數 |
|---|---:|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | **0** | — |
| `npm run build` | **0** | 208 modules transformed；`dist/assets/index-tXGF1-Lm.js` 1,258.13 kB（gzip 359.78 kB） |
| `npx vitest run` | **0** | **284 passed / 1 skipped（285 files）**；**3709 passed / 2 skipped（3711 tests）** |
| `npx vitest run tests/regression` | **0** | **33 files**；**324 passed** |

⚠️ 這四個數字與 [WP-69 T-exit](../../stage15/wp-69-pause-invalid-restart/progress.md) 收尾時記錄的
**逐字相同**（3709/2、284 files、324）⇒ 兩個 WP 之間**零漂移**，本 WP 的 baseline 是乾淨的。
NFR-70.1 的「`tests/regression` 計數零漂移」以 **324** 為基準值。

### T0.4 GD-10 複核（步驟 1 的延伸，D-70.P5 複核）

逐字重讀 [GD-10](../../../DECISIONS.md) ①（未沿用 KI-040／README 的轉述）：

> ① **軟體資格閘(eligibility gate)**——session 開始自動檢查:原生解析度 ≥ 實驗最高條件
> (`screen.width × devicePixelRatio`)、fullscreen 強制、效能地板(per-frame time log 超標 →
> session 標 `suspect`/剔除);**不合格拒入,非僅記錄**。

複核結論分兩半：

1. **規劃期判讀（README §0.2 / D-70.P5）成立。** 條文把「session 標 `suspect`/剔除」寫在**效能地板**
   的括號內；GD-10 **從未**規定「錄製中退出 fullscreen ⇒ session 級 sticky suspect」。該行為出自
   WP-20 T2 的實作延伸（[`experimentSession.ts`](../../../../../src/display/experimentSession.ts) 檔頭
   docstring 自述「WP-20 T2（GD-10）」）。且 GD-10 ① 的三項檢查是**進場**判準，本 WP 一項門檻都不動。
2. **但規劃期給的理由不夠。** GD-10 ① 的字面用詞是「**session** 標 suspect」，而那一句綁定的效能地板
   成分**自實作起就是 per-run**（`frameLog.reset()` 在 `drillRunner.start()` 內，
   [main.ts:1417](../../../../../src/main.ts#L1417)）。⇒「session」這個用詞**早就**與實作不符，
   不是本 WP 才造成的。

⇒ **維持「補澄清註記」而非修訂**（D-70-T0-2），但 T6 的澄清註記**必須同時澄清用詞**——說明
`suspect` 的效力單位是 **run**，且效能地板成分向來如此；只談 fullscreen 會讓下一個讀者再踩一次同一個
歧義。**此為對 D-70.P5 的理由改寫，不是推翻。**

### T0.5 KI-040 四缺陷複核（步驟 4）

以**當前 HEAD 行號**重讀，未沿用 KI 文件行號：

| 缺陷 | 當前位置 | 複核結果 |
|---|---|---|
| **A** `experimentSession.suspect` 只有兩個賦值、無 reset | [`experimentSession.ts:44`](../../../../../src/display/experimentSession.ts#L44)（`let suspect = false`）、[`:63`](../../../../../src/display/experimentSession.ts#L63)（`suspect = true`） | ✅ **仍成立**。`exit()`（`:66-68`）只寫 `active = false`，**不碰 `suspect`** ⇒ 永不復位 |
| **B** `requestFullscreen` 為 production 單一呼叫點且綁資格閘 | [`main.ts:633`](../../../../../src/main.ts#L633) | ✅ **仍成立**。該行是 `createEligibilityGateScreen({…})`（`:625-648`）的一個 option；實際呼叫點在 [`EligibilityGate.ts:96`](../../../../../src/ui/EligibilityGate.ts#L96) 的 `attempt()` 內 ⇒ 除了「重開資格閘」以外**沒有任何路徑**能重新取得 fullscreen |
| **C** `hideSuspectWarning` 為 production 單一呼叫點 | [`main.ts:642`](../../../../../src/main.ts#L642) | ✅ **仍成立**。位在資格閘的 `onEnter` 內 ⇒ 橫幅只在「重新過閘」時才會消失（FR-70.6 的根） |
| **D** `updatePauseRuntime()` 不觸碰 `drillRunner` | [`main.ts:1339-1352`](../../../../../src/main.ts#L1339) | ✅ **仍成立**。函式體內 `grep drillRunner` 命中數 **0**（只動 `runAttempt`／`timeMapper`／`pauseOverlay`） |

**額外複核（README §0.1 的前提）**：`collectMeta()` 的 suspect 組裝在
[`main.ts:913-916`](../../../../../src/main.ts#L913)：

```ts
suspect:
  (protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect) ||
  frames.summary.p95 > PERF_FLOOR_MS,
```

左成分 session 級 sticky、右成分 per-run（`frameLog` 每場 reset）⇒ **§0.1 的不對稱逐字成立。**

**另確認 FM-70.2 的風險是真的且已有現成警語**：`meta.validity` 是**逐欄手抄**而非展開
`sharedState.validity`，且 [main.ts:922-924](../../../../../src/main.ts#L922) 已有 WP-65 T5 留下的警告註解
（「新旗標必須在這裡明寫，否則會靜默漏掉整條鏈」）。T1 照抄 pattern 時**必須**連這個手抄點一起改。

**FR-70.5 的根一併確認**：[`main.ts:673-675`](../../../../../src/main.ts#L673) 算出 `recording` 後
**只**傳給 `experimentSession.handleFullscreenChange()`；下一行的
`if (!fullscreen) markProtocolFullscreenExit?.()` **完全不看 `recording`**
（`markProtocolFullscreenExit` 宣告於 `:624`、呼叫於 `:675`、賦值於 [`:2082`](../../../../../src/main.ts#L2082)
＝ `activeProtocolRunner.markCurrentConditionSuspect('fullscreen-exit')`）⇒ **第二套判準（C-D4）確實存在**，T2 的標的成立。

### T0.6 Canonical digest 預測（步驟 5）

`CANONICAL_DIGEST_BEFORE_T5`（[exportPayloadSchema.test.ts:67](../../../../../src/data/exportPayloadSchema.test.ts#L67)）
現有 **8 筆**。**未沿用 WP-69 的結論**，改以 fixture 原始檔直接數 `"validity"` 鍵：

| fixture | `"validity"` 出現次數 | T1 後預測 |
|---|---:|---|
| `counterstrafe_ad_v1-…T08_03_45.617Z.json` | 0 | 逐位不變 |
| `counterstrafe_ad_v1-…T09_39_06.031Z.json` | 0 | 逐位不變 |
| **`counterstrafe_ad_v1-…T09_18_05.631Z.json`** | **1** | **移動** |
| **`counterstrafe_ad_v1-…T09_24_18.148Z.json`** | **1** | **移動** |
| **`counterstrafe_ad_v1-…T09_37_24.351Z.json`** | **1** | **移動** |
| `synthetic_counterstrafe.json` | 0 | 逐位不變 |
| `synthetic_counterstrafe_t1_long.json` | 0 | 逐位不變 |
| `synthetic_timeline.json` | 0 | 逐位不變 |

⇒ **預測：恰 3 筆移動、5 筆逐位不變**（D-70-T0-3）。理由：`fullscreenExited` 為 required-out，
只會在**已有** `meta.validity` 父物件的 payload 上多一個鍵；缺席 `validity` 的 payload 不該長出父物件。

⚠️ 承 [D-69-T0-4](../../stage15/wp-69-pause-invalid-restart/progress.md) 的先例：
**第 4 筆變動即 bug，回頭修程式，不准改表。** 本 WP 與 WP-65／WP-69 同屬一族，三次預測應同一組 fixture。

### T0.7 OQ-70.1 實測（步驟 6）

**這是本 gate 最高價值的產出。** 丟棄式 spike 寫在 `tests/e2e/wp70-fullscreen-spike.spec.ts`，
以 `npx playwright test --project=edge wp70-fullscreen-spike` 執行，**已於本 task 內刪除**
（`git diff -- src tests` 為空為證）。**headless、未加任何 launch flag。**

| Spike | 情境 | 實測輸出 |
|---|---|---|
| **A** | dev origin 上的 stub 頁（COOP/COEP，`crossOriginIsolated === true`）＋ `page.click()` | `{"resolved":"ok","log":["enter"],"element":true,"innerH":720,"screenH":720}`；`exitFullscreen()` 後 `{"log":["enter","exit"],"element":false}` |
| **B** | **真實 app 頁面**（含其 overlay 與 COOP/COEP）＋ `locator.click({force:true})` | `{"resolved":"ok","log":["enter"],"element":true}` |
| **C**（控制組） | `page.evaluate()` 直接呼叫，**無任何點擊** | `{"outcome":"ok","element":true}` ⚠️ **本該被拒卻通過** |
| **D**（控制組） | `evaluate` 內 `dispatchEvent` untrusted click | `{"resolved":"ok","element":true}` ⚠️ **本該被拒卻通過** |
| **F**（隔離） | 頁面自己的 `DOMContentLoaded` → `setTimeout`，Playwright 完全沒碰 | `{"auto":"rejected: TypeError","log":[],"element":false}` ✅ |
| **G** | 真點擊進入 → `exitFullscreen()` 離開，**等事件記錄長度**而非等 element | `["enter","exit"]` ✅ |

**結論：可行 ⇒ T5 是 e2e 任務**（D-70-T0-4）。FR-70.1 需要的整條鏈
（真進 fullscreen → 錄製中掉出 → 觸發 `fullscreenchange`）**全部可腳本化**：進場用 `page.click()`，
「錄製中掉出」用 `page.evaluate(() => document.exitFullscreen())`（退出不需 activation）。

**但必須連同三條具名限制一起寫進 T5，否則是假綠燈：**

- **L1 ⭐ — e2e 無法守 FM-70.4。** spike C/D 證明 `page.evaluate()` 對 CDP 帶 `userGesture: true`；
  spike F 證明 activation 閘在本環境**確實生效**（頁面自發呼叫被 `TypeError` 拒絕）⇒ 兩者合起來
  定位出「是 Playwright 供給了 activation，不是閘壞了」。**後果**：把 `requestFullscreen()` 錯排到
  `await` 之後的實作，在 e2e 裡**照樣全綠**。⇒ FM-70.4 的守衛**只能**是 T4 的 source-scan
  （釘住 click handler 內**同步**呼叫）＋ 實機手動；**T5 不得宣稱涵蓋 FM-70.4**。
- **L2 — 斷言掛 `fullscreenchange`／`fullscreenElement`，不得掛視窗尺寸。** headless 下
  `innerH === screenH === 720`，進出 fullscreen **不改變任何尺寸**；尺寸斷言會因錯誤的理由通過或失敗。
- **L3 — 等待條件掛事件記錄，不掛 `fullscreenElement`。** 見 S-70-T0-2。

### T0.8 OQ 關閉與降級（步驟 8）

**OQ-70.3 → 關閉。** [`eligibilityGate.ts`](../../../../../src/display/eligibilityGate.ts) 的
`runEligibilityGate()` 是**純函式**，呼叫當下現讀 `screen` / `devicePixelRatio` /
`document.fullscreenElement` 三個環境訊號 ⇒ 重跑「原生解析度」的邊際成本為 **0**，而另開一個
「只驗 fullscreen + perf」的兩項變體反而會生出**第二套資格判準**（C-D4 風險）。
且 README 自己點出的那個情境——使用者把視窗拖到另一個螢幕——**正是**解析度會變的時候。
⇒ 恢復流程重跑三項全部（D-70-T0-5）。

**OQ-70.2 → 降級（🟡 → 🟢），事實已查完，只剩取捨留給 T1。**
`experimentSession` 全 repo 引用：`main.ts` 18、`SharedState.ts` 1（純註解）、
`tests/e2e/session-orchestrator.spec.ts` 3（純註解）、`experimentSession.test.ts` 1。
逐一分類 `main.ts` 的 18 處後：

| 成員 | production 讀寫點 | T1 後 |
|---|---|---|
| `.suspect` | **恰 1 個讀取點**（`main.ts:914`，即 export 路徑） | **歸 0** |
| `.gate` | 1（`main.ts:873` → `meta.display.gate`） | 不變 |
| `.active` | 1（`main.ts:1685`） | 不變 |
| `.enter()` / `.exit()` / `.handleFullscreenChange()` | 3 / 5 / 1 | 不變 |

⇒ **T1 的預設動作 = 只切 export 路徑、不刪欄位。** 理由：`suspect` 在模組**內部仍承重**——
`handleFullscreenChange` 的早退條件 `if (!active || !recording || present || suspect) return;`
就是「同一次退出只觸發一次 `onSuspect`」的去重閂，直接刪掉會讓橫幅回呼每次退出都重觸發。
是否連 `onSuspect` 與欄位一併刪除，**待 T3 決定橫幅真值驅動後再回頭收**；若屆時選擇保留而無人讀，
須依 README §3 明帳觸發清理的條件，不得靜默留著。

**OQ-70.4** 屬使用者、留至 T6，不阻塞 T1。

### T0.9 Blast radius（步驟 7，grep 為權威）

依 README §5：CodeGraph 對 caller 列舉不可採信（[D-68.T0-4](../../stage13/wp-68-micro-flick-v9-measurement-parity/progress.md) ＋
WP-69 T-exit 二度複現）⇒ 本節**全部以 grep 取得**，未使用 CodeGraph。

| 符號 | production | test | 分布 |
|---|---:|---:|---|
| `experimentSession` | 19 | 4 | `main.ts` 18、`SharedState.ts` 1（註解）／`session-orchestrator.spec.ts` 3（註解）、`experimentSession.test.ts` 1 |
| `handleFullscreenChange` | 4 | 11 | `experimentSession.ts` 3、`main.ts` 1／`experimentSession.test.ts` 11 |
| `markProtocolFullscreenExit` | 3 | 0 | `main.ts` 僅此一檔（宣告 `:624`、呼叫 `:675`、賦值 `:2082`） |
| `hideSuspectWarning` | 3 | 1 | `EligibilityGate.ts` 2、`main.ts` 1／`EligibilityGate.test.ts` 1 |
| `requestFullscreen` | 4 | 2 | `EligibilityGate.ts` 3、`main.ts` 1／`EligibilityGate.test.ts` 2 |
| `sharedState.validity` | 5 | 0 | `main.ts` 僅此一檔 |

⚠️ **與 README §5 規劃期數字的兩處差異**（規劃期以較粗的 grep 取得，非錯誤，但 T1 應以本表為準）：
(1) `experimentSession` 規劃期記「`main.ts` 12 處」，實測 **18 處**；
(2) 規劃期未列出 `SharedState.ts` 與 `session-orchestrator.spec.ts` 的引用——兩者皆為**註解**，
不構成程式相依，但 T1／T2 改語意時這些註解會過期，需一併更新。

### T0.10 DoD 對帳

- [x] 編號重查有具名證據（最大 WP＝WP-70／其餘最大 WP-69、最大 GD＝GD-46、`GD-47` 標題零命中）→ T0.1
- [x] WP-69 上游 gate 綠燈證據齊全，focused 重跑 **exit 0（8 files／216 tests）** → T0.2
- [x] 四閘 baseline 全數 exit 0，精確計數記入 → T0.3
- [x] KI-040 四缺陷逐條複核，**每條附當前行號** → T0.5
- [x] canonical digest 預測 **3 筆** + 具名 fixture 清單 → T0.6
- [x] **OQ-70.1 有實測結論**（非推測）：spike 指令／輸出／T5 形狀決定 → T0.7
- [x] blast radius 六個符號的 grep 計數記入 → T0.9
- [x] `git diff -- src tests` 為空（spike 已刪除）
