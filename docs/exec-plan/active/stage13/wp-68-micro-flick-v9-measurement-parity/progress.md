# WP-68 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-14 規劃完成）

⬜ **未開工**。規劃於 2026-09-14 完成，承 [WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md)（已交付，v0.1.1）當場發現的缺口。T0 尚未執行。

規劃來源：使用者 2026-09-14 在 WP-63 釋出後問「v9 是否也有同等的量測基礎層」。以 WP-63 T-exit 新增的 determinism harness 實測 v8／v9／「v9 只換武器」三組，確認**結構可用、儀器污染**（見 §規劃期實測），再依 `.claude/skills/engineering-planning/SKILL.md` 落成執行計畫。

---

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry gate | ⬜ 未開工 | — | — | — |
| T1 零散布武器宣告 | ⬜ 未開工 | — | — | — |
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

## Open Questions

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
