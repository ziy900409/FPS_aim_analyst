# BUGFIX-DECISIONS — 修 bug 決策帳本

> `docs/known_issue/` 的**除錯 episodic memory**:記錄修 bug 時做的**決策**——選了哪個修法、為何、
> 偏離既定計畫之處、遺留 open question 的處置。每個 bug 的完整診斷 + 修改計畫寫在各自的
> `KI-NNN-*.md`(tech spec);**跨計畫、需事後追溯、或偏離協議**的決策才寫這裡。
>
> 與 [exec-plan/DECISIONS.md](../exec-plan/DECISIONS.md) 分工:那裡記 **feature / WP 開發**的全域決策(`GD-n`);
> 這裡記 **bug 修復**的決策(`BD-n`)。兩者互不複製,只互相指路。
>
> 索引:[docs/MAP.md](../MAP.md) · 協議:[CLAUDE.md §3](../../CLAUDE.md) · 術語:[CONTEXT.md](../../CONTEXT.md)。
> 語言:繁體中文,術語保留英文(D4)。最新在上。

---

## 1. Known Issues 索引(權威來源 = 各 KI tech spec)

> 每支 KI doc 是該 bug 的診斷 + 修改計畫 source of truth;下表是入口 + 對應決策 + 修復狀態。

| KI | 症狀 | 修復決策 | 狀態 |
|---|---|---|---|
| [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) | br-field camera 未錨定 sim origin(D1)+ protocol 場景載入驗證舊 drill(D2)(PR #34 review) | BD-002(§2) | 🟡 已定解法待落地(2026-07-15) |
| [KI-001](KI-001-input-lag-sim-clock-drift.md) | 開火/鍵盤嚴重輸入延遲(sim 邏輯時鐘漂移) | BD-001(§3) | ✅ Task 1+2 已修(2026-07-09) |

---

## 2. 未解 / 進行中(OPEN)

> 狀態:🔴 診斷中 · 🟡 已定解法待落地 · ✅ 已修(移至 §3 並標日期/commit)。

### BD-002 🟡 KI-002 — br-field camera 錨定 sim origin(eyeZ)+ protocol 原子載入(2026-07-15)

| | |
|---|---|
| **發現處 / 根因** | [PR #34](https://github.com/ziy900409/FPS_aim_analyst/pull/34) Codex 自動 review 兩則(P1/P2),追碼證實 → [KI-002](KI-002-br-field-camera-anchor-protocol-load.md)。**D1(P1)**:`SceneManager` 把 camera(= 射線/彈道原點,[SimLoop.ts:142](../../src/loop/SimLoop.ts#L142))放在背牆 standoff `depth/2-1`([SceneManager.ts:64](../../src/render/SceneManager.ts#L64)),br-field depth=290 → camera z=144,前向目標 z=−distance → 實際交戰距離放大 ~2.3×(0.5°→0.22°、2°→0.33°),projectile `maxRangeU=143.24` 永不達標(4 變體 0 命中)。**D2(P2)**:`applyCondition` 先 `loadSceneById` 拿**舊** drill 驗目標場景淨空([main.ts:720/743](../../src/main.ts#L743)),BR-active → 啟動 resolution protocol 時舊 BR drill 過不了 field-low → throw 中止。 |
| **決策(修法選項)** | **D1 → Option A(顯式 `eyeZ` 欄位)**:`ProceduralRoomConfig` 加 `eyeZ?: number`,`SceneManager` 用 `room.eyeZ ?? (depth/2 - standoff)`,br-field 設 `eyeZ:0`。**不採 B**(把 roomSize.depth 改 2:語意混亂、依賴「GLTF 跳過建房」巧合)、**不採 C**(asset≠null 無條件放 origin:行為改動面過大需回歸全場景)。**D2 → Option B(補 drill `sceneId` + 簡化 applyCondition)**:`detection_popin_v1` 補 `sceneId:'field-low'`,`applyCondition` 移除 `loadSceneById`、只留 `loadDrillById`(驗新 drill vs 新 scene)+ dev assertion 落點校驗。**不採 A**(新增合併載入器:多餘程式碼)、**不採 C**(把新 drill 傳進 loadSceneById:耦合)。 |
| **理由** | D1-A 最誠實建模「玩家站 sim origin、場景往前延伸」,`eyeZ` optional 且預設逐位相容 → placeholder/field-low/urban camera 不動、零回歸;`maxRangeU/engagementDistanceU` 圍繞 114.59 的設計佐證原意即 origin 錨定。D2-B 改動最小且順手補齊 data-model 缺口(drill 宣告自己的 scene),`loadDrillById` 既有契約已能原子載入 + 驗證**新** drill。 |
| **偏離計畫** | 無偏離協議;兩缺陷源自 PR #34 review 而非既定 WP task,依 §9 走 known_issue 流程(KI-002 tech spec + 本帳本)。歸檔時使用者選「先討論不落生產碼、僅落 KI 文件」——本次僅產出診斷/計畫,實作待後續 session。 |
| **遺留 OQ / 未做** | **OQ-KI2-1**:`tracking_longrange_v1`(field-low camera z=4)~1% 側翼距離誤差**本次維持現狀**(使用者拍板),不綁 field-low eyeZ;日後若研究者判不可接受再另開 task 並重驗 WP-23 決定性。**OQ-KI2-2**:補 sceneId 使 detection_popin_v1 下拉選取強制載 field-low(行為變更,使用者已接受)。**OQ-KI2-3**:E2E projectile 變體由 0 命中變可命中,實作時重跑 playwright、必要時更新命中期望。**尚未實作**:Task 1(D1)、Task 2(D2)皆待落地。 |
| **影響面** | D1:`src/scene/SceneConfig.ts`(+eyeZ+validator)、`src/render/SceneManager.ts`(camera 放置)、`src/scene/scenes/br-field.ts`(eyeZ:0)、新增不變性測試(封 D1 測試盲區——既有 [br-tracking-invariants.test.ts:84](../../tests/regression/br-tracking-invariants.test.ts#L84) 自建 z=4 camera 故看不到 bug)。D2:`src/main.ts`(drill 註冊 sceneId + applyCondition + dev assertion)。不動 sim/hitbox/彈道語意(GD-6/7/16/17)、不動場景資產(GD-9)。 |
| **狀態** | 🟡 已定解法待落地(2026-07-15 診斷 + 定解;branch `aa`)。落地時同步翻:KI-002 狀態列、本條目、§1 索引(移入 §3)。 |

---

## 3. 已決策 / 已修(CLOSED)

### BD-001 ✅ KI-001 — sim 邏輯時鐘 re-anchor 修法 + 提交顆粒度偏離(2026-07-09)

| | |
|---|---|
| **發現處 / 根因** | [KI-001](KI-001-input-lag-sim-clock-drift.md) /debug session(2026-07-08 診斷、2026-07-09 修復)。根因(KI-001 §2.1):`pump` 把 frame delta 夾在 0.25s 避免 spiral of death,但被丟棄的 `(rawDelta−0.25s)` 使 `simTimeMs` 永久落後真實時鐘域;消費閘門 `tickEndMs=simTimeMs` 因而落在事件「未來」,開火/鍵盤事件延後數百 ms 才被消費(次生 ring 溢位掉輸入)。 |
| **決策(修法選項)** | 採 **Option A(re-anchor)**:`pump` 於 `rawDeltaS > 0.25` 夾除生效時 `simTimeMs = nowMs; accSec = 0`(KI-001 §2.4 INV-ReAnchor),落於 [SimLoop.ts pump](../../src/loop/SimLoop.ts)。**不採 Option B**(改用真實 `now` 當消費閘門)——會使 input 分桶脫離固定 tick 邊界、破壞 input→tick 決定性分桶(KI-001 §2.5)。 |
| **理由** | 修法**只在 >0.25s 分支動作**,≤0.25s 路徑 byte-for-byte 不變 → 既有 determinism 回歸(C-2 三案 179/184/164)不受影響;re-anchor 不新增被丟棄的模擬時間(現行 clamp 本就丟被夾時間),僅該卡頓幀一次 hitch。 |
| **偏離計畫(提交顆粒度)** | KI-001 §4 列 Task 1(紅測試)與 Task 2(修法)為**兩個**原子 commit;但 repo 硬規「先驗證再 commit / 每個 commit 綠」([CLAUDE.md §3.1](../../CLAUDE.md))與「提交一支已知紅的測試」衝突。**決議**:仍照 TDD 先寫測試、於工作區證實其**紅**(重現 KI-001),再修法轉綠,但把測試 + 修法**合併為單一已驗證綠的 commit**,而非提交紅測試。此偏離適用於所有「TDD 修 bug」情境。 |
| **遺留 OQ / 未做** | **OQ-KI1-1**(re-anchor 於卡頓幀丟棄被夾模擬時間對研究效度是否可接受)→ 研究者待確認;現況與既有 clamp 語意一致,不新增丟棄量。**選配硬化未執行**:Task 3(`simClockLagMs` 觀測欄 + dev readout,交付 FR-5)、Task 4(WebGPU pipeline 預熱)、Task 5(mouse 移出 sim ring,承 OQ-KI1-2)——觸發條件見 KI-001 §3/§4。故本次修復 **FR-1~FR-4 達成、FR-5(可觀測性)未交付**。 |
| **影響面** | `src/loop/SimLoop.ts` `pump`(唯一 runtime 改動,只動 >0.25s 分支);新增回歸測試 [sim-clock-drift.test.ts](../../src/loop/__tests__/sim-clock-drift.test.ts);KI-001 doc 狀態更新。驗證:`tsc --noEmit` 0、`vitest run` 全 415 綠(含 determinism src + `tests/regression`,**0 迴歸**)。 |
| **狀態** | ✅ Task 1+2 已修 + 落地(2026-07-09;branch `fix/ki-001-sim-clock-drift`)。 |

---

## 寫入慣例

- 新增條目編號 `BD-n`(bugfix decision),對應一支 `KI-NNN-*.md`;最新放 §3 最上方(或 §2 若未落地)。
- 一條目至少含:**發現處/根因**(指路 KI,不複製診斷全文)、**決策**、**理由**、**偏離計畫**(如有)、**遺留 OQ/未做**、**影響面**、**狀態**。
- bug 修復落地時:同步更新(a) 對應 KI doc 的狀態列、(b) 本帳本條目狀態、(c) §1 索引表。
- 純屬單一 KI、無跨計畫追溯或偏離協議價值的細節,寫在該 KI doc,**不重複**到這裡。
- 若修 bug 過程動到 ADR / GD 決策或硬約束,回改權威文件,並在此記一筆交叉引用。
