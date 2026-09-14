# WP-63 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-14 T5 完成）

✅ **T6 完成**（2026-09-14）。`src/metrics/microFlickMetrics.ts` 補上 **L2 免閾值微調描述子**（FR-63.10：`reEntryCount`／`dwellPathRatio`／`signReversalCount`／`approachToFireMs`）與**擊殺後方向預測曲線**（FR-63.11，逐 `W ∈ {30,60,90,120} ms`）。四個描述子無速度門檻、無平滑窗、無峰值偵測，`submovement.ts` 一行未動；角半徑讀 `meta.targets.hitbox` 並與 ray/sphere 命中判定恆等（GD-7）。25 個新測試全綠（檔內 50 → **75**）、全量 Vitest **3,335 passed**（T5 基線 3,310，**+25 = 本 task**）、typecheck ×2 與 `vite build` exit 0。五條決策（D-63.T6-1～5），其中 **D-63.T6-1 放寬了 T4 的「模組零三角換算」掃描**，單獨列帳。T7 與 T-exit 未開工。

> ⚠️ **T-exit 待辦（本 task 產生）**：README §2.5 的 `microAdjust`／`direction` 簽名（D-63.T6-5）與 §4.1 相依圖的 `T5 → T6`（D-63.T6-4）須同步更正。

✅ **T4 完成**（2026-09-14 16:29Z）。`src/metrics/microFlickMetrics.ts` 交付 L0 結果層（FR-63.6）＋ L3 選擇策略層（FR-63.4／63.5）；26 個新測試全綠、全量 Vitest 3,286 passed（T3 基線 3,260，**+26 = 本 task**）、typecheck ×2 與 `vite build` exit 0。**可比性前置檢查判定兩群不可比** ⇒ `replacementEngagedRate` 依 [README §3.1](README.md) 只出分層值（`replacementEngagedByRank`）、不出總量（見 §T4 與 D-63.T4-3）。`T_valid` 的錨點與 FM-4 的處置各有一條偏離規劃期字面的決策（D-63.T4-1／D-63.T4-2）。T5–T7 未開工。

✅ **T3 完成**（2026-09-14 15:42Z）。`src/metrics/targetWindows.ts` 交付 `buildTargetWindows()` + `aliveAt()`；27 個新測試全綠、NFR-63.4 符號掃描 count === 0、NFR-63.3 實測 **0.914 ms**（63 窗／7,682 ticks）與 **5.187 ms**（180 窗／22,658 ticks），遠低於 50 ms 門檻。五個 canonical derivation 檔 `git diff` 為空。**T1 的 FR-63.13 判準 `ammo === 0` 經實作複核為不可達，已就地更正為「扣彈前存量觸底」**（見 D-63.T3-2）。T4–T7 未開工。

✅ **T2 完成**（2026-09-14）。[KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) 以 **(a)+(b) 併行**修復並以 **`BD-039`**（非規劃期寫的 `BD-035`，已撞號）入帳：感度／FOV 變更即時把新 gain 推進 recorder，且錄製中（`countdown`/`running`）停用兩個滑桿。OQ-63.4 關閉。T3–T7 未開工。

✅ **T1 完成**（2026-09-14 14:52Z）。v8 宣告 `weaponId: 'usp_s_laser'`，斷代靠 `meta.weaponId`；NFR-63.7 以「同 kill order 下換武器 spawn trace 逐位相同（且雙方皆有實際開火）」+「`sampleSpread()` 對本武器 rng 呼叫數 === 0」兩條機械證據釘死。（當時）T2–T7 未開工；OQ-63.1 仍以具名預設假設推進（研究者未回覆）。

✅ **T0 entry gate 完成**（2026-09-14 12:38Z）。編號、上游與機制事實已複核；GD-44 的 Edge 全量／chromium-ci fast 與 typecheck、Vitest、build 五項正式基線 exit 0。

規劃來源：2026-09-10 的設計對話（使用者指定四項計算 → 逐項稽核蒐集層 → 依 `.claude/skills/engineering-planning/SKILL.md` 落成執行計畫）。

---

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry gate | ✅ 完成 | 2026-09-14 | 2026-09-14 12:38Z | 見下方 §T0：五項基線 exit 0，Vitest 3,217 passed／2 skipped、Edge 115 passed、chromium-ci fast 102 passed／1 skipped、build 203 modules；編號、上游、五個 CodeGraph impact、三項機制與 OQ-63.1 明帳。 |
| T1 零散布武器宣告 | ✅ 完成 | 2026-09-14 | 2026-09-14 14:52Z | 見下方 §T1：typecheck ×2 exit 0、全量 Vitest **3,224 passed／2 skipped（267 files）**（≥ T0 基線 3,217）、`vite build` exit 0、`micro-flick-live.spec.ts` 6/6 passed。 |
| T2 Mouse gain 修復 | ✅ 完成 | 2026-09-14 | 2026-09-14 | 見下方 §T2：typecheck ×2 exit 0、全量 Vitest **3,233 passed／2 skipped（268 files）**（≥ T1 基線 3,224）、`vite build` exit 0、GD-44 Tier 1 **102 passed／1 skipped**（= T0 基線）、Tier 2 Edge 全量見該節。`BD-039` 已入帳、KI-035 翻 ✅。 |
| T3 窗界 primitive | ✅ 完成 | 2026-09-14 | 2026-09-14 15:42Z | 見下方 §T3：typecheck ×2 exit 0、全量 Vitest **3,260 passed／2 skipped（269 files）**（≥ T2 基線 3,233，+27 = 本 task 新增）、`targetWindows.test.ts` 27 passed、NFR-63.3 實測 0.914 ms／5.187 ms、NFR-63.4 掃描 count === 0。 |
| T4 L0 + L3 | ✅ 完成 | 2026-09-14 | 2026-09-14 16:29Z | 見下方 §T4：26 tests 綠、全量 Vitest 3,286 passed／2 skipped、typecheck ×2 與 build exit 0；可比性檢查 p10/p50/p90 入帳。 |
| T5 L1 幾何層 | ✅ 完成 | 2026-09-14 | 2026-09-14 16:40Z | 見下方 §T5：50 tests 綠（+24）、全量 Vitest 3,310 passed／2 skipped、typecheck ×2 與 build exit 0；D1–D6 六份對抗性 fixture 各有具名測試；五個 canonical derivation 檔 `git diff` 為空。 |
| T6 L2 + 方向 | ✅ 完成 | 2026-09-14 | 2026-09-14 | 見下方 §T6：75 tests 綠（+25）、全量 Vitest 3,335 passed／2 skipped（T5 基線 3,310）、typecheck ×2 與 `vite build` exit 0；E1–E5 五份 fixture 各有具名測試；門檻常數掃描五個字串 count === 0；六個 canonical derivation 檔 `git diff` 為空。 |
| T7 Harness + 紀律 | ⬜ 未開工 | — | — | — |
| T-exit | ⬜ 未開工 | — | — | — |

---

## T0 Entry gate（2026-09-14；worktree `codex/wp-63-t0`，基線 HEAD `bc467c49`）

### 編號與上游

| 檢查 | 2026-09-14 重查結果 |
|---|---|
| WP 編號 | [`exec-plan/README.md §2`](../../../README.md) 目前最大採納號 **WP-67**；[WP-63 索引列](../../../README.md) 已明確指向本資料夾，故 **WP-63 保留、不順延**。 |
| GD 編號 | [`DECISIONS.md`](../../../DECISIONS.md) 最大已落帳號 **GD-44**；**GD-39 無已落帳標題**，仍為本 WP 已預留的草稿號，T0 不佔用新號。T-exit 入帳前須再重查，若屆時號已被取用，依 GD-15 順延。GD-43 由 WP-67 預約，不動。 |
| stage14 候選 | [stage14 §3](../../stage14/README.md) 已有 2026-09-12 權威註記：WP-66／67 再被採納後，候選應為 **WP-68／69／70**；該表仍顯示過時的 66／67／68，但本 T0 不替未批准草案改寫。 |
| WP-56 | [progress.md 的 T-exit Evidence Log](../../stage12/wp-56-micro-flick-test-scene/progress.md)：**Complete（2026-09-07）**，FR/NFR、全量 Vitest／build／Playwright 已入帳；三顆 population 生命週期可用。 |
| WP-59 | [README Progress](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md)：**T3 完成（2026-09-08）**，T4 與 T-exit 仍未勾；T3 的 2,000-run stress corpus 為現有證據。本 WP 不以其 T-exit 為前置；T4 比較角距分布須註明所用 HEAD。 |
| WP-60 | [progress.md T-exit](../wp-60-raw-mouse-sample-capture/progress.md)：**✅，TF1–TF3 亦關閉（2026-09-09）**；[T0 R1 實機讀數](../wp-60-raw-mouse-sample-capture/T0-entry-gate.md) 為瞬時約 **1005 Hz**、dt p50 **995 µs**，取樣串流可用。 |

### NFR-63.6 基線實測

五項均在本 worktree、未修改任何 `src/` 或測試的 HEAD `bc467c49` 上執行。依賴以 `npm.cmd ci --offline` 安裝到本 worktree；曾用 junction 的第一次 build 因 sandbox 的 esbuild 目錄存取拒絕失敗，移除 junction、獨立安裝後 sandbox 仍拒絕讀取 `vite.config.ts`，在 sandbox 外重跑成功。這是執行環境限制，不能把失敗當程式碼回歸。

**舊規劃指令的實測失敗**：`npx.cmd playwright test --workers=1` 在 GD-44 的雙 project 設定下計畫執行 **230 tests**。Edge **115/115 通過**；進入 chromium-ci 後，真 GPU 專用的 `hit-feedback-live.spec.ts` `@realgpu` 三例連續失敗（第 150–152 例，SwiftShader 下沒有穩定命中／Pointer Lock）。已中止該不符合 [GD-44](../../../DECISIONS.md) 分層的舊指令，exit **1**。這不是 WP-63 source 回歸；T0 的正式基線改採下表 Edge 全量與 chromium-ci fast 各自 exit 0，保留這次失敗紀錄以便稽核。

