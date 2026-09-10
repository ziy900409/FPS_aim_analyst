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

---

## §T1 Drill 自宣告武器的推導註冊表（2026-09-10）

**狀態**：✅ 完成。`isWeaponId` 已匯出，`DECLARED_WEAPON_BY_DRILL_ID` 由 `trackingBrVariants` 推導，對表測試**全覆蓋 36 個 schedulable drill、零豁免**。

### Progress

- [x] (2026-09-10) `src/weapon/weapons.ts`：`isWeaponId()` 由模組私有改為 `export`，語意零變更（同一個 `WEAPONS` own-property 判定）；`getWeapon()` 與其錯誤訊息未動。
- [x] (2026-09-10) `src/session/drillFamily.ts`：新增 `DECLARED_WEAPON_ROSTER`（值取 `variant.drill.weaponId`，零手打字面值）＋ `buildDeclaredWeaponByDrillId()` ＋ `DECLARED_WEAPON_BY_DRILL_ID`。建構時三道驗證：值須通過 `isWeaponId()`、drillId 不得重複、drillId 須在 `FAMILY_BY_DRILL_ID` 內。
- [x] (2026-09-10) `src/session/drillFamily.test.ts`：+44 tests（36 逐 drill 對表 + 4 範圍/型別斷言 + 4 建構期負向）。既有 60 tests 零修改。

### 驗證（六道閘全綠，逐項實測）

| 指令 | 結果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| `npm run build`（含兩個 typecheck + `vite build`） | ✅ exit 0，`built in 2.12s` |
| `npx vitest run src/session/drillFamily.test.ts src/weapon/WeaponConfig.test.ts` | ✅ 128 passed |
| 全量 `npx vitest run` | ✅ **2,866 passed / 2 skipped**；檔案 252 passed / 1 skipped |

**回歸基線對帳**：T0 基線 2,822 passed / 2 skipped → 現 2,866 / 2。差值 **+44 = 36 + 4 + 4**，恰為本 task 新增，**既有測試零修改、零減少**，檔案數不變（改的是既有 `drillFamily.test.ts`）⇒ NFR-62.3 守住。

**Playwright 未跑**：T1 的 DoD 只要求 typecheck + Vitest，且本 task 不觸及 DOM／runtime 路徑（純新增一張編譯期 map）。全量 e2e 留在 T6，並須遵守 [§T0.6](progress.md) 的 5173 前置條件。

### 對表測試覆蓋率（OQ-62.3 → 結案：全覆蓋，零豁免）

`SCHEDULABLE_DRILL_SOURCES` 逐一列出 36 個 schedulable drill 的**真實 config 物件**，與 `main.ts` `availableDrills` 同序、同來源常數：

| 解析方式 | 筆數 | 說明 |
|---|---|---|
| 直接 `DrillConfig`（`.drillId`） | 8 | `counterstrafe_ad_v1`(JSON)／`detection_popin_v1`／`tracking_v1`／`spider-shot-v1`／`spider-shot-v2`／`spider-shot-v3`／`counterstrafe-reversal-v1`／`counterstrafe-free-v1` |
| `{ id, drill }` 包裝（`.drill`） | 27 | tracking scene/longrange、hold-click/track、peek 六格 + formal、micro-flick ×8、BR ×8 |
| **lazy binding** | 1 | `spider-shot-wide-v1` ⇒ `resolveSpiderShotWideV1(75, 16/9)` |

**OQ-62.3 的「解析成本過高則具名豁免」條款未動用。** 唯一被規劃期點名有風險的兩個 lazy binding 實際成本都是零：
- `spiderShotV3Binding` 只是 `{id, sceneId}`，其 config 是同檔另一個具名匯出 `spiderShotV3`（一個純常數）⇒ 不需 lazy 解析。
- `resolveSpiderShotWideV1(fovDegVertical, aspect)` 是 (FOV, aspect) 的純函式，**不需要場景、不需要相機、不讀時鐘**（`spider_shot_wide_v1.test.ts` 已用同樣的 `(75, 16/9)` 呼叫）。

⇒ 對表測試是「全體 36 個」而不是子集，這點很重要：子集覆蓋會讓**沒被檢查的那些 drill** 恰好成為未來可以偷偷長出 `weaponId` 的地方。

### 防 rot 機制已實測有效（不是宣稱）

DoD 的第 3 條要的是「未來任何 drill 新增 `weaponId` 而忘了進 map，這條測試會紅」。這是本 task 唯一真正有價值的斷言，所以**用突變實測而非推理**驗證：

- 暫時在 `src/drill/tracking_v1.ts` 加上 `weaponId: 'm4a4'`（一個未進 roster 的 drill）；
- `npx vitest run src/session/drillFamily.test.ts` ⇒ **2 failed / 102 passed**，其中一條正是 `tracking_v1 declares in the map exactly what its config declares`；
- 立即還原，`git diff --stat src/drill/tracking_v1.ts` 為空。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T1-1** | 2026-09-10 | **`DECLARED_WEAPON_BY_DRILL_ID.size` 的斷言值由計畫的 `4` 改為 `8`**，並另加「值集合恰 4 把武器」的斷言 | `trackingBrVariants` 實為 **2×2×2 = 8** 格（ads × ballistic × **angularHeight**），共用 4 把武器。規劃期把「4 把武器」誤記成「4 個 drill」（README §0.1 ①、T1 步驟 2/5、DoD 皆寫 4）。照計畫寫 `size === 4` 會**直接紅**，或更糟——若改成寬鬆斷言就會失去「範圍變了要被看見」的作用 | ① 照 DoD 寫 4 並「修正」實作：不可能，8 個 drill 各自宣告武器是既有事實，不是本 WP 能改的；② 只斷言 key 集合等於 `trackingBrVariants` 而不寫 size：數字消失後 review 時看不出範圍變化，違反該斷言的存在目的 ⇒ 兩個都寫 |
| **D-62.T1-2** | 2026-09-10 | **`buildDeclaredWeaponByDrillId(roster)` 以 roster 為參數並 `export`**，而非仿 `buildFamilyByDrillId()` 讀模組級常數的私有函式 | DoD 明文要求三種污染各有一條 **throw 的負向測試**。私有零參數函式無法注入污染 roster ⇒ 三條負向測試將無從撰寫，只能靠「相信 if 有寫」 | ① 保持私有 + 不寫負向測試：直接違反 DoD；② 用 `vi.mock` 偽造 `trackingBrVariants`：把測試綁在 import 形狀上，比多一個具名匯出脆弱得多 |
| **D-62.T1-3** | 2026-09-10 | **roster 的元素型別為 `[string, string \| undefined]`，`undefined` 在建構期 throw**，而非把 `isWeaponId` 的參數放寬成 `unknown` | `DrillConfig.weaponId` 型別上是 optional，所以「BR 格子掉了 weaponId」在型別層是合法的。若讓它靜默映射成 `undefined`，會與「28 個本來就沒宣告」長得**一模一樣**——T2 便會允許覆蓋一個實際上被固定的實驗格 | 放寬 `isWeaponId(id: unknown)`：會改動 T1 invariant「`getWeapon()`／`isWeaponId` 語意零變更」，且讓型別更弱 ⇒ 改在呼叫端顯式檢查 |
| **D-62.T1-4** | 2026-09-10 | 對表測試的 source 型別用 `Pick<DrillConfig, 'drillId' \| 'weaponId'>`，而非 `{ weaponId?: string }` | 只有 optional 欄位的型別是 TS 的 **weak type**，`tsc` 會對「沒有任何共同屬性」的物件報 TS2322（實際發生了，micro-flick 那組 literal union 觸發）。要求 `drillId` 存在，順帶讓「這真的是一個 drill config」變成編譯期主張 | 加 `as` 斷言消音：會讓「傳錯物件」這類真正的錯誤也一併消音 |

### Surprises & Discoveries

1. **🔴 BR 實驗格是 2×2×2 = 8 格，不是 2×2 = 4 格。** 全套 WP-62 文件（README §0.1 ①／§1.4 D-62-1「BR 四格」／§2.3 註解／FM-2／A-62.2／T1 步驟 2·5／T1 DoD）一致寫「4」，而 [tracking_br_v1.ts:93-102](../../../../../src/drill/tracking_br_v1.ts) 的 `trackingBrVariants` 有 8 個 `makeVariant(...)`——第三軸 `angularHeight`（`0p5deg`／`2deg`）是後來加的目標幾何軸，不改武器，所以 8 格共用 4 把武器。規劃期顯然是數了 `WEAPON_BY_AXIS` 的 4 把武器，寫成了 4 個 drill。**證據**：`drillFamily.test.ts` 既有的 family 分組斷言早就寫著 `tracking: 11`（= `tracking_v1` + scene + longrange + **8**），所以這個數字一直在 repo 裡，只是規劃期沒對上。已回改 README ①、§2.3 註解與 T1 doc；D-62-1 的**語意不變**（宣告了武器的 drill 不可覆蓋），只是範圍從 4 列變 8 列，**T2 的驗證邏輯不受影響**（它查 map 而非數字）。
2. **`spider-shot-v3` 根本不是 lazy binding。** OQ-62.3 把 `spiderShotV3Binding` 與 `spiderShotWideV1Binding` 並列為「需要各自解析方式、成本可能過高」的兩個風險項。實查：前者只是 `{id, sceneId}` 的**場景綁定**，drill config 是同檔的純常數 `spiderShotV3`（`main.ts` 也是這樣用的：`source: spiderShotV3`）。真正 arm-time 解析的只有 `spider-shot-wide-v1` 一個，而它是 (FOV, aspect) 的純函式 ⇒ OQ-62.3 擔心的成本實際上是零，全覆蓋不需要任何取捨。**「lazy binding」在 repo 裡指兩種不同的東西**（場景綁定 vs config 延遲解析），T4 讀 OQ-62.1 時要注意同一個誤解。
3. **`tsc` 的 weak-type 檢查在測試碼上救了一次。** `{ readonly weaponId?: string }` 作為對表 source 的型別會被 TS2322 拒絕——這正是該檢查的用意（一個全 optional 的型別可以接受任何無關物件）。若當初用 `as` 消音，這張表就會失去「值真的來自 drill config」的保證。順帶印證 T0 §4 的提醒反向也成立：這個檔在 `src/` 下**有**被 typecheck 守到；T6 寫在 `tests/` 的就沒有。

