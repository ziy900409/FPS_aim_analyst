# WP-62 — Progress

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md) · 決策 [GD-38](../../../DECISIONS.md)
>
> 每個 task 完成時追加一段（Progress / Decision Log / Surprises / Open Questions），與該切片一起 stage（協議 §3.4）。

---

## §0 規劃（2026-09-10）

**狀態**：📋 規劃完成，未開工。

計畫由 `engineering-planning` skill 產出，落點依使用者指示為 `active/stage13/`（主題不符的說明見 [README §落點說明](README.md)）。

### 規劃期發現（已寫入 README §0，此處只記推翻了什麼）

1. **原始需求是「全域 pin 一把武器」，經稽核後改向。** 使用者最初要求把整輪測試 pin 成 `usp_s_laser`。稽核 sim 消費路徑後發現兩個 blocker：
   - **散佈公式歸零**：`totalInaccuracy = stand + inaccuracyFire + speedRatio^0.25 × move`（[spread.ts:41](../../../../../src/recoil/spread.ts)），`usp_s_laser` 三項全 0 ⇒ `sampleSpread` 恆回 `{0,0}` ⇒ 移動中開火與靜止開火彈著點相同 ⇒ **counter-strafe 的「急停時機 → 首發命中」因果通道消失**，F1–F4 的核心構念失效（不是與舊資料斷代，是不再量測任何東西）。
   - **`magSize: 12` 且全 repo 無 reload**：`state.weapon.ammo` 只在 `createSimLoop()` 設一次（[SimLoop.ts:815](../../../../../src/loop/SimLoop.ts)），打空即 `heldFire = false`、`nextFireT = Infinity`（[SimLoop.ts:541-544](../../../../../src/loop/SimLoop.ts)）⇒ 12 發 × 0.17 s = 2.04 秒後該 run 靜默停火，且受測者的「按住」意圖被記成放開。
   使用者據此改向為**逐列指定**，本 WP 即此方向。原「全域 pin」方案已放棄，不再保留為備選。
2. **可排程 drill 中只有 4 個宣告武器**（BR 2×2 實驗格）。綁 `tracking_pilot_hold` 的兩個 tracking pilot drill **不可排程**（走 `loadDrillConfigDirect`）⇒「武器鎖」的範圍是 4 列，不是一整套機制。這把 D-62-1 從「需要鎖定 UI」縮成「編譯器一條驗證」。
3. **`CompatibilityKey` 已含 `weaponId`**（[compatibilityKey.ts:8](../../../../../src/metrics/compatibilityKey.ts)）⇒ 不同武器的 run 本來就不會併池，本 WP 對 history/trend **零程式修改**。代價是趨勢線會依武器碎裂（FM-5），屬正確行為但外觀像 bug，故列為表單必須明示的文字。
4. **`drillFamily.ts` 已 import 全部 drill 模組** ⇒ 「哪個 drill 宣告了武器」可推導，不需第二份手寫清單（避免 KI-016 重演）。這是 T1 存在的理由。

### 凍結決策

D-62-1～4 見 [README §1.4](README.md)，同步入帳 `GD-38`（編號待 T0 寫入當下重查確認）。

### Open Questions（開工前狀態）

| OQ | 狀態 | Owner | 預設假設 |
|---|---|---|---|
| OQ-62.1 | 🟡 未決 | 研究者 | 預覽對未指定列顯示「預設」；BR 四格顯示實名 |
| OQ-62.2 | 🟡 未決 | 研究者 | 不做 ADS 警告，只記為已知限制 |
| OQ-62.3 | 🟡 未決 | 實作者（T1 開工時） | 對表測試全覆蓋 36 個 schedulable drill；解析成本過高者具名豁免 |

### Surprises

- 使用者要求的 `usp_s_laser` 恰好是全 repo 唯一同時具備「零 move 散佈」與「12 發彈匣」的武器，兩個 blocker 疊在同一把上——若當初直接照做，counter-strafe 資料會全部作廢且不會有任何錯誤訊息。這條記錄下來是為了說明：**武器不是外觀參數，是量測儀器的一部分**。

---

## §T0 Entry gate（2026-09-10）

**狀態**：✅ 完成。上游 WP-58 T-exit 復現為綠燈，編號 `WP-62` / `GD-38` 經重查確認歸本 WP，熱區無平行未合併變更。**未動任何 `src/` 程式碼**（invariant 守住）。

### 1. 基線實測（全部 exit 0）

