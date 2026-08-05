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
| [KI-004](KI-004-sim-world-unit-domain-mismatch.md) | sim(source unit)與 world domain 混用:corridor gate 緊 100× → 真實急停 run 全被標 `suspect`;離線 ε(t) 的 `p_eye` 原點錯尺度 | BD-004(§2,**待拍板**) | 🔴 診斷完成,修法待拍板 |
| [KI-003](KI-003-top-left-controls-overlap.md) | 左上角 session/protocol 啟動按鈕覆蓋 SettingsPanel 的 Sensitivity/FOV/Resolution | BD-003(§3) | ✅ 已修(2026-08-05) |
| [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) | br-field camera 未錨定 sim origin(D1)+ protocol 場景載入驗證舊 drill(D2)(PR #34 review) | BD-002(§3) | ✅ D1+D2 已修(2026-07-15) |
| [KI-001](KI-001-input-lag-sim-clock-drift.md) | 開火/鍵盤嚴重輸入延遲(sim 邏輯時鐘漂移) | BD-001(§3) | ✅ Task 1+2 已修(2026-07-09) |

---

## 2. 未解 / 進行中(OPEN)

> 狀態:🔴 診斷中 · 🟡 已定解法待落地 · ✅ 已修(移至 §3 並標日期/commit)。

### BD-004 🔴 KI-004 — sim/world 單位域混用(corridor gate + 離線 ε 原點);**診斷完成,修法待拍板**(2026-08-05)

| | |
|---|---|
| **發現處 / 根因** | 排查「08:03 匯出零位移」時,重現用的 09:39 匯出(含真實 A/D 橫移)暴露:`meta.suspect` 在**有做急停**時為 true、**完全不動**時為 false。追碼確認唯一觸發者為 [main.ts:527](../../src/main.ts#L527) 的 corridor gate,它拿 **source unit** 的 `state.player.x` 去比 **world unit** 的 `playerCorridor.halfWidthU`。根因是全案有兩個單位域,而橋樑 `SIM_TO_WORLD = 0.01`([main.ts:628](../../src/main.ts#L628),註解自陳為「佔位;WP-6 drill config 接管」,從未接管)**只被套用在 render camera 一處**;所有繞過 camera 直接讀 sim 量的消費者都少乘這個因子。第二處落點在離線推導 `p_eye = (px, eyeY, pz)`([trackingDerivation.ts:191](../../src/metrics/trackingDerivation.ts#L191)、`detectionDerivation.ts` 同實作)。完整診斷見 [KI-004](KI-004-sim-world-unit-domain-mismatch.md)。 |
| **決策** | **尚未拍板。** KI-004 §5 列 D1 三案(換算後比較 / 走廊改存 sim domain / `SIM_TO_WORLD` 升為 config 欄位)與 D2 三案(匯出 `meta.simToWorld` / 改寫 `px/pz` 尺度 / 並存 `pxWorld`)。**先決問題 = OQ-KI4-1**:資料層的正規域到底是 source unit 還是 world unit —— `CONTEXT.md` 聲明前者,但 `tx/ty/tz`/`hitbox`/`eyeHeight` 實作為後者。未決前任何修法只是把不一致搬家。 |
| **理由(為何先入帳不先修)** | 此缺陷會污染往後**每一份**含橫移的 pilot 資料(`suspect` 旗標 + ε 系列指標),越早定調越好;但修法選擇取決於一個尚未回答的規格問題(OQ-KI4-1),依 CLAUDE.md §3.9 先落 KI tech spec 與本帳本,拍板後再走 TDD 落地。 |
| **偏離計畫** | 無。本次僅診斷與入帳,零程式碼改動(`git diff` 僅 docs + 新 fixture)。 |
| **遺留 OQ** | **OQ-KI4-1** 正規單位域(先決)· **OQ-KI4-2** 修法後 ±1 world unit 走廊對 counter-strafe 是否合理(09:39 位移 −1.69 world u,修好仍會 suspect)· **OQ-KI4-3** 09:39 的 `px` 單調漂移是受試者行為還是 drill 缺歸位機制(已詢問使用者,未回覆)· **OQ-KI4-4** M14 ② 是否需重新宣告。 |
| **影響面(診斷結論)** | **受影響**:`meta.suspect` 語意、離線 ε(t)/on-target/TOT%/`t_acquire`/`t_detect`/`eccentricity_at_spawn`(僅 `px ≠ 0` 時)、stage4 WP-30/31 的全部逐段軌跡指標。**不受影響**:引擎命中/彈道/`offsetDeg`(全走 camera,兩端同域)、sim 決定性、WP-29 T1/T2(只吃 events 與 `ticks[].keys`)。**M14 ② 數值不撤回**(Python 與 TS 仍逐位一致),但其效度僅限 `px ≡ 0` 的 fixture —— 三層防護同時失效的原因見 KI-004 §4。 |
| **狀態** | 🔴 診斷完成、修法待拍板。 |

---

---

## 3. 已決策 / 已修(CLOSED)

### BD-003 ✅ KI-003 — 左上角 controls 改用共用 flow 容器(2026-08-05)

| | |
|---|---|
| **發現處 / 根因** | 使用者截圖顯示「實驗 session／解析度 protocol／BR protocol」覆蓋 SettingsPanel。追碼確認兩組 overlay 同時直接掛在 `document.body`，SettingsPanel 固定於 `top:16px;left:16px;z-index:11`，三顆按鈕固定於 `left:12px;top:12/54/96px;z-index:40`；解鎖時又同時顯示，形成確定性的座標衝突。完整紀錄見 [KI-003](KI-003-top-left-controls-overlap.md)。 |
| **決策** | 建立唯一 fixed 的 `#top-left-controls`，以 column flex 正常排列 `#session-launch-controls` 與 `#settings-panel`；`createSettingsPanel` 增加 optional `parent` 掛載點並保留未傳入時的相容行為；Pointer Lock 統一切換外層容器。 |
| **理由** | 流式版面由內容尺寸決定間距，不依賴按鈕文字、縮放或控制項數量；比調整固定 `top/left` 更能避免同類回歸，且不改 protocol/解析度業務邏輯。 |
| **偏離計畫** | 無。依 TDD 先以 Playwright bounding-box 測試重現三顆按鈕皆相交（RED），再落共用容器使同一測試轉綠（GREEN）。 |
| **影響面** | `src/main.ts`、`src/ui/SettingsPanel.ts`、`tests/e2e/overlay-layering.spec.ts`；不觸及 sim、輸入、recorder、匯出或 ResolutionMode 語意。 |
| **狀態** | ✅ 已修。驗證：`tsc --noEmit` 0、Vitest 82 files / 641 tests 全綠、Playwright 19 tests 全綠。 |

---

### BD-002 ✅ KI-002 — br-field camera 錨定 sim origin(eyeZ)+ protocol 原子載入(2026-07-15)

| | |
|---|---|
| **發現處 / 根因** | [PR #34](https://github.com/ziy900409/FPS_aim_analyst/pull/34) Codex 自動 review 兩則(P1/P2),追碼證實 → [KI-002](KI-002-br-field-camera-anchor-protocol-load.md)。**D1(P1)**:`SceneManager` 把 camera(= 射線/彈道原點,[SimLoop.ts:142](../../src/loop/SimLoop.ts#L142))放在背牆 standoff `depth/2-1`([SceneManager.ts:64](../../src/render/SceneManager.ts#L64)),br-field depth=290 → camera z=144,前向目標 z=−distance → 實際交戰距離放大 ~2.3×(0.5°→0.22°、2°→0.33°),projectile `maxRangeU=143.24` 永不達標(4 變體 0 命中)。**D2(P2)**:`applyCondition` 先 `loadSceneById` 拿**舊** drill 驗目標場景淨空([main.ts:720/743](../../src/main.ts#L743)),BR-active → 啟動 resolution protocol 時舊 BR drill 過不了 field-low → throw 中止。 |
| **決策(修法選項)** | **D1 → Option A(顯式 `eyeZ` 欄位)**:`ProceduralRoomConfig` 加 `eyeZ?: number`,`SceneManager` 用 `room.eyeZ ?? (depth/2 - standoff)`,br-field 設 `eyeZ:0`。**不採 B**(把 roomSize.depth 改 2:語意混亂、依賴「GLTF 跳過建房」巧合)、**不採 C**(asset≠null 無條件放 origin:行為改動面過大需回歸全場景)。**D2 → Option B(補 drill `sceneId` + 簡化 applyCondition)**:`detection_popin_v1` 補 `sceneId:'field-low'`,`applyCondition` 移除 `loadSceneById`、只留 `loadDrillById`(驗新 drill vs 新 scene)+ dev assertion 落點校驗。**不採 A**(新增合併載入器:多餘程式碼)、**不採 C**(把新 drill 傳進 loadSceneById:耦合)。 |
| **理由** | D1-A 最誠實建模「玩家站 sim origin、場景往前延伸」,`eyeZ` optional 且預設逐位相容 → placeholder/field-low/urban camera 不動、零回歸;`maxRangeU/engagementDistanceU` 圍繞 114.59 的設計佐證原意即 origin 錨定。D2-B 改動最小且順手補齊 data-model 缺口(drill 宣告自己的 scene),`loadDrillById` 既有契約已能原子載入 + 驗證**新** drill。 |
| **偏離計畫** | 無偏離協議;兩缺陷源自 PR #34 review 而非既定 WP task,依 §9 走 known_issue 流程(KI-002 tech spec + 本帳本)。診斷/計畫於前一 session 產出(僅落 KI 文件),實作於本 session(2026-07-15)完成,依協議拆為兩個原子 commit(D1、D2 相互獨立)。 |
| **遺留 OQ / 未做** | **OQ-KI2-1**:`tracking_longrange_v1`(field-low camera z=4)~1% 側翼距離誤差**維持現狀**(使用者拍板),不綁 field-low eyeZ;日後若研究者判不可接受再另開 task 並重驗 WP-23 決定性。**OQ-KI2-2**:補 sceneId 使 detection_popin_v1 下拉選取強制載 field-low(行為變更,使用者已接受)。**OQ-KI2-3**:已釐清——`br-tracking.spec.ts` 兩案(autoAim tracking 指標 + hitscan 命中)不斷言 projectile 命中數,`full-drill.spec.ts` WP-22 resolution protocol 兩案亦綠 → 修法後自然綠,無需改期望。 |
| **影響面** | **D1**(commit 1):`src/scene/SceneConfig.ts`(+`eyeZ`+finite validator)、`src/render/SceneManager.ts`(camera z 用 `room.eyeZ ??`)、`src/scene/scenes/br-field.ts`(`eyeZ:0`)、新增 [br-camera-anchor-invariants.test.ts](../../tests/regression/br-camera-anchor-invariants.test.ts)(封 D1 測試盲區——既有 [br-tracking-invariants.test.ts:84](../../tests/regression/br-tracking-invariants.test.ts#L84) 自建 z=4 camera 故看不到 bug)。**D2**(commit 2):`src/main.ts`(drill 註冊表補 `detection_popin_v1.sceneId='field-low'`、`applyCondition` 移除 `loadSceneById` + 加 dev assertion)、新增 [protocol-atomic-load.test.ts](../../tests/regression/protocol-atomic-load.test.ts)(鎖 `loadDrill(目標 drill, 目標 scene)` 契約 + 重現「舊 BR drill vs field-low throws」根因;main.ts wiring 另由 e2e protocol 全鏈路覆蓋)。不動 sim/hitbox/彈道語意(GD-6/7/16/17)、不動場景資產(GD-9)。 |
| **狀態** | ✅ D1+D2 已修 + 落地(2026-07-15;branch `aa`)。驗證:`tsc --noEmit` 0、`vitest run` 628 綠(含新增 D1 3 案 + D2 3 案、br-tracking-invariants 三案 0 迴歸)、`playwright` 18 綠(含 WP-22 resolution×detection protocol + br-tracking)。 |

---

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