### Open Questions（T1 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | **OQ-62.3** 對表覆蓋範圍 | ✅ **結案**：全覆蓋 36 個、零豁免（見上） | 實作者 | — |
| 2 | OQ-62.1（預覽對未指定列顯示「預設」還是實名） | 🟡 未決。**T1 的產出讓實名選項變便宜**：`DECLARED_WEAPON_BY_DRILL_ID` 已可為 8 個 BR 格提供實名，其餘 28 個一律是 app 預設 `ak47`（無 drill 級宣告）⇒ 若研究者要「一律顯示實名」，表單也不需解析任何 drill config，只需 map + 預設字串 | 研究者 | T4 開工前 |
| 3 | OQ-62.2（ADS × 禁 ADS drill 是否警告） | 🟡 未決，T1 未觸及 | 研究者 | T4 開工前 |
| 4 | `loadSceneById()` 清空 override 的處置（選項收斂為 ②／③，見 §T0.5） | 🟡 未決，T1 未觸及 | 實作者 + 研究者 | T3 開工時 |
| 5 | D-62-1 的措辭「BR 四格」散在 §1.4／FM-2／A-62.2 三處，本 task 只改了事實陳述（§0.1 ①、§2.3、T1 doc），**未改決策與驗收條目的措辭** | 🟢 非阻塞：語意不受數字影響（判準是「有宣告就不可覆蓋」）。T2 落地時順手把三處「四格」改為「八格」即可 | 實作者 | T2 |

---

## §T2 編譯器：`weaponId` 穿透與驗證（2026-09-10）

**狀態**：✅ 完成。`SessionProgramItem`／`RunStep` 各加 `weaponId?: WeaponId`，由 `requireWeapon()` 在**建構任何 step 之前**驗證，穿透時維持鍵集合最小化。省略時輸出對本 task 前 HEAD **逐位元相同**（sha256 對帳，見下）。

### Progress

- [x] (2026-09-10) `src/session/sessionProgram.ts`：`SessionProgramItem.weaponId?` / `RunStep.weaponId?`（型別自 `../weapon/weapons.ts` 匯入）、`SessionProgramErrorField` 加 `'weaponId'`、新增 `requireWeapon(drillId, weaponId, itemIndex)`，並把 run step 的兩支 ternary 改為條件展開（見 D-62.T2-2）。
- [x] (2026-09-10) `deriveProgramFamilyOrder()` / `summarizeProgram()` / `resolveBoundary()` **零修改**（T2 步驟 6）——並以「同一 plan 加不加武器，rest step 與 summary 完全相同」的斷言釘住，而非只是宣稱沒改。
- [x] (2026-09-10) `src/session/sessionProgram.test.ts`：+30 tests（6 合法穿透／不變性 + 8 非法定位 + 16 純度掃描）。既有 65 tests 零修改。
- [x] (2026-09-10) README／task-checklist／T1／T2／T4／T5／T6 doc 的「BR 四格」→「BR 八格」、「2×2 實驗格」→「2×2×2 實驗格」——收掉 T1 OQ #5。`progress.md` 的歷史段落**不改**（那是當時的紀錄，不是現況陳述）。

### 驗證（六道閘全綠，逐項實測）

| 指令 | 結果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| `npm run build` | ✅ exit 0，`built in 2.14s`（chunk > 500 kB 警告為先前狀態） |
| `npx vitest run src/session/sessionProgram.test.ts` | ✅ 95 passed（本 task 前為 65） |
| 全量 `npx vitest run` | ✅ **2,896 passed / 2 skipped**；檔案 252 passed / 1 skipped |

**回歸基線對帳**：T1 基線 2,866 / 2 → 現 2,896 / 2，差值 **+30 = 6 + 8 + 16**，恰為本 task 新增；檔案數不變（改的是既有 `sessionProgram.test.ts`）。既有測試零修改、零減少 ⇒ NFR-62.3 守住。**Playwright 未跑**：T2 不觸及 DOM／runtime 路徑，全量 e2e 留在 T6（並須遵守 §T0.6 的 5173 前置條件）。

### NFR-62.4 逐位回歸（DoD 第 4 條，實測而非推理）

一次性 harness `.tmp-wp62-t2-baseline.ts`（跑完即刪，內容附於下方以便重製）壓 5 個**不含 `weaponId`** 的 plan：`golden`（三 family ×3 reps）、`zeroRest`、`sameFamilyAdjacent`、`warmupMarked`、`frozenSixFamiliesWithWarmup`（`buildFrozenSessionPlan` 六 family + warmup，即 D-62-2 的 frozen 軌）。

```bash
# 1) 本 task 的碼
npx vite-node .tmp-wp62-t2-baseline.ts > after.json
# 2) 換成本 task 前 HEAD 的 sessionProgram.ts，同一 harness 再跑一次
git show HEAD:src/session/sessionProgram.ts > src/session/sessionProgram.ts
npx vite-node .tmp-wp62-t2-baseline.ts > before.json
# 3) 逐位元比對
cmp before.json after.json && sha256sum before.json after.json
```

結果：`cmp` 無輸出（**逐位元相同**），兩檔 sha256 皆為

```text
dadec456ef0be2b18d9dc7254ef572f35f795b469853d55defaa44799571c30d
```

⇒ NFR-62.4 與 FR-62.6（frozen 軌編譯逐位不變）在編譯層成立。**這只涵蓋編譯輸出**；frozen 的 runtime 與匯出逐位不變仍是 T6 的職責。

<details>
<summary>harness 內容（重製用）</summary>

```ts
import { holdClickV1 } from './src/drill/hold_click_v1.ts';
import { spiderShotV2 } from './src/drill/spider_shot_v2.ts';
import { counterstrafeReversalV1 } from './src/drill/counterstrafe_reversal_v1.ts';
import { counterstrafeFreeV1 } from './src/drill/counterstrafe_free_v1.ts';
import { buildFrozenSessionPlan } from './src/session/SessionRunner.ts';
import { compileSessionProgram } from './src/session/sessionProgram.ts';

const A = holdClickV1.id;
const B = spiderShotV2.drillId;
const C = counterstrafeReversalV1.drillId;
const C_SIBLING = counterstrafeFreeV1.drillId;

const cases: Record<string, unknown> = {
  golden: compileSessionProgram({
    items: [{ drillId: A, reps: 3 }, { drillId: B, reps: 3 }, { drillId: C, reps: 3 }],
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  }),
  zeroRest: compileSessionProgram({
    items: [{ drillId: A, reps: 2 }, { drillId: C_SIBLING, reps: 1 }],
    drillRestSeconds: 0,
    familyRestSeconds: 0,
  }),
  sameFamilyAdjacent: compileSessionProgram({
    items: [{ drillId: C_SIBLING, reps: 1 }, { drillId: C, reps: 2 }],
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  }),
  warmupMarked: compileSessionProgram({
    items: [{ drillId: C_SIBLING, reps: 1, warmup: true }, { drillId: C, reps: 2 }, { drillId: A, reps: 1 }],
    drillRestSeconds: 30,
    familyRestSeconds: 60,
  }),
  frozenSixFamiliesWithWarmup: buildFrozenSessionPlan({
    participantId: 'P001',
    sessionIndex: 1,
    families: ['hold-click', 'hold-track', 'spider-shot', 'spider-shot-wide', 'counterstrafe', 'micro-flick'],
    restSeconds: 60,
    includeWarmup: true,
  }),
};

console.log(JSON.stringify(cases, null, 1));
```

</details>

### 兩道新守門是否真的會咬（突變實測，沿用 T1 的做法）

`JSON.stringify` 的逐位比對不會替 `weaponId: undefined` 說話（`toEqual`／`toBeUndefined()` 也一樣會過），所以「鍵不存在」與「鍵存在但值是 undefined」的差別必須靠 `Object.hasOwn`／`Object.keys` 斷言看守。用突變證明它會咬：

| 突變 | 結果 |
|---|---|
| `...(weaponId === undefined ? {} : { weaponId })` → `weaponId,`（永遠放鍵） | **1 failed / 94 passed**：`omits the key entirely when no weapon was named (NFR-62.4)` |
| `if (declared !== undefined && declared !== weaponId)` → `if (false)`（拿掉覆蓋檢查） | **3 failed / 92 passed**：`overrides a BR cell`、`only the second of three items is bad`、`classifies by field and index alone` |