| 指令 | 結果 | 備註 |
|---|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2，含 `tsconfig.node.json`） | ✅ exit 0 | ⚠️ 只掃 `src/` 與 `server/`（`tsconfig.json` `include: ["src"]`）⇒ **`scripts/` 與 `tests/` 不在守備範圍**；本 WP 若在 `tests/` 新增型別（T6 E2E），typecheck 不會替你擋 |
| `npm run build`（兩個 typecheck + `vite build`） | ✅ exit 0 | `built in 2.11s`；既有 chunk > 500 kB 警告為先前狀態，非本 WP 引入 |
| 全量 Vitest（`npx vitest run`） | ✅ **2,822 passed / 2 skipped（2,824）**；檔案 **252 passed / 1 skipped（253）**，15.87s | **與文件數字不符已修正**：T0 步驟 1 與 README NFR-62.3 引述 WP-58 T-exit 的 `2,688 passed`；實測為 **2,822**。依 T0「以本次實測為準，不得沿用文件數字」⇒ **NFR-62.3 的回歸基線 = 2,822 passed / 2 skipped** |
| 全量 Playwright（`--workers=1 --reporter=line`） | ✅ **103 passed / 0 failed / 0 flaky（13.8m）** | 收集到 **103 tests**（文件引述 99、WP-60 T-exit 記錄 101）⇒ 基線同樣以實測為準 |

### 2. 編號重查（GD-35 ② 紀律，第五次應驗）

- **`GD-38`**：`DECISIONS.md` 現行最高 = **GD-38，且該條即本 WP**（規劃 commit `57dc804` 已寫入）⇒ 未被平行 session 取用，**維持 GD-38**。T0 步驟 4「決策入帳」因此**在規劃期即已完成**，本 gate 的工作變成補上重查結論與對帳修正（見下）。
- **`WP-62`：規劃期敘述不準確，但結論不變。** 規劃期記「全 repo 最高為 WP-61」；實查發現 [`active/stage14/README.md`](../../stage14/README.md) §3（commit `72c1baa`，**2026-09-09，早一日**）已提出候選 **WP-62/63/64**，即存在雙重主張。
  依 [GD-15](../../../DECISIONS.md) 的既有判準——「編號歸屬以**採納入 [`exec-plan/README.md`](../../../README.md) §2 索引**為準，草稿之預留不構成佔用」：

  | | stage13 本 WP | stage14 §3 候選 |
  |---|---|---|
  | 自我宣告 | 已採納，📋 規劃完成 | 標題明文「**候選，未批准**」 |
  | WP 子資料夾 | ✅ 存在（11 個檔） | ❌ 無 |
  | 入 `exec-plan/README.md` §2 索引 | ✅ 第 160 行（`57dc804`） | ❌ 未入 |

  ⇒ **`WP-62` 歸本 WP，無需改號**；stage14 三個候選於**採納當下**順延為 **WP-63/64/65**。已在 [stage14 README §3](../../stage14/README.md) 加註警示，避免其未來採納者再次取用 WP-62；同步記入 [GD-38](../../../DECISIONS.md) ①。

### 3. 平行 session／熱區檢查

熱區各檔最近 commit（皆已在 `main`，無未合併變更）：

| 檔案 | 最近 commit |
|---|---|
| `src/session/sessionProgram.ts` | `d2307a3` 2026-09-08 record executed session program in export metadata |
| `src/session/SessionRunner.ts` | `85d85e1` 2026-09-08 drive session plan from a compiled program cursor |
| `src/session/drillFamily.ts` | `371e13c` 2026-09-09 give the tracking family a scene-pinned drill |
| `src/ui/SessionPlanSetup.ts` | `84483a6` 2026-09-08 edit and preview custom session programs |
| `src/main.ts` | `3175efd` 2026-09-09 add opt-in operator annotation events |
| `src/data/metadata.ts` | `9015610` 2026-09-09 Merge branch `codex/wp-60-raw-mouse-t1` |
| `src/weapon/weapons.ts` | `416026f` 2026-09-04 tracking-pilot-v2 專用武器 |

- **兩個 worktree 皆 0 commits ahead of `main`** ⇒ 無平行未合併變更，FM-6 本次未觸發：
  - `.worktrees/wp-60-raw-mouse-t1`（`codex/wp-60-raw-mouse-t1` @ `83648d0`）= 與 `main` 的 merge-base，**已全數併入**。
  - `../FPS_aim_analyst-WP-29`（`wp-29-coach-timeline` @ `f9ee903`）ahead 0 / behind 493，且與本 WP 熱區**零交集**。