| 指令 | exit code | 當次實測數字 |
|---|---:|---|
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` 與 `tsc --noEmit -p tsconfig.node.json` 兩段皆成功。 |
| `npm.cmd test` | **0** | Vitest **266 files passed／1 skipped（267）**；**3,217 tests passed／2 skipped（3,219）**；12.81 s。 |
| `npm.cmd run test:e2e -- --workers=1` | **0** | GD-44 Tier 2：Edge 全量，**115 passed／0 skipped**，**18.3m**。真 GPU `@realgpu` 案例含在內；由本 worktree 的 5173／4173 server 執行。 |
| `npm.cmd run test:e2e:fast -- --workers=1` | **0** | GD-44 Tier 1：chromium-ci，排除 `@slow|@realgpu`；**102 passed／1 skipped（103）**，**11.7m**；由本 worktree 的 5173／4173 server 執行。 |
| `npm.cmd run build` | **0** | `tsc` 兩段成功；Vite 6.4.3 **203 modules transformed**、2.03 s；保留既有 chunk-size warning。 |

### CodeGraph impact（當下 index up to date）

逐一執行 `codegraph.cmd impact <symbol> -j -p .`（預設 depth 2），並以 `codegraph.cmd callers <symbol> -j -l 1000 -p .` 計算直接 caller。caller 條目含檔案節點，因此另列非檔案符號數與 distinct file 數，避免把兩種計數混稱。`graphify-out/GRAPH_REPORT.md` 宣告建自 `8e03f9d6`，落後本 HEAD `bc467c49`，此處以 up-to-date 的 CodeGraph 與原始碼為準。

| 符號 | 直接 caller 條目 | 非檔案 caller | distinct files | depth-2 impact nodes | 判定 |
|---|---:|---:|---:|---:|---|
| `buildPeekWindows` | 26 | 12 | 14 | 50 | cross-module，**不改** |
| `resolveEyeOrigin` | 24 | 11 | 13 | 75 | cross-module，**只讀** |
| `omegaDegPerSec` | 11 | 5 | 6 | 33 | cross-module，**只讀** |
| `createDataRecorder` | 64 | 35 | 34 | 75 | cross-module，**不改** |
| `microFlickThreeTargetTestV8` | 6 | 0 | 6 | 21 | fixture 變更會波及 `main.ts`／session consumer；T1 回歸保護 |

`impact` 對 `resolveEyeOrigin`、`createDataRecorder` 均回報 75 個節點；這是本次 depth-2 查詢的回傳值，**不得當成全域影響上界**。此 T0 僅更動 WP-63 文件，程式碼 blast radius 為零；未來 T1–T3 仍須依各自 HEAD 重查。

### README §0.4 機制事實親自複核

| 機制 | 原始碼位置與結論 |
|---|---|
| `spawn()` 補彈及三個呼叫點 | **已親自確認**：[TargetManager.ts:582](../../../../../src/sim/TargetManager.ts) 定義 `spawn()`；[585](../../../../../src/sim/TargetManager.ts) 執行 `state.weapon.ammo = state.weapon.magSize`；呼叫點為 **617、644、647**，涵蓋 legacy 與 population。 |
| 零散布不耗 RNG | **已親自確認**：[spread.ts:28-32](../../../../../src/recoil/spread.ts) 在 `inaccuracy === 0` 時於第 29 行回 `{x: 0, y: 0}`；RNG 呼叫從第 31 行才開始。 |
| `usp_s_laser` 規格 | **已親自確認**：[weapons.ts:82-100](../../../../../src/weapon/weapons.ts) 為 `cycletimeSec: 0.17`、`magSize: 12`、`recoil.magnitude: 0`、stand/crouch/fire/move inaccuracy 全 0，且無 `ads` 區塊。 |

### OQ-63.1 與 GD-39 草稿

**OQ-63.1：以預設假設推進（2026-09-14 11:42Z）**。已向研究者詢問既有 v8 匯出是否為 frozen cohort；T0 記錄採 README §1.4 的非阻塞預設「否」，故 T1 預設直接改 v8 fixture 並以 `meta.weaponId` 斷代。若研究者在 T1 開工前回覆「是」，改走 v9 fixture 並同步改 FR-63.12／§3.1。此處不是研究者的肯定回覆。

**GD-39 草稿（不入帳，T-exit 再重查號）**：① WP-63 依 2026-09-10 指示寄放 stage13，明帳其量測窗界部分較接近 stage14；② v8 指標一律事件錨定，不新設 movement-onset，日後若需偵測式錨點，先解 KI-031／KI-034 並用 canonical `t_detect`；③ GD-38 ② 的更正已在原條 inline 入帳，此處只指回其機制事實：`spawn()` 每次補彈，且 locked translation 使 counter-strafe 論證不適用 v8；④ 可在 v8 逐 drill 指定 `usp_s_laser`，以 `meta.weaponId` 區分前後世代，維持不做全域 pin；⑤ 本 WP 的交付宣稱限「可算、可重現、可稽核」，C-D3 未過不得進教練報告。

---

## T1 零散布武器宣告（2026-09-14）

### 斷代宣告（T1 Steps 6）

**T1 之後的 `micro_flick_three_target_test_v8` 匯出與之前的不可混比。** 變的不是 spawn 分布（WP-59 的等級），而是**命中判定的隨機性本身**：pre-T1 的 v8 吃 `main.ts` 預設 `ak47`（`inaccuracy.stand 0.00641` / `fire 0.0078` 的 seeded spread + `recoil.magnitude 25` 的 aim punch + `ads.fovDeg` 縮 FOV），post-T1 的 v8 是 `usp_s_laser`（三者皆 0／不存在）。

**機械區分方式 = 匯出的 `meta.weaponId`**（`'ak47'` vs `'usp_s_laser'`）。分析側**不得**以 drillId 合併兩批資料。

**副作用（明帳，承 D-63-P3）**：`cycletimeSec` 由 ak47 的 **0.10** 升為 **0.17** ⇒ 最小發間隔 170 ms，補槍的時間懲罰是 ak47 的 1.7 倍。這是 FR-63.9 必須把 `correctionMs` 拆成 `settlingMs` + `cadenceWaitMs` 的直接理由，也是 T5 不可省略該拆解的原因。`magSize` 由 30 降為 **12**。

### FR-63.13 彈匣契約（T1 Steps 7；實作落 T3）

**離線判準 = 窗內存在 `fire.ammo === 0` 的 `fire` 事件。** 兩個前提已在本 task 確認：

> ⚠️ **T3 就地更正（2026-09-14）**：上面這條字面判準**在真實匯出上永遠不成立**。[`SimLoop.ts:510`](../../../../../src/loop/SimLoop.ts) 記的 `ammo` 是**本發扣彈前**的存量（扣彈在 551 行），而 [538 行](../../../../../src/loop/SimLoop.ts) 的 while gate 是 `ammo > 0` ⇒ 能被記到的最小值是 **1**（＝這發打完就空倉）。T3 的實作判準改為 **`ammo <= 1`**，並保留 `0` 的涵蓋以防手工 fixture 與未來 schema 變動。下方「不得假設窗內 `ammo` 單調」的警告仍然成立且已照做（逐事件判，不假設單調）。詳見 D-63.T3-2。

1. `fire` 事件的 `ammo` 欄位在 v8 匯出中**無條件存在**（[`SimLoop.ts`](../../../../../src/loop/SimLoop.ts) `recordFire` 路徑非選填欄位）。
2. run 起始彈匣 === `usp_s_laser.magSize === 12`，由本 task 新增測試 `starts every magazine at the declared size` 斷言（`state.weapon.magSize` 與 `state.weapon.ammo` 皆為 12）。

⚠️ **`ammo` 不是單調遞減的**：`spawn()` 每次補滿彈匣（D-63-P4），v8 每殺一顆就 spawn ⇒ T3 實作 `ammo_exhausted_in_window` 時**不得**假設窗內 `ammo` 單調，必須逐事件判 `=== 0`。本 task 的 trace harness 已實地踩到這一點（見下方 Surprises 7）。

### NFR-63.7 的兩條機械證據

| 證據 | 測試 | 結果 |
|---|---|---|
| 換武器不擾動 seeded spawn 串流 | `swapping the weapon does not perturb the seeded spawn stream, even under live fire` | ak47 與 `usp_s_laser` 兩次 96-snapshot trace 的 **7 個欄位逐筆 `Object.is` 相同**；兩次 `shotsFired` 皆 > 0 且相等（實測各 4 發），故比較不是「沒人開槍」的空對空 |
| 零消耗 spread RNG | `never draws from the shared seeded stream, because sampleSpread early-returns` | 3 種 speedRatio + 12 發 `recoilOnFire` 後共 15 次 `sampleSpread()`，counting rng 呼叫數 **0**；對照組 ak47 同一 harness 呼叫數 > 0 |
| recoil 表逐筆 0 | `generates a bit-zero recoil table, so aim punch never moves the recorded view` | 全表 `angleDeg`／`magnitude` 皆 `Object.is(x, 0)`；12 發後 `aimPunch*`／`viewPunch*` 皆 0 |

### 驗證輸出

| 指令 | exit code | 數字 |
|---|---:|---|
| `npx.cmd vitest run src/drill/micro_flick_three_target_test_variants.test.ts` | **0** | 10 passed |
| `npx.cmd vitest run src/drill/micro_flick_three_target_test_v8_weapon.test.ts` | **0** | 6 passed |
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` ×2 皆成功 |
| `npm.cmd test` | **0** | **267 files passed／1 skipped**；**3,224 tests passed／2 skipped**（T0 基線 3,217 passed，**+7 = 本 task 新增**） |
| `npm.cmd run build` | **0** | Vite 203 modules、2.58 s，保留既有 chunk-size warning |
| `npm.cmd run test:e2e:fast -- --workers=1 tests/e2e/micro-flick-live.spec.ts` | **0** | 6 passed（1.4m）。該 spec 是全 repo 唯一載入 v8 的 e2e |


## T2 Mouse gain 修復（KI-035 / BD-039）（2026-09-14）

### OQ-63.4 收斂：(a)+(b) 併行

T2 Steps 1 要求「先確認 (b) 是否會讓既有 E2E 轉紅」。**實測：不會。** 全 repo 唯一操作感度／FOV 滑桿的
e2e 是 [`spider-shot-wide.spec.ts`](../../../../../tests/e2e/spider-shot-wide.spec.ts) 的 `setFov()`
（`#settings-panel` 內 FOV 那列，以 `dispatchEvent(new Event('input'))` 驅動）。加上 handler guard
之後單跑該 spec **4/4 passed**，與未加 guard 的對照組同樣 4/4。

原因（實測前的推測是錯的，記下來以免後續重蹈）：`harness.startDrill()` 跑的是
[`fpsTestHarness`](../../../../../src/testharness/fpsTestHarness.ts) **自己那條獨立管線**（自有
`state`／`recorder`／`targetManager`／`drillRunner`），完全不動 `main.ts` 的 live `drillRunner`。
`syncAimSettingsLock()` 讀的是 live 那個，所以 harness 把自己泵到 `running` 並不會鎖住面板。

⇒ 不需要退回「(a) only + 明帳限制」，(a)+(b) 併行按預設假設落地。**OQ-63.4 關閉。**

### 修法與落點

| 修法 | 落點 | 修掉哪條路徑 |
|---|---|---|
| **(a)** | [`main.ts`](../../../../../src/main.ts) 新增 `refreshRecorderMouseGain()`，`onSensitivityChange`／`onFovChange` 各呼叫一次 | KI-035 §3 的原始症狀：**載入 drill 之後、取鎖之前**調滑桿（相位 `idle`/`armed`，(b) 的判準根本不涵蓋） |
| **(b)** | [`SettingsPanel.ts`](../../../../../src/ui/SettingsPanel.ts) 新增 `lockAim()`；`main.ts` 新增 `syncAimSettingsLock()` | run **進行中**改設定 —— 唯一可達路徑是「跑到一半掉鎖 ⇒ 面板重新顯示」 |

`(b)` 的判準沿用 KI-007 對 `fullscreenchange` 的同一條（`countdown`/`running` = 實際錄製中），
**不另立第二個「run 進行中」定義**；掛載點選既有的 `syncControlsVisibility()`，因為 drill 的每一次
start／restart／換武器／換 drill／轉 `ended`，以及 `pointerLock.onChange`，都已經呼叫它。

`main.ts:738-739`（原 KI-035 doc 記的 712-713，行號已漂移）與
[`DataRecorder.ts`](../../../../../src/data/DataRecorder.ts) `configureMouseIntegration()` 的
docstring **兩處**都宣稱了被本 bug 證偽的不變式，已一併改寫為列舉「實際保證的重設時機」與
「仍不保證的事」。

### 驗證輸出

| 指令 | exit code | 數字 |
|---|---:|---|
| `npx.cmd vitest run src/data/DataRecorder.test.ts` | **0** | 31 passed（新增 8：3 條行為 + 2 條 `it.each` + 3 條 source 掃描） |
| `npx.cmd vitest run src/ui/SettingsPanel.test.ts` | **0** | 2 passed（新增 1：`lockAim()`） |
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` ×2 皆成功 |
| `npm.cmd test` | **0** | **267 files passed／1 skipped（268）**；**3,233 passed／2 skipped（3,235）**（T1 基線 3,224 ⇒ **+9 = 本 task 新增**） |
| `npm.cmd run build` | **0** | Vite 203 modules、2.15 s，保留既有 chunk-size warning |
| `npm.cmd run test:e2e:fast -- --workers=1` | **0** | GD-44 Tier 1：**102 passed／1 skipped**、11.1 m，**與 T0 基線逐項相同** |
| `npm.cmd run test:e2e -- --workers=1`（run 2） | **0** | GD-44 Tier 2：Edge 全量，**115 passed／0 skipped**、17.8 m，**與 T0 基線逐項相同**。run 1 為 114 passed／1 failed，見下方 flake 判定 |

**Edge run 1 的單一失敗判為 flake，非本 task 回歸**（證據而非宣稱）：

| 觀察 | 值 |
|---|---|
| 失敗案例 | `hit-feedback-live.spec.ts:541`「換場景：離開再載回 br-field 後仍生效」`@realgpu` |
| 失敗點 | [`support/arm.ts:120`](../../../../../tests/e2e/support/arm.ts) 的**第三個** poll：相位 10 s 未離開 `'armed'` |
| 關鍵細節 | **第二個** poll（`armRequestedDuringTransition === true`）已通過 ⇒ `armOnPointerLock` 確實收到取鎖、`sharedState.armRequested` 已設。卡住的是其後 `armed → countdown` 的那一步 |
| 機制 | 該轉態由 sim pump 消費 `armRequested`，而 pump 只在 `liveFrame()` 的 rAF 內跑 ⇒ headed Edge 視窗失焦／被遮擋而 rAF 被節流時就會停住。與 T2 的 diff（mouse gain 佈線 + 兩個滑桿的 `disabled`）無任何交集：本 task 不碰 arming、pointer lock、pump 或 rAF |
| 單跑該 spec（Edge） | **3 passed**，含該失敗案例本身（1.6 m） |
| 全量重跑（run 2） | **115 passed**、exit 0 |

⚠️ 仍**具名記錄**而非抹掉：這是 T0 基線（115/115）之後首次觀察到該案例失敗。若後續 task 再遇到同一個
`armed` 卡住，應直接登記為 KI 而不是再判一次 flake。

既有 `dYaw`/`dPitch` golden 與四 FPS parity 的測試檔 `git diff` 為空（本 task 只新增測試，未改任何
既有斷言）；`git diff --name-only` 的完整清單見下方 diff 稽核。

---

## T3 窗界 primitive（2026-09-14）

### 交付物

| 檔案 | 內容 |
|---|---|
| `src/metrics/targetWindows.ts`（**新**） | `buildTargetWindows()`／`aliveAt()`／`TARGET_WINDOW_FLAG_VOCABULARY`，介面照 [README §2.5](README.md) |
| `src/metrics/targetWindows.test.ts`（**新**，27 tests） | fixture A／B／C + 旗標封閉性 + 不拋錯契約 + NFR-63.4 掃描 + NFR-63.3 效能 |

既有檔案異動：**零**。`peekWindows.ts`／`trackingDerivation.ts`／`detectionDerivation.ts`／`eyeOrigin.ts`／`angularKinematics.ts` 五個 canonical 檔的 `git diff --name-only` 為空（本 task 對它們只有一個 `import { WINDOW_EPSILON_MS }` 的讀取）。

> ⚠️ **commit 落點更正（2026-09-14）**：本節、D-63.T3-1～4、Surprises 14～16 與 `task-checklist.md` 的 T3 勾選，
> 因為與 T2 的文件異動在同一份檔案裡無法乾淨切開，**實際隨 T2 的 commit `909a29c` 一起入庫**；
> `feat(wp-63): T3 add population-aware target window primitive` 這個 commit 只含兩個新的 `src/metrics/` 檔
> 與本段更正。⇒ **T-exit 做 diff 稽核時，不要因為 T3 的 commit 沒帶 `progress.md` 就判定證據缺漏**——
> 它在前一個 commit 裡。這是一次性的落點偏移，不是新慣例（協議 §3.4 仍要求 `progress.md` 與切片同 commit）。

### 三份 fixture（T3 Steps 7）

fixture 是**合成**的 v8 形狀匯出（決定性，無 `Math.random()`，GD-5），由測試檔內的 `v8Fixture()` 生成：三顆同時存活、`next-tick` 補位、每次擊殺前一發失手、擊殺時刻一半落在 tick 邊界上一半落在 tick 之間（壓測半開區間與容差）。

| Fixture | 形狀 | 針對 |
|---|---|---|
| **A** | 60 kills、63 個 `visible`、7,682 ticks | 窗數不變式、窗不被別顆 spawn 截斷、`aliveAt` 2↔3 顆、座標來源、效能 |
| **B** | 3 個 `visible`、零擊殺 | `never_killed`：三個窗皆無 `tKillMs` 且延伸到 trace 末尾 |
| **C** | 6 kills、`visible` 不帶 `targetX/Y/Z`（pre-WP-56 形狀） | `no_position`：`pos` 缺席、不回退 `ticks[].tx`、窗界本身仍正確 |

fixture A 刻意複製兩個既有的靜默錯誤形態，好讓「原語不能讀它們」成為**可測的事**：`ticks[].tx/ty/tz` 一律只描述陣列首顆（[README §0.1](README.md) #1），失手 `fire` 的 `targetId` 也指向陣列首顆（同 #4）。若實作讀了其中任何一個，fixture A 的三顆座標會塌成一顆、或擊殺歸屬會全錯。

### 反向證明：同一份 payload 餵給既有原語會被截斷

`fixture A: 窗內確實含有別顆的 visible 事件` 這個測試把同一份 payload 同時餵給 `buildTargetWindows()` 與既有的 `buildPeekWindows()`：60 個被擊殺的窗裡，**有別顆 `visible` 橫跨在窗內**的那些，在 peek 側的 `tEnd` **全部**嚴格早於真實擊殺時刻。這把 [README §0.1](README.md) #3 從一段散文變成一條會紅的斷言。

### 驗證輸出

| 指令 | exit code | 數字 |
|---|---:|---|
| `npx.cmd vitest run src/metrics/targetWindows.test.ts` | **0** | **27 passed**（53 ms） |
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` ×2 皆成功 |
| `npm.cmd test` | **0** | **268 files passed／1 skipped（269）**；**3,260 tests passed／2 skipped**（T2 基線 3,233 passed，**+27 = 本 task 新增**） |
| `git diff --name-only -- <五個 canonical 檔>` | — | **空** |