兩次突變後皆立即還原，還原後以字串比對確認兩段程式碼原文皆在（非靠 `git diff --stat` 的行數推測）。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T2-1** | 2026-09-10 | **純度 source-scan 擴及 `weapons.ts` 與 `WeaponConfig.ts`**（既有 8 條 FORBIDDEN 規則一條未動，只是多掃兩個檔） | NFR-62.1 要的是「純度不退化」。既有 scan 是**逐檔**的，但純度是**相依閉包**的性質，而本 task 剛好把 `weapons.ts`（及其唯一相依 `WeaponConfig.ts`，該檔無任何 import）拉進編譯器的閉包。不擴掃的話，日後有人在 `weapons.ts` 寫個 `Date.now()`，編譯器的純度閘會全綠放行 | ① 維持只掃 `sessionProgram.ts`／`drillFamily.ts`：新閉包無人看守，等於把 NFR-62.1 縮成「檔案級」承諾；② 放寬規則讓新 import 通過：T2 步驟 9 明文禁止，且本次**不需要**——兩個檔實測對 8 條規則全部乾淨 |
| **D-62.T2-2** | 2026-09-10 | **run step 改以條件展開（`...(cond ? {x} : {})`）建構**，取代原本 warmup 的兩支 ternary | 兩個獨立 optional 鍵 ⇒ ternary 要寫成 4 個字面分支，鍵順序被複製 4 份，而**鍵順序正是 NFR-62.4 要保的東西**（`JSON.stringify` 逐位比對看得到順序）。單一字面 + 條件展開讓順序只有一份 | ① 巢狀 ternary 4 分支：鍵順序四處重複，任一處手滑就是逐位回歸紅燈；② 先建物件再有條件賦值：破壞 `readonly` 語意，且鍵順序變成執行順序的副作用。實際順序不變已由 harness 的 sha256 與 `Object.keys` 斷言雙重釘死 |
| **D-62.T2-3** | 2026-09-10 | 非法矩陣納入 **`'toString'`（Object 原型鍵）** 這一格 | `isWeaponId` 是 own-property 判定；若日後有人「簡化」成 `id in WEAPONS` 或 `WEAPONS[id] !== undefined`，`'toString'` 會變成合法武器 id 並一路帶著一個 function 抵達 `buildSimLoop()`。這一格把該判定方式本身釘死 | 只測 `'not_a_weapon'`／空字串：涵蓋不到「判定方式退化」這條路徑，而表單交給編譯器的就是任意字串 |

> D-62-1 的「指定值等於宣告值 → 放行」照 T2 doc 落地，非新決策；已由 `lets a BR cell name the weapon it already declares` 一條正向測試釘住。

### Surprises & Discoveries

1. **本 task 開工時 worktree 已有未提交的 `sessionProgram.ts` 改動**（+ 根目錄的 `.tmp-wp62-t2-baseline.ts`），是前一個中斷 session 的遺留。**逐行對照 T2 doc 的 Steps 1–6 確認語意一致後才沿用**，沒有當成既成事實照單全收；測試、逐位回歸與突變驗證全部在本 session 重跑。記在這裡是因為 §T0.3 已警示平行 session 在跑——下一個 task 開工前一樣要先 `git status` 看清楚手上這份改動是誰的。
2. **`it.each` 的 `%i` 吃的是第二個參數，不是「第二欄」。** 標題原寫 `'%s -> field weaponId at item %i'`，而 tuple 第二格是 `items` 陣列 ⇒ 測試名字印成 `at item NaN`。斷言本身是對的（`itemIndex` 有逐條比對），錯的只有標題——但一個永遠印 NaN 的標題會讓未來讀 CI log 的人以為索引壞了。已改成不帶索引的標題。
3. **`JSON.stringify` 的逐位比對擋不住 `weaponId: undefined`。** 這正是 DoD 第 3 條要求「明確斷言 `Object.hasOwn(...) === false`、不得只用 `toBeUndefined()`」的原因：既有的元素級 `toEqual` golden 測試對多出一個 undefined 鍵**完全沉默**，而該鍵一旦進到 `RunStep`，T5 的匯出 schema 就會多一個欄位。突變表第一列就是這個沉默的實測。

### Open Questions（T2 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | T1 OQ #5：「BR 四格」措辭 | ✅ **結案**：WP 資料夾內非 `progress.md` 的 7 個 doc 已全數改為「八格」／「2×2×2」 | 實作者 | — |
| 2 | OQ-62.1（預覽對未指定列顯示「預設」還是實名） | 🟡 未決，T2 未觸及 | 研究者 | T4 開工前 |
| 3 | OQ-62.2（ADS × 禁 ADS drill 是否警告） | 🟡 未決，T2 未觸及 | 研究者 | T4 開工前 |
| 4 | `loadSceneById()` 清空 override 的處置（選項收斂為 ②／③，見 §T0.5） | 🟡 未決 | 實作者 + 研究者 | **T3 開工時** |
| 5 | T5 提醒：編譯器以 `isWeaponId` 為武器 allowlist 的**唯一**來源；`SessionPlanItemMeta.weaponId?: string` 的 runtime 驗證在 `exportPayloadSchema.ts`（§T0.4 / D-62.T0-3），必須共用同一個判定，不得另寫一套字串比對 | 🟢 非阻塞 | 實作者 | T5 |

---

## §T3 SessionRunner 與 `activateDrill()` 接線（2026-09-10）

**狀態**：✅ 完成。`RunStep.weaponId` 已從編譯結果一路送到 `createSimLoop(..., weapon)`；武器 precedence 抽成 `resolveActiveWeapon()` 單一定義；跨 4 種 render FPS 逐位一致與賦值順序皆有測試釘死。**`loadSceneById()` 未動**（OQ #4 收斂為 ③，見下）。

### Progress

- [x] (2026-09-10) `src/weapon/weapons.ts`：新增 `DEFAULT_WEAPON_ID` 與 `resolveActiveWeapon(override, drillWeaponId)`——把 `main.ts` 原本 inline 的 `override ?? drill ?? 'ak47'` 收成單一定義（見 D-62.T3-1）。既有 `getWeapon`／`isWeaponId`／`WEAPONS` 語意零變更。
- [x] (2026-09-10) `src/session/SessionRunner.ts`：`loadDrillById` 簽名擴為 `(drillId, weaponId?) => Promise<void>`；`enterStep()` 改呼叫 `loadDrillById(step.drillId, step.weaponId)`。游標／rest／`measuredRunOrdinal`／`runTransition` 錯誤傳播**零修改**。`WeaponId` 以 `import type` 引入 ⇒ runtime 無新增 import，`SessionRunner.ts` 的 `FORBIDDEN_REACH` 掃描（ADR-2）全綠。
- [x] (2026-09-10) `src/main.ts`：`activateDrill()` 加第五參數 `weaponId: WeaponId | undefined`，第 1397 行的 `activeWeaponOverride = undefined` 改為 `= weaponId`（**位置不動**）；`loadDrillById(drillId, weaponId?)` 穿透；`loadDrillConfigDirect()` 顯式傳 `undefined`；`controls?.setSelectedWeapon()` 改讀 `activeWeaponConfig().id`。
- [x] (2026-09-10) 新測試檔 2 支（+21）、既有 runner 測試 3 檔補參數並**加嚴**（+2）。全量 Vitest **2,919 passed / 2 skipped**。

### 驗證（六道閘全綠，逐項實測）

| 指令 | 結果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| `npm run build` | ✅ exit 0，`built in 2.41s`（chunk > 500 kB 警告為先前狀態） |
| `npx vitest run src/session/ src/loop/__tests__/wp62-session-weapon-determinism.test.ts` | ✅ 328 passed |
| 全量 `npx vitest run` | ✅ **2,919 passed / 2 skipped**；檔案 **254 passed / 1 skipped** |

**回歸基線對帳**：T2 基線 2,896 / 2（252 檔）→ 現 2,919 / 2（254 檔）。差值 **+23 = 9（決定性檔）+ 12（接線檔）+ 2（runner 檔各 1 支新測試）**，檔案 **+2** 恰為兩支新檔。既有測試零刪除。

**Playwright 未跑**：T3 不改 DOM／表單路徑，全量 e2e 留在 T6（並須遵守 [§T0.6](progress.md) 的 5173 前置條件）。⚠️ 但 T6 必須特別覆驗 `tests/e2e/weapon-select.spec.ts`——本 task 改了 `activateDrill()` 的 override 賦值與 `setSelectedWeapon()` 讀取來源，那支 spec 正是 WP-47 reset-per-drill 的契約守門人。

### 既有測試的修改：6 條斷言**加嚴**，非放寬（NFR-62.3 的明帳）

`enterStep()` 改為永遠傳兩個參數後，Vitest 的 `toHaveBeenCalledWith` 是**含 arity** 比對 ⇒ 既有 5 條 `toHaveBeenCalledWith('drill_id')` 立即轉紅（實測：改完 runner 當下 `src/session/` 為 **5 failed / 300 passed**）。依 T3 DoD 第 6 條「僅補參數、無斷言放寬」處理：