- ⚠️ **CodeGraph 索引包含 `.worktrees/wp-60-raw-mouse-t1/`**，而 `tsconfig.json` 只 `include: ["src"]`。⇒ 查詢 `activateDrill`／`compileSessionProgram` 會回**兩份**同名符號（`src/…` 與 `.worktrees/…`）。**T1–T6 一律只改 `src/` 下那一份**；該 worktree 既已全數併入，可考慮 `git worktree prune` 但**不屬本 WP 範圍**。
- ⚠️ **有一個平行 session 在本 gate 期間活動中**（FM-6 的實況觀測，但**未撞到本 WP 熱區**）：
  - gate 開始時的未追蹤檔 `.tmp-analyze-flick-viz.ts`（先前既有）於期間**被他人移除**；
  - 期間**新增**未追蹤檔 `docs/algorithm/spider_shot/spider-shot-wide-v1-angular-speed-coaching-2026-09-10.html`（wide-v1 教練分析，屬 stage14 WP-63 題材）。
  - 兩者皆**非本 WP 產生**，全程未觸碰、**不 stage**。本 gate 只 stage 自己改的 8 個 docs 檔。
  - ⇒ 對 T1 的提醒：`src/session/*`、`SessionPlanSetup.ts`、`main.ts`、`metadata.ts` 本次雖無平行變更，但**平行 session 確實在跑**，開工前應重跑一次 `git status` 與熱區 `git log`。

### 4. CodeGraph blast radius 對帳（T0 步驟 6）

四個符號各查一次，與 README §0.1 對帳。**§0.1 有兩處漏列 + 一處錯誤，已回改 README**：

| 符號 | 實查結果 | 與 §0.1 差異 |
|---|---|---|
| `activateDrill` | **2 個直接呼叫端**：`loadDrillById`（[main.ts:1428](../../../../../src/main.ts)）、`loadDrillConfigDirect`（[main.ts:1436](../../../../../src/main.ts)） | ❌ **錯誤已改**：§0.1 原記「四個呼叫端」。`loadSceneById`／`loadWeaponById` **不呼叫** `activateDrill`，而是各自重做動作序列 ⇒ `activeWeaponOverride` 共 **3 個寫入點** |
| `compileSessionProgram` | 10 callers（`SessionRunner.ts`／`SessionPlanSetup.ts`／`main.ts`）；覆蓋測試 4 支 | ⚠️ **漏列已補**：`sessionProgramExport.test.ts`（＋`SessionRunnerProgram.test.ts`／`SessionPlanSetup.test.ts`） |
| `SessionRunnerOptions` | 1 caller（`createSessionRunner`），CodeGraph 報 no covering tests | ✅ 不算出入。三支 runner 測試以 inline object literal 建構 options，未具名引用該型別 ⇒ 符號級 caller 數必然低估；§0.1 列的是「改了要跟著更新的檔」，較寬且正確，**維持原樣** |
| `SessionPlanItemMeta` | 6 callers，分布 `metadata.ts` **與 `src/data/exportPayloadSchema.ts`** | ⚠️ **漏列已補**：§0.1 原僅泛稱「匯出 schema 全體 consumers」。實際 runtime 逐列驗證在 `parseSessionPlanItems()`（[exportPayloadSchema.ts:529](../../../../../src/data/exportPayloadSchema.ts)，另 352-355／430 行組裝）⇒ **型別宣告與驗證分屬兩檔，T5 必須同改**，否則 schema 會放行未驗證的 `weaponId`。已加入 README §2.1 In scope |

**§0.6 的賦值順序主張經實查確認為真**：`activeWeaponOverride = undefined` 在 [main.ts:1397](../../../../../src/main.ts)，`buildSimLoop()`／`setAdsConfig()`／`configureMouseIntegration()` 在 [main.ts:1415-1417](../../../../../src/main.ts) ⇒ 把「清空」換成「設值」不需移動其他行（§2.2 的關鍵順序成立）。

### 5. T0 新發現：`loadSceneById()` 會清掉逐列武器（移交 T3）

`loadSceneById()`（[main.ts:1444](../../../../../src/main.ts)）同樣無條件 `activeWeaponOverride = undefined`，且**不經** `activateDrill()`。本 WP 只改 `activateDrill()` 的話，**此路徑仍會清空** ⇒ 研究者在 program 執行中途從 Controls 切場景，該列指定武器會被靜默還原。