**NFR-63.3 實測**（`performance.now()` 同域相減，臨時 instrument 後移除）：

| 規模 | 耗時 | 門檻 |
|---|---:|---:|
| 63 窗／7,682 ticks（實際的 60-kill v8） | **0.914 ms** | < 50 ms |
| 180 窗／22,658 ticks（README 規劃期估的上界） | **5.187 ms** | < 50 ms |

> README §0.6／NFR-63.3 寫「約 180 個 `visible` 事件」；**60 kills 的實際形狀是 63 個**（60 擊殺 + 3 殘存）。兩個規模都留了效能斷言，故無論後續採哪個數字當基準都有覆蓋。

### `multiple_kill_candidates`（T3 Steps 6）

只建立**槽位**：進封閉詞彙表、型別可用、封閉性測試涵蓋。判定留給 T5——它需要逐顆角誤差，而角誤差是 canonical derivation 的事，不是窗界原語的事（C-D4）。

---

## T4 L0 結果層 + L3 選擇策略層（2026-09-14）

### 交付物

| 檔案 | 內容 |
|---|---|
| `src/metrics/microFlickMetrics.ts`（**新**） | `deriveMicroFlickMetrics()`、兩份封閉旗標詞彙表、`MICRO_FLICK_METRICS_VERSION = 'micro-flick-v1'` |
| `src/metrics/microFlickMetrics.test.ts`（**新**，26 tests） | 手算 3-target 小案例、零 `hit` 事件釘死、FR-63.15 缺失處置、C-D4 符號掃描、可比性前置檢查 |

既有檔案異動：**零**。本 task 只新增兩個 `src/metrics/` 檔。

**本層只交付 `outcome` 與 `selection` 兩個鍵**，不替 T5／T6 的 `geometry`／`microAdjust`／`direction` 先佔位——空陣列會被讀成「算過了，沒有樣本」而不是「這一層還沒交付」。以 `Object.keys()` 一測釘死。

### 可比性前置檢查（T4 Steps 4／[README §3.1](README.md)）

以 [WP-59](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md) 同一條 stress 路徑（`createTargetManager(v8.drill)` + `createRan1(killOrderSeed)`，60 個 kill-order seed × 57 次補位 = **3,420 次補位機會**）量「被殺目標中心 → 候選」的角距分布，頂點取 eye `{0, 1.6, 0}`，夾角一律經 canonical `angularDistanceDeg()`：

| 群 | n | p10 | p50 | p90 | mean |
|---|---:|---:|---:|---:|---:|
| **倖存者**（每次 2 顆） | 6,840 | 5.579° | **9.224°** | 12.725° | 9.159° |
| **replacement**（每次 1 顆） | 3,420 | 8.282° | **11.278°** | 14.290° | 11.243° |
| `nearest2Deg` | 3,420 | 5.275° | 7.097° | 10.385° | 7.532° |
| `nearest3Deg` | 3,420 | 5.267° | 6.883° | 9.650° | 7.209° |

**判定：兩群不可比。** 位移不是雜訊而是機制——WP-59 的 temporal replacement sampler 以「離被殺目標中心越遠越好」排序候選（`TargetManager.ts:407-418`），把補位系統性推離。三個分位點同向外推（p10 +2.70°、p50 +2.05°、p90 +1.57°），遠大於任何合理的可比容差。

⇒ **影響呈現方式**：`replacementEngagedRate`（總量）**不出數**，改出 `replacementEngagedByRank` —— 依「replacement 在候選集中的角距 rank」分層的交戰率。rank 正是上面那條距離混淆的載體，分層即控掉它。決策見 D-63.T4-3。

> 補充觀測（同一份 corpus）：replacement 嚴格比兩顆倖存者都近的比例為 **545/3,420 = 15.9%**；`nearest3 − nearest2` 平均 **−0.32°**。⇒ replacement 確實會搶走注意力，但六次裡只有一次真的在幾何上「最近」。

這段檢查以 `replacement 與倖存者的角距分布可比性` 為名**committed 成測試**（非一次性腳本）：日後誰把 sampler 調到兩群可比，那條測試就會紅，強迫重新評估 `replacementEngagedRate` 的呈現方式。

### 驗證輸出

| 指令 | exit code | 數字 |
|---|---:|---|
| `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` | **0** | **26 passed**（12 ms tests／305 ms collect） |
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` ×2 皆成功 |
| `npm.cmd test` | **0** | **269 files passed／1 skipped（270）**；**3,286 tests passed／2 skipped**（T3 基線 3,260，**+26 = 本 task**） |
| `npm.cmd run build` | **0** | built in 2.20 s |

### 手算 3-target 小案例（T4 Steps 5）

三顆一律落在通過 eye 的同一水平面、距 eye 等距 ⇒ 任兩顆之間以 eye 為頂點的球面角**恰等於方位角之差**，每個期望值都能用紙筆寫下，而不是跑實作產生「期望值」（那會讓測試變成把實作抄一遍）。

擊殺順序 A(0°) → C(17°) → B(5°) → D(40°)，擊殺於 1000／1600／2300／3500 ms，每次擊殺前 170 ms 一發失手：

| 量 | 手算 | 實測 |
|---|---|---|
| `killRateHz` | 4 / 3.5 s | ✅ |
| `shotsPerKill`／`shotAccuracy` | 8/4 = 2 ／ 4/8 = 0.5 | ✅ |
| `killIntervalP50Ms`／`P90Ms` | 間隔 [600, 700, 1200] ⇒ 700 ／ 1100 | ✅ |
| `firstKillLatencyMs` | 1000（**不**併入上面的分布） | ✅ |
| `nearest2Deg`／`nearest3Deg` | [5, 12, 35, 20]（逐位對齊） | ✅ |
| `nearestFirstRate` | rank [2, 1, 1] ⇒ 2/3 | ✅ |
| `selectionCostRatio` | (17+12+35) / (5+12+35) = 64/52 | ✅ |
| `selectionRankEntropy` | H({1:2, 2:1}) = 0.9182958… bits | ✅ |

另有一份**完全按最近鄰擊殺**的序列，`selectionCostRatio === 1.0`、`nearestFirstRate === 1.0`、熵 `=== 0`（T4 DoD 第四條）。

零 `hit` 事件的釘死方式：fixture 一個 `hit` 事件都不發（`events.some(e => e.type === 'hit') === false` 先斷言），再斷言四個依賴擊殺時刻的量都對得上手算值 —— 照抄 `t_hit` 的實作在這裡會拿到空陣列而靜默回 0 樣本，那四條就會紅。
## T5 L1 幾何層：意圖歸屬 + 角誤差 + 首發重定義 + 修正時間拆解（2026-09-14）

### 交付物

| 檔案 | 內容 |
|---|---|
| `src/metrics/microFlickMetrics.ts`（**改**，+約 260 行） | `deriveGeometry()`、`attributeShot()`、`candidatesForShot()`、`targetGeometry()`、`cadenceWaitWithin()`、`heldFireWithin()`、`resolveCycletimeMs()`；新增 `MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY`（10 個旗標）與 `MicroFlickShotAttribution`／`MicroFlickTargetGeometry`／`MicroFlickGeometryMetrics` |
| `src/metrics/microFlickMetrics.test.ts`（**改**，+24 tests → 50） | D1–D6 六份對抗性 fixture、`t5Scenario()`（**帶視角**的合成匯出）、命名紀律掃描、cycletime 非常數佐證 |

既有檔案異動：**零**。本 task 只改 T4 交付的那兩個檔（加上一條 T4 測試的期望值更新，見下方 §偏離）。五個 canonical derivation 檔（`peekWindows.ts`／`trackingDerivation.ts`／`detectionDerivation.ts`／`eyeOrigin.ts`／`angularKinematics.ts`）`git diff --stat` 為**空**。

### 幾何學的可手算性（測試不抄實作）

T5 的 fixture 讓目標與開火射線都落在通過 eye 的同一水平面（`viewPitch = 0`）：

```
aimForward(−a) = { sin a, 0, −cos a }      目標方向 = { sin t, 0, −cos t }
⇒ dot = cos(a − t)  ⇒  angularDistanceDeg = |a − t|（度），精確
```

於是每個期望角誤差都能用紙筆寫下（`aimYawDeg = 4.9`、目標 `5°` ⇒ 期望 `0.1°`），不必跑實作產生「期望值」。

### 三個偏離規劃期字面的決策

全文見下方 [Decision Log](#decision-log) 的 **D-63.T5-1**（`cycletimeSec` 不在 `meta.weapon` 上，改由匯出宣告的武器 id 查 registry）、**D-63.T5-2**（L1 另立閉區間右界的候選集，不用 `aliveAt()`）與 **D-63.T5-3**（`geometry` 為物件，並新增逐發 `shots`；逐發列不轉載 `fire.targetId`）。

### `cadenceWaitMs` 的定義與一個規劃期沒寫的判斷

task 文件寫「對區間內每一對相鄰 fire，間隔恰等於 `cycleMs` ⇒ 全部計入；大於 `cycleMs` ⇒ 只有 `cycleMs` 那段計入」。兩種情形合起來就是 `min(間隔, cycleMs)`（排程器保證間隔不可能**小於** `cycleMs`：[`SimLoop.ts:552`](../../../../../src/loop/SimLoop.ts) 的 `nextFireT += cycleMs`）。

規劃期沒寫的是：**區間內朝別顆開的槍算不算**。本 task 判定**算**——節奏地板是武器層級的，玩家中途朝別顆開的槍一樣會把本顆的補槍往後推。不計入會讓 `settlingMs` 把武器的硬等待誤讀成玩家的猶豫，正好是 FR-63.9 要避免的那件事。以 `中途朝別顆開的槍一樣佔住節奏` 一條測試釘死（1000 失手 t0 → 1170 失手 t1 → 1340 命中 t0 ⇒ `correction 340 / cadence 340 / settling 0`）。

推論：`settlingMs >= 0` 恆成立（`Σ min(gap, cycle) <= Σ gap = correctionMs`）。

### 點擊 vs 按住（task 文件的 ⚠️）

`fire.t` 是**排程時刻**不是點擊時刻：單次點擊的首發 `nextFireT = ev.t`（真實 mouse-down 時間戳，[`SimLoop.ts:100`](../../../../../src/loop/SimLoop.ts)），按住時後續發為 `nextFireT += cycleMs`（552 行）。只有逐 tick 的 `heldFire`（`ticks[].fire`，WP-54 / T7 加的欄）能分辨兩者。

落成兩個旗標：修正區間內有 `fire === true` 的 tick ⇒ `held_fire_during_correction`（那幾發的 `t` 是排程出來的）；`ticks` 整批沒有 `fire` 欄 ⇒ `no_held_fire_channel`（**不**把缺席當成 `false`）。旗標只描述語意，**不改動數值**——`cadenceWaitMs` 在標旗標時仍是同一個數。

### 不加 recoil punch（C-D4）

`fire.viewYaw`／`viewPitch` 是 `state.aim` 的原值；punch 另記於 `aimPunch*`。把兩者相加等於在本檔重寫一次彈道朝向 ⇒ 踩 C-D4。且 `usp_s_laser` 的 punch 逐位為 0（T1 NFR-63.7 已釘死），v8 上兩種讀法本來就同值。記錄於此以免後續讀者以為是漏做。

### 驗證輸出

| 指令 | exit code | 數字 |
|---|---:|---|
| `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` | **0** | **50 passed**（T4 交付時為 26 ⇒ **+24 = 本 task**） |
| `npm.cmd run typecheck` | **0** | `tsc --noEmit` 與 `tsc --noEmit -p tsconfig.node.json` 兩段皆成功 |
| `npm.cmd test` | **0** | Vitest **269 files passed／1 skipped（270）**；**3,310 tests passed／2 skipped（3,312）**；16.81 s。T4 基線 3,286 ⇒ **+24 = 本 task** |
| `npm.cmd run build` | **0** | `tsc` 兩段成功；Vite build 2.02 s；保留既有 chunk-size warning |
| `git diff --stat -- <五個 canonical derivation 檔>` | — | **空**（README §1.3 的「不得修改任何一行」） |
| `git status --short` | — | 只有 `src/metrics/microFlickMetrics.ts` 與 `src/metrics/microFlickMetrics.test.ts` |

### DoD 逐條對帳

| DoD | 證據 |
|---|---|
| `vitest run src/metrics/microFlickMetrics.test.ts` exit 0 | 上表，50 passed |
| D1–D6 各有具名測試且綠 | 測試名逐一以 `D1`～`D6` 開頭（D1 等距併列／D2 argmin vs `targetId`／D3 交叉檢核／D4 strict 拋錯／D5 170 ms／D6 500 ms） |
| D2 測試名明示「採用 argmin 而非 fire.targetId」 | `D2 採用 argmin 角誤差而非 fire.targetId——後者失手時是陣列首顆（README §0.1 #4）` |
| D3 在**全部**命中發上成立（不只抽樣） | 測試先斷言 `hits.length === 4` 且 `attributedHits.length === hits.length`，再逐發對照 `tMs` 與 `intendedTargetId` |
| `cycletimeSec` 讀匯出而非常數 | 見 D-63.T5-1；`usp_s_laser` 170 / `ak47` 100 / 未知 id ⇒ `unknown_cycletime` 三條測試 |
| `intended*` 命名紀律 | 逐發列鍵名掃描（`/target/i` ⇒ 必須 `intended` 開頭）+ 原始碼掃描 `fire.targetId`／`fire.offsetDeg`／`fire.firstShot` 各 0 次 |
| typecheck ×2 exit 0；全量 Vitest exit 0 | 上表 |