| 檔 | 改動 | 方向 |
|---|---|---|
| `SessionRunner.test.ts` | 5 條 `toHaveBeenCalledWith(id)` → `(id, undefined)`；stub 型別補第二參數 | **加嚴**（多驗一個值） |
| `SessionRunnerPoll.test.ts` | 1 條同上；stub 型別補第二參數 | **加嚴** |
| `SessionRunnerProgram.test.ts` | stub 型別補第二參數（該檔的斷言走 `mock.calls.map(([id]) => id)`，不受 arity 影響） | 不變 |

三檔各新增／擴充一條 **weaponId 正向斷言**（DoD 第 6 條後半）：

- `SessionRunner.test.ts` — frozen 軌逐步第二參數皆為 `undefined`（**D-62-2 的 runner 層守門**：編譯器若哪天開始對 frozen step 發 `weaponId`，這條會紅）。
- `SessionRunnerProgram.test.ts` — `reps: 3` + `weaponId: 'm4a1s'` 的 item，三輪 call 逐一為 `[holdClickV1.id, 'm4a1s']`，其後未指定的 item 為 `undefined`（**FR-62.3**）。
- `SessionRunnerPoll.test.ts` — **`poll()` 驅動的無人自動推進**也帶對武器。挑這條路徑是因為它是唯一無操作員在場的推進路徑，掉了武器不會有人當場看見。

### 決定性與賦值順序：兩支新測試檔的分工

| 檔 | 案例 | 守什麼 |
|---|---|---|
| `src/loop/__tests__/wp62-session-weapon-determinism.test.ts`（9 tests） | `穩定 60 Hz`／`穩定 144 Hz`／`穩定 240 Hz`／`抖動 144 Hz ±50%`：**整份 program 的逐步 sim 狀態 bit-exact 對齊 canonical**；另有「四種 FPS 序列彼此 bit-exact 相等」與「重播 bit-exact」 | **NFR-62.2 / A-62.6** |
| 同上 | `武器賦值早於 sim loop 建構：首 tick 的 magSize 已是本步武器的容量` | DoD 第 2 條（magSize 版） |
| 同上 | `program 走完三條 precedence 分支，且 reps 的每一輪同一把（FR-62.3）` | DoD 第 3 條 |
| `src/session/sessionWeaponActivation.test.ts`（12 tests） | `resolveActiveWeapon()` precedence 四格 + 未知 id + BR 八格對表 | 武器解析單一定義 |
| 同上 | `main.ts` source 掃描：賦值早於 `buildSimLoop()`／`setAdsConfig`／`configureMouseIntegration`；`setSelectedWeapon(activeWeaponConfig().id)`；`loadSceneById()` 的 reset 未動；三個非 Session Plan 呼叫端傳 `undefined`；無第二條換武器路徑 | DoD 第 2／4／5 條 + §Invariants |

決定性測試跑的 program 刻意走完三條 precedence 分支——`holdClickV1 ×3`（逐列指定 `m4a1s`，mag 20）→ BR `tracking_br_v1__ads_off__hitscan__0p5deg`（drill 自宣告）→ `counterstrafe-free-v1`（落回預設 `ak47`，mag 30）。輸入序列含**移動中開火**，讓 `inaccuracy.move` 這一項真的參與散佈，否則換武器只換到彈匣容量、測不到 recoil／spread 維度。

### 為何順序要用 source 掃描（不是偷懶）

`main.ts` 是 WebGPU + DOM 的 top-level 腳本，vitest 起不動；而「賦值早於 `buildSimLoop()`」是 `activateDrill()` **函式體內的敘述順序**，沒有任何可注入的介面。關鍵是：**magSize 斷言擋不住這個失敗模式**——它在 `createSimLoop()` 建構當下量測，那時武器早已定案，順序被搬動它仍會綠。兩支測試因此不是重複，是各守一半。source 掃描是既有 repo 慣例（`sessionProgram.test.ts` 的純度掃描同樣 `readFileSync`）。

### 四道突變實測（沿用 T1／T2 做法）：**第四道抓到測試本身的漏洞**

| # | 突變 | 結果 |
|---|---|---|
| M1 | `enterStep()` 的 `loadDrillById(step.drillId, step.weaponId)` → 只傳 `drillId` | ✅ **7 failed** |
| M2 | 把 `activeWeaponOverride = weaponId;` 搬到 `buildSimLoop()` **之後** | ✅ **1 failed**：`賦值早於 simLoop = buildSimLoop()` |
| M3 | `setSelectedWeapon(activeWeaponConfig().id)` → 還原成 `nextConfig.weaponId ?? 'ak47'` | ✅ **1 failed**：`Controls 顯示的是實際生效武器` |
| M4 | `resolveActiveWeapon` 的 precedence 反轉為 `drillWeaponId ?? override ?? DEFAULT` | 🔴 **328 passed——沒抓到**。修正後重跑 ✅ **1 failed** |

**M4 是本 task 最有價值的一格。** 原因：測試裡唯一「override 與 drill 宣告都有值」的案例，兩邊填了**同一個值**（`resolveActiveWeapon('ak47_br_hip_hitscan', 'ak47_br_hip_hitscan')`）⇒ precedence 反轉完全不可觀測。而反轉**是可達的真實故障**：`loadWeaponById()`（Controls 武器下拉）**不經編譯器**，可在 BR drill 上直接設 override——precedence 若反過來，那個下拉在 BR 八格會**無聲失效**，WP-47 的既有語意就沒了。已補一格 `resolveActiveWeapon('usp_s_laser', 'ak47_br_hip_hitscan') === 'usp_s_laser'`。

（M2 的第一次嘗試被腳本自己的 `assert count == 1` 擋下：`activeWeaponOverride = weaponId;` 在 `main.ts` 有**兩處**——`activateDrill` 與 `loadWeaponById`。突變腳本改為只在 `activateDrill` 之後的片段動手。記在這裡是因為這正說明「兩個寫入點」這件事有多容易被忽略，見 §T0 Surprises 2。）

四次突變後皆立即還原，還原後以 `git diff --stat` 對帳三個檔的行數與突變前一致，並重跑全綠。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T3-1** | 2026-09-10 | **武器 precedence 抽成 `weapons.ts` 的 `resolveActiveWeapon()`**，`main.ts` `activeWeaponConfig()` 改為單行呼叫；新增具名 `DEFAULT_WEAPON_ID` | 決定性測試若在測試檔裡自己寫一次 `step.weaponId ?? drill.weaponId ?? 'ak47'`，測的就是**測試自己的副本**，而不是 `main.ts` 跑的規則——正是 C-D4 禁止的第二定義。抽出來後測試斷言的是同一個函式 | ① 測試內重寫 precedence：見上，測不到真正的迴歸；② 以 e2e 覆蓋（`main.ts` 唯一可執行的環境）：T3 的 DoD 要 unit 級的跨 FPS 逐位斷言，e2e 給不了逐 tick bit-exact，且 e2e 是 T6 的範圍；③ 不抽、只做 source 掃描：掃描只能證明「寫法沒變」，不能證明「規則正確」 |
| **D-62.T3-2** | 2026-09-10 | **`loadSceneById()` 完全不動 ⇒ OQ #4 採選項 ③（明帳接受為已知限制）**，不採 ②（session 執行中停用場景下拉） | ① 已由 [§T0.5](progress.md) 排除（會讓 `weapon-select.spec.ts:106` 的 WP-47 契約轉紅）。②／③ 之間選 ③：該路徑**在 Session Plan 主線不可達**（KI-002/D2 明文只走 `loadDrillById`），且事實**已可稽核**——逐 run `meta.weaponId` 會如實記下還原後的武器，離線比對 `sessionPlanItems[].weaponId`（意圖）即可發現。② 要改 UI 行為（run 中停用控制項），屬 T4 範圍且未經研究者要求 | ② 停用場景下拉：零程式風險但擴大 T3 範圍到 UI，且是**猜使用者要什麼**；若研究者確認需要硬性 guard，T4 可零成本補上（本 task 未關閉這條路） |
| **D-62.T3-3** | 2026-09-10 | **`setSelectedWeapon()` 只改 `activateDrill()` 內那一處**，`loadSceneById()`（第 1459 行）與 Controls 初始建構（`selectedWeaponId`）維持原本的 `?? 'ak47'` 字面 | T3 Invariant 明文「`loadSceneById()` 的既有 reset 語意不變」。那兩處改成 `DEFAULT_WEAPON_ID` 雖逐位等價，但屬與本 task 無關的整理，會讓 diff 混入非必要變更 | 一次把三處 `?? 'ak47'` 全部收斂：逐位等價但越界；已記為可順手處理的 debt（見下方 OQ #6） |

### Surprises & Discoveries