- **可達性**：program 換 drill 走 `loadDrillById`（KI-002/D2 明文只走此路）⇒ **非主線**；但 Controls 場景下拉在 run 中未被硬性禁用。
- 🔴 **關鍵約束（T0 跑完 Playwright 才發現）：這個清空行為是 WP-47 T-exit 刻意釘死的既有契約，有 E2E 斷言。** [`tests/e2e/weapon-select.spec.ts:106`](../../../../../tests/e2e/weapon-select.spec.ts) 的 `reset-per-drill：重選同一場景不靜默清空 override` 同時斷言**兩件事**：
  - 重選**同一**場景 ⇒ override **保留**（`loadSceneById` 的 early-return 早於清空那行）；
  - 真的換到**不同**場景（`urban-high`）⇒ override **歸零**，`meta.weapon.id` 必須變回 `'ak47'`（該檔第 131-135 行）。
  ⇒ **選項 ①（改為保留 override）會讓這條既有測試轉紅**，直接違反 NFR-62.3「既有測試零修改全綠」。故 T3 的實際選項收斂為：**②** session 執行中停用場景下拉（不動 `loadSceneById` 語意，故不碰該測試）、或 **③** 明帳接受並記為已知限制；若仍要選 ①，必須先入帳「修改 WP-47 T-exit 契約」的決策並說明為何 NFR-62.3 可例外——**不得靜默改測試**。
- **附帶（先前既有，本 WP 不修）**：`loadSceneById()` 清空 override 後**未**呼叫 `setAdsConfig()`／`configureMouseIntegration()`（`activateDrill()` 兩者皆呼叫）⇒ 換場景後 ADS 光學與滑鼠 gain 可能對不上已還原的武器。具名記錄供後續判斷是否另開 KI。

### 6. 環境發現：5173 dev server 佔用**真實** history root（影響 T6）

T0 跑 Playwright 前發現 port 5173 已有本 checkout 的 dev server（PID 43044），其 `.history-root.lease` 指向 **`data/session-history/`（真實研究資料根）**，非 `.playwright-tmp/history-dev`。因 `playwright.config.ts` 的 `reuseExistingServer: !process.env.CI`，Playwright 會**沿用**該 server ⇒ e2e 寫進真實 root。

- **既有污染證據**：`data/session-history/` 內現存 `e2e-t5-…`、`etc_passwd-…`、`ki017-early-replay-…` 等測試 participant（2026-09-02 建立）⇒ 此陷阱**過去已實際發生**。
- 本次處置：確認該 process 已自行結束、port 釋放後才跑 Playwright ⇒ 兩個設定好的 webServer 各自取到隔離 root（`history-dev` pid 48476 @ 09:07:07Z、`history-preview` pid 35292 @ 09:08:05Z）。
- **真實 root 的實測結果（逐項證據，非概括宣稱）**：
  - ⚠️ 期間**仍有一個未經 `playwright.config.ts` 設定的 server**（pid 48772 @ 09:07:48Z，夾在 dev 與 preview 之間，現已結束）取得了 `data/session-history/.history-root.lease`。已排除為 e2e 所為——`grep` 全 `tests/` 無任何 spawn server 或設 `FPS_HISTORY_ROOT` 之處；最可能是 VS Code Playwright 擴充的 test-server（pid 29592 系）另起的無 env dev server。
  - ✅ **但未寫入任何 session 資料**。跑前／跑後各驗一次（本節即 T6 的證據範本）：兩次皆為目錄項數 **41**（與 gate 開始時相同）、`find … -newermt "11:05" -type f ! -name ".history-root.lease"` **為空**、最新 participant 目錄仍是使用者 10:22 的 `P001--df1e40051e`。⇒ **僅 lease 檔被改寫（metadata 寫入），研究資料零變動**。
  - 對照組：e2e 確實寫進了隔離 root——`.playwright-tmp/history-dev` 目錄數 117 → **134**。
- **T6 前置條件（已知限制，非本 WP 修）**：跑 e2e 前必須確認 5173 無他人 dev server。且本次證明**光關掉手動 dev server還不夠**——IDE 擴充也會起無 env 的 server 來搶真實 root。T6 應在跑前後各記一次真實 root 的項數與最新 mtime 作為未污染證據（本節即為範本）。

### 7. OQ 處置（三者皆非阻塞）