### 偏離協議的明帳

**改了一條 T4 的測試期望值**：`本層不先佔位 L1／L2／方向預測的鍵——那三層由 T5／T6 交付` 斷言 `Object.keys(metrics)` 不含 `geometry`。T5 交付 L1 之後這條**必定**轉紅——那正是它被寫出來的目的（它是「這一層還沒交付」的哨兵）。已改名為 `不先佔位尚未交付的鍵：L1 已由 T5 交付，L2 與方向預測仍由 T6 交付`，並補上 `microAdjust`／`direction` 仍為 `undefined` 的斷言，讓哨兵繼續替 T6 站崗。除此之外 T4 的 25 條測試**零修改**全綠。

---

## Decision Log（規劃期與 T0／T1／T2／T3／T4／T5）

### D-63.T4-1 — `T_valid` 錨在第一個 `visible`，不是 countdown 也不是整場（2026-09-14）

[T4 檔](T4-outcome-and-selection.md) Steps 2 寫「`T_valid` 從 `meta` 的 countdown 結束推導 …… 若匯出無此資訊則整場計入並標旗標」。實作時逐欄掃過 [`metadata.ts`](../../../../../src/data/metadata.ts) 的 `Meta`：**`timing.countdownMs` 從來沒有進過匯出**（它只活在 `DrillConfig` 與 `DrillRunner` 內）。⇒ 前半句在資料上不存在，只剩後半句的退路。

但「整場計入」會把 3 秒倒數整段算進分母（[`main.ts:1446`](../../../../../src/main.ts) 註明 `recordTickFromState()` **不看相位**，故 trace 從 countdown 就開始），讓 `killRateHz` 系統性偏低——這不是缺失，是**已知偏誤**。

**取「第一個 `visible` 事件」為 `T_valid` 起點、「最後一次擊殺」為終點。** v8 無 `spawnDelayMs` ⇒ 第一次 spawn 就在 running 的第一個 sim tick，與倒數結束同一刻（差一個 tick 之內）。這同時是 [GD-39](../../../DECISIONS.md) ② 「v8 指標一律事件錨定」的直接應用。`validSpanMs` 一併輸出，讓分母本身可稽核。

暫停／失焦區間**不扣除**：匯出只有 `meta.validity.pointerLockLost` 這個布林，沒有區間。WP-60 的 `pointer_lock` 事件雖然有區間，但那是 `?rawMouse=1` 才收的 opt-in 資料——**讓指標定義依賴一個採集開關，會讓開／關兩批 run 的 `killRateHz` 不可混比**。⇒ 一律不扣，以 `idle_span_unbounded` 恆亮聲明這件事，另以 `focus_lost_during_run` 指出這一場實際掉過鎖。

**替代方案（被否決）**：整場計入 —— 否決理由為它是已知偏誤而非缺失，而本 WP 的存在理由正是消滅「數字看起來合理但錯」；把 `countdownMs` 補進 `meta` —— 否決理由為那是改匯出 schema，[README §1.3](README.md) 明文禁止，且要動的話該另開 WP 一次處理所有 timing 欄位。

### D-63.T4-2 — FM-4 的彈匣空倉改為「整層不出數」，因為「該窗不進分母」在 L0 無定義（2026-09-14）

[README §2.6](README.md) FM-4 寫「標 `ammo_exhausted_in_window`，**該窗不進 L0 的 `shotsPerKill` 分母**」。實作時發現這條在 v8 上沒有定義：`shotsPerKill = N_fire / N_kill` 是 trace 層的量，而 v8 **三顆並發** ⇒ 一發 `fire` 同時落在最多三個窗內。**逐窗的發數歸屬要等 T5 的意圖歸屬才存在**，L0 拿不到。

**取「任一窗在 `T_valid` 內標了 `ammo_exhausted_in_window` ⇒ `shotsPerKill` 與 `shotAccuracy` 皆不出數 + `ammo_exhausted_in_run`」。** 依 **C-D3**（寧可少一個指標，不能有一個會說錯話的指標）：FM-4 已載明這時的數字**已知偏低**，輸出它等於明知有偏誤還發數字。其餘三量（`killRateHz`／兩個 `killInterval` 分位數）不吃發數，不連坐。

實務上這條幾乎不會觸發：D-63-P4 已證每次 `spawn()` 都補滿彈匣，而 v8 每殺一顆就補位。

**替代方案（被否決）**：照出數字只加旗標 —— 否決理由如上；等 T5 再回頭剔窗 —— 否決理由為那會讓 L0 的語意依賴 L1，破壞「L0／L3 完全不需要意圖歸屬」這個 T4 的設計前提。

### D-63.T4-3 — `replacementEngagedRate` 只出 rank 分層值，總量不出（2026-09-14）

可比性前置檢查（見 §T4）判定 replacement 群與倖存者群的角距分布**不可比**（p50 11.28° vs 9.22°，機制為 WP-59 的 sampler 刻意外推）。依 [README §3.1](README.md) 的既定緩解「分布不可比 ⇒ 只出分層值不出總量」，`replacementEngagedRate` 恆為 `undefined` 並常亮 `replacement_distance_not_comparable`。

**分層變項取「replacement 在候選集中的角距 rank」**（1／2／3），不取距離分箱：rank 正是距離混淆的載體，而且 v8 的候選集恆為 3 顆 ⇒ rank 是完整、無參數、無分箱邊界的分層。距離分箱會引入 bin 寬這個自由參數，與本 WP 的免閾值紀律相衝。

**替代方案（被否決）**：照出總量只加旗標 —— 否決理由為總量會把「玩家偏好補位」與「補位比較遠所以少被選」混在一起，而讀者幾乎一定會把它讀成前者；不出任何 replacement 量 —— 否決理由為 [README §5](README.md) #6 的 (c) 路（以 replacement 對照倖存者取搜尋成本下界）明文要靠這個原料，分層值保住了它。

### D-63.T4-4 — `nearest2Deg` 與 `nearest3Deg` 逐位對齊是硬不變式（2026-09-14）

兩個陣列的唯一用途之一是相減（`nearest3 − nearest2` = 這一次 replacement 搶走的角距，[README](README.md) FR-63.4 的設計意圖）。若「沒有倖存者」的退化情形只讓其中一邊 push，兩者就會**靜靜地錯位**，而相減仍然算得出數字 —— 又是一個 §0.1 型的靜默錯誤。

**取「一顆倖存者都沒有 ⇒ 兩邊都不 push」**，並以「逐位對齊且 `nearest3 <= nearest2`」一測釘死（四份 fixture 各驗）。介面註解也把對齊寫成契約。

### D-63.T4-5 — 同距候選一律同 rank，不以陣列順序或 id 序決勝（2026-09-14）

`rank = 1 + #{候選 : 角距 < 本候選角距 − 1e-9}`。這是 [README §2.6](README.md) FM-2 「**不**以陣列順序或 id 序決勝（那正是 §0.1 #4 的錯誤形態）」在 L3 的對應實作。後果是等距時兩顆都算 rank 1 ⇒ `nearestFirstRate` 在對稱佈局上不會因為實作的迭代順序而抖動。以「倖存者 −9°／+9° 與被殺的 0° 等距」一測釘死。

### D-63.T3-1 — `pos` 改為 optional，而不是用哨兵值填滿（2026-09-14）

[README §2.5](README.md) 的介面草稿把 `pos` 寫成**必填**，同時 §2.6 的 FM-1 又要求缺座標時「**不**猜位置、**不**回退到 `ticks[].tx`」。兩者不可能同時成立：必填就得填一個值，而任何值都是猜的。

**取 `readonly pos?:`**（`no_position` 旗標同時標上）。理由是型別要逼消費端處理缺席——填 `{0,0,0}` 會讓 T4／T5／T6 的角距在 pre-WP-56 匯出上安靜地算出一堆指向原點的數字，那正是本 WP 存在的理由（靜默錯誤比報錯貴）。`AliveSnapshot.targets` 的 `Pick<TargetWindow, 'targetId' | 'pos'>` 不受影響。

實作上缺席是**真的不存在這個鍵**（條件展開，非 `pos: undefined`）；測試以 `'pos' in window === false` 釘死，免得 `JSON.stringify` 往返後語意漂移。

**替代方案（被否決）**：`pos` 填 NaN 三元組 —— 否決理由為 NaN 會在下游算術裡傳播成 NaN 指標，而 FR-63.15 明文要求「缺失一律 `undefined` + 具名旗標，**不補零、不吞成 NaN**」。

### D-63.T3-2 — `ammo_exhausted_in_window` 判準改為 `ammo <= 1`（2026-09-14）

T1 的 FR-63.13 契約寫「逐事件判 `fire.ammo === 0`」。T3 實作時複核原始碼發現這個判準**不可達**：

| 位置 | 事實 |
|---|---|
| [`SimLoop.ts:510`](../../../../../src/loop/SimLoop.ts) | `ammo: state.weapon.ammo` —— 記的是**本發扣彈前**的存量 |
| [`SimLoop.ts:551`](../../../../../src/loop/SimLoop.ts) | `if (fired) state.weapon.ammo--;` —— 扣彈發生在記錄**之後** |
| [`SimLoop.ts:538`](../../../../../src/loop/SimLoop.ts) | while gate `state.weapon.ammo > 0` —— 存量 0 時根本不會產生 `fire` 事件 |

⇒ 匯出裡 `fire.ammo` 的最小可能值是 **1**（＝這發打完就空倉），`0` 永遠不出現。照字面實作會得到一個**永遠不會亮的旗標**，而它守的正是 FM-4 那條「該窗有一段按住但不出彈的時間洞」的殘留風險——不亮等於沒守。

**取 `event.ammo !== undefined && event.ammo <= 1`**，保留 `0` 的涵蓋（手工 fixture、未來 schema 變動）。三條測試分別釘死 `ammo: 1` 會亮、`ammo: 0` 也會亮、`ammo: 11/10` 與缺欄位不亮。T1 的契約段已就地加更正框（比照本 WP 對 GD-38 ② 的 inline 更正慣例，D-63-P6）。

T1 另外警告的「`ammo` 不單調（`spawn()` 每次補滿）」仍然成立，實作照做：逐事件判，不假設窗內單調、不取 min、不看首尾差。

**替代方案（被否決）**：照字面留 `=== 0` 並把差異記成 OQ —— 否決理由為那會讓一個**已知失效**的旗標帶著綠燈進 T4／T5／T6，而 T7 的 harness 不會替它補課（合成 fixture 是我們自己寫的，寫成 0 就會過）。

### D-63.T3-3 — NFR-63.4 的符號掃描取**大小寫敏感**（2026-09-14）

NFR-63.4 要求 `epsilon`／`onTarget`／`eyeHeight`／`SIM_TO_WORLD`／`acos` 五個符號直接出現次數為 0；T3 的 DoD 同時要求 `WINDOW_EPSILON_MS` 必須是**引用**而非重新定義。不分大小寫的掃描會讓這兩條互相矛盾（`WINDOW_EPSILON_MS` 含 `EPSILON`）。