1. **🔴 突變測試抓到的不是程式的 bug，是測試的 bug（M4）。** 前三道突變都被擋下，第四道（precedence 反轉）**全綠通過**——因為唯一同時給兩個值的測試案例兩邊填了同一個值。若當初只做「四道突變、三道紅就算數」的粗略檢查，這個洞會一路留到 T-exit。教訓：**斷言「A 勝過 B」時，A 與 B 必須不同值**，否則那條斷言只是在測 `x === x`。
2. **`toHaveBeenCalledWith` 含 arity 比對，所以「加一個 optional 參數」不是純加法。** 規劃期把 `loadDrillById` 的簽名擴充視為 additive；實際上 5 條既有斷言立刻轉紅。這**不是**壞事（正因為它會紅，才證明 stub 真的收到了新參數），但它說明 NFR-62.3「既有測試零修改」在**簽名層**的改動上必然要開豁免——T3 DoD 第 6 條就是那個豁免，改動方向必須是加嚴。
3. **`activeWeaponOverride = weaponId;` 在 `main.ts` 有兩處。** 寫突變腳本時 `assert count == 1` 直接紅——第二處是 `loadWeaponById()`（WP-47 的 Controls 路徑）。這與 §T0 Surprises 2「`activateDrill()` 不是唯一寫入點」是同一件事的第三次現身：改完之後，`activeWeaponOverride` 的**三個寫入點**變成「本步指定值（`activateDrill`）／手選值（`loadWeaponById`）／清空（`loadSceneById`）」，語意反而比先前清楚。
4. **本 task 期間平行 session 新增了 `docs/known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md`**（未追蹤，非本 WP 產生，**未觸碰、未 stage**）。題材是滑鼠 gain 在感度／FOV 變更後過期——與本 task 動到的 `recorder.configureMouseIntegration()` 呼叫點**相鄰但不相同**（本 task 未改該行，只保證武器賦值早於它）。T4／T5 開工前應重讀該 KI，確認兩者沒有隱含衝突。

### Open Questions（T3 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | OQ-62.1（預覽對未指定列顯示「預設」還是實名） | 🟡 未決，T3 未觸及 | 研究者 | T4 開工前 |
| 2 | OQ-62.2（ADS × 禁 ADS drill 是否警告） | 🟡 未決，T3 未觸及 | 研究者 | T4 開工前 |
| 3 | `loadSceneById()` 清空 override 的處置 | ✅ **結案（暫定）**：採 ③，見 D-62.T3-2。**研究者若要硬性 guard，T4 補 ② 的成本仍是零**——本 task 沒有關閉那條路 | 實作者（已決）＋ 研究者（可推翻） | T4 開工前可推翻 |
| 4 | `loadSceneById()` 缺 `setAdsConfig`／`configureMouseIntegration` 的先前既有不對稱（§T0.5 附帶） | 🟡 未決。本 task 未改該函式，故不對稱**原樣保留**；逐列武器上線後它的可觀測後果變大（換場景後 ADS 光學／gain 可能對不上已還原的武器） | 實作者 | 非阻塞；建議 T6 e2e 觀察後決定是否另開 KI |
| 5 | T5 提醒：`SessionPlanItemMeta.weaponId` 的 runtime 驗證在 `exportPayloadSchema.ts`，須共用 `isWeaponId` | 🟢 非阻塞（承 T2 OQ #5） | 實作者 | T5 |
| 6 | `?? 'ak47'` 字面仍散在 `loadSceneById()` 與 Controls 初始建構兩處，未收斂為 `DEFAULT_WEAPON_ID` | 🟢 非阻塞：逐位等價，純可讀性 debt（D-62.T3-3 刻意不越界） | 實作者 | 任一觸及該兩處的後續 task 順手處理 |
| 7 | 平行 session 的 `KI-035`（滑鼠 gain 過期）與本 task 的 `configureMouseIntegration` 呼叫點相鄰 | 🟡 待確認無衝突 | 實作者 | T4 開工前重讀該 KI |

---

## §T4 Session Plan 表單每列武器選單與預覽（2026-09-10）

**狀態**：✅ 完成。自訂 program 每列已有武器 `<select>`（預設 + 全部 9 把 `WEAPONS`，標籤含彈匣容量），預覽 run row 顯示武器並帶 `data-step-weapon-id`，BR 八格錯誤覆蓋會走 compiler 錯誤定位到列。frozen track DOM／submit 行為未改。

### Progress

- [x] (2026-09-10) `src/ui/SessionPlanSetup.ts`：新增 internal `EditableSessionProgramItem.weaponId?`，用 `sessionProgramItemFromEditable()` 送進 compiler 與 submit，避免預設列多出 `weaponId: undefined`。
- [x] (2026-09-10) `renderItems()`：每列插入原生 weapon `<select>`；第一項為 `—（drill 預設）`，其餘由 `Object.entries(WEAPONS)` 產生，格式為 `` `${id}（${magSize} 發）` ``。`change` handler 只更新該 item 並 `refreshPreview()`，不重繪 row。
- [x] (2026-09-10) `refreshPreview()` / `describeStep()`：預覽直接渲染 compiled program；指定 weapon 顯示該 id，未指定的一般 drill 顯示「預設」，BR 八格透過 `DECLARED_WEAPON_BY_DRILL_ID` 顯示實名。run `<li>` 新增 `data-step-weapon-id`（一般預設為 `default`，BR 自宣告與指定武器為實際 id）。
- [x] (2026-09-10) 表單說明新增兩行：無玩家 reload／目標生成補彈／連續打空停火行為、不同 `weaponId` 造成 history trend 分群。
- [x] (2026-09-10) `src/ui/SessionPlanSetup.test.ts`：補 T4 DoD 覆蓋（選項數與彈匣標籤、選武器更新預覽且 row 不重繪、BR 覆蓋錯誤定位、submit payload、兩行說明文字、ARIA）。

### 驗證

| 指令 | 結果 |
|---|---|
| `npx vitest run src/ui/SessionPlanSetup.test.ts` | ✅ **39 passed**；preview redraw 799 steps p95 **1.3032 ms** |
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| 全量 `npx vitest run` | ✅ **2,925 passed / 2 skipped**；檔案 **254 passed / 1 skipped**；preview redraw p95 **1.9079 ms** |
| `npm run build` | ⚠️ sandbox 內 Vite/esbuild 讀取上層目錄被拒（`Cannot read directory "../../../.."`）；同指令依權限規則改以非沙箱執行後 ✅ exit 0，`vite build` **195 modules transformed**，`built in 2.53s`；chunk > 500 kB 警告為既有狀態 |

**回歸基線對帳**：T3 全量 Vitest 2,919 / 2 → T4 2,925 / 2，差值 **+6** 皆在 `SessionPlanSetup.test.ts`。該檔 33 → **39 tests**。frozen track 既有 describe 區塊未改案例內容；只有 row control helper 因 custom row 新增 select 而調整位置。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T4-1** | 2026-09-10 | OQ-62.1 採預設假設：未指定 weapon 的一般 drill 在預覽顯示「預設」；BR 八格顯示自宣告實名 | T4 不把 UI 變成第二套 weapon resolution：一般 drill 的 app fallback 仍由 runtime 的 `resolveActiveWeapon()` 決定；BR 八格已有 T1 的推導 map，可在不解析 drill config 的情況下顯示實名 | 對所有未指定列顯示 `ak47`：會把 app fallback 寫死到 UI，與 T3 刻意保留的 runtime precedence 分散；對所有未指定列都顯示「預設」：會讓 BR 八格的實際武器不可見，弱化 FR-62.5 |
| **D-62.T4-2** | 2026-09-10 | OQ-62.2 採預設假設：不做 ADS × 禁 ADS drill 的非阻塞警告 | T4 的錯誤分類只沿用 compiler 的 `field/itemIndex`，不新增第二套 guard；ADS 事件與 `meta.weapon.ads` 已可在匯出後稽核。本 slice 只揭露彈匣與 trend 分群文案 | 在 UI 額外提示 ADS 風險：需要定義哪個 drill「禁 ADS」與哪個 weapon「有 ADS」的第二套規則，超出 D-62-4 的資訊揭露範圍 |
| **D-62.T4-3** | 2026-09-10 | 彈匣文案採較窄表述：「無玩家 reload；每次目標生成會補滿彈匣；若連續打空仍會停火」 | 開工期間平行文件更正指出「全 repo 無 reload」過寬：spawn-driven drill 會在目標生成時補彈。T4 仍需要揭露研究者可觀測的風險，但不得把 spawn 補彈路徑講成不存在 | 沿用 T4 原文「無 reload：彈匣打完該輪即停火」：對 spawn-driven drill 誤導；完全移除彈匣提醒：會丟掉 magSize 對資料收集的殘留風險 |
| **D-62.T4-4** | 2026-09-10 | `data-step-weapon-id` 對一般未指定 fallback 使用字面 `default`，對 BR 自宣告／指定武器使用實際 id | 文字層遵守 OQ-62.1 的「預設」假設；屬性仍給 E2E 一個穩定定位值。用 `default` 可避免把 app fallback `ak47` 提前烙進 UI | 屬性省略或空字串：E2E 不易區分「漏設屬性」與「預設」；屬性填 `ak47`：與文字決策矛盾，且形成第二個 fallback 定義 |

### Surprises & Discoveries

1. **T4 與 KI-035 無直接衝突。** 開工前重讀 `docs/known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md`，該 KI 的落點在 `main.ts` 感度／FOV 變更後重配 recorder gain；T4 只改 DOM setup 與 compiler input，不觸及 `configureMouseIntegration()`。
2. **彈匣文案需要跟上平行文件更正。** T4 原文要求「無 reload：彈匣打完該輪即停火」，但同一工作樹已出現 GD-38 inline 更正：spawn-driven drill 會於每次目標生成時補滿彈匣。本 task 因此採較窄文案，避免在 UI 裡出貨已知不準確的機制描述。
3. **`npm run build` 在沙箱內會被 Vite/esbuild 讀上層目錄擋住。** 同一指令非沙箱通過，故這次 build failure 記為環境權限，不是程式回歸。

