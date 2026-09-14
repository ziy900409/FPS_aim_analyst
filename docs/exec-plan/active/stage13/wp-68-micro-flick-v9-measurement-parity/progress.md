# WP-68 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-14 T1 完成）

🟡 **T0／T1 已完成，T2 可開工**。分支 `wp-68-micro-flick-v9-measurement-parity`（基準 `main` @ `eec359d`）。

T1 結論一句話：**v9 宣告 `weaponId: 'usp_s_laser'` 並登記 `DECLARED_WEAPON_ROSTER`，FR-68.1／68.2 與 NFR-68.1／68.2 逐條有機械證據**（spawn trace 96 snapshot 逐位 `Object.is` 相同且兩邊實測各開 **4** 發、`sampleSpread()` rng 呼叫數 **0** 且 ak47 對照組 **> 0**、`meta.weaponId` round-trip 綠）。全量閘：typecheck ×2、Vitest **3,362 passed／2 skipped（271 files）**、build **203 modules**、`micro-flick-live.spec.ts` **6 passed** 皆 exit 0。⚠️ 全量 Vitest 揭露 DoD 未點名的**第二個**硬編 roster 大小守衛（`sessionWeaponActivation.test.ts:67`），已一併修正（[Surprises 2](#surprises--discoveriest1)）。⚠️ 另查出 spread 與 spawn 是**兩個獨立的 `createRan1` 實例** ⇒ WP-63 T1 檔頭「(2) 是 (1) 在實彈下仍成立的原因」為過度宣稱；v9 新檔的註解已照實改寫，v8 該檔屬 WP-63 已交付證據、依範圍紀律不動，記為 **[OQ-68.5](#open-questionst1-後)（Deadline = T-exit）**。

T0 結論一句話：**兩號沿用（WP-68／GD-45），上游 WP-63 三項證據綠燈，五項基線指令全部 exit 0 且數字與 WP-63 T-exit 逐項相同，`endCondition` 不在匯出 schema ⇒ T2 走路徑 B，OQ-68.2 以非阻塞預設「否」明帳推進。** 另有三項 T0 自行查出、規劃期未知的事實：README「唯三差異」漏列 `targets.count`（[Surprises 1](#surprises--discoveriest0)）、CodeGraph 索引只覆蓋 repo 一小片而其 `callers` 輸出不可採信（[D-68.T0-4](#d-68t0-4--codegraph-對本問題降級為blast-radius-下界c-d5-判定改以全-repo-grep-為權威2026-09-14)）、T1 換武器會把彈匣 30 → 12 而 v9 的鐘不會因失手而停（[OQ-68.4](#open-questionst0-後)）。

規劃於 2026-09-14 完成，承 [WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md)（已交付，v0.1.1）當場發現的缺口。

規劃來源：使用者 2026-09-14 在 WP-63 釋出後問「v9 是否也有同等的量測基礎層」。以 WP-63 T-exit 新增的 determinism harness 實測 v8／v9／「v9 只換武器」三組，確認**結構可用、儀器污染**（見 §規劃期實測），再依 `.claude/skills/engineering-planning/SKILL.md` 落成執行計畫。

---

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry gate | ✅ 完成 | 2026-09-14 | 2026-09-14 | 見下方 [§T0](#t0--entry-gate編號重查上游驗證基線實測oq-682-收斂2026-09-14)。WP-68／GD-45 重查後沿用；WP-63 三項上游證據綠（`targetWindows.test.ts` 27／`microFlickMetrics.test.ts` 80／`wp63-v8-metrics-determinism.test.ts` 11／`drillFamily.test.ts` 155）；五項基線 exit 0 —— typecheck ×2、Vitest **3,351 passed／2 skipped（270 files）**、build **203 modules**、Tier 1 **102 passed／1 skipped**（8.4 m）、Tier 2 Edge **115 passed／0 failed**（18.3 m，第一輪 1 failed 為 [OQ-66.9](../wp-66-target-hit-visual-feedback/progress.md) 機制第五次發生，已明帳）；CodeGraph impact 已記錄且**降級為下界**，C-D5 以 grep 判定**不觸發**；`endCondition` **不在**匯出 schema ⇒ T2 走**路徑 B**；OQ-68.2 以預設「否」明帳推進；GD-45 草稿已寫入。 |
| T1 零散布武器宣告 | ✅ 完成 | 2026-09-14 | 2026-09-14 | 見下方 [§T1](#t1--v9-宣告-weaponid-usp_s_laser--roster-登記--斷代標記2026-09-14)。v9 fixture 宣告 `usp_s_laser` + `DECLARED_WEAPON_ROSTER` 登記（14 → 15）；spawn trace **96 snapshot 逐位 `Object.is` 相同、兩邊各 4 發**；rng 呼叫數 **0**（ak47 對照 > 0）；recoil table 逐位 0；`meta.weaponId` round-trip 綠；v1–v7 七支 `hasOwnProperty('weaponId') === false`。全量閘 exit 0：typecheck ×2、Vitest **3,362 passed／2 skipped（271 files，+11 = 本 task 新增數）**、build **203 modules**、`micro-flick-live.spec.ts` **6 passed**。⚠️ 第一輪全量 Vitest 1 failed = DoD 未點名的第二個硬編守衛 `sessionWeaponActivation.test.ts:67`，已修正並重跑。 |
| T2 計時制右界 | ⬜ 未開工 | — | — | — |
| T-exit | ⬜ 未開工 | — | — | — |

---

## 規劃期實測（2026-09-14，HEAD `e58232d` / v0.1.1）

以 [`wp63-v8-metrics-determinism.test.ts`](../../../../../src/loop/__tests__/wp63-v8-metrics-determinism.test.ts) 的 harness 形狀（真 `TargetManager` seeded spawn、真 camera hitscan、真 `DataRecorder`、144 Hz 幀序列）對三組 config 餵**同一份合成輸入**。探針為一次性，跑完即刪，未進 repo。

| 量 | v8（已交付） | **v9（現況）** | v9 只換武器 |
|---|---|---|---|
| `meta.weaponId` | `usp_s_laser` | **`ak47`** | `usp_s_laser` |
| `targets.hitbox.widthU` | 1.08375 | 0.975375 | 0.975375 |
| `endCondition` | `targetCount 60` | `timeLimit 60000` | `timeLimit 60000` |
| 窗數 / `visible` 數 | 21 / 21 ✅ | 4 / 4 ✅ | 21 / 21 ✅ |
| `fire` 事件數 | 37 | 33 | 37 |
| 帶散布的發數 | **0** | **33** | **0** |
| 帶 aim punch 的發數 | **0** | **32** | **0** |
| 命中數 | 18 | **1** | 18 |
| `outcome.n` | 18 | **1** | 18 |
| `outcome.flags` | `idle_span_unbounded` | `single_kill`, `idle_span_unbounded` | `idle_span_unbounded` |
| `geometry.cycletimeMs` | 170 | **100** | 170 |
| `geometry.firstShotHitRate` | 0.421 | **0** | 0.421 |
| `selection.n` | 17 | **0** | 17 |
| `selection.flags` | `replacement_distance_not_comparable` | **`no_kill_transitions`**, 同左 | 同 v8 |
| `microAdjust.hitboxRadiusU` | 0.541875 | **0.4876875** ✅ | 0.4876875 |
| `direction` 逐 `W` 的 `n` | 17 / 17 / 17 / 17 | **0 / 0 / 0 / 0** | 17 / 17 / 17 / 17 |
| `direction.flags` | （空） | **`no_kill_transitions`** | （空） |
| trace flags | `never_killed` | `never_killed`, **`ammo_exhausted_in_window`** | `never_killed` |
| `eyeOriginSource` | `meta` | `meta` ✅ | `meta` |

### 三條判讀

1. **窗界原語與指標模組對 v9 零修改可用。** 窗數不變式成立；`cycletimeMs` 正確解析成 ak47 的 **100**（證明 [D-63.T5-1](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 的 registry 查表確實讀匯出宣告的武器，不是寫死 170）；`hitboxRadiusU` 正確讀到 v9 縮小 10% 的球；eye origin 正常；缺樣本一律具名旗標不補零。**沒有崩、沒有靜默算錯。**
2. **污染全部來自武器，不是來自縮小的靶。** 只換武器一項，命中 1 → 18，兩個需要「擊殺→擊殺」轉移的層（L3 選擇策略、方向預測曲線）從 `n = 0` 復活到 `n = 17`。
3. ⚠️ **「v9 只換武器」與 v8 的數字幾乎逐位相同 —— 那是這份合成瞄準軌跡的巧合，不是等價的證據。** 該 harness 的瞄準 offset 依 tick 幾何衰減，衰減值沒有落在兩個角半徑（v9 約 1.118° / v8 約 1.242°）之間的窄帶裡，於是命中/失手樣態恰好相同。**本 WP 不得引用那個巧合作為任何論證**；T2 的 v9 非空對空前置正是為了不讓這個巧合被誤當成覆蓋。

### 第二個發現：`validSpanMs` 是為 kill-budget drill 定義的

[`microFlickMetrics.ts`](../../../../../src/metrics/microFlickMetrics.ts) `deriveOutcome()`：`validSpanMs = lastKillMs - firstVisibleMs`。

對 v8（`targetCount`）自然；對 v9（`timeLimit 60000`）**不成立** —— 最後一次擊殺之後的剩餘時間（受試者仍在打、在失手、在找靶）被整段排除出分母 ⇒ `killRateHz` 系統性**高估**。偏誤方向與 [KI-037](../../../../known_issue/KI-037-valid-duration-includes-countdown.md)（恆向低估）相反，性質相同：看起來合理、實際會說錯話的數字（C-D3）。⇒ 成為 FR-68.3 與 T2。

> **KI-037 不咬 v9**：其標的為 `DrillMetricRegistry.validDurationMs()`（history／assessment 投影，v9 為 practice 不進該路徑），且談的是**左界**（倒數）。WP-63 的 `T_valid` 錨在第一個 `visible`（[D-63.T4-1](../wp-63-micro-flick-v8-measurement-foundation/progress.md)）已結構性避開倒數。本 WP 只解**右界**。

### 第三個發現：v9 現在就收得到資料

| 入口 | 位置 |
|---|---|
| app 變體清單 | [`main.ts:306`](../../../../../src/main.ts) |
| session family roster | [`drillFamily.ts:104`](../../../../../src/session/drillFamily.ts)（`micro-flick` 家族） |
| live e2e | [`micro-flick-live.spec.ts:318, 356, 430`](../../../../../tests/e2e/micro-flick-live.spec.ts) |

且 v9 **不在** `DECLARED_WEAPON_ROSTER`（[`drillFamily.ts:156-170`](../../../../../src/session/drillFamily.ts)，v8 在 `:169`）⇒ 即使只改 fixture，Session Plan 的逐列武器指定仍可覆蓋它 ⇒ FR-68.2。

⇒ 操作員今天就能載入 v9 收資料，匯出看起來完全合理，而 `meta.weaponId` 會是 `ak47`。**活的風險，不是理論風險。**

---

## Decision Log（規劃期）

### D-68-P1 — v9 用 `usp_s_laser`，與 v8 同一把（2026-09-14，使用者拍板）

使用者在開 task 時直接指定。⇒ OQ-68.1 於規劃期即關閉，不進 T0。

**後果（必須明帳）**：v8 與 v9 自此在 `meta.weaponId` 上**不可分**，兩者的機械區分只剩 `meta.drillId`。這不是問題（兩支的靶徑與計分制本來就不同、本來就不該混池），但分析側的分池鍵從「weaponId 或 drillId 皆可」收窄成「**必須** drillId」，須在 `GD-45` ② 與交接清單具名。

**Alternatives considered**：替 v9 另立一把同規格但不同 id 的武器（讓 `meta.weaponId` 保留區分力）—— 未採納。使用者已拍板，且多一把設定完全相同的武器只會讓 `WEAPONS` 表多一個沒有語意差異的條目，維護成本換來的是一個 `drillId` 已經提供的區分。

### D-68-P2 — 本 WP 不碰 `DrillMetricRegistry` / KI-037（2026-09-14）

T2 的右界問題與 [KI-037](../../../../known_issue/KI-037-valid-duration-includes-countdown.md) 表面同型（都是計分窗算錯），但：路徑不同（離線 metrics vs history 投影）、界不同（右界 vs 左界）、消費者不同（v9 practice vs `spider-shot-v2/v3` 的主指標）、且 KI-037 有自己的 `BD` 號與修法。合併處理會讓一個 practice drill 的切片動到兩支已凍結 assessment 的主指標。

⇒ T2 的 DoD 與 T-exit 都以 `src/history/DrillMetricRegistry.ts` 的 `git diff` 為空稽核這條邊界。

### D-68-P3 — 落點與編號（2026-09-14）

規劃期重查：`exec-plan/README.md §2` 最大採納 **WP-67** ⇒ 取 **WP-68**；`DECISIONS.md` 最大已落帳 **GD-44**、`GD-43` 由 WP-67 預約 ⇒ 取 **GD-45**。依 [GD-35](../../../DECISIONS.md) ② 紀律，兩號在 T0 執行時**仍須重查**；被平行 session 取用則依 [GD-15](../../../DECISIONS.md) 順延。

**落點偏離（明帳）**：本 WP 主題（v8 量測基礎層的姊妹補齊）**不屬** stage13 的「原始輸入取樣與抬滑鼠判準驗證」主題，承 WP-62／63／64／65／66／67 的同一先例落於此處。

**stage14 連帶影響**：採納 WP-68 後，[stage14 §3](../../stage14/README.md) 的三個候選依 GD-15「先採納先得」順延為 **WP-69／70／71**；該檔 2026-09-14 的註記寫的是前一版數字，T-exit 須同步更新。

---

## Surprises & Discoveries（規劃期）

1. **v9 的量測層其實一行都不用改** —— 規劃前的預期是「v9 要重做一次 WP-63」。實測後發現窗界原語與四層指標對 v9 零修改可用，因為 v9 與 v8 共用同一個 population 形狀（`activeCount: 3`、`next-tick`、無 motion、sphere hitbox、locked translation、同一 spawn 場域）。**缺的是儀器宣告與一條計時制的窗界決策**，不是指標層。這把估時從「比照 WP-63」的 12+ d 壓到 3 d。
2. **`cycletimeMs` 在 v9 上回 100 是好消息不是壞消息** —— 它證明 T5 的 `resolveCycletimeMs()` 真的讀匯出宣告的武器而不是寫死 v8 的 170。那條在 WP-63 只有合成 fixture 佐證，v9 是第一個真實的反例。
3. **`ammo_exhausted_in_window` 在 v9 上自己亮了** —— FR-63.13 的旗標在 v8 上從未在真實 run 觸發過（每殺一顆就補滿彈匣），v9 因為幾乎殺不掉靶而真的打空了 ak47 的彈匣。這是該旗標第一次在非手工 fixture 上證明自己會咬。

---

## Open Questions（規劃期 — 現況見下方 [§Open Questions（T0 後）](#open-questionst0-後)）

| OQ | 問題 | 預設假設 | Owner | Deadline |
|---|---|---|---|---|
| ~~OQ-68.1~~ | ~~v9 換成哪一把武器？~~ | ✅ **已關閉（2026-09-14，使用者拍板）：`usp_s_laser`**。見 D-68-P1 | — | — |
| **OQ-68.2** | 既有 v9 匯出是否屬於已凍結的研究 cohort？ | **否** —— v9 為 practice/researcher-only，未進 history；T1 直接改 fixture 並以 `meta.weaponId` 斷代 | 研究者 | T1 開工前 |
| **OQ-68.3** | 計時制的右界取「最後一個 tick」還是「`timeLimit` 從第一個 `visible` 起算」？ | **最後一個 tick** —— 匯出自身的事實，不需要相信 config 與實際錄製對得上；兩者差異須在 T2 實測入帳 | 實作者 | T2 開工時 |

---

## 交接清單（T-exit 時填寫）

- [ ] v8／v9 因同武器而不可分，對混池分析的具體操作要求
- [ ] `endCondition` 若日後進匯出 schema，本 WP 的查表應改讀匯出並移除 `unknown_end_condition`
- [ ] v9 的真人 pilot 需求（承 [WP-63 §5](../wp-63-micro-flick-v8-measurement-foundation/README.md)，兩支應一起收而非各收一次）

---

## T0 — Entry gate：編號重查、上游驗證、基線實測、OQ-68.2 收斂（2026-09-14）

> 分支 `wp-68-micro-flick-v9-measurement-parity`，基準 `main` @ **`eec359d`**（`docs(wp-68): plan micro flick v9 measurement parity`）。
> 本 task **零 `src/` 異動**（`git diff --name-only` 只含本檔）。

### T0.1 編號重查（[GD-35](../../../DECISIONS.md) ② 紀律）

| 項目 | 規劃期（2026-09-14） | **T0 重查（2026-09-14，`eec359d`）** | 判定 |
|---|---|---|---|
| WP | `exec-plan/README.md §2` 最大採納 **WP-67** | `exec-plan/README.md:168` 已有 **WP-68** 列（規劃期採納時寫入，狀態 ⬜）；全檔 `WP-\d+` 去重排序最大值 = **WP-68**，無 WP-69 以上 | ✅ **WP-68 未被平行 session 取用**，沿用，資料夾不改名 |
| GD | `DECISIONS.md` 最大已落帳 **GD-44**、`GD-43` 由 WP-67 預約 | `DECISIONS.md` 最大**已落帳標題** = `### GD-44`（`:26`）；`GD-43` 在本檔仍**零標題命中**（唯一出現處是 GD-44 ① 內的交叉引用），維持 WP-67 預約中；`GD-45` 在 `DECISIONS.md` **零命中** | ✅ **GD-45 未被取用**，沿用 |

`GD-45` 在 `docs/**.md` 命中 8 個檔，逐檔確認**全部**為本 WP 自身的預約敘述（WP-68 的 README／T0／T-exit／task-checklist／progress、stage13 README §2 與 §3、`exec-plan/README.md §2` 的 WP-68 列）＋ WP-63 progress 內一句「不改用 GD-45」的駁回理由。無第三方占用。`GD-46` 以上在 `docs/` 全樹零命中。

### T0.2 上游 exit-gate 驗證（WP-63）

[WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 交付於 **`ade25f7`**（`docs(wp-63): T-exit gate and evidence reconciliation`，2026-09-14），其後 **`e58232d`** = `chore(release): v0.1.1`。T0 所在 HEAD `eec359d` 為其直接後繼。三項證據逐項複核：

| 上游證據 | T0 實測 |
|---|---|
| `src/metrics/targetWindows.ts` 存在且測試綠 | ✅ 檔存在（9,171 B）；`src/metrics/targetWindows.test.ts` **27 tests / 68 ms 綠** |
| `src/metrics/microFlickMetrics.ts` 存在且測試綠 | ✅ 檔存在（60,840 B）；`src/metrics/microFlickMetrics.test.ts` **80 tests / 167 ms 綠** |
| `src/loop/__tests__/wp63-v8-metrics-determinism.test.ts` 綠（T2 要複用其 harness 形狀） | ✅ **11 tests / 708 ms 綠** |
| `DECLARED_WEAPON_BY_DRILL_ID` 已含 v8 | ✅ `drillFamily.ts:169` = `[microFlickThreeTargetTestV8.drill.drillId, ...weaponId]`；roster 定義於 `:156`、map 建於 `:201`；`drillFamily.test.ts` **155 tests 綠** |

⇒ 上游綠燈成立，T1 可開工。

### T0.3 NFR-68.4 基線實測（HEAD `eec359d`，未改任何 `src/`）

| # | 指令 | exit | **實測數字** |
|---|---|---|---|
| 1 | `npm.cmd run typecheck`（`tsc --noEmit` ×2） | **0** | 無輸出；wall 約 38 s（20:28:06Z → 20:28:44Z） |
| 2 | `npm.cmd test`（全量 Vitest） | **0** | **Test Files 270 passed / 1 skipped (271)**；**Tests 3,351 passed / 2 skipped (3,353)**；Duration **13.36 s**（transform 17.02 s／collect 55.59 s／tests 30.79 s） |
| 3 | `npm.cmd run build` | **0** | **203 modules transformed**；`dist/assets/index-h3CR_c6s.js` **1,244.34 kB**（gzip 354.56 kB）；built in **2.27 s** |
| 4 | `npm.cmd run test:e2e:fast -- --workers=1`（[GD-44](../../../DECISIONS.md) Tier 1 chromium-ci） | **0** | **102 passed / 1 skipped**（103 tests，1 worker，**8.4 m**） |
| 5 | `npm.cmd run test:e2e -- --workers=1`（GD-44 Tier 2 Edge 全量，headed） | **0**（第二輪） | **115 passed / 0 failed**（115 tests，1 worker，**18.3 m**）。⚠️ 第一輪為 **114 passed / 1 failed，exit 1**，詳見下方 |

Vitest／build／兩層 Playwright 的四個數字與 [WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 收尾時記錄的（**3,351 passed／2 skipped／270 files**、**203 modules**、Tier 1 **102 passed／1 skipped**、Tier 2 **115 passed**）**逐項相同** ⇒ v0.1.1 之後到 `eec359d` 之間（只有 `chore(release)` 與本 WP 的規劃文件）確實零 `src/` 異動，基線可信。

#### Tier 2 第一輪的 1 failed —— [OQ-66.9](../wp-66-target-hit-visual-feedback/progress.md) 機制的**第五次**發生

| 輪次 | 指令 | 結果 |
|---|---|---|
| 1 | `npm.cmd run test:e2e -- --workers=1` | **114 passed / 1 failed，exit 1**（18.7 m） |
| 2 | `npx.cmd playwright test --project=edge tests/e2e/hit-feedback-live.spec.ts --workers=1` | **3 passed，exit 0**（1.6 m），含第一輪紅掉的那一條 |
| 3 | `npm.cmd run test:e2e -- --workers=1`（乾淨全量重跑） | **115 passed / 0 failed，exit 0**（18.3 m） |

失敗條目：`tests/e2e/hit-feedback-live.spec.ts:541`（WP-66 `換場景：離開再載回 br-field 後仍生效（FM-3 wiring #3/#4）` `@realgpu`）。失敗樣態**不是斷言不符**，是 `support/arm.ts:120` 的 `expect.poll(...).not.toBe('armed')` 逾時 10 s —— drill 卡在 `armed` 相位，亦即**待命閘的真實左鍵取鎖沒發生**。

⇒ 與 [WP-66 T-exit §T-exit.4](../wp-66-target-hit-visual-feedback/progress.md) 記載的機制**完全相同**：該 spec 是全 115 條裡**唯一**需要**真實** Pointer Lock 的（其餘走 WP-65 的合成 `armDrill()` 脈衝），headed Edge 一旦掉焦點就會以這個樣態轉紅。WP-65 T6／WP-66 T5／WP-66 T-exit 第一輪／WP-66 後續切片各記錄過一次，**本輪是第五次**。

**本 gate 的處置與誠實邊界**：
- 第一輪期間本 session **未**平行下任何指令（已遵守 T0 Steps 3 的警告）⇒ 干擾源不在本 session 可控範圍內（本機桌面環境仍可能奪取焦點）。
- 不把它記成 flaky test —— 它每次都有確切機制（[OQ-66.9](../wp-66-target-hit-visual-feedback/progress.md) 已明載）。
- 不新開 KI：`docs/known_issue/` 逐檔確認無對應條目，且 WP-66 已以 OQ-66.9 持有此議題；本 gate 只**補一次發生紀錄**，不搶該 OQ 的 owner。
- **基線以第三輪的 `115 passed / 0 failed` 為準**，但 T2 比對時必須知道：Tier 2 的單輪 exit 0 **不是穩定可得的**，對 NFR-68.4 的判讀應以「115 條全綠 + 失敗條目是否為 `hit-feedback-live.spec.ts`」兩問並用，而不是只看 exit code。

### T0.4 CodeGraph impact 重跑 — 以及一個必須明帳的索引缺口

```
codegraph.cmd status .                                   # 146 files / 4,243 nodes / 7,495 edges / 8.61 MB
codegraph.cmd sync .                                     # "Already up to date"
codegraph.cmd impact deriveOutcome -j -p .
codegraph.cmd callers deriveOutcome -j -l 1000 -p .
codegraph.cmd callers deriveMicroFlickMetrics -j -l 1000 -p .
```

| 量 | 值 |
|---|---|
| `impact deriveOutcome` 的 `nodeCount` / `edgeCount` | **3 / 2** |
| affected 條目 | `deriveOutcome`（function, `src/metrics/microFlickMetrics.ts:365`）、`microFlickMetrics.ts`（file）、`wp63-v8-metrics-determinism.test.ts`（file） |
| 非檔案符號數 | **1**（`deriveOutcome` 自身） |
| distinct file 數 | **2**（`src/metrics/microFlickMetrics.ts`、`src/loop/__tests__/wp63-v8-metrics-determinism.test.ts`） |
| `callers deriveOutcome` | **`{"callers": []}`** |
| `callers deriveMicroFlickMetrics` | **`{"callers": []}`** |

⚠️ **這兩個空結果與事實不符，索引不完整**：`deriveMicroFlickMetrics` 明明被兩個測試檔 import，`deriveOutcome` 明明在同檔的 `deriveMicroFlickMetrics` 內被呼叫。佐證：`codegraph status` 報 **146 files（127 typescript）**，而 `src/` 單一目錄就有 **421 個 `.ts`**；`codegraph files` 在 `src/metrics` 下只列到 `microFlickMetrics.ts`／`.test.ts`／`trackingPilotHistoryExclusion.test.ts`，**`targetWindows.ts` 根本不在索引內**。`sync` 仍回「Already up to date」⇒ 不是 staleness，是索引涵蓋範圍本身就是子集。

⇒ **本 gate 對 CodeGraph 結果的採信降級為「blast radius 下界」**；C-D5 的判定改以全 repo grep 為權威證據。

**C-D5 邊界結論（grep 權威，`node_modules` 排除）**：

| 檢查 | 結果 |
|---|---|
| `deriveOutcome` 出現處 | **僅** `src/metrics/microFlickMetrics.ts:365`，且**未 export**（`function deriveOutcome(`，無 `export` 前綴）⇒ 模組私有 |
| `deriveMicroFlickMetrics` 的 importer | **恰好 2 個，皆為測試**：`src/loop/__tests__/wp63-v8-metrics-determinism.test.ts:8`、`src/metrics/microFlickMetrics.test.ts:31`。**零 production importer** |
| `src/history/DrillMetricRegistry.ts` 是否消費 | **否** —— 該檔對 `microFlick`／`micro_flick`／`MicroFlick` 零命中 |
| 晉升指標（`tests/golden/research/promoted-{curve,kinematics,phase-sync,segments}.test.ts`）是否消費 | **否** —— 四檔對 `microFlick`／`targetWindows` 零命中 |

⇒ **C-D5 不觸發**。T2 改 `deriveOutcome()` **不是**晉升指標語意變更，不需 Python 對表、不需重跑 `research/fixtures/golden/`。README §2b 該列判定在 T0 仍成立。

### T0.5 親自複核兩條規劃期的機制宣稱

**(a) v9 確實無 `weaponId`，且球徑由 v8 常數推導** ✅

以 `sed` 抽出兩支 config 的欄位序列後 `diff -u` 逐欄比對（非引用 README）：

- `src/drill/micro_flick_three_target_test_v9.ts:11-14` 的 `drill` 物件**無** `weaponId` 鍵（v8 在 `:12` 有 `weaponId: 'usp_s_laser'`）。
- `:6` 的 `MICRO_FLICK_V9_TARGET_DIAMETER_U = MICRO_FLICK_V8_TARGET_DIAMETER_U * 0.9`，其中 `MICRO_FLICK_V8_TARGET_DIAMETER_U` 由 `:2` 自 v8 模組 import ⇒ 兩者不可能漂移。✅
- 「吃預設 `ak47`」的機制**親自確認**：`src/main.ts:1622` 與 `:1670` 皆為 `activeDrillConfig.weaponId ?? 'ak47'`（另 `src/data/metadata.ts:17` `DEFAULT_WEAPON_ID = 'ak47'`）。

⚠️ **README §Truth model 的「唯三差異」不精確，T-exit 須更正**。機械 diff 的實際差異是**四項**（`drillId` 與「v9 缺 `weaponId`」＝本 WP 標的，不計入）：

| 欄位 | v8 | v9 |
|---|---|---|
| `targets.count` | 60 | **600** ← README 未列 |
| `targets.hitbox.{width,height,depth}U` | `MICRO_FLICK_V8_TARGET_DIAMETER_U` | `MICRO_FLICK_V9_TARGET_DIAMETER_U`（×0.9） |
| `sequence.seed` | 56008 | 56009 |
| `endCondition` | `targetCount 60` | `timeLimit 60000` |

其餘（`mode`／`playerControl`／`targets.distance`／`shape`／`population`／整個 `spawnArea` 八個值／`timing.countdownMs`）**逐字相同**。`targets.count` 的差異**不影響**本 WP 的任何論證，且已就地驗證其語意：`src/drill/DrillRunner.ts:274-283` 只以 `endCondition.targetCount`／`endCondition.timeLimit`／`timing.timeLimitMs` 後援閘三者判 `ended`，`targets.count` 是 `TargetManager` 的 spawn 上限而非結束條件；v9 **未**宣告 `timing.timeLimitMs` ⇒ v9 確實由 60 s 的鐘結束，FR-68.3 的前提成立。

**(b) `validSpanMs` 確實是 `lastKillMs - firstVisibleMs`** ✅ —— 但**行號要更正**：

`src/metrics/microFlickMetrics.ts:386`（README §0.2 寫 `:385`）：

```ts
const validSpanMs = hasSpan ? lastKillMs - firstVisibleMs : undefined;
```

`deriveOutcome()` 起於 `:365`。連帶受右界影響的還有同函式內三處：`:386-394` 的 `shots` 事件視窗（`event.t <= lastKillMs + WINDOW_EPSILON_MS`）、`:405` 的 `ammoExhausted` 窗篩選、`:415` 的 `killRateHz = n / (validSpanMs / 1000)`。T2 的分流必須一併涵蓋這三處，否則 `shotsPerKill`／`shotAccuracy` 的分子分母會落在兩個不同的窗上（見 Surprises 6）。

`MICRO_FLICK_OUTCOME_FLAG_VOCABULARY`（`:55-70`）現有 **7** 個旗標（`no_valid_span`／`no_kills`／`no_shots`／`single_kill`／`idle_span_unbounded`／`focus_lost_during_run`／`ammo_exhausted_in_run`），T2 擬新增 2 個。

### T0.6 `endCondition` 是否在匯出 schema 內 → **否**，T2 走**路徑 B**

逐欄掃 `src/data/metadata.ts` 的 `SpawnMeta`／`TargetsMeta`／`WeaponMeta`／`SceneMeta`／`Meta`：**零 `endCondition`**。全 repo `endCondition` 的命中只落在 `src/drill/*`（各 drill config 與 `DrillConfig.ts:294` 的型別）、`src/drill/DrillRunner.ts`，以及 `src/history/DrillMetricRegistry.ts:143-146`（`spider-shot-v2` 直接讀 **config** 的 `endCondition.value` 換算 `durationS`，**不是**讀匯出）。

唯一貌似可用的匯出欄位 `Meta.maxDrillSeconds`（`metadata.ts:222`）經複核**不可用**：它來自 `DEFAULT_MAX_DRILL_SECONDS`（`src/data/RingBuffer.ts`），是 recorder arena 的容量上限，與 drill 的結束條件無關（同一常數對 v8／v9 相同，零鑑別力）。

⇒ **T2 採 README §2.2 的路徑 B**：以匯出的 `meta.drillId` 反查本 build 的 drill config registry，`endCondition.type === 'timeLimit'` 時右界取最後一個 tick，否則維持 `lastKillMs`；查不到 `drillId` ⇒ 具名 `unknown_end_condition` 並退回既有語意（FM-2），**不猜、不預設成 timeLimit**。

先例已在同檔成立：`resolveCycletimeMs()`（`microFlickMetrics.ts:676`）就是「拿匯出宣告的 id（`meta.weapon?.id ?? meta.weaponId`）去查本 build 的 `WEAPONS` registry，認不得就回 `undefined` + 具名旗標」。路徑 B 是同一形狀換一張表（`drillId` → drill config），不是新機制。

路徑 A（右界一律取最後一個 tick）**駁回**：它會改變 v8 已釋出（v0.1.1）的 `validSpanMs`／`killRateHz`／`shotsPerKill`／`shotAccuracy`，直接違反 FR-68.4 與 FM-1。

### T0.7 OQ-68.2 收斂（既有 v9 匯出是否為 frozen cohort）

本 session 無研究者回覆。依 README §1.4 的**非阻塞預設「否」明帳推進**。

> ⚠️ **這不是研究者的肯定回覆。** 以下是 T0 能在 repo 內稽核到的部分；repo 外（操作員本機已錄的 v9 匯出）不在本 gate 的可證範圍內。

| 可稽核事實 | 結果 |
|---|---|
| v9 是否進 history／assessment 投影 | **否** —— `mode: 'practice'`（`micro_flick_three_target_test_v9.ts:11`）⇒ 結構性排除於 `DrillMetricRegistry` |
| repo 內是否有 v9 的 frozen fixture／golden 匯出 | **零** —— `src/`／`tests/`／`research/`／`scripts/` 全掃，v9 的命中只有：config 自身、`micro_flick_three_target_test_variants.test.ts`、`main.ts:159/306` 註冊、`drillFamily.ts:15/104` 家族列、`drillFamily.test.ts:404/534`、`tests/e2e/micro-flick-live.spec.ts:318/356/430` 三個 live 觸點 |

⇒ T1 直接改 fixture，斷代鍵為 `meta.weaponId`（`ak47` = pre-T1 世代，`usp_s_laser` = T1 後）。若研究者事後回覆「是」，補救成本 = 已錄資料以 `meta.weaponId` 機械分池，**不需**回退 T1。

### T0.8 `GD-45` 草稿（**不**入 `DECISIONS.md`，T-exit 才落帳並再重查號）

> 標題擬：`### GD-45 ✅ WP-68 Micro Flick v9 量測基礎層對齊 — 儀器宣告、計分窗右界依計分制分流、v8/v9 分池鍵收窄（2026-09-14，WP-68 T-exit）`

**① 編號與落點** — 落帳前重查 `DECISIONS.md`（T0 重查結果：最大已落帳 **GD-44**，`GD-43` 由 WP-67 預約中且仍零標題命中，`GD-45` 零命中 ⇒ 未被取用）。WP-68 依使用者 2026-09-14 指示寄放 `active/stage13/`，但主題（v8 量測基礎層的姊妹補齊）**不屬**該 stage 的「原始輸入取樣與抬滑鼠判準驗證」，承 WP-62／63／64／65／66／67 同一先例；偏離在 stage index 與 WP README 明帳保留。連帶：stage14 §3 的三個候選依 [GD-15](../../../DECISIONS.md)「先採納先得」順延為 WP-69／70／71。

**② v9 的零散布武器宣告與效度斷代** — v9 宣告 `weaponId: 'usp_s_laser'`（使用者 2026-09-14 拍板）並登記 `DECLARED_WEAPON_ROSTER`，理由與 v8 同一條：武器是**量測儀器**不是操作員可選的變項，零散布零後座才讓「命中與否」是開火瞬間角誤差的純函式。⚠️ **新事實**：v8／v9 自此在 `meta.weaponId` 上**不可分**，分析側的分池鍵從「`weaponId` 或 `drillId` 皆可」收窄為「**必須** `meta.drillId`」。本次變更前後的 v9 資料**不可混比**（變的是命中判定的隨機性本身），斷代鍵同為 `meta.weaponId`。

**③ 計時制與 kill-budget 兩種計分窗右界的分流** — `validSpanMs` 的原定義 `lastKillMs − firstVisibleMs` 是為 **kill-budget** drill 寫的；套到**計時制** drill 上會把最後一次擊殺之後的真實剩餘時間整段排除出分母 ⇒ `killRateHz` 系統性**高估**。因 `endCondition` **不在匯出 schema 內**（T0.6 逐欄確認），採**路徑 B**：`meta.drillId` → 本 build 的 drill config 查表（比照 `resolveCycletimeMs()` 的先例），`timeLimit` 取最後一個 tick 為右界、`targetCount` 維持 `lastKillMs`、查不到則 `unknown_end_condition` 具名退回。v8 的四量逐位不變為硬斷言（FR-68.4／FM-1）。v9 上兩種右界的**實測差值**（秒數 + `killRateHz` 相對差）由 T2 填入 —— 那個差值就是這條決策存在的理由，不得以「已修正」帶過。⚠️ 邊界：本決策**不碰** [KI-037](../../../../known_issue/KI-037-valid-duration-includes-countdown.md)（不同路徑、不同界、不同消費者，有自己的 `BD` 號），以 `src/history/DrillMetricRegistry.ts` 的 `git diff` 為空稽核。技術債：任何 WP 把 `endCondition` 或等價事實加進 `meta` 之後，此處查表應改讀匯出並移除 `unknown_end_condition`。

**④ 交付宣稱上限** — 與 [GD-39](../../../DECISIONS.md) ⑤ 相同 = **可算、可重現、可稽核，不含效度**。C-D3 的構念驗證閘未過 ⇒ v9 的指標同樣**不得進教練報告**。v9 靶徑較 v8 再縮 10%（角半徑約 1.118° vs 1.242°）後是否仍有鑑別力、以及計時制與 kill-budget 對受試者策略的影響，皆**非真人不可**，本 WP 明確不宣稱。

---

## Decision Log（T0）

### D-68.T0-1 — WP-68／GD-45 兩號重查後沿用（2026-09-14）

見 T0.1。`exec-plan/README.md §2` 的 WP-68 列為規劃期採納時寫入，非平行 session 占用；`GD-45` 在 `DECISIONS.md` 零命中。⇒ 不依 GD-15 順延，資料夾不改名。

**Alternatives considered**：因「WP-68 已出現在 §2」而誤判為被占用並順延到 WP-69 —— 駁回，逐檔確認那八處命中全是本 WP 自身的預約敘述；無端棄號會讓 stage14 的順延註記再錯一次。

### D-68.T0-2 — T2 走路徑 B（`drillId` → config 查表），路徑 A 駁回（2026-09-14）

見 T0.6。`endCondition` 不在匯出 schema，且唯一貌似可用的 `Meta.maxDrillSeconds` 是 recorder 容量而非結束條件。路徑 A（一律取最後一個 tick）會改寫 v8 已釋出的四量 ⇒ 違反 FR-68.4／FM-1。路徑 B 與同檔 `resolveCycletimeMs()` 是同一形狀，代價是多一張查表與一個 `unknown_end_condition` 旗標，並在 `endCondition` 日後進 schema 時可移除（README §3.2 已列為觸發重構的條件）。

**這同時把 OQ-68.3 提前收斂**為「右界 = 最後一個 tick」：它是匯出本身的事實，不需要相信 config 的 `timeLimit` 與實際錄製對得上（FR-68.5）。兩種右界的實測差值仍屬 T2 的交付。

**Alternatives considered**：(a) 把 `endCondition` 加進 `meta` 後再做右界 —— 那是匯出契約的 additive 變更，應另開 WP（比照 WP-67 對 `meta.opening` 的處理），夾帶進本 WP 會讓一個 3 d 的切片同時動 schema 與指標語意；(b) 以 `meta.maxDrillSeconds` 當代理 —— 駁回，它對 v8／v9 同值，零鑑別力。

### D-68.T0-3 — OQ-68.2 以非阻塞預設「否」推進，並明記其證據邊界（2026-09-14）

見 T0.7。repo 內可稽核的部分（practice 模式、零 frozen fixture）全部支持「否」，但 repo 外已錄的 v9 匯出不在本 gate 的可證範圍。⇒ 明帳推進，不阻塞 T1。

**Alternatives considered**：阻塞 T1 直到研究者回覆 —— 駁回，README §1.4 已把此 OQ 定為非阻塞，且「活的風險」（操作員今天就能以 `ak47` 收 v9 資料）的方向正好相反：**拖延才是在累積不可用的資料**。

### D-68.T0-4 — CodeGraph 對本問題降級為「blast radius 下界」，C-D5 判定改以全 repo grep 為權威（2026-09-14）

見 T0.4。`codegraph callers` 對兩個符號都回空陣列，與「`deriveMicroFlickMetrics` 被兩個測試檔 import」這個可直接讀到的事實矛盾；索引只涵蓋 146 檔（`src/` 單一目錄即 421 個 `.ts`），連 `targetWindows.ts` 都不在索引內，而 `sync` 回「Already up to date」⇒ 屬涵蓋範圍缺口而非 staleness。

⇒ 本 gate 仍依 T0 Steps 4 記錄 CodeGraph 的三組數字（作為下界），但 **C-D5 的「未被晉升指標／`DrillMetricRegistry` 消費」結論以 grep 證據為準**。T-exit 的硬約束複核（步驟 3）須沿用同一權威來源，不得只引用 `codegraph impact` 的 `nodeCount`。

**Alternatives considered**：(a) 照 `CLAUDE.md` 的「Trust codegraph results」直接採信空 callers ⇒ 會得到「零消費者」的**正確結論**但**理由是錯的**，且同樣的採信在 T2 擴大 blast radius 時會漏掉真正的 caller，駁回；(b) 先重建索引再繼續 —— 超出 T0 範圍（`codegraph` 的索引設定屬工具層，不是本 WP 的標的），改為明帳記錄並在需要時以 grep 補足。

---

## Surprises & Discoveries（T0）

1. **README 的「唯三差異」漏了 `targets.count` 60 → 600。** 機械 diff（非閱讀）抓到的實質差異是四項。**Evidence**：`diff -u` 兩支 config 的欄位序列，見 T0.5(a)。對本 WP 的論證影響為零（已就地驗證 `targets.count` 只是 `TargetManager` 的 spawn 上限，`DrillRunner.ts:274-283` 不以它判 `ended`，且 v9 無 `timing.timeLimitMs` 後援閘 ⇒ v9 確實由鐘結束），但 README §Truth model 的措辭 T-exit 須更正為「唯四差異」。
2. **CodeGraph 索引只覆蓋 repo 的一小片。** 146 files / 127 typescript vs `src/` 的 421 個 `.ts`；`targetWindows.ts`（WP-63 的兩個交付檔之一）不在索引內；`callers` 對兩個真實有 caller 的符號都回空。**Evidence**：`codegraph status .`、`codegraph files`、兩次 `codegraph callers … -j` 的輸出，見 T0.4。⇒ D-68.T0-4。
3. **T1 換武器會把彈匣從 30 發縮到 12 發，而 v9 的鐘不會因為失手而停。** `usp_s_laser` 的 `magSize: 12`（`weapons.ts:85`），ak47 為 30；補彈發生在**每次 spawn**（`TargetManager.ts:585` `state.weapon.ammo = state.weapon.magSize`），`next-tick` 補位 ⇒ 每次擊殺補滿。v8（kill-budget）從未在真實 run 觸發 `ammo_exhausted_in_window`，但 v9 是 60 s 計時制：一段夠長的失手串（>12 發無擊殺）就會觸發，而 `ammo_exhausted_in_run` 會讓**整場**的 `shotsPerKill`／`shotAccuracy` 依 FM-4／C-D3 不出數。⇒ **T1／T2 須留意**：這不是 bug（旗標正確地在說「這場的發數統計已知偏誤」），但它在 v9 上的觸發率會遠高於 v8，T2 的 v9 非空對空前置應涵蓋一個會打空的案例。記為 OQ-68.4。
4. **`usp_s_laser` 的零散布前提逐欄成立。** `weapons.ts:83-100`：`recoil` 的 `magnitude`／`magnitudeVariance`／`angleVariance` 全 0，`inaccuracy` 的 `stand`／`crouch`／`fire`／`move` 全 0，且**無** `ads` 區塊 ⇒ NFR-68.2「`sampleSpread()` 早退不消耗 RNG」的前提在 T0 即已確認，不是 T1 的未知數。
5. **Tier 2 的單輪 exit 0 不是穩定可得的。** 第一輪 114/1 failed，失敗的是全 115 條裡唯一需要真實 Pointer Lock 的 spec，且本輪**未**平行下任何指令 ⇒ 干擾源在本 session 之外。**Evidence**：三輪指令與輸出見 T0.3 的收尾表。⇒ T2 對 NFR-68.4 的判讀不可只看 exit code（見該節末的兩問並用）。
6. **右界不只影響 `validSpanMs`。** `deriveOutcome()` 內另有三處以 `lastKillMs` 為界：`shots` 的事件篩選（`:386-394`）、`ammoExhausted` 的窗篩選（`:405`）、`killRateHz` 的分母（`:415`）。T2 若只改 `validSpanMs` 一行，`shotAccuracy` 的分子（擊殺數，全場）與分母（發數，截在最後擊殺）會落在兩個不同的窗上 ⇒ 產生一個比現況更糟的數字。

---

## Open Questions（T0 後）

| OQ | 狀態 |
|---|---|
| ~~OQ-68.1~~ | ✅ 規劃期關閉（D-68-P1） |
| ~~OQ-68.2~~ | ✅ **T0 以非阻塞預設「否」明帳推進**（D-68.T0-3），**T1 開工前複核仍成立**（T1 Steps 1 gate：研究者未回覆「是」⇒ 不改走 v10）。**非**研究者的肯定回覆；repo 內證據齊全，repo 外未證 |
| ~~OQ-68.3~~ | ✅ **T0 提前收斂為「最後一個 tick」**（D-68.T0-2 的路徑 B）。兩種右界在 v9 上的**實測差值**仍由 **T2** 填入 |
| **OQ-68.4（新）** | `ammo_exhausted_in_run` 在 v9 上的觸發率（Surprises 3）。預設假設：不改任何判定、不放寬旗標，T2 只需確保覆蓋一個會打空的 v9 案例。Owner = 實作者，Deadline = T2 |

---

## T1 — v9 宣告 `weaponId: 'usp_s_laser'` + roster 登記 + 斷代標記（2026-09-14）

> 承 T0 的 OQ-68.2 結論（Steps 1 gate）：研究者未回覆「是」，既有 v9 匯出非 frozen cohort 的預設假設仍成立 ⇒ 直接改 v9 fixture，**不**改走 v10。

### T1.1 斷代宣告 —— pre-T1 與 post-T1 的 v9 差在哪

**這是效度斷代，不是一行 config 改動。** 變的是命中判定的隨機性本身：

| | pre-T1 v9（`ak47`，`main.ts` 預設） | **post-T1 v9（`usp_s_laser`）** |
|---|---|---|
| 武器來源 | 無 `weaponId` ⇒ 吃 `main.ts:1622/1670` 的 `?? 'ak47'` | fixture 自行宣告 |
| 每發散布 | `inaccuracy.stand 0.00641`／`fire 0.0078` 的 seeded spread（規劃期實測 **33/33 發帶散布**） | `inaccuracy` 四項全 0 ⇒ `sampleSpread()` 早退回 `{0,0}` |
| aim punch | `recoil.magnitude 25`（實測 **32/33 發帶 punch**） | recoil 三項全 0 ⇒ recoil table 逐位為 0 |
| 右鍵 ADS | 有 `ads` 區塊（縮 FOV + 改感度） | **無** `ads` 區塊 ⇒ 右鍵完全無效 |
| 「命中與否 = 開火瞬間角誤差的純函式」 | **不成立** | **成立** |

**機械區分**：匯出的 `meta.weaponId`。`ak47` = pre-T1 世代，`usp_s_laser` = post-T1。兩批資料**不可混比**。

**副作用（明帳，非預期外）**：

| 量 | pre-T1 | post-T1 | 後果 |
|---|---|---|---|
| `cycletimeSec` | 0.10 | **0.17** | 節奏地板由 100 ms 升為 170 ms；離線端 `resolveCycletimeMs()` 自動跟著改讀（T0.5 已驗證它讀匯出宣告的武器，非寫死） |
| `magSize` | 30 | **12** | ⚠️ 見 T1.3 —— 這一項在 v9 上的意義比在 v8 上重 |

### T1.2 新事實（WP-63 沒有的）：v8 與 v9 在 `meta.weaponId` 上不可分

兩支姊妹 drill 自此宣告**同一把**武器（使用者 2026-09-14 拍板，[D-68-P1](#d-68-p1--v9-用-usp_s_laser與-v8-同一把2026-09-14使用者拍板)）⇒ `meta.weaponId` **不再**是 v8／v9 的區分鍵。

⇒ **分析側的分池鍵從「`weaponId` 或 `drillId` 皆可」收窄為「必須 `meta.drillId`」。** 這不是損失：`drillId` 同時決定了兩件真正不該混池的事 —— 靶徑（`widthU` 1.08375 vs 0.975375）與計分制（`targetCount 60` vs `timeLimit 60000`），兩者都從 `drillId` 可達。本條已在三處以測試釘死（見 T1.4），並入 `GD-45` ② 與交接清單。

### T1.3 ⚠️ `magSize` 30 → 12 在 v9 上的意義大於 v8（承 T0 的 OQ-68.4）

補彈發生在**每次 spawn**（`TargetManager.ts:585`），v9 為 `next-tick` 補位 ⇒ 每次擊殺補滿。但 v9 是**計時制**：鐘不因失手而停。一段 >12 發而無擊殺的失手串就會讓 `fire` 事件帶 `ammo === 0`，離線端據此亮 `ammo_exhausted_in_window` ⇒ `ammo_exhausted_in_run` ⇒ 依 FM-4／C-D3，**整場**的 `shotsPerKill` 與 `shotAccuracy` 不出數。

v8 是 kill-budget（60 顆打完才結束），沒有「鐘還在跑但一直沒殺掉」的狀態 ⇒ 該旗標在 v8 真實 run 從未觸發。**v9 觸發率結構性較高，這是本 WP 接受的代價，不是缺陷**（旗標正確地在說「這場的發數統計已知偏誤」）。T1 只把 `magSize` 的事實釘進測試；覆蓋一個真的打空的 v9 案例屬 **T2**（OQ-68.4 維持開放至 T2）。

### T1.4 證據（逐條對 T1 DoD）

| DoD | 指令／斷言 | 結果 |
|---|---|---|
| variants test exit 0，含 v9 `weaponId` 與 v1–v7 鍵集合不變 | `npx.cmd vitest run src/drill/micro_flick_three_target_test_variants.test.ts` | ✅ **11 tests**（T0 基線 10，**+1**）。新測試同時斷言 `parsed.weaponId === 'usp_s_laser'`、`usp_s_laser` 的 `inaccuracy` 四項與 `recoil` 三項全 0 且無 `ads`（從 `WEAPONS` **讀**而非重述 ⇒ 改動該武器會在此轉紅）、v1–v7 **七支**皆 `hasOwnProperty('weaponId') === false` 且 `loadDrill(...).weaponId === undefined` |
| drillFamily test exit 0，含 roster 與不可覆蓋 | `npx.cmd vitest run src/session/drillFamily.test.ts` | ✅ **158 tests**（T0 基線 155，**+3**）。`DECLARED_WEAPON_BY_DRILL_ID.size` 14 → **15**；逐列武器指定 `weaponId: 'ak47'` 被 `SessionProgramCompileError` 擋下且 `itemIndex === 1`（定位到那一列）、訊息含 drillId 與 `usp_s_laser`、`compileSessionProgram` 無回傳值；「指定成它已宣告的那把」與「不指定」兩種拼法皆放行 |
| spawn trace 逐位相同，且兩邊 `shotsFired > 0` 且相等 | `src/drill/micro_flick_three_target_test_v9_weapon.test.ts` | ✅ **實測 `shotsBefore = shotsAfter = 4`**，`snapshots = 96`（一次性 `console.log` 探針取得，取完即還原，未進 repo）。96 個 snapshot × 逐顆 `id/side/x/y/z/visible/alive` 全部 `Object.is` 相同（非 `toEqual`，−0 與 1-ulp 漂移擋得住）；另斷言 traced window 內 distinct target id 數 **>** `activeCount` ⇒ 補位確實從 spawn 串流抽過，比較非空對空 |
| `sampleSpread()` rng 呼叫數 === 0，ak47 對照組 > 0 | 同上檔 | ✅ 三個 `speedRatio`（0／0.5／1）＋整個彈匣 12 發後 `counter.calls() === 0` 且 `recoilState.inaccuracyFire === 0`；**對照組** `ak47` 同一 harness `calls() > 0` ⇒ 零消耗是武器的性質，不是 harness 的 |
| `meta.weaponId` round-trip | 同上檔 | ✅ 經 `collectMeta` → `canonicalExportJSON` → `parseExportPayload` 後 `meta.weaponId === 'usp_s_laser'` 且 `!== 'ak47'`，`meta.drillId === 'micro_flick_three_target_test_v9'` |
| typecheck ×2／全量 Vitest／build 皆 exit 0，Vitest 差值 = 本 task 新增數 | 見 T1.5 | ✅ |
| `micro-flick-live.spec.ts`（唯一 live 消費端）exit 0 | 見 T1.5 | ✅ |
| （DoD 未列，全量閘揭露）第二個硬編 roster 大小的守衛 | `src/session/sessionWeaponActivation.test.ts:67` | ✅ 14 → **15**，註解同步指名 WP-68 T1。詳見 Surprises 2 —— **這一條是全量 Vitest 抓出來的，三個 targeted 檔全綠時它仍是紅的** |
| 斷代宣告入 `progress.md` | 本節 T1.1／T1.2／T1.3 | ✅ |

另補一條 DoD 未要求但屬同一證據鏈的斷言：`recoil` table **逐位為 0**（`Object.is(entry.angleDeg, 0)` 與 `magnitude`），且打完整個彈匣後 `aimPunch{Pitch,Yaw}Deg` 與 `viewPunch{Pitch,Yaw}Deg` 皆為 0 ⇒ `ticks[].aim` 就是真實視角，不含補償量。

### T1.5 全量閘（對 T0 基線）

| 指令 | exit | 數字 | 對 T0 基線 |
|---|---|---|---|
| `npm.cmd run typecheck` | **0** | — | 同 |
| `npm.cmd test`（全量 Vitest） | **0** | **Test Files 271 passed / 1 skipped (272)**；**Tests 3,362 passed / 2 skipped (3,364)** | 檔 270 → **271**（+1 = 新測試檔）；測試 **3,351 → 3,362 = +11**，與本 task 新增數（variants +1、drillFamily +3、新檔 7）**逐數相符** ⇒ 零既有測試被改寫或移除（`sessionWeaponActivation.test.ts` 維持 12 tests，只改斷言內的數字） |
| `npm.cmd run build` | **0** | **203 modules transformed** | 逐數相同（fixture 改動不新增模組） |
| `npm.cmd run test:e2e:fast -- --workers=1 tests/e2e/micro-flick-live.spec.ts` | **0** | **6 passed**（1.4 m） | v9 的唯一 live 消費端，spec 零修改通過 |

⚠️ 上表是**第三輪**。全量 Vitest 共跑三輪：**第一輪 `2 failed / 3,360 passed`**（`sessionWeaponActivation.test.ts:67` 的 `toBe(14)`，**外加**環境性的 `tests/history/historyPlugin.test.ts` 埠佔用 —— 見 [Surprises 5](#surprises--discoveriest1)）、**第二輪 `1 failed / 3,361 passed`**（埠釋出，只剩那個守衛）、第三輪全綠。三輪之間對 `src/` **只改了那一個數字與其註解**（`sessionWeaponActivation.test.ts:67` 的 `toBe(14)` → `toBe(15)`），六個切片檔的 md5 經 `md5sum -c` 確認在末輪執行期間逐檔未變（避免在移動中的工作區上取數）。

---

## Decision Log（T1）

### D-68.T1-1 — roster 登記與 fixture 宣告在**同一個切片**落地（2026-09-14）

T1 Steps 2 與 3 是兩個檔、兩個機制（fixture 宣告 vs 編譯期不可覆蓋），但拆成兩個 commit 會產生一個**中間狀態**：v9 已宣告武器、卻仍可被 Session Plan 逐列覆蓋，而那個狀態下匯出看起來完全正常。⇒ 兩者合為一個原子切片，並在 `drillFamily.test.ts` 以「map 成員資格」與「覆蓋被拒」**成對**斷言（測試本身的註解也寫明：成員資格而無拒絕，正是本 task 要防的失敗）。

**Alternatives considered**：只改 fixture、roster 留到 T2 —— 駁回，FR-68.2 是獨立的一條需求，且 T0 已確認 v9 今天就在 `main.ts` 變體清單與 family roster 內（活的風險）。

### D-68.T1-2 — `magSize` 30 → 12 的後果記為 OQ-68.4，不在 T1 處置（2026-09-14）

T0 的 Surprises 3 指出換武器會讓空倉旗標在 v9 上更易觸發。T1 的處置是**只把事實釘進測試**（`state.weapon.ammo === magSize === 12` 的啟動斷言 + `cycletimeSec`／`magSize` 前後值的顯式斷言），**不**改任何判定、**不**放寬旗標。

理由：`ammo_exhausted_in_run` 的行為是 WP-63 FR-63.13 已交付且正確的 —— 它在說「這場的發數統計已知偏誤」，而那句話在 v9 上會更常為真，那是 drill 設計（12 發彈匣 × 計時制）的事實，不是指標的缺陷。依 C-D3，**寧可少一個指標，不能有一個會說錯話的指標**。覆蓋一個真的打空的 v9 案例屬 T2 的非空對空前置。

**Alternatives considered**：(a) 替 v9 開一把 `magSize` 較大的零散布武器 —— 駁回，那等於為了讓一個旗標少亮而改儀器，且會讓 v8／v9 的武器再度分歧、推翻使用者拍板；(b) 在 T1 就放寬 `ammo_exhausted_in_run` 的判準 —— 駁回，那是在動 WP-63 已交付的指標語意，屬 T2 的範圍且需要自己的理由。

---

## Surprises & Discoveries（T1）

1. **`shotsFired` 只有 4 發 —— 這個數字本身就是證據的邊界。** trace 窗是 96 個 snapshot，開火間隔刻意設在兩把武器 cycletime 之上（200 ms）⇒ 窗內只打得出 4 發。**Evidence**：一次性探針 `shotsBefore=4 shotsAfter=4 snapshots=96`。4 發足以讓 `ak47` 真的抽過 spread 串流（DoD 要求的「非空對空」成立），但它**不是**一個高強度的壓力測試 ⇒ 逐位比對的說服力來自「兩邊都開了槍且發數相等」這個結構，不是來自發數大。T2 若要更強的覆蓋，應在自己的 harness 拉長窗，而不是回頭改本測試。
2. **`DECLARED_WEAPON_BY_DRILL_ID.size` 的硬編守衛有 _兩_ 個，不是一個。** `drillFamily.test.ts:446` 與 `sessionWeaponActivation.test.ts:67`（WP-62 T1 與 T3 各寫了一次，彼此不知道對方存在）。**Evidence**：三個 targeted 測試檔全綠（176 passed）之後，全量 Vitest 仍回 `1 failed`：`AssertionError: expected 15 to be 14` at `sessionWeaponActivation.test.ts:67`。

   ⇒ **這是本切片唯一一次「targeted 綠、全量紅」**，也是 T1 DoD 第 6 項（全量閘）真正咬到東西的一次 —— DoD 前五項全部只點名了 `micro_flick_three_target_test_variants.test.ts` 與 `drillFamily.test.ts` 兩個檔，照著跑完會得到全綠的錯覺。**給後續 task 的教訓**：本 repo 的「硬編數字守衛」可能散在多個檔，`DECLARED_WEAPON_ROSTER` 這種跨 WP 累積的 roster 尤其如此；改 roster 後**必須**以全量 Vitest 收尾，不能只跑 task 檔點名的 spec。兩處都按設計轉紅、被有意識地改，其餘既有斷言零修改。

3. **本切片的 `src/` 變更由平行作業產出，且工作區在驗證期間仍在變動。** 第一輪全量 Vitest（21:23:45Z）跑完後，`sessionWeaponActivation.test.ts` 於 **21:25:05Z** 被修正 —— 亦即修正發生在那一輪之後。⇒ 第一輪的 `1 failed` 與第二輪的全綠**不是同一份工作區**。處置：重跑前先取六個切片檔的 md5，跑完 `md5sum -c` 確認逐檔未變，才把數字入帳（見 T1.5 的 ⚠️）。**紀律**：工作區由多方同時編輯時，「先驗證再 commit」必須加一條「驗證期間工作區不得變動」，否則入帳的數字對應不到被 commit 的那份樹。

4. ⚠️ **spread 串流與 spawn 串流是兩個獨立的 `createRan1` 實例 —— 於是 spawn trace 逐位比對證明的東西比 [WP-63 T1](../wp-63-micro-flick-v8-measurement-foundation/T1-zero-spread-weapon.md) 的檔頭註解所宣稱的窄。** `SimLoop` 自建 `recoilRuntime.rng = createRan1(seed)` 供 spread 取樣（`SimLoop.ts:855`、`:428`），`TargetManager` 另自建 `spawnRng = createRan1(config.sequence.seed)`（`TargetManager.ts:314`），而 loop **從不**把自己的 rng 交給 manager（`SimLoop.ts` 對 manager 的呼叫只有 `markKilled`／`tick`）。`createRan1` 回的是閉包持有自身 `idum`／`iy`／`iv` 的產生器（`rng.ts:13-22`）⇒ **同 seed 的兩個實例仍是兩份狀態**。

   ⇒ 不論 `ak47` 抽了幾次 spread，spawn placement 都不可能因此位移。**`micro_flick_three_target_test_v8_weapon.test.ts` 檔頭第 2 點寫的「the shared seeded stream it draws from … that is *why* (1) also holds under live fire」是過度宣稱** —— (1) 並不建立在 (2) 之上，兩者是**各自獨立**的斷言。

   **本 task 的處置**：新檔 `micro_flick_three_target_test_v9_weapon.test.ts` 的註解**照實寫**，明列兩條串流的出處與「兩個 `createRan1` 閉包不共享狀態」這個事實，並重述兩條斷言各自買到什麼 —— (1) 買的是**其他**武器耦合進 spawn 的防線（彈匣 30 → 12，而 `spawn()` 會補彈 ⇒ ammo 與 placement 確實會碰面），(2) 買的是「日後有人把 `usp_s_laser` 調成非零 inaccuracy 時會在此轉紅」。**兩條斷言本身與其數值證據完全不受影響，動到的只有註解的措辭。** v8 那個檔屬 WP-63 已交付的證據檔，本切片**不改**（範圍紀律）⇒ 記為 [OQ-68.5](#open-questionst1-後)。

5. **第一輪全量 Vitest 其實是 `2 failed`，第二個失敗與本切片無關。** 除 Surprises 2 的守衛外，`tests/history/historyPlugin.test.ts` 同輪回 `Error: Port 18173 is already in use`。單獨重跑該檔 **1 passed（1.27 s）** ⇒ 環境性（埠佔用），非本切片所致。與 [T0.3](#t0.3-nfr-684-基線實測head-eec359d未改任何-src) 的 Tier 2 單輪失敗屬同一類，處置也相同：**exit code 單看不成立判讀**，須配合「失敗檔單獨重跑」與「失敗原因是否落在本切片的 blast radius 內」兩問並用。T1.5 上表為三輪中最後一輪（無環境性失敗）的數字。

---

## Open Questions（T1 後）

| OQ | 狀態 |
|---|---|
| ~~OQ-68.1~~／~~OQ-68.2~~／~~OQ-68.3~~ | ✅ 見 [§Open Questions（T0 後）](#open-questionst0-後) |
| **OQ-68.4** | 🔵 **維持開放至 T2**（[D-68.T1-2](#d-68t1-2--magsize-30--12-的後果記為-oq-684不在-t1-處置2026-09-14)）。T1 只把 `magSize === 12` 的事實釘進測試；覆蓋一個真的打空的 v9 案例屬 T2 的非空對空前置 |
| **OQ-68.5（新）** | `micro_flick_three_target_test_v8_weapon.test.ts` 檔頭第 2 點的「shared seeded stream」措辭要不要更正？（Surprises 4）**預設假設：要，但屬 T-exit 的文件對帳而非 T1 的程式切片** —— 它是 WP-63 已交付的證據檔，且更正的是**註解措辭**不是斷言，v8 的任何數字與任何測試結果都不會因此改變。Owner = 實作者，Deadline = **T-exit** |