**取大小寫敏感**：五個禁用名在各自的 canonical 實作裡就是這個拼法（`trackingDerivation.ts` 的 `epsilonDeg`／`onTarget`、`eyeOrigin.ts` 的 `eyeHeight`、`loop/constants.ts` 的 `SIM_TO_WORLD`、`Math.acos`），已逐一複核。掃描另外加了三組補強，讓「不重寫幾何」不靠單一字串：禁 `Math` 的三角／`hypot` 家族、禁 `angularEccentricityDeg`／`omegaDegPerSec`／`resolveEyeOrigin`／`deriveTracking*`／`deriveDetection*`、禁 `RAD_TO_DEG`／`DEG_TO_RAD`。

同步記一個掃描本身的陷阱：DOM 全域**不能**用「`window` 加點」的 pattern 掃——`window` 正是本模組的核心領域詞（target window），那個 pattern 會把 `window.flags` 一起打死。改掃 DOM 專屬成員（`document`／`location`／`navigator`／`addEventListener`／…）與 `globalThis`／`self`。

### D-63.T3-4 — 擊殺歸屬收斂在「這一次 presentation」的佔用區間內（2026-09-14）

[`TargetManager.ts:587`](../../../../../src/sim/TargetManager.ts) 現況是遞增計數器產 id，一場之內全域唯一 ⇒ 「找第一個 `hit === true` 且 `targetId` 相符的 `fire`」已經夠用。**實作仍額外把搜尋右界收在「同 id 的下一次 `visible`」**，多一個反向 pass（O(n)）。

理由是窗界原語不該把 id 生成策略這個實作產物當前提——若日後有人改成 slot-based 或 pooled id，字面判準會安靜地把第二次 presentation 的擊殺歸給第一次的窗，而那個錯誤的形態（歸屬到錯的目標、數字仍然合理）正是本 WP §0.1 要消滅的那一類。以 `同一個 id 被重複使用時，擊殺只歸屬給當次 presentation` 一測釘死。

### D-63.T2-1 — KI-035 取 (a)+(b) 併行；`BD-035` 撞號（2026-09-14）

**OQ-63.4 關閉**：T2 Steps 1 的條件（「若 (b) 讓既有 E2E 轉紅就退回 (a) only」）**未觸發**，故按預設
假設 (a)+(b) 併行落地。全 repo 唯一操作感度／FOV 滑桿的 e2e 是
[`spider-shot-wide.spec.ts`](../../../../../tests/e2e/spider-shot-wide.spec.ts) 的 `setFov()`；加上
handler guard 之後單跑該 spec **4/4 passed**，與未加 guard 的對照組相同（兩次各 1.2–1.3 m）。

**編號偏離（明帳）**：T2 task 檔與 KI-035 doc 都寫「開立 `BD-035`」，那是規劃期按 KI 號推的。實況
`BD-n` 與 `KI-n` **不同步** —— `BD-035`／`BD-036`／`BD-037` 已分別由 KI-038／KI-037／KI-039 取用，
`BUGFIX-DECISIONS.md` 最大號為 `BD-037`。依 [GD-15](../../../DECISIONS.md)「先採納先得」改取
**`BD-038`**（⚠️ 這個號後來又被 `main` 撞一次，最終落帳為 **`BD-039`**，見 **D-63.T2-2**），並在 KI-035 doc 抬頭具名記錄這次改號，免得後續讀者照舊文去找 `BD-035`。順帶補上
`BUGFIX-DECISIONS.md` §1 索引**原本缺的 KI-035 列**。

**Alternatives considered**：
- **(a) only** —— 駁回。它讓 run **之間**的變更即時生效，但 run **內**改設定仍會讓同一份 `ticks[]`
  前後段用不同 gain，而 `meta` 只有一組值。既然 (b) 實測不破壞任何既有 spec，沒有理由留著這個缺口。
- **(b) only** —— 駁回，而且是**修不到 bug 本身**：KI-035 §3 的症狀發生在「載入 drill 之後、取鎖之前」，
  相位是 `idle`/`armed`，(b) 的 `countdown`/`running` 判準根本不涵蓋。
- **(c) provenance 化**（`meta` 增加 gain 變更事件序列）—— 駁回，要動匯出 schema，而 (a)+(b) 之後
  run 內本就不會有第二組 gain，(c) 付的代價買不到對應的資訊。
- **`lockAim()` 只做 `disabled` 不加 handler guard** —— 這是實測前準備好的退路（`disabled` 擋操作員，
  程式化 `dispatchEvent` 仍通過 ⇒ 保證 dev-only harness 不受影響）。實測顯示 guard 不破壞既有 spec，
  故採**與 `lockMode()` 相同的既有作法**（`disabled` + guard），不為了保留退路而弱化語意。

### D-63.T2-2 — (b) 的判準與掛載點都沿用既有的，不新增第二套（2026-09-14）

**判準**：`drillRunner.phase === 'countdown' || 'running'`，與 KI-007 對 `fullscreenchange`、
以及 WP-60 對 `pointer_lock` 事件記錄用的是**同一條**。不新增「run 進行中」的第二個定義。

**掛載點**：`syncControlsVisibility()` 的第一行（在 `controls === undefined` 的 early return **之前**）。
理由是那個函式已經是全 app 的 UI 同步匯流點 —— `pointerLock.onChange`、
`restartActiveDrill()`、`loadWeaponById()`、`activateDrill()`、以及 `liveFrame()` 轉 `ended` 時都會呼叫它。
唯一能在錄製中碰到滑桿的路徑是「run 到一半掉鎖 ⇒ 面板重新顯示」，而那正是 `pointerLock.onChange`。

**放在 `controls === undefined` early return 之前，且已核對過 KI-013 的 TDZ 顧慮**：`settingsPanel`（`main.ts:519`）
與 `drillRunner`（`:1114`）之間**沒有任何 top-level await**，模組評估到 `drillRunner` 為止都是同步的
⇒ 任何 handler 能跑到 `syncControlsVisibility()` 時，兩者必定已初始化。（`controls` 的 early return
之所以存在，是因為 `controls` 的賦值點在 dev harness／`measureDisplayHz` 的 top-level await **之後**。）
這條推理已寫進該行上方的註解，並具名標出「日後若有人在那兩個宣告之間插入 top-level await，就必須把
這一行移到 early return 之後」——移動不損語意，因為那個窗內相位不可能是 `countdown`/`running`。

**Alternatives considered**：在 `liveFrame()` 每幀同步 —— 駁回，per-frame 做一件只在相位轉換時會變的事，
而且會把 UI 狀態塞進 render 熱路徑；新增一組 drillRunner 的 phase-change 訂閱 —— 駁回，`DrillRunner`
目前沒有這種 callback，為此加一個公開 API 的代價遠大於重用既有匯流點。

### D-63.T2-3 — `refreshRecorderMouseGain()` 需要就緒旗標，這不是可省的防禦性程式（2026-09-14）

`createSettingsPanel()` 在**建構當下**就把 sensitivity/FOV 兩個預設值各推過 callback 一次
（面板自述為這兩個設定的單一真實來源）。而在 `main.ts` 裡 `settingsPanel`（:519）與 `recorder`（:797）
都是**更下方**才宣告的 `const` ⇒ 那一次推送若碰 recorder 會直接 `ReferenceError`（TDZ），app 開不起來。
`typeof recorder === 'undefined'` 也擋不住（`typeof` 對 TDZ 變數同樣拋錯），故用一個
`recorderMouseGainWired` 布林。建構時刻的 gain 不會漏：
`createDataRecorder({ mouseIntegration: { gain: currentMouseGain() } })` 讀的是同一組設定。

**Alternatives considered**：把 `createSettingsPanel()` 移到 `recorder` 之後 —— 駁回，`cameraController`
的初值推送與 `topLeftControls` 的組裝順序都綁在現位置，為一行接線搬動 app 啟動順序是不對價的風險。

### D-63.T1-1 — v8 進 `DECLARED_WEAPON_BY_DRILL_ID`，武器成為不可覆蓋的固定因子（2026-09-14）

T1 加上 `weaponId` 後，WP-62 T1 的守門測試 `drillFamily.test.ts` 立刻轉紅（`expected undefined to be 'usp_s_laser'`）——它對**全部 38 個 schedulable drill** 逐一斷言「map 宣告 === config 宣告」，正是為了攔截「drill 長出 weaponId 但沒人登記，於是 Session Plan 逐列武器可以悄悄覆蓋實驗因子」。

處置：把 v8 登記進 [`drillFamily.ts`](../../../../../src/session/drillFamily.ts) 的 `DECLARED_WEAPON_ROSTER`。**這不是純記帳，有行為後果**：[`sessionProgram.ts`](../../../../../src/session/sessionProgram.ts) 的 `requireWeapon()` 會在**編譯期**拒絕替 v8 指定其他武器（錯誤訊息「由實驗格固定為 usp_s_laser，不可指定其他武器」），且 `SessionPlanSetup` 的武器欄改顯示 `usp_s_laser` 而非「預設」。

**這正是本 WP 要的語意**：零散布武器是 v8 的**量測儀器**，不是操作員的偏好選項——若可被逐列覆蓋，FR-63.7 的意圖歸屬與 `shotAccuracy` 隨時可能在某一列被散布污染，而離線端只能從 `meta.weaponId` 事後發現。與 tracking pilot 的固定因子（WP-62 / D-62-1）同一紀律。

**Alternatives considered**：不登記、改讓 `drillFamily.test.ts` 對 v8 例外 —— 駁回，那等於為了少改一行而關掉唯一會攔住「實驗因子被覆蓋」的閘；改用 Session Plan 逐列指定 `usp_s_laser` 而 fixture 不宣告 —— 駁回，v8 主要走 researcher 下拉直接載入（非 Session Plan），那條路徑根本吃不到逐列指定，等於沒修。

⚠️ **T-exit 對帳項**：本 task 的 diff 因此比 [T1 檔](T1-zero-spread-weapon.md) DoD 列的檔案集多出三個（`src/session/drillFamily.ts` 與兩個 WP-62 scope-count 測試）。三者皆為**既有守門測試逼出的必要異動**，非 scope 蔓延；詳見 Surprises 8。

### D-63.T1-2 — v9 不在本 task 範圍內跟著換武器（2026-09-14）

[`micro_flick_three_target_test_v9.ts`](../../../../../src/drill/micro_flick_three_target_test_v9.ts) 是 v8 的 60 s 計時版姊妹 drill，其 variants 測試明寫「Everything else is v8's field, verbatim」。T1 後 v9 **仍吃預設 `ak47`** —— 亦即兩個共用同一 spawn 場域的姊妹 drill 現在跑不同武器。

本 task **不代改**：v9 不在 WP-63 的 FR 範圍（FR-63.12 只點名 v8），且 v9 若要換武器必須同步處理自己的斷代宣告與 `DECLARED_WEAPON_ROSTER` 登記，屬另一個垂直切片。**具名記錄以免後續讀者誤判為遺漏**；若研究者要以 v9 收資料，應先開 task 比照 T1 處理。

**Alternatives considered**：順手一起改 —— 駁回（協議 §3.1：一 task 一垂直切片，且會讓 T1 的斷代宣告涵蓋一個本 WP 不量測的 drill）。

### D-63.T0-1 — 編號與 cohort gate 依當下權威處理（2026-09-14）

WP-63 已在 §2 索引由本案採納，GD-39 尚無已落帳標題，故維持既有號；stage14 §3 的後續註記已把候選推至 WP-68／69／70。OQ-63.1 先採非 frozen cohort 的明帳預設，T1 前若有相反研究者回覆即改為 v9。**Alternatives considered**：把 GD 草稿直接改成最大號之後的 GD-45，會在 T0 尚未入帳時無端放棄本 WP 已預留且未被占用的號，駁回；直接將研究者未回覆解讀為確認「否」，會抹掉 cohort 風險，駁回。

### D-63.T0-2 — Playwright 基線跟隨 GD-44 分層（2026-09-14）

T0 原規劃的無 project 指令在 2026-09-14 新增 `chromium-ci` 後，會把 Edge 真 GPU 案例送入 SwiftShader；實跑第 150–152 例失敗。按 [GD-44](../../../DECISIONS.md) 與 `package.json`，基線改為 Edge 全量 `test:e2e` 和 chromium-ci fast `test:e2e:fast` 兩個 exit 0 的獨立閘，兩者都指定一個 worker。**Alternatives considered**：修改 `hit-feedback-live.spec.ts` 讓 SwiftShader 的 `@realgpu` 斷言變綠，會降低真 GPU 效度閘且違反 T0 既有測試零修改，駁回；只接受舊指令 Edge 階段 115/115 而不獨立跑 chromium-ci fast，不能建立 GD-44 Tier 1 基線，駁回。

### D-63-P1 — 四項計算的蒐集層逐項判定（2026-09-10，使用者指定）

使用者指定四項計算，逐項稽核匯出與蒐集路徑後的結論：

| # | 計算 | 蒐集層 | 處置 |
|---|---|---|---|
| 1 | 擊殺後 → 下一個最近目標的距離 | ✅ 足夠 | `nearest-2` 與 `nearest-3` **都算**（使用者決定）；差值 = replacement 注意力搶奪量。FR-63.4 |
| 2 | 準心移動方向 → 預測意圖目標 | ✅ 足夠 | 用 `ticks[].dYaw`/`dPitch`（真 128 Hz），輸出逐窗長 `W` 的預測準確率曲線。FR-63.11 |
| 3 | 找尋下一個目標的時間窗口 | ❌ **原理不足** | **放棄**（使用者決定）。降級宣稱為 `post-kill-onset-latency`；且因 D-63-P2 連該量也不在本 WP 範圍 |
| 4 | 首發失手 → 微調到擊殺的時間 | ✅ 足夠 | 三個陷阱各有對策：無 `hit` 事件、`targetId` 錯、170 ms cadence 地板。FR-63.9 |

