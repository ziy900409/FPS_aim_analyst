# WP-63 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-14 T0 完成）

✅ **T0 entry gate 完成**（2026-09-14 12:38Z）。編號、上游與機制事實已複核；GD-44 的 Edge 全量／chromium-ci fast 與 typecheck、Vitest、build 五項正式基線 exit 0。T1–T7 未開工；OQ-63.1 以具名預設假設推進。

規劃來源：2026-09-10 的設計對話（使用者指定四項計算 → 逐項稽核蒐集層 → 依 `.claude/skills/engineering-planning/SKILL.md` 落成執行計畫）。

---

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry gate | ✅ 完成 | 2026-09-14 | 2026-09-14 12:38Z | 見下方 §T0：五項基線 exit 0，Vitest 3,217 passed／2 skipped、Edge 115 passed、chromium-ci fast 102 passed／1 skipped、build 203 modules；編號、上游、五個 CodeGraph impact、三項機制與 OQ-63.1 明帳。 |
| T1 零散布武器宣告 | ⬜ 未開工 | — | — | — |
| T2 Mouse gain 修復 | ⬜ 未開工 | — | — | — |
| T3 窗界 primitive | ⬜ 未開工 | — | — | — |
| T4 L0 + L3 | ⬜ 未開工 | — | — | — |
| T5 L1 幾何層 | ⬜ 未開工 | — | — | — |
| T6 L2 + 方向 | ⬜ 未開工 | — | — | — |
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

## Decision Log（規劃期與 T0）

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

---

## Surprises & Discoveries（規劃期與 T0）

**T0 新發現（2026-09-14）**：`npm.cmd run build` 在 worktree 的 sandbox 內兩次於 esbuild 讀取 `vite.config.ts` 時遭 `Access is denied`，第二次已使用獨立 `npm ci --offline` 安裝而非 junction；在 sandbox 外同一 HEAD、同一 worktree 重跑 exit 0、203 modules。這個差異屬執行環境，非 source failure。舊 Playwright 指令在 GD-44 後混跑兩個 project，SwiftShader 上的三個 `@realgpu` 案例失敗，故按 D-63.T0-2 改用正式分層。另 [WP-59 README](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md) 的 T4／T-exit 仍未勾，雖 HEAD 已含 v8 replacement E2E；後續角距分析必須記錄 HEAD，不能將存在測試誤寫成 WP-59 已正式退出。

1. **v8 整場 0 個 `hit` 事件**。[`SimLoop.ts:354`](../../../../../src/loop/SimLoop.ts) 的 `hit` 事件只在 projectile 分支發射；v8（ak47 與 usp_s_laser 皆無 `bullet`）為純 hitscan。⇒ [micro-flick 設計文件](../../../../algorithm/micro-flick/README.md) 與 [`compute.ts`](../../../../../src/metrics/compute.ts) 裡所有 `t_hit` 公式在 v8 上會拿到**空陣列**且靜默回傳 0 樣本。

2. **`ticks[].aim` 與 `ticks[].dYaw`/`dPitch` 是兩條不同的資料路徑**。[`SimLoop.ts:103`](../../../../../src/loop/SimLoop.ts) 的 mouse 分支註明「**只寫 recorder，不寫 state**」⇒ `aim` 由 render thread 寫（更新率 = 顯示率，這正是 KI-031 的根因），而 `dYaw`/`dPitch` 依事件自身 `timeStamp` 分桶進 tick 窗 ⇒ **真 128 Hz，與顯示率無關**。方向預測因此建立在後者。

3. **[KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md)：`main.ts:712-713` 的註解宣稱的不變式不成立**。`onSensitivityChange`/`onFovChange` 不呼叫 `configureMouseIntegration()`，而匯出時的 `meta.mouseIntegration` 用當下設定重算 ⇒ 「載入 drill 後才調感度」會讓兩者發散且離線不可察覺。

4. **GD-38 ②(b) 的前提有誤**（見 D-63-P4）。

5. **`SEG_V2_PARAMS` 的 `sgWindow` 單位是樣本數，不是時間**。@128 Hz 是約 78 ms 跨度，比 v8 的微調事件（30–80 ms）還長；`peakFloorDegPerSec: 60` 會讓 1°/50 ms 的修正（minimum-jerk 峰值約 38 deg/s）判 `below_floor` ⇒ `correction-free-rate` 系統性高估，且偏誤方向對玩家有利。⇒ 本 WP 走免閾值路線（T6）。

6. **v8 的 Fitts ID 跨度只有約 2 bits**（`D` 2.6–17°、`W` 2.483°@25u ⇒ ID 約 1.0–3.0）。⇒ throughput 只能作 covariate，不交付。

---

## Open Questions

| OQ | 問題 | 預設假設 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-63.1** | 既有 v8 匯出是否屬於已凍結的研究 cohort？ | **2026-09-14 11:42Z 以預設「否」明帳推進**，不是研究者回覆；T1 直接改 fixture，若 T1 前確認 frozen 則轉 v9（見 §T0） | 研究者 | T1 開工前 |
| **OQ-63.2** | `selectionCostRatio` 貪婪基準線的起點？ | 被殺目標中心（非擊殺瞬間瞄準點） | 研究者 | T4 開工前 |
| **OQ-63.3** | `?rawMouse=1` 是否為 v8 的強制採集條件？ | 否，但預設開啟；不進本 WP 任何指標定義 | 研究者 | T7 開工前 |
| **OQ-63.4** | KI-035 修法取 (a)、(b) 或併行？ | (a)+(b) 併行 | 實作者 | T2 開工時 |
| ~~OQ-63.5~~ | ~~GD-39 ③（GD-38 ②(b) 更正）是否提前單獨入帳？~~ | ✅ **已關閉（2026-09-10）：是**，已寫入 GD-38 ② inline 更正段。理由見 D-63-P6 修訂 | — | — |

---

## 交接清單（T-exit 時填寫）

- [ ] 真人 pilot 最小規格（[README §5](README.md) 的六項非真人不可）
- [ ] `?rawMouse=1` cohort 取得後，量免閾值描述子漏檢率的方法
- [ ] KI-031／KI-034 修復後，補 `movementTimeMs`／`peakOmega` 的路徑