### Open Questions（T4 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | OQ-62.1（預覽顯示） | ✅ 採 D-62.T4-1 | — | — |
| 2 | OQ-62.2（ADS × 禁 ADS drill 警告） | ✅ 採 D-62.T4-2；不新增 guard | — | — |
| 3 | `loadSceneById()` 清空 override 與 ADS/gain 不對稱 | 🟡 未決，T4 未觸及 | 實作者 | T6 e2e 觀察後判斷是否另開 KI |
| 4 | T5 提醒：`SessionPlanItemMeta.weaponId` 的 runtime 驗證在 `exportPayloadSchema.ts`，須共用 `isWeaponId` | 🟢 非阻塞 | 實作者 | T5 |
| 5 | `?? 'ak47'` 字面仍散在 `loadSceneById()` 與 Controls 初始建構兩處 | 🟢 非阻塞，T4 未觸及 | 實作者 | 任一觸及該兩處的後續 task |

---

## §T5 匯出稽核：計畫武器（意圖）與實際武器（事實）（2026-09-10）

**狀態**：✅ 完成。`SessionPlanItemMeta.weaponId?` 已在寫入端對 `isWeaponId` 嚴驗、在讀取端只驗形狀，逐列意圖與逐 run 事實（`meta.weaponId`）可對帳。frozen 軌匯出逐位不變（8 個 canonical digest 全綠）。`research/` 側**零修改**，以真實 `load_export()` 實測。

### Progress

- [x] (2026-09-10) `src/data/metadata.ts`：`SessionPlanItemMeta` 加 `readonly weaponId?: string`；`requireSessionPlanItems()` 擴充為「缺席合法 → present 先 `requireTrimmedNonEmptyString` → 再 `isWeaponId`」，錯誤訊息帶 `sessionPlanItems[i].weaponId`。**單一來源**沿用 T1 匯出的 `isWeaponId`／`WEAPONS`，不新增第二份武器清單（比照該函式對 `FAMILY_BY_DRILL_ID` 驗 `drillId` 的既有作法，KI-016）。
- [x] (2026-09-10) `src/data/exportPayloadSchema.ts`：`parseSessionPlanItems()` 加 `weaponId` 的 additive optional parse，與 `drillId` **同層**（shape-only，不對 allowlist 驗）。理由沿用該函式檔頭既有註解：寫入端嚴、讀取端寬，否則武器改名會讓歷史 run 變成讀不出來。
- [x] (2026-09-10) `main.ts` **零修改**確認：`sessionPlanAuditFields()` custom 分支的 `sessionPlanItems: activeSessionPlanSelection.items` 就是編譯器驗過的同一組物件，`weaponId` 隨型別自動帶出。已以 source 掃描斷言釘死（不是「應該會帶」而是「有斷言」，T5 步驟 3）。
- [x] (2026-09-10) frozen 分支**零修改**：只寫 `sessionPlanRestSeconds` + `sessionPlanFamilyOrder`，測試同時斷言「編譯出的 frozen run step 沒有 `weaponId` 鍵」與「frozen meta 的 `sessionPlan*` 鍵恰為那兩個」（FR-58.10／FR-62.6）。
- [x] (2026-09-10) 測試 **+21**（三個既有檔，零新增檔、零既有案例修改）：`metadata.test.ts` +9、`exportPayloadSchema.test.ts` +6、`sessionProgramExport.test.ts` +6。

### 驗證（逐項實測）

| 指令 | 結果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| `npm run build` | ✅ exit 0，`built in 1.96s`（chunk > 500 kB 警告為既有狀態） |
| `npx vitest run src/data/metadata.test.ts` | ✅ **101 passed**（本 task 前 92） |
| `npx vitest run src/data/exportPayloadSchema.test.ts` | ✅ **114 passed**（本 task 前 108） |
| `npx vitest run src/session/sessionProgramExport.test.ts` | ✅ **13 passed**（本 task 前 7） |
| 全量 `npx vitest run` | ✅ **2,946 passed / 2 skipped**；檔案 **254 passed / 1 skipped** |

**回歸基線對帳**：T4 基線 2,925 / 2（254 檔）→ 現 2,946 / 2（254 檔）。差值 **+21 = 9 + 6 + 6**，恰為本 task 新增；檔案數不變（三個都是既有檔）。**既有測試零修改、零刪除** ⇒ NFR-62.3 守住，本 task 不需要 T3 那種簽名層豁免。

**Playwright 未跑**：T5 不改 DOM／表單／runtime 路徑，全量 e2e 留在 T6（並須遵守 [§T0.6](progress.md) 的 5173 前置條件）。

### 逐位回歸：沿用既有的 8 個 canonical digest，不另起一套（DoD 第 1 條）

WP-58 T5 已在 `exportPayloadSchema.test.ts` 內建了 8 個 fixture 的 `canonicalExportJSON(parseExportPayload(x).payload)` FNV-1a digest 對表，且該表的 digest 是在 **WP-58 T5 之前**（HEAD `84483a6`）取的。本 task 不新增第二張表——**同一張表就是本 task 的逐位回歸**：`weaponId` 若哪天取得預設值、被無條件寫出、或擾動任何既有欄位，這 8 格立刻轉紅。

| Fixture | digest（本 task 後，與 WP-58 T5 前相同） |
|---|---|
| `counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` | `15c614402021931b` |
| `counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json` | `390d7578707f6ff9` |
| `counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json` | `a9555430873bfa89` |
| `counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json` | `edb34bfc5b664f17` |
| `counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json` | `d294238f1dc54df2` |
| `synthetic_counterstrafe.json` | `c159f12f895ae5f3` |
| `synthetic_counterstrafe_t1_long.json` | `2790a5da578ab390` |
| `synthetic_timeline.json` | `6b48b2f23a70b6bf` |

```bash
npx vitest run src/data/exportPayloadSchema.test.ts -t 'byte-identical'
```

### 意圖 vs 事實對帳：四列一次覆蓋（DoD 第 3 條）

`sessionProgramExport.test.ts` 新增的 program 刻意排出四種列，讓「意圖」與「事實」的**四種關係**同時出現在一份計畫裡：

| 列 | 意圖（`sessionPlanItems[i].weaponId`） | 事實（`meta.weaponId`） | 守什麼 |
|---|---|---|---|
| `hold_click_v1` ×2，指定 `m4a1s` | `m4a1s` | `m4a1s` | 指定即生效，且 **reps 的每一輪都同一把**（FR-62.3） |
| `spider-shot-v2` ×1，未指定 | **鍵不存在** | `ak47`（app 預設） | 「沒有意圖」不等於「沒有武器」 |
| BR `…__ads_off__hitscan__2deg`，指定值＝宣告值 | `ak47_br_hip_hitscan` | 同左 | 兩欄同值時**都要在**，不可被「優化」掉一個 |
| BR `…__ads_on__projectile__2deg`，未指定 | **鍵不存在** | `ak47_br_ads_projectile`（drill 自宣告） | 「把 `meta.weaponId` 抄進計畫」這種寫法會在這一列開始說謊 |

事實側一律呼叫 `resolveActiveWeapon(step.weaponId, DECLARED_WEAPON_BY_DRILL_ID.get(step.drillId))`——**`main.ts` 跑的同一個函式**，不是它的副本（C-D4；同 D-62.T3-1 的理由）。

### 四道突變實測（沿用 T1～T3 做法）：四道全紅

腳本一次改一行、跑完即還原，跑的是 `metadata.test.ts` + `exportPayloadSchema.test.ts` + `sessionProgramExport.test.ts`（乾淨基線 **228 passed**）。

| # | 突變 | 結果 |
|---|---|---|
| M1 | 寫入端 `return { drillId, reps, weaponId }` → 丟掉 `weaponId`（最平凡的「忘了帶過去」） | ✅ **5 failed** |
| M2 | 寫入端 `if (!isWeaponId(weaponId))` → 永不成立（等於開出第二個武器命名空間） | ✅ **3 failed** |
| M3 | 寫入端對未指定列改寫成 `{ drillId, reps, weaponId: undefined }`（鍵存在但值為 undefined） | ✅ **2 failed** |
| M4 | 讀取端無條件 `push({ drillId, reps, weaponId })`（讓每份 WP-58 舊 payload 都多一個鍵） | ✅ **1 failed** |

M3／M4 是本 task 特有的一對：`toEqual` 會忽略值為 `undefined` 的鍵，所以**只有明寫的 `'weaponId' in item === false` 斷言擋得住它們**。這也是為什麼正向案例裡那兩行 `in` 斷言不是贅語——它們是 NFR-62.4「不得多出 `weaponId: undefined`」在匯出側的唯一防線。

### C-D1 相容性：以真實 `load_export()` 實測，Python 側零修改（DoD 第 5 條）

`research/` 全樹 `grep -rn "sessionPlan" --include=*.py` **零命中**——ingest 從未觸碰這組欄位，`load_export()` 的 `meta=dict(meta)` 是原樣穿透。但 DoD 要的是證據不是推理，故以 `research/.venv` 跑真實 loader：baseline = committed fixture 原樣，candidate = 同一份 payload 加上 WP-58 五個 custom-program 欄位（其中兩列帶 WP-62 `weaponId`）。