| OQ | 狀態 | Owner | Deadline | 未答覆時的預設假設 |
|---|---|---|---|---|
| OQ-62.1 | 🟡 未決 | 研究者 | **T4 開工前** | 預覽對未指定列顯示「預設」字樣；BR 四格因 T1 的 `DECLARED_WEAPON_BY_DRILL_ID` 顯示實名 |
| OQ-62.2 | 🟡 未決 | 研究者 | **T4 開工前** | 不做第二套 ADS guard，只記為已知限制（`ads` 事件與 `meta.weapon.ads` 已逐 run 記錄，事後可稽核） |
| OQ-62.3 | 🟡 未決 | 實作者 | **T1 開工時** | 對表測試全覆蓋 36 個 schedulable drill；解析成本過高者於本檔**具名豁免**並說明，不得靜默略過 |

### Decision Log

| # | 日期 | 決定 | 理由 | 出處 |
|---|---|---|---|---|
| **D-62.T0-1** | 2026-09-10 | **維持 `WP-62` / `GD-38` 不改號** | 雖與 stage14 §3 候選撞號，但依 GD-15「以採納入 §2 索引為準」，stage14 自宣告「候選，未批准」且無子資料夾、未入索引 ⇒ 不構成佔用 | [GD-38](../../../DECISIONS.md) ① |
| **D-62.T0-2** | 2026-09-10 | **NFR-62.3 回歸基線改採實測 2,822 passed / 2 skipped**（非文件的 2,688）；Playwright 亦以本次實測為準 | T0 明文「以本次實測為準，不得沿用文件數字」；文件數字為 WP-58 T-exit 當時值，其後多個 WP 已加測試 | 本節 §1 |
| **D-62.T0-3** | 2026-09-10 | **`exportPayloadSchema.ts` 納入 §2.1 In scope** | CodeGraph 實查顯示 `SessionPlanItemMeta` 的 runtime 驗證不在 `metadata.ts` 而在此檔；不納入會讓 T5 漏改，schema 放行未驗證欄位 | 本節 §4 |
| **D-62.T0-4** | 2026-09-10 | **`loadSceneById()` 的 override 清空行為移交 T3 決定，T0 不改碼** | T0 invariant 明文「不改任何 `src/` 程式碼」；且此為接線設計選擇，屬 T3 職責 | 本節 §5 |

### Surprises & Discoveries

1. **編號紀律第五次應驗，但方向相反。** GD-35 ② 預期的失效模式是「規劃期預留的號被平行 session 搶走」；本次實況是**本 WP 的號早一日就被另一份草稿主張過**，而規劃期的 repo 掃描沒看到（stage14 的候選表未入 §2 索引，且規劃期只查了「最大 WP-n」而 stage14 已寫到 WP-64 ⇒ **「最大值」查法本身會漏掉未採納的雙重主張**）。⇒ 教訓：重查不只要查最大值，還要 `grep` 目標號本身。
2. **`activateDrill()` 不是 `activeWeaponOverride` 的唯一寫入點。** README §0.1「四個呼叫端」把三條**平行**路徑誤記成 `activateDrill` 的呼叫端。真相是 3 個寫入點各自重做動作序列 ⇒ 本 WP 的接線面比規劃期所想更寬（§5）。這正是 blast-radius 對帳存在的理由。
3. **真實研究資料根已被 e2e 污染過。** `data/session-history/` 裡的 `etc_passwd-…` participant 是安全性 e2e 的產物，卻落在真實 root。這不是本 WP 造成，但說明 `reuseExistingServer` + 手動 dev server 的組合是**會靜默毀資料**的陷阱（§6）。
4. **`npm run typecheck` 的守備範圍比直覺窄**：`include: ["src"]` ⇒ T6 在 `tests/` 寫的 E2E 型別**六道綠燈都不會檢查**。T6 若新增型別需另行確認。

### Open Questions（T0 結束時）

| # | 問題 | Owner | 需要在何時收斂 |
|---|---|---|---|
| 1 | OQ-62.1／62.2（見上表） | 研究者 | T4 開工前 |
| 2 | OQ-62.3（見上表） | 實作者 | T1 開工時 |
| 3 | `loadSceneById()` 清空 override 的處置。**選項已收斂為 ②／③**——① 會讓 `weapon-select.spec.ts:106` 的既有 WP-47 契約轉紅（見 §5） | 實作者 + 研究者 | **T3 開工時**（D-62.T0-4） |
| 4 | `loadSceneById()` 缺 `setAdsConfig`／`configureMouseIntegration` 的先前既有不對稱是否另開 KI | 實作者 | 非阻塞，T3 順帶判斷 |