第 3 項不可行的理由（記錄以免後續重提）：視覺搜尋與決策不可觀測，**且可能發生在擊殺之前** —— v8 三顆全程可見、無 pop-in、無 cue，玩家可在打當前目標時就看好下一顆。`t_kill → t_move` 在「已預先規劃」與「未預先規劃」兩種情況下語意完全不同，而資料無法分辨。這不是閾值問題，是訊號裡沒有那個資訊（與 WP-57 抬滑鼠偵測同一類）。

### D-63-P2 — 放棄第 3 項後，整個 WP 不需要任何 movement-onset 判準（2026-09-10）

原設計對話曾討論 onset 判準（ω 門檻 + 持續毫秒 vs 滑動窗累積位移），使用者選了「ω 門檻 + 持續毫秒」。**放棄第 3 項之後這個選擇變成非必要**：

- CONTEXT.md §48 已把「瞄準移動 onset」定為既有構念 `t_detect` ⇒ 任何 v8 側的第二個判準直接踩 **C-D4**
- `t_detect` 在 v8 上另有兩個結構性障礙：[KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)（`aim` 更新率 = 顯示率）與 [KI-034](../../../../known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md)（v8 的基線窗 100% 被上一次拉槍污染）
- 而 ①②④ 與免閾值描述子**全部可以錨在事件上**（`fire.viewYaw`/`viewPitch` 是精確已知的，不需要偵測）

⇒ 換構念而非換判準。詳見 [README §2.2](README.md)。**替代方案（被否決）**：在 v8 側自訂 ω 門檻 —— 否決理由為 C-D4；先修 KI-031/034 再用 canonical `t_detect` —— 否決理由為那是兩個獨立的 bugfix WP，不該藏在指標定義 WP 裡。

### D-63-P3 — v8 改用 `usp_s_laser`（2026-09-10，使用者拍板）

使用者指定「預設使用 `usp_s_laser`」。稽核 [`weapons.ts:82`](../../../../../src/weapon/weapons.ts) 確認三項條件成立：`recoil` 全 0、`inaccuracy` 四項全 0、無 `ads` 區塊（右鍵自動失效）。

**副作用（明帳）**：`cycletimeSec: 0.17`（ak47 為 0.10）⇒ 最小發間隔 170 ms，補槍時間懲罰是 ak47 的 1.7 倍。這是 FR-63.9 要把 `correctionMs` 拆成 `settlingMs` + `cadenceWaitMs` 的直接理由。

**替代方案（被否決）**：保留 ak47 把散布/punch 當 covariate —— 否決理由為補槍（第 2、3 發）的誤差幾乎不可解釋，且 C-D3 信度閘會更難過；新開 v9 cued 變體 —— 否決理由為工作量最大且不是使用者要的任務。

### D-63-P4 — GD-38 ②(b) 的機制前提有誤，須入帳更正（2026-09-10）

[GD-38](../../../DECISIONS.md) ②(b) 寫「`state.weapon.ammo` 只在 `createSimLoop()` 設一次，全 repo **無 reload 路徑**」。

**實況**：[`TargetManager.ts:585`](../../../../../src/sim/TargetManager.ts) 的 `spawn()` 每次都執行 `state.weapon.ammo = state.weapon.magSize`，`spawn()` 有 3 個呼叫點（`TargetManager.ts:617, 644, 647`），涵蓋 legacy 與 population 兩條路徑 ⇒ **每次目標生成都補滿彈匣**。

GD-38 ②(b) 描述的「`magSize 12` × `cycletime 0.17` = 2.04 秒後靜默停火」只在**整段期間零 spawn** 時成立，在任何 spawn-driven drill 上都不成立。

同時 GD-38 ②(a)（counter-strafe 因果通道消失）對 v8 **不適用**：v8 是 `translation: 'locked'` ⇒ `speedRatio` 恆 0 ⇒ `inaccuracy.move` 從不參與。

⚠️ **這不推翻 GD-38 ②「不做全域 pin」的結論** —— 該結論仍成立；更正的是它引用的機制事實與適用範圍。列為 GD-39 ③ 於 T-exit 入帳。

> **⚠️ 跨 WP 影響**：GD-38 ⑥ 的 UI 文案「無 reload：彈匣打完該輪即停火」依同一機制事實為**誤導**。WP-62 T4 開工前應覆核該文案；本 WP 不代改他人 WP 的交付物，僅具名記錄。

**✅ 已提前落帳（2026-09-10）**：本條的更正已直接寫入 [`DECISIONS.md`](../../../DECISIONS.md) 的 **GD-38 ② inline 更正段**（比照該條既有的 `T0 對帳修正` 慣例），未等到本 WP 的 T-exit。理由見下方 D-63-P6 的修訂。

### D-63-P5 — 落點與編號（2026-09-10）

- **落點 = `active/stage13/`，依使用者 2026-09-10 指示**。主題部分相符（KI-035 與 rawMouse 採集紀律屬 stage13；v8 窗界與指標族更接近 stage14 草案）。承 [WP-62](../wp-62-session-plan-per-item-weapon/README.md) 的同一先例，明帳記錄。
- **編號**：規劃寫入當下 `exec-plan/README.md §2` 最大 WP 為 **WP-62**、`DECISIONS.md` 最大 GD 為 **GD-38**、`docs/known_issue/` 最大 KI 為 **KI-034** ⇒ 取用 **WP-63 / GD-39 / KI-035**。
- 依 [GD-35](../../../DECISIONS.md) ② 紀律，三個號在 T0 執行時**仍須重查**；被平行 session 取用則依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，不爭號。
- [stage14 草案](../../stage14/README.md) §3 的候選編號（GD-38 ① 已將其從 WP-62/63/64 順延為 WP-63/64/65）因本 WP 取用 WP-63 **再順延為 WP-64/65/66**。

### D-63-P6 — GD-39 於 T-exit 入帳，不在規劃期寫入（2026-09-10）

GD-37 於 T0 入帳、GD-38 於規劃期入帳、GD-36 於 T-exit 入帳 —— 三種時機都有先例。本 WP 選 **T-exit**，理由是 GD-39 需要 T0 親自複核機制事實後才有把握，且編號重查紀律要求越晚寫越不容易撞號。

**修訂（2026-09-10）——③ 拆出來提前落帳。** 原規劃把 ③（D-63-P4 的機制更正）一併留到 T-exit，代價是「在 T-exit 之前，平行 session 讀 GD-38 ②(b) 仍會被誤導」。重新評估後認定這個代價**不可接受**：

- [WP-62](../wp-62-session-plan-per-item-weapon/README.md) 的 **T4 正是建立武器選單文案的 task**，而 GD-38 ⑥ 的「無 reload」文案依同一錯誤事實而來
- WP-62 T2 完成於 **2026-09-10**（同日），T3/T4 迫近；本 WP T-exit 在 12–16.5 dev-days 之後
- ⇒ 等 T-exit 會讓誤導文案先出貨

⇒ ③ 已直接寫入 [`DECISIONS.md`](../../../DECISIONS.md) 的 **GD-38 ② inline 更正段**（比照該條既有的 `T0 對帳修正` 慣例：更正寫在被更正的那一格，平行 session 讀 GD-38 時一定看得到，而不是要求他們去讀另一條 GD）。

**GD-39 本體（①②④⑤）仍於 T-exit 入帳**，其 ③ 處只指回 GD-38 的更正段，**不重複入帳**。

⚠️ 這是本 WP **唯一**在規劃期就落地的帳本異動；除此之外 `DECISIONS.md` 不應有本 WP 的其他改動。

### D-63.T5-1 — `cycletimeSec` 讀不到 `meta.weapon`，改由匯出宣告的武器 id 查 registry

T5 Steps 5 與 DoD 寫「`cycletimeSec` 從 `meta.weapon` 讀，**不寫死**」。**實況**：`WeaponMeta`（[`metadata.ts:55-67`](../../../../../src/data/metadata.ts)）只有 `id`／`ads`／`bullet`／`projectileOverflow`，**沒有** `cycletimeSec`；`WeaponConfig.cycletimeSec` 從來沒有進過匯出 schema。

**採用**：`resolveCycletimeMs()` 取 `meta.weapon?.id ?? meta.weaponId`，經 `isWeaponId()` 查本 build 的 `WEAPONS` registry。這仍然滿足規劃期真正要守的那條（**不是常數**）：同一份程式碼對 `usp_s_laser` 得 170 ms、對 `ak47` 得 100 ms。DoD 的「以測試傳入不同 cycletime 佐證」由 `cycletimeSec 讀匯出宣告的武器,不是常數——同一份時序換 ak47 就換一組拆解` 這條測試滿足：同一份事件時序，`usp_s_laser` 給 `cadenceWait 170 / settling 330`，`ak47` 給 `100 / 400`，而 `correctionMs` 兩邊相同（它不依賴武器）。

**替代方案（被否決）**：把 `cycletimeSec` 加進 `WeaponMeta` —— 否決理由是它會動匯出 schema，而 README §1.3 明文「**不得**改 `DataRecorder` 或匯出 schema」；且 registry 查表已足夠，加欄位只是把同一個事實寫兩份（第二定義風險）。寫死 170 —— 否決理由是換武器時離線不可察覺地錯。

**殘留**：認不得的武器 id ⇒ `cycletimeMs` 缺席 + `unknown_cycletime` 旗標，`correctionMs` 仍出數但不拆解（不猜預設值：猜錯會讓 `settlingMs` 系統性偏移且離線不可察覺）。

### D-63.T5-2 — L1 的候選集不用 `aliveAt()`，另立「開火那一刻在場上的窗」

`aliveAt()`（T3）的右界是半開的（`tMs < tKillMs`），對 L3 的「擊殺之後誰還活著」是對的。但 L1 問的是**開火那一刻誰在場上**——擊殺那一發的目標在開火瞬間還活著，它是被這一發打掉的。沿用 `aliveAt()` 會把它從自己那一發的候選集排除，於是**命中的那一發永遠歸屬不到自己**，D3 交叉檢核必然失敗。

**採用**：`candidatesForShot()` 用閉區間右界（`tMs <= tKillMs + ε`）。這不是第二套幾何（C-D4 管的是 ε(t)／on-target／eye origin／ω(t)，本函式一個都不算），是同一個窗陣列的另一種區間查詢。以 `D3 的前提:候選集含**被這一發打掉的那顆**` 一條測試把這個理由釘在程式碼旁邊。

### D-63.T5-3 — `geometry` 是物件不是陣列；逐發列刻意不轉載 `fire.targetId`

README §2.5 的 `geometry` 是一個 per-target 陣列。但 FR-63.8 要 `firstShotHitRate`、FR-63.15 要 `n` 與旗標——陣列裝不下聚合量。**採用**：比照 T4 的 `outcome`／`selection` 先例，`geometry` 為物件 `{ shots, targets, firstShotHitRate?, cycletimeMs?, n, flags }`，per-target 列住在 `targets` 裡。

`shots`（逐發意圖歸屬）是 README 沒列的新輸出。它不是裝飾：D3 的 DoD 要求交叉檢核在**全部**命中發上成立，per-target 聚合看不到逐發；T6 的 `approachToFireMs` 也要逐發歸屬。

逐發列**刻意不轉載** `fire.targetId`：交叉檢核由讀得到 payload 的測試自己做，輸出端不該提供一個會被下游誤當資料源的欄位。這同時讓 DoD 的 `intended*` 命名紀律成為一條機械化測試（逐發列上凡 `/target/i` 的鍵必須 `intended` 開頭），而不是靠人看。原始碼掃描同時釘死 `fire.targetId`／`fire.offsetDeg`／`fire.firstShot` 三個字串在模組內出現次數為 **0**。

### D-63.T2-2 — `BD-038` 再撞號，採納 `main` 的保留改落 `BD-039`（2026-09-14）

本分支自 `bc467c4` 切出後，`main` 落了 [`67962ed` *docs: reserve unique bugfix decision numbers for KI-034 to KI-037*](../../../../known_issue/BUGFIX-DECISIONS.md)，把 BD 號重新配過：

| | 本分支（T2 已落地） | `main` （67962ed 保留） |
|---|---|---|
| **BD-038** | KI-035 修復決策 ✅ 已寫 | 保留給 **KI-034** |
| **BD-039** | — | 保留給 **KI-035** |

⇒ 兩邊都宣稱 `BD-038`。這是 **D-63.T2-1 那個號的第二次撞號**：規劃期照 KI 號推的 `BD-035` 已被 KI-038 取用 ⇒ T2 改取 `BD-038` ⇒ `main` 又把 `BD-038` 給了 KI-034。

**採用：改落 `BD-039`。** 依 [GD-15](../../../DECISIONS.md)「先採納先得」，`main` 是已採納的主幹而本分支當時尚未推送 ⇒ 本分支讓號。而 `main` 同一個 commit **已經替 KI-035 保留了 `BD-039`**，所以這不是「再找一個空號」而是直接**採納 `main` 的保留**：`BD-038` 回到 KI-034、`BD-039` 歸 KI-035，兩邊的帳本一次對齊，沒有任何號被爭。

落地範圍：`docs/` 六檔 + `src/` 四檔共 **37 處**（`main.ts` 7、`DataRecorder.test.ts` 5、KI-035 doc 5、`progress.md` 6、`T2-mouse-gain-refresh.md` 4、`BUGFIX-DECISIONS.md` 3、其餘各 1–2）。`src/` 的 15 處全是註解與測試名稱，**無任何測試斷言這個字串**（已逐條確認 `DataRecorder.test.ts` 的 source 掃描測試只掃 `refreshRecorderMouseGain`／`syncAimSettingsLock`，不掃 BD 號）⇒ 改號不改行為。