```text
ticks equals   : True
events equals  : True
ticks shape    : (48, 14) (48, 14)
events shape   : (11, 24) (11, 24)
meta added     : ['sessionPlanDrillRestSeconds', 'sessionPlanItemIndex', 'sessionPlanItems', 'sessionPlanMode', 'sessionPlanRepIndex']
meta removed   : []
meta changed   : []
weaponId (fact): ak47_synthetic
plan intent    : [{"drillId": "hold_click_v1", "reps": 2, "weaponId": "m4a1s"}, ...]
RESULT         : PASS
```

`meta removed` / `meta changed` 皆空 ⇒ 既有 meta 逐鍵不變；`meta added` 恰為 WP-58 那五個（`weaponId` 在 `sessionPlanItems[]` 內，不是頂層新鍵）。**不需要改任何 Python**，故無 C-D1 邊界事件要入帳。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T5-1** | 2026-09-10 | **讀取端 `weaponId` 只驗形狀，不驗 `isWeaponId`**（寫入端才嚴驗） | 沿用 `parseSessionPlanItems()` 檔頭既有的非對稱理由：`collectMeta` 是寫入時的守門人，讀取端必須讓「當年合法、如今武器已改名／已下架」的歷史 run 仍讀得出來。若兩端都嚴驗，`WEAPONS` 的任何一次改名都會讓既有 history 條目變成無法載入 | ① 兩端都用 `isWeaponId`：一致但會把武器表變成歷史資料的相容性契約，任何改名都是 breaking change；② 讀取端驗但只記 warning：需要在 parser 引入第三種錯誤等級，超出本 task 範圍且該檔目前沒有 warning 概念 |
| **D-62.T5-2** | 2026-09-10 | **不新增本 task 專屬的 digest 表**，直接沿用 WP-58 T5 的 8 格 | 那 8 格的基準是 WP-58 T5 **之前**的 HEAD，涵蓋範圍比「T5 前 vs T5 後」更寬；再開一張表只是把同一件事量兩次，而且第二張表的基準較晚、抓得較少 | 依 T5 步驟 7 字面另取一組 T5-前 digest：可行但嚴格較弱（基準較晚），且會在同一檔留下兩張語意重疊的表，未來改動時不知該更新哪張 |
| **D-62.T5-3** | 2026-09-10 | **`main.ts` 完全不改**，改以 source 掃描斷言 `sessionPlanItems: activeSessionPlanSelection.items` 與「frozen 分支不含 `weaponId`／`sessionPlanItems`」 | 型別上 `SessionProgramItem` 已可賦值給 `SessionPlanItemMeta`，`weaponId` 本來就會穿透——真正的風險不是「現在沒帶」，而是「日後有人在中間插一層 map 把它濾掉」。掃描守的正是那個未來的迴歸；`main.ts` 是 WebGPU/DOM top-level 腳本，Vitest 起不動（同 T3 的處置） | ① 在 `sessionPlanAuditFields()` 顯式列出 `weaponId`：等於在排程層外再寫一次欄位清單，`warmup` 之外多出第二處要同步的地方；② 完全不斷言、只靠型別：型別擋不住「顯式 map 掉某個欄位」這個最可能的迴歸 |

### Surprises & Discoveries

1. **`toEqual` 對 `undefined` 值的鍵是無感的，所以 NFR-62.4 需要專屬斷言。** M3／M4 兩道突變（把鍵寫成 `weaponId: undefined`）在 `toEqual` 下**完全綠**；只有 `'weaponId' in item === false` 抓得到。這是 T2 在編譯器側已經處理過的同一個陷阱在匯出側的第二次現身——「省略」與「值為 undefined」在 JSON 序列化後才會分家，而測試預設的比較器早在那之前就已放行。
2. **`metadata.ts` 早已有自己的 `DEFAULT_WEAPON_ID = 'ak47'`（第 17 行），與 T3 新增的 `weapons.ts` `DEFAULT_WEAPON_ID` 同值但各自定義。** 本 task 只 import `isWeaponId`，未動這兩個常數（越界）。兩者目前逐位等價，但這是第二個 `'ak47'` 字面的來源——與 T3 OQ #6 記的兩處是同一類 debt，一併記在下方 OQ。
3. **本 task 全程未改任何既有測試案例**，這與 T3（簽名層改動必然波及 `toHaveBeenCalledWith` 的 arity 比對）形成對照：純資料欄位的 additive 擴充**真的**可以做到零既有測試修改，T3 的豁免確實是簽名層專屬的例外而非通則。

### Open Questions（T5 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | `loadSceneById()` 清空 override 與 ADS/gain 不對稱（承 T3 OQ #4／T4 OQ #3） | 🟡 未決，T5 未觸及 | 實作者 | T6 e2e 觀察後判斷是否另開 KI |
| 2 | `'ak47'` 的字面／常數目前有三處來源：`weapons.ts` `DEFAULT_WEAPON_ID`（T3 新增，權威）、`metadata.ts` `DEFAULT_WEAPON_ID`（既有）、`main.ts` 兩處 `?? 'ak47'`（承 T3 OQ #6） | 🟢 非阻塞：三者逐位等價，純可讀性 debt | 實作者 | 任一觸及該三處的後續 task 順手處理 |
| 3 | T6 提醒：本 task 的 frozen 逐位不變只驗到 **meta 鍵集合 + 8 個 canonical digest**（unit 級）；**真實 frozen live e2e 的逐份匯出**仍是 T6 的職責，不可視為已由 T5 涵蓋 | 🟢 非阻塞 | 實作者 | T6 |
| 4 | T6 提醒：`session-orchestrator.spec.ts` 的 live run 若加上逐列武器案例，應順帶斷言匯出的 `sessionPlanItems[].weaponId` 與 `meta.weaponId` 對得上（本 task 只在 unit 級對帳，沒有走過真實瀏覽器） | 🟢 非阻塞 | 實作者 | T6 |

---

## §T6 E2E 整合與 frozen 逐位不變回歸（2026-09-10）

**狀態**：✅ 完成。`session-orchestrator.spec.ts` 擴充 3 條（不新開平行 spec）：DOM 正向逐列選武器、DOM 負向 BR 實驗格覆蓋、live 逐列武器實跑並解析匯出對帳。frozen live 匯出的 meta 鍵面以 `f0df84d`（本 WP 前 HEAD）實跑取得的 digest 釘死，**跑出來一模一樣**。`npm run test:ci` exit 0。

### Progress

- [x] (2026-09-10) `tests/e2e/session-orchestrator.spec.ts` +3 tests（15 → **18**），全部落在既有 `describe` 內：
  - `WP-62 T6：每列各選一把武器 → 預覽逐步顯示該步武器 → 送出`（FR-62.1／62.3／62.5／62.7）；
  - `WP-62 T6：覆蓋 BR 實驗格武器 → 標紅該列且禁用提交；改回宣告值即解除`（FR-62.2／FM-2）；
  - `WP-62 T6：逐列武器實跑 —— 每份匯出的 meta.weaponId 對得上該列選擇，意圖與事實一致`（FR-62.1／62.3／62.4）。
- [x] (2026-09-10) `runLiveSessionPlan()` 由「只數下載檔名」擴為**同時解析下載內容**（新增 `metas`）。custom／frozen／abort 三條 live 案例共用同一個 helper，frozen 因此免費取得逐份匯出的稽核能力。
- [x] (2026-09-10) frozen live 案例新增三層 FR-62.6 斷言：`sessionPlan*` 鍵恰為 `sessionPlanFamilyOrder`＋`sessionPlanRestSeconds`、`sessionPlanItems` 缺席、`meta.weaponId === 'ak47'`，外加整個 meta 鍵面的 digest 對表。
- [x] (2026-09-10) 更新既有 WP-58 T6 預覽文字斷言（T4 改了 `describeStep()` 的唯一 e2e 犧牲者，見 Surprises 1），並**同時加嚴**：逐 run 釘死 `data-step-weapon-id`。

### 驗證（`npm run test:ci` exit 0，逐項實測）

| 指令 | 結果 |
|---|---|
| `npm run test:ci`（兩個 typecheck + 全量 Vitest + 全量 Playwright，preview webServer 內含 `vite build`） | ✅ **exit 0** |
| 全量 Vitest（`npx vitest run`） | ✅ **2,946 passed / 2 skipped**；檔案 **254 passed / 1 skipped**，17.96s |
| 全量 Playwright（`test:ci` 預設 fullyParallel） | ✅ **106 passed / 0 failed / 0 flaky（7.0m）** |
| 單檔 `session-orchestrator.spec.ts --workers=1` | ✅ **18 passed（11.7m）** |
| `tsc --noEmit --strict` 直接掃 `session-orchestrator.spec.ts`（補 `npm run typecheck` 的 `include: ["src"]` 缺口，T6 步驟 5 的警告） | ✅ exit 0 |

**回歸基線對帳**：

| | T0 基線 | T5 | T6 | 差值 |
|---|---|---|---|---|
| Vitest tests | 2,822 / 2 skipped | 2,946 / 2 | **2,946 / 2** | **0**（T6 不新增 unit 測試） |
| Vitest files | 252 / 1 skipped | 254 / 1 | **254 / 1** | 0 |
| Playwright tests | 103 | —（未跑） | **106** | **+3**，恰為本 task 三條新案例 |

只增不減；既有 Vitest 測試零修改。既有 Playwright 案例修改**一條**（下方 D-62.T6-2 明帳）。