**為何單獨一個 `docs:` commit，不摻進 merge commit**：帳本編號是協定 §7 的決策，不是機械 rebase；摻進 merge 會讓它在 `git log` 裡消失。

**教訓（接 Surprises 10）**：BD 號在**開工當下**重查還不夠 —— 長命的分支在**推送前**都可能被主幹撞號。給未推送分支用的號，實質上只是「預約」，要到合併那一刻才算數。

---

## Surprises & Discoveries（規劃期、T0、T1、T2、T3、T4 與 T5）

**T0 新發現（2026-09-14）**：`npm.cmd run build` 在 worktree 的 sandbox 內兩次於 esbuild 讀取 `vite.config.ts` 時遭 `Access is denied`，第二次已使用獨立 `npm ci --offline` 安裝而非 junction；在 sandbox 外同一 HEAD、同一 worktree 重跑 exit 0、203 modules。這個差異屬執行環境，非 source failure。舊 Playwright 指令在 GD-44 後混跑兩個 project，SwiftShader 上的三個 `@realgpu` 案例失敗，故按 D-63.T0-2 改用正式分層。另 [WP-59 README](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md) 的 T4／T-exit 仍未勾，雖 HEAD 已含 v8 replacement E2E；後續角距分析必須記錄 HEAD，不能將存在測試誤寫成 WP-59 已正式退出。

1. **v8 整場 0 個 `hit` 事件**。[`SimLoop.ts:354`](../../../../../src/loop/SimLoop.ts) 的 `hit` 事件只在 projectile 分支發射；v8（ak47 與 usp_s_laser 皆無 `bullet`）為純 hitscan。⇒ [micro-flick 設計文件](../../../../algorithm/micro-flick/README.md) 與 [`compute.ts`](../../../../../src/metrics/compute.ts) 裡所有 `t_hit` 公式在 v8 上會拿到**空陣列**且靜默回傳 0 樣本。

2. **`ticks[].aim` 與 `ticks[].dYaw`/`dPitch` 是兩條不同的資料路徑**。[`SimLoop.ts:103`](../../../../../src/loop/SimLoop.ts) 的 mouse 分支註明「**只寫 recorder，不寫 state**」⇒ `aim` 由 render thread 寫（更新率 = 顯示率，這正是 KI-031 的根因），而 `dYaw`/`dPitch` 依事件自身 `timeStamp` 分桶進 tick 窗 ⇒ **真 128 Hz，與顯示率無關**。方向預測因此建立在後者。

3. **[KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md)：`main.ts:712-713` 的註解宣稱的不變式不成立**。`onSensitivityChange`/`onFovChange` 不呼叫 `configureMouseIntegration()`，而匯出時的 `meta.mouseIntegration` 用當下設定重算 ⇒ 「載入 drill 後才調感度」會讓兩者發散且離線不可察覺。

4. **GD-38 ②(b) 的前提有誤**（見 D-63-P4）。

5. **`SEG_V2_PARAMS` 的 `sgWindow` 單位是樣本數，不是時間**。@128 Hz 是約 78 ms 跨度，比 v8 的微調事件（30–80 ms）還長；`peakFloorDegPerSec: 60` 會讓 1°/50 ms 的修正（minimum-jerk 峰值約 38 deg/s）判 `below_floor` ⇒ `correction-free-rate` 系統性高估，且偏誤方向對玩家有利。⇒ 本 WP 走免閾值路線（T6）。

6. **v8 的 Fitts ID 跨度只有約 2 bits**（`D` 2.6–17°、`W` 2.483°@25u ⇒ ID 約 1.0–3.0）。⇒ throughput 只能作 covariate，不交付。

---

7. **（T1）`fire.ammo` 在 v8 上不是單調遞減的。** T1 的 trace harness 原本以「ammo 從 magSize 起遞減」計開火數，實測 ak47 `minAmmo=29`／`usp_s_laser` `minAmmo=11`（各只低於滿匣 1 發），但實際各開了 **4 發** —— 因為 `spawn()` 每次補滿彈匣（D-63-P4），而 harness 每 3 個 tick 就殺一顆。harness 已改為只累加向下的差值。⇒ **T3 實作 `ammo_exhausted_in_window` 時不得假設窗內單調**，必須逐 `fire` 事件判 `ammo === 0`；這同時是 FM-4「彈匣空倉」在 spawn-driven 的 v8 上極罕見的實地佐證。

8. **（T1）WP-62 的守門測試比 T1 的 DoD 檔案清單更早發現範圍。** `weaponId` 一加，`drillFamily.test.ts` 對**全部 38 個 schedulable drill** 的逐一對帳立刻轉紅（`expected undefined to be 'usp_s_laser'`）。這是設計意圖生效（見 D-63.T1-1），但代表 **[T1 檔](T1-zero-spread-weapon.md) DoD 的 `git diff --name-only` 清單在規劃期就是錯的** —— §0.6 的 blast radius 漏掉了 `DECLARED_WEAPON_BY_DRILL_ID`。實際 diff 另含 `src/session/drillFamily.ts`、`src/session/drillFamily.test.ts`、`src/session/sessionWeaponActivation.test.ts`（後二者是 WP-62 刻意寫死的 scope-count 守門，13 → 14）。⇒ T-exit 的 diff 稽核以本條為準，不以 T1 檔原始清單判定「超出範圍」。

9. **（T1）零散布讓 v8 的 e2e 只會更穩，不會更脆。** [`micro-flick-live.spec.ts`](../../../../../tests/e2e/micro-flick-live.spec.ts) 是全 repo 唯一載入 v8 的 e2e；其 500 ms 敲擊節奏的註解明寫是為了讓 **ak47 的 punch 與 spread** 在兩發之間衰減完（該段描述的是 v1，不是 v8）。v8 換零散布後這層補償對 v8 不再需要；6/6 全綠，且未改動該 spec 任何一行。

10. **（T2）`BD-n` 與 `KI-n` 不同步，規劃期照 KI 號推的 `BD-035` 已被別人用掉。** `BD-035`／`BD-036`／`BD-037` 分別屬於 KI-038／KI-037／KI-039。⇒ 本 WP 先改取 `BD-038`（D-63.T2-1），其後 `main` 的 `67962ed` 把 `BD-038` 保留給 KI-034、把 `BD-039` 保留給 KI-035 ⇒ **同一個號撞了兩次**，最終落帳 `BD-039`（D-63.T2-2）。同時發現 `BUGFIX-DECISIONS.md` §1 的索引表**根本沒有 KI-035 這一列**（KI-034 之後直接跳 KI-036），本 task 補上。**教訓**：帳本的號要在**開工當下**重查，不能沿用規劃期推的號；GD-35 ② 對 WP／GD 號的紀律，對 BD 號同樣適用。

11. **（T2）`fpsTestHarness` 有自己的 `drillRunner`，e2e 的 `harness.startDrill()` 不會讓 live 相位變成 `running`。** 這件事推翻了本 task 的第一個假設：原本預期
    [`spider-shot-wide.spec.ts`](../../../../../tests/e2e/spider-shot-wide.spec.ts) 在 `running` 中改 FOV 會被 (b) 的 handler guard 擋下而轉紅，實測 4/4 全綠。harness 自述「每次 `startDrill()` 重建，形成乾淨、與生產同源的**獨立**管線」——`state`／`recorder`／`targetManager`／`drillRunner` 全都是它自己的。⇒ **任何以 `drillRunner.phase` 為判準的新 UI 行為，都不會被 harness 驅動的 e2e 覆蓋到**；要測那種行為必須走真 pointer lock 的 live 路徑（`armAndWaitRunning`）。

12. **（T2）`resolveMouseGain()` 的 `hipStep` 不看 FOV。** 公式是 `sensitivity × RAD_PER_COUNT`；FOV 只進 `adsStep`（`ads.sensitivityRatio × (ads.fovDeg / hipFovDeg)`）。⇒ **KI-035 的 FOV 半邊只咬得到有 `ads` 的武器**；v8 的 `usp_s_laser` 無 `ads` 區塊（T1 已確認），改 FOV 對它的 `dYaw` 逐位無影響。以 `DataRecorder.test.ts` 的斷言 (4) 釘死，免得後續讀者把「FOV 也會污染 dYaw」當成所有 drill 的通則。

13. **（T2）同一個被證偽的不變式在 repo 裡寫了兩遍。** KI-035 只點名 `main.ts` 的「兩者不可能發散」；實作時發現 [`DataRecorder.ts`](../../../../../src/data/DataRecorder.ts) `configureMouseIntegration()` 的 docstring 另有一份同義宣稱（「SettingsPanel 於 Pointer Lock 鎖定中整組隱藏 ⇒ drill 內 sensitivity/FOV 不可能變動」）。後者的推論漏掉的正是 KI-035 的路徑：**載入 drill 之後、取鎖之前**面板是顯示的。兩處都已改寫為列舉「實際保證的重設時機」與「仍不保證的事」。⇒ 診斷 KI 時，值得 grep 同一個不變式宣稱的其他複本。

14. **（T3）`fire.ammo` 記的是扣彈前的存量 ⇒ 規劃期的 `=== 0` 判準永遠不會亮。** 見 D-63.T3-2。**證據**：`SimLoop.ts:510` 寫 `ammo: state.weapon.ammo`，`551` 才做遞減，而 `538` 的 while gate 是 `ammo > 0`。⇒ 匯出的最小值是 1。教訓：規劃期讀欄位名推語意（`ammo === 0` = 空倉）很自然，但「記錄點相對於狀態更新的**位置**」才決定欄位到底是什麼。

15. **（T3）v8 的 60 kills 產生 63 個 `visible`，不是 README 估的約 180 個。** 每次擊殺補位一顆 ⇒ `visible` 數 = 擊殺數 + 期末存活數（3）。**證據**：fixture A 生成器實測 `visibleCount === 63`、`ticks.length === 7682`。NFR-63.3 的兩個數字（180 visible／7,700 ticks）其實對應不到同一個 run。效能斷言兩個規模都留了（0.914 ms／5.187 ms），故此差異不影響閘門，但 T4–T7 若要引用「樣本數」須以實際形狀為準。

16. **（T3）`window` 是本模組的領域詞，讓「禁 DOM 全域」的標準掃描 pattern 直接誤殺。** 既有 `mouseSampleGaps.test.ts` 的純函式掃描以「`window` 加點」禁 DOM；同一條 pattern 套到 `targetWindows.ts` 會打中 `window.flags`／`window.tKillMs` 等數十處領域用法。**證據**：第一次跑該斷言轉紅（`expected 'import type { DrillEvent } …' not to match`）。⇒ 複製既有掃描規則時，要先確認被掃模組的**詞彙**與那條規則的假設不衝突。

14. **（T2）Edge 全量首次出現 `armed` 卡住的 flake。** `hit-feedback-live.spec.ts:541`（`@realgpu`）在全量第一次跑時停在 `'armed'` 10 s；單跑該 spec 3/3、全量重跑 115/115。可疑機制是 `armed → countdown` 由 sim pump 消費 `armRequested`，而 pump 只在 rAF 內跑 ⇒ headed Edge 視窗失焦／被遮擋時會停住。⇒ **`armDrill()` 的第三個 poll 對 rAF 節流沒有免疫力**；它的前兩個 poll 都直接觀測狀態，只有這一個依賴 render loop 有在跑。後續若再遇到，應登記 KI 而非再判一次 flake（判定與證據見 §T2）。


17. **（T4）`timing.countdownMs` 從來沒有進過匯出 `meta`。** 規劃期與 T4 檔都寫「從 `meta` 的 countdown 結束起算」，逐欄掃 `Meta` 才發現這個欄位只活在 `DrillConfig`／`DrillRunner` 裡。**證據**：`grep -rn "countdown" src/` 的 40 筆命中沒有一筆在 `metadata.ts` 的 `Meta` 或 `collectMeta()` 內。⇒ 任何以 metadata 欄位為前提寫的分析步驟，開工時要先驗那個欄位真的在 payload 裡；欄位名在 config 裡看得到，不代表它進得了匯出。

18. **（T4）WP-59 的 replacement sampler 讓「補位比較遠」成為結構性事實，不是雜訊。** 量到 replacement 群的角距分布整體外推於倖存者群（p50 11.28° vs 9.22°，三個分位點同向）。**證據**：60 個 kill-order seed × 57 次補位 = 3,420 次機會，數字見 §T4。機制在 `TargetManager.ts:407-418`——候選以 `killedSeparationDeg` 由大到小排序。⇒ [README §3.1](README.md) 把它列為「若不可比」的**條件**風險，實測結果是它**確實**不可比；`replacementEngagedRate` 的總量因此永遠不會出數（D-63.T4-3）。這也意味著**任何**拿 replacement 與倖存者直接對比的未來指標都要先過同一關。

19. **（T4）FM-4 的緩解措施在它自己的 drill 上沒有定義。** README 的 FM-4 寫「該窗不進 `shotsPerKill` 分母」，但 v8 三顆並發 ⇒ 一發 `fire` 同時落在最多三個窗內，逐窗發數歸屬要等 T5 才存在。⇒ **規劃期為 FM 寫緩解措施時，措施本身也要過一次「這個 drill 的資料形狀支援嗎」的檢查**；本例的措施是照單目標 drill 的直覺寫的。處置見 D-63.T4-2。

20. **（T4）`angularDistanceDeg()` 收的是兩個單位方向向量，不是兩個點。** canonical 實作把「點 → 以 eye 為頂點的單位方向」這一步留在呼叫端（`angularEccentricityDeg()` 自己做了一次）。⇒ 消費端必然要寫一段正規化，這不是重寫幾何（角度本身仍來自 canonical），但邊界要講清楚：本模組的 C-D4 掃描因此**允許 `Math.hypot`、禁掉所有三角函式與弧度換算**，讓「角度只能從 `angularDistanceDeg()` 來」變成機械可驗的。

**T5 新發現（2026-09-14）**：兩個像是漏寫、實則是結構性的缺口。（1）**`WeaponConfig.cycletimeSec` 從來沒有進過匯出 schema** —— `WeaponMeta` 只帶 `id`／`ads`／`bullet`／`projectileOverflow`，所以任何「從 `meta.weapon` 讀節奯」的規劃都只能改走 registry 查表（D-63.T5-1）。（2）**`aliveAt()` 的右界是半開的**（`tMs < tKillMs`）——對 L3 正確，拿去做 L1 則會把「被這一發打掉的那顆」從它自己那一發的候選集排除，使命中發永遠歸屬不到自己（D-63.T5-2）。⭐ **T6 注意**：免閾值描述子若要「進入角半徑後的計數」，同樣要先想清楚右界該開還是該閉。

## T6 L2 免閾值微調描述子 + 擊殺後方向預測曲線（2026-09-14）

`src/metrics/microFlickMetrics.ts` 補上 **L2**（FR-63.10）與**方向預測**（FR-63.11）兩個鍵，加法為主：T4／T5 的 `outcome`／`geometry`／`selection` 一行未改，六個 canonical derivation 檔（含 `submovement.ts`）`git diff` 為空。

| 指令 | exit | 數字 |
|---|---:|---|
| `npx vitest run src/metrics/microFlickMetrics.test.ts` | **0** | **75 passed**（T5 基線 50，**+25 = 本 task**） |
| `npm run typecheck`（×2） | **0** | 兩段 `tsc --noEmit` 皆成功 |
| `npm test`（全量 Vitest） | **0** | **269 files passed／1 skipped**；**3,335 tests passed／2 skipped**（T5 基線 3,310，**+25**） |
| `npm run build` | **0** | Vite 2.13 s，保留既有 chunk-size warning |
| `git diff` on 6 canonical 檔 | — | **空**（五個既有 + `submovement.ts`） |

### E4 逐 `W` 預測結果（T6 DoD：曲線形狀是本指標的主要產出）

fixture E4 = 殺掉 0° 的靶之後**先朝 A（−10°）動 8 個 tick（約 62 ms），再反向奔向 B（+10°）並殺掉 B**。ground truth = B。

| `W` (ms) | 窗內淨位移 | 預測 | 正確？ | `predictionAccuracy` | `n` |
|---:|---|---|---|---:|---:|
| 30 | 負（仍在朝 A） | A | ✗ | **0** | 1 |
| 60 | 負（剛到假動作底部） | A | ✗ | **0** | 1 |
| 90 | 正（已反向越過起點） | B | ✓ | **1** | 1 |
| 120 | 正 | B | ✓ | **1** | 1 |

⇒ 曲線在 60→90 ms 之間翻轉。**這個形狀本身就是訊號**：假動作的持續時間可以從翻轉點讀出來，而任何單一凍結的 `W` 都只會回報一個沒有上下文的布林。對照組 `SINGLE_INTENT`（擊殺後直奔下一顆）四個 `W` 全為 1，符合 T6 Step 6 的「單一意圖軌跡上隨 `W` 增大不下降」。

⚠️ 這是**合成軌跡上的機械驗證**，`n = 1`。它證明的是「這個運算會照定義動」，不是「人類的假動作真有 60–90 ms」。真人常模屬 README §5 的非真人不可項。

### Decision Log

#### D-63.T6-1 — 放寬 T4 的「模組零三角換算」掃描，改為**具名白名單 + 寫死次數**

T4 立過一條 C-D4 守門測試：`microFlickMetrics.ts` 內 `Math.acos`／`asin`／`atan`／`cos`／`sin`／`tan`／`PI` 出現次數皆為 **0**，夾角一律經 `angularDistanceDeg()`。T6 有兩個新構念無法在這條下實作：

- **角半徑** `asin(r/d)`（FR-63.10 的「進入目標角半徑」）
- **方位角** `atan2(Σ dPitch, Σ dYaw)`（FR-63.11 的字面定義）

**處置**：測試從「全部為 0」改為「**`cos`／`sin`／`tan`／`acos` 仍為 0，`asin` 恰 2 處、`atan2` 恰 3 處、`Math.PI` 恰 1 處**」，並在測試內註明每一處的用途。**下一個 `it()`（ε／on-target／eyeHeight／SIM_TO_WORLD 禁令）完全未動**。

**為什麼這不是破防**：那條測試的意圖是「不要在本模組重寫既有幾何構念」。角半徑與方位角都是 T6 才引入的**新**量，repo 內沒有既有實作可呼叫。而 ε(t)、eye origin、朝向定義仍一律走 `angularDistanceDeg()`／`resolveEyeOrigin()`／`eyeOriginForTick()`／`aimForward()`。次數寫死是為了讓**下一個**想加三角換算的人被測試擋下來、回來讀這段理由。

**替代方案（被否決）**：
- 以向量構造迴避 `asin`（取球面上一個切點方向再量夾角）—— 幾何上可行，但正確的切點構造是 `C − (r²/d)·u + (r√(d²−r²)/d)·p`，寫出來沒有人看得懂它就是 `asin(r/d)`。為了通過一條 lint 而讓程式碼變難讀是反向的取捨。
- 把 L2 另開一個模組以保住 T4 的掃描 —— 否決理由為 `approachToFireMs` 要讀 T5 的 `geometry.shots`，拆檔會讓同一層的資料流跨檔繞路；且 README §2.1 明文把 L2／方向列在 `microFlickMetrics.ts`。
- 改用小角近似避開 `asin` —— 否決理由為那會讓「進入角半徑」不再與命中判定**恆等**，正好踩掉 GD-7 的同源要求。

⚠️ **本條是本 task 唯一放寬既有守門測試的地方**，故單獨列帳；T-exit 稽核時應把它與 T4 的原始測試並讀。

#### D-63.T6-2 — 角半徑取 `asin(r/d)`，與 ray/sphere 命中判定**恆等**而非近似

`HitDetector.ts:105` 的 sphere 分支用 `radius = hitbox.width / 2`。射線與球相交 ⟺ 球心到射線的垂距 `d·sin(ε) ≤ r` ⟺ `ε ≤ asin(r/d)`。故「進入角半徑」與「這一發會命中」是**同一個判定**，不是另一套門檻；半徑讀 `meta.targets.hitbox` 這個 GD-7 單一來源，以 `hitboxRadiusU` 輸出讓它可稽核。

`targetHitboxRadius()` **未被 import**（測試掃描佐證）：它回箱體角點半徑，在 cube 上是命中半徑的 **√3 倍**（KI-029），誤用會讓進入判準整個鬆掉。測試把這個倍率釘成一個會紅的數字。

`shape: 'box'` 判為 `unsupported_hitbox_shape` 而**不**改用任何等效半徑：箱體的角半徑隨方位變化，沒有單一值。依 C-D3 寧可具名拒絕，也不要算出一個會說錯話的數字。v8 是 `sphere`，故這條在 v8 上不觸發。

#### D-63.T6-3 — 窗右界：tick 窗維持半開，右緣由**事件錨**補上（回答 T5 的 ⭐ 提醒）

T5 留了一條提醒：「免閾值描述子若要『進入角半徑後的計數』，同樣要先想清楚右界該開還是該閉」。

**本層不需要另立閉區間右界**，因為它的右緣不是靠候選集判定，而是靠**事件**：逐 tick 視角由「擊殺那一發的 `viewYaw`／`viewPitch`」**反向積分**重建，而 `tickRange` 的半開右界 `[tVisible, tKill)` 正好讓最後一個 tick 的下一步落在擊殺瞬間 —— `view[j] = anchor − Σ_{k≥j} dYaw[k]` 於是逐位還原出真實軌跡（合成 fixture 以此驗證）。

`approachToFireMs` 的右界則是 **T5 的意圖歸屬首發**（見 D-63.T6-4），它是事件時刻不是 tick，故完全不受 tick 窗開閉影響。

#### D-63.T6-4 — `approachToFireMs` 的首發一律讀 T5 的歸屬結果，不在 L2 另立判準

規劃期把 T5／T6 列為可並行，若照字面各自實作，L2 勢必要自備一套「這一發打誰」的判準 ⇒ 同一構念兩個定義（C-D4）。

T5 既已落地，`deriveMicroFlickMetrics()` 改為**先算 L1、再把 `geometry.shots` 餵給 L2**，首發取「意圖歸屬為本窗的第一發」（FR-63.8 的同一定義，鍵為窗索引而非 `targetId`）。L2 完全不讀 `fire.targetId`／`offsetDeg`／`firstShot`。

**副作用**：T6 因此實質相依 T5，與 README §4.1 的相依圖（T6 只相依 T3）不符。⇒ **README §4.1 須在 T-exit 對帳時更正為 `T5 → T6`**。

首發早於首次進入角半徑（玩家還沒對準就扣扳機）⇒ 區間為負，標 `fire_before_entry` 且不出數，**不取 0 也不取絕對值** —— 兩者都會把「提早開火」偽裝成「立刻開火」。

#### D-63.T6-5 — L2／方向層採 T5 的「層 = 物件」形狀，不用 README §2.5 的裸陣列

README §2.5 把 `microAdjust` 與 `direction` 寫成裸陣列。T5 已因同一理由把 `geometry` 改為物件（D-63.T5-3）：FR-63.15 要求**每個指標輸出**攜帶 `n` 與封閉詞彙表旗標，裸陣列沒有地方放層級旗標（例如 `no_hitbox` 是整層的性質，不是某一列的）。⇒ 沿用 T5 的先例，兩層皆為 `{ targets／windows, n, flags }`。**README §2.5 須在 T-exit 一併更正。**

### Surprises & Discoveries

1. **ε 是無號角距 ⇒「在靶心兩側左右交替、振幅遞減」的軌跡，`signReversalCount` 是 0 而不是很多**。第一版 E3 fixture 就是這樣寫的，實測只得到 2 次反轉（全部來自銜接處）。因為 ε(t) = |Δ| 在振幅遞減時**單調下降**，左右交替完全不在 ε 上留下痕跡。⇒ 要讓 ε 真的震盪，交替的必須是**離中心的遠近**而不是左右。fixture 已改為在 0.25°／1.05° 之間來回（兩者都在角半徑內），得 10 次反轉。⭐ **T7 注意**：七種故障型態裡的 #3「一路修正」與 #4「過衝後回頭」若照直覺寫成左右交替，會得到一個**恆真的空測試**。

2. **T4 留下的兩條守門測試在 T6 落地時必然轉紅，而且兩條都是「刻意設計成會紅」的**。一條斷言 `microAdjust`／`direction` **不存在**（防先佔位），一條禁止一切三角換算。前者按其註解的意圖翻成「鍵存在且帶得動 `n`／`flags`」；後者見 D-63.T6-1。兩條都不是 bug，是 T4 把「尚未交付」寫成了可執行的斷言 —— 這個做法值得延用，但接手的人要預期它們會擋路。

3. **`Math.atan2(Math.sin(x), Math.cos(x))` 這種慣用的角度折回寫法會踩自己的三角掃描**。改成純算術的 `((x + π) mod 2π + 2π) mod 2π − π` 之後，`sin`／`cos` 歸零、`Math.PI` 也收斂成單一常數 `PI`。副作用是程式碼反而更快也更好讀。

---

## Open Questions

| OQ | 問題 | 預設假設 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-63.1** | 既有 v8 匯出是否屬於已凍結的研究 cohort？ | **2026-09-14 11:42Z 以預設「否」明帳推進**，不是研究者回覆；T1 直接改 fixture，若 T1 前確認 frozen 則轉 v9（見 §T0） | 研究者 | T1 開工前 |
| ~~OQ-63.2~~ | ~~`selectionCostRatio` 貪婪基準線的起點？~~ | ✅ **已關閉（2026-09-14，T4）：被殺目標中心**（非擊殺瞬間瞄準點），以預設假設明帳推進，研究者未另行回覆。基準線是幾何量，不該被執行誤差污染；選定值寫在 `MICRO_FLICK_METRICS_VERSION` 旁的註解與 `candidatesAtKill()` 的 docstring | — | — |
| **OQ-63.3** | `?rawMouse=1` 是否為 v8 的強制採集條件？ | 否，但預設開啟；不進本 WP 任何指標定義 | 研究者 | T7 開工前 |
| ~~OQ-63.4~~ | ~~KI-035 修法取 (a)、(b) 或併行？~~ | ✅ **已關閉（2026-09-14，T2）：(a)+(b) 併行**。(b) 實測不讓任何既有 e2e 轉紅（`spider-shot-wide.spec.ts` 4/4），故不需退回 (a) only。見 D-63.T2-1 | — | — |
| ~~OQ-63.5~~ | ~~GD-39 ③（GD-38 ②(b) 更正）是否提前單獨入帳？~~ | ✅ **已關閉（2026-09-10）：是**，已寫入 GD-38 ② inline 更正段。理由見 D-63-P6 修訂 | — | — |

---

## 交接清單（T-exit 時填寫）

- [ ] 真人 pilot 最小規格（[README §5](README.md) 的六項非真人不可）
- [ ] `?rawMouse=1` cohort 取得後，量免閾值描述子漏檢率的方法
- [ ] KI-031／KI-034 修復後，補 `movementTimeMs`／`peakOmega` 的路徑