### frozen 逐位不變：實作方式與偏離（DoD 第 4 條）

`f0df84d`（本 WP 前最後一個未動 `src/` 的 commit）另開 worktree、掛同一份 `node_modules`、**放進同一份 spec** 實跑 frozen live e2e 取基準，量完即 `git worktree remove`。兩次跑的 digest：

| Fixture（frozen live run，依序） | `f0df84d` 基準 | 本 WP HEAD | 一致 |
|---|---|---|---|
| `detection_popin_v1` | `2752c07b` | `2752c07b` | ✅ |
| `spider-shot-wide-v1` | `2752c07b` | `2752c07b` | ✅ |
| `tracking_scene_v1` | `2752c07b` | `2752c07b` | ✅ |

digest = FNV-1a over `Object.keys(meta).sort().join(',')`（與 `exportPayloadSchema.test.ts` 同一個雜湊）。**偏離說明見 D-62.T6-1：比的是鍵面不是整份 payload。**

### 意圖 vs 事實對帳：live 匯出的實際值（DoD 第 1／2 條）

測試名 `WP-62 T6：逐列武器實跑 —— 每份匯出的 meta.weaponId 對得上該列選擇，意圖與事實一致（FR-62.1/62.3/62.4）`。三列同一個 `tracking_scene_v1`（讓武器成為唯一變因），四份匯出實測值：

| 匯出 | `sessionPlanItemIndex` / `RepIndex` | 事實 `meta.weaponId` | 意圖 `sessionPlanItems[i].weaponId` | 守什麼 |
|---|---|---|---|---|
| 1 | 0 / 0 | `m4a1s` | `m4a1s` | 指定即生效 |
| 2 | 0 / 1 | `m4a1s` | `m4a1s` | **同一列第二輪仍是同一把**（FR-62.3；本 WP 前這裡會被 `activateDrill()` 清成 `ak47`） |
| 3 | 1 / 0 | `usp_s_laser` | `usp_s_laser` | 換列即換槍 |
| 4 | 2 / 0 | `ak47` | **鍵不存在** | 「沒有意圖」≠「沒有武器」 |

四份匯出的 `meta.sessionPlanItems` 皆為完整計畫且第三列**無 `weaponId` 鍵**（以 `'weaponId' in item === false` 明寫，`toEqual` 對值為 `undefined` 的鍵無感——T5 §Surprises 1 的同一個陷阱）。

### 環境陷阱檢查（DoD 第 6 條）

| 項目 | 跑前 | 跑後 | 判讀 |
|---|---|---|---|
| port 5173 歸屬 | **free**（無他人 dev server） | free | Playwright 自起 dev pid 38768 / preview pid 35588，各自持有 `.playwright-tmp/history-{dev,preview}/.history-root.lease` ⇒ `reuseExistingServer` 未誤接他人 server |
| `.playwright-tmp/history-dev` 目錄數 | 144 | **171**（+27，全量 Playwright 的 history 案例所致） | 遠低於記憶中會出事的「上千個」，本次非嫌疑 |
| 真實 root `data/session-history/` 項數 | **41** | **41** | 零污染 |
| 真實 root 新檔（`find -newermt "12:00" ! -name .history-root.lease`） | 空 | **空** | 零污染（逐項證據，非概括宣稱） |

⚠️ **T0 §6 的陷阱第二次現身**：`data/session-history/.history-root.lease` 期間被 **pid 50248**（12:51:53Z）取得，該 pid 非 Playwright 起的兩個 server 之一；查證時該 process **已結束**，屬殘留 lease，且如上表**未寫入任何資料**。與 T0 同一結論：IDE 擴充等非 `playwright.config.ts` 管的 server 仍會搶真實 root，光關手動 dev server 不夠。

### Decision Log

| # | 日期 | 決定 | 理由 | Alternatives considered |
|---|---|---|---|---|
| **D-62.T6-1** | 2026-09-10 | frozen「逐位不變」在 live e2e 落成**三層斷言 + meta 鍵面 digest**，而非整份 payload 逐位比對 | 真實 frozen run 的 payload 內含時間戳、逐 tick 資料與命中統計，**兩次跑本來就不同** ⇒ 對整份 payload 取 digest 不是嚴格，是釘死 flake。WP-62 唯一可能弄壞 frozen 匯出的方式是**改變它寫哪些欄位**，鍵面正是那個面 | ① 整份 payload digest：不可能綠，且第一次紅就會被當成環境問題關掉；② 只靠 T5 的 8 個 canonical fixture digest：unit 級、跑的是 committed fixture，**不涵蓋真實 frozen live run**（T5 OQ #3 明文把這件事留給 T6） |
| **D-62.T6-2** | 2026-09-10 | **修正**（非放寬）既有 WP-58 T6 的預覽文字斷言 `expect(steps[0].text)`，並在同一處**加嚴**逐 run 的 `data-step-weapon-id` | T4 把 `describeStep()` 的 run row 文案加上「· 武器 X」卻標記「Playwright 未跑，留到 T6」⇒ 這條斷言自 T4 起就是紅的。T6 是它的收斂點；斷言的**語意**未變（仍釘死預覽逐字），只換成新文案，並多釘一個屬性 ⇒ 符合 T6 invariant「新增可以、放寬不行」 | ① 刪掉該行：會丟掉「預覽文字由編譯器輸出決定」的唯一 e2e 證據；② 改成 `toContain`：那才是放寬，且會讓下一次文案漂移無聲通過 |
| **D-62.T6-3** | 2026-09-10 | live 案例用**同一個 drill**（`tracking_scene_v1`）三列 + 四輪，而非三個不同 drill | 武器成為唯一變因 ⇒ 匯出對不上時不可能推給 drill 差異；且 `tracking_scene_v1` 是 roster 中最短的 scene-pinned 自終止 drill（~23 s），四輪 ≈ 1.7 分鐘，比三個不同 drill 便宜一個數量級 | ① 三個不同 drill（沿用 `PROGRAM_DRILLS`）：貴 5 倍且引入 drill 這個混淆變因；② 只跑兩列：無法同時涵蓋「同列兩輪同一把」與「不指定 → app 預設」 |

### Surprises & Discoveries

1. **T4 的預覽文案改動讓既有 e2e 從 T4 當下就是紅的，T6 第一次跑就撞到。** T4 的驗證表六道全綠、`progress.md` 記「Playwright 未跑：T4 只改 DOM setup」——但改的正是 `describeStep()` 的回傳字串，而那個字串有 e2e 逐字斷言。**六道閘裡沒有一道會告訴你這件事**：`npm run typecheck` 不掃 `tests/`，Vitest 不跑 e2e。⇒ 教訓與 T0 §4 的「typecheck 守備範圍比直覺窄」同源：**只要改動的是會被 e2e 逐字斷言的使用者可見字串，就不能把 Playwright 推到下一個 task**。
2. **三個 frozen drill 的 meta 鍵面 digest 完全相同（`2752c07b`）。** 原以為要三個不同值（`spiderShot`／`tracking` 等 drill 專屬欄位），實測是這三個代表 drill 在 frozen 軌下寫出的鍵集合**逐字相同**。保留三格對表而非收成一格，是因為「哪天某個 drill 開始多寫一個欄位」正是這張表要抓的東西。
3. **`node_modules` 用 directory junction 掛進量測 worktree 可行**，省掉一次完整 `npm ci`；量完 `git worktree remove --force` 後主 checkout 的 `node_modules` 完好（已覆驗 `npx playwright --version`）。
4. **`meta.weaponId`（頂層，事實）與 `meta.weapon.id`（武器快照）是兩個不同欄位**：`weapon-select.spec.ts`（WP-47 契約守門人）讀的是後者，本 task 讀的是前者。兩支 spec 在本次全量 Playwright 中同時綠 ⇒ T3 改動 `activateDrill()` override 賦值與 `setSelectedWeapon()` 讀取來源後，WP-47 的 reset-per-drill 契約**未被破壞**（T3 特別點名要 T6 覆驗的那件事，此處結案）。

### Open Questions（T6 結束時）

| # | 問題 | 狀態 | Owner | 需在何時收斂 |
|---|---|---|---|---|
| 1 | `loadSceneById()` 清空 override 與 ADS/gain 不對稱（承 T3 OQ #4／T4 OQ #3／T5 OQ #1） | 🟡 **仍未決**。T6 的 e2e **未觀察到**該路徑：Session Plan 執行中不碰 Controls 場景下拉，故 live 案例天然走不到它 ⇒ 「T6 e2e 觀察後判斷」這個收斂條件**無法由 T6 滿足** | 實作者 + 研究者 | **T-exit**（判斷是否另開 KI；選項仍為 T0 §5 收斂的 ②／③） |
| 2 | `'ak47'` 三處來源的可讀性 debt（承 T5 OQ #2） | 🟢 非阻塞，T6 未觸及 | 實作者 | 任一觸及該三處的後續 task |
| 3 | 全量 Playwright 的基準跑法不一致：T0 用 `--workers=1`（103，13.8m），T6 的 `npm run test:ci` 用預設 fullyParallel（106，7.0m） | 🟢 非阻塞：兩者本次皆 0 failed／0 flaky，且 T6 另以 `--workers=1` 單檔覆驗過本 task 的 18 條 | 實作者 | T-exit 記錄時擇一為準即可 |
