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
| [KI-016](KI-016-session-plan-family-order-validator-stale-allowlist.md) | `metadata.ts` 的 `requireSessionPlanFamilyOrder` 仍寫死驗證 `TEST_FAMILY_IDS`，未跟上 WP-45 T5 在 `SessionRunner.ts` 建立的 `KNOWN_SESSION_FAMILY_IDS` 聯集——目前被「preset 切換未接進操作端 UI」意外遮住未觸發，一旦 `families` 含 `'peek-click-transfer'` 就會在匯出時 throw | BD-016(§2，兩份允許清單收斂成 `sessionSchedule.ts` 匯出的單一來源，`SessionRunner.ts`/`metadata.ts` 皆改為 import) | 🔴 診斷完成，修法待落地 |
| [KI-015](KI-015-drill-results-retest-discoverability.md) | Drill Results 以全螢幕遮罩呈現，但 Restart／匯出入口位於頁外；使用者不易發現重測，且未被提醒重測會清除本輪結果 | BD-015(§3,Results 內新增 sticky 操作列；UI 只用 callbacks 重用既有 restart/export path，Restart 前確認資料清除) | ✅ 已修(2026-08-26) |
| [KI-014](KI-014-spider-shot-peripheral-target-sunk-below-floor.md) | KI-012 修復北牆遮擋後,使用者回報「現在地板高度也會遮蓋球體」——`spider-shot-v2` 的 `angularRadiusDegRange` 上限 25° 搭配 azimuth 朝下時,周邊目標世界 y 可低至約 -1.99,`placeholder-room` 地板原在 y=0,目標幾乎全沉入地板 | BD-014(§3,只放大 `placeholder-room` 的地板深度:新增 `floorY:-3` 並讓牆體下緣一併延伸,不動任何 drill config 凍結值) | ✅ 已修(2026-08-26) |
| [KI-013](KI-013-controls-tdz-referenceerror-on-early-researcher-click.md) | 於 KI-012 診斷過程中意外發現:過早連續點擊「研究員模式」→「單一 Drill 調整」會拋出未捕捉的 `ReferenceError: Cannot access 'controls' before initialization`——`controls` 是頂層 `const`,兩個 top-level await 期間按鈕已可點但 `controls` 仍在 TDZ | BD-013(§3,`controls` 改為提早宣告的 `let \| undefined` + `syncControlsVisibility()` 補 guard,比照既有 `researcherMenu` 慣例) | ✅ 已修(2026-08-26) |
| [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) | WP-46 T-exit 手動驗收回報「spider-shot-v2 沒有看到任何球體」——追碼證實 v1 的方塊目標在同一位置也一樣看不到:`placeholder-room` 北牆(z=-5)比 spider-shot 目標距離(z=-8)更靠近相機,整顆目標(不分形狀)被牆體完全遮擋;這正是 WP-5 T1 早已文件化過但被 WP-36 重蹈的坑 | BD-012(§3,只放大 `placeholder-room` 的 `roomSize` depth 10→20(北牆退到 z=-10),明確釘住 `eyeZ:4` 避免連動改變 camera/raycast 原點;不動任何 drill config 凍結值) | ✅ 已修(2026-08-26) |
| [KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md) | drill 選單選 `spider-shot-v1` 擲出「clearance 驗證失敗」，完全無法載入——`availableDrills` 缺 `sceneId`，fallback 到預設 field-low，其 tree/rock 道具與目標距離重疊 | BD-011(§3,`main.ts` 補 `sceneId: 'placeholder-room'`(唯一零 propBounds 的既有場景)) | ✅ 已修(2026-08-25) |
| [KI-010](KI-010-rest-overlay-stuck-on-failed-auto-advance.md) | Session Plan 休息倒數結束後自動載入下一家族失敗時（`SessionRunner.poll()`）錯誤被 `void` 靜默丟棄，`phase` 永遠卡在 `'rest'`，`restOverlay` 因此永不消失 | BD-010(§3,`poll()` 自動 advance 補 `.catch()`：`onStatus` 回報 + 強制轉 `{kind:'done'}`；`runTransition()` 的 `.finally()` 鏈補 `.catch(() => {})` 避免衍生 unhandled rejection) | ✅ 已修(2026-08-25) |
| [KI-009](KI-009-session-plan-qhd-gate-too-strict.md) | Session Plan（不操弄解析度條件）誤用 resolution/BR protocol 專屬的 QHD（2560×1440）資格閘門檻，FHD 面板無法測試選手 | BD-009(§3,新增 `SESSION_PLAN_MIN_CONDITION`(1920×1080)，`EligibilityGate.required` 改支援函式型、依 `pendingSessionMode` 動態解析) | ✅ 已修(2026-08-25) |
| [KI-008](KI-008-fitts-v1-threshold-drift-and-xcorr-empty-table.md) | PR #39 Codex review 三則:①`fitts-v1` 門檻偏離 T0 凍結的 pre-registration(`min_samples`/`min_id_range_bits` 各減半),09:24 誤判 `ok`;②`d_ratio` 對 `min(D)<=0` 算出 `+inf` 誤判為未過關,丟棄有效 session;③空 xcorr table(`verdict is None`)誤判為未 blocked,缺口說明謊稱全數有輸出 | BD-008(§2,**D1+D2+D3 全數落地**:恢復凍結門檻 20/2.0/1.0;`d_ratio` 只在有限值時判定;`verdict is None` 視同 blocked) | ✅ 已修(2026-08-17) |
| [KI-007](KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) | `experimentSession.exit()` 只在多條件 protocol 流程呼叫,單一「實驗 session」drill 流程從未呼叫 → `active` 對整頁生命週期恆 true → drill 結束後正常退出全螢幕(去抓匯出檔)也會被誤判為條件失效,`meta.suspect` 誤標 `true` | BD-007(§2,**F-1 已落地**:`handleFullscreenChange` 新增 `recording` 參數,只在 drill 錄製中才判定失效) | ✅ 已修(2026-08-07) |
| [KI-006](KI-006-m14-sample-no-counterstrafe.md) | M14 ④/⑤ 的真實資料效度閘所用樣本(08:03)**不含 counter-strafe 構念**:`vx ≡ 0`、`keys` 全空、`counter` 事件 0 → 量到的是站樁純 flick。**M14 ④⑤ 撤回**(理由獨立於 KI-005) | BD-006(§3,**C+B 全數落地**:construct presence gate + 重新採樣,見 [A2](KI-005-A/A2-blocked-plan.md)) | ✅ CLOSED(2026-08-07),M14 ④⑤ 已重新宣告 |
| [KI-005](KI-005-omega-render-sim-aliasing.md) | ω(t) 受 render(240Hz)/sim(128Hz)**zero-order-hold aliasing** 汙染:每 8 tick 一個假凹口 → `merged_adjacent_peaks` 15/19,有效產率僅 4/19。**推翻 KI-004「①③④⑤⑥ 不受影響」的豁免,M14 ③④⑤ 撤回** | BD-005(§3,**A1+A2(T1–T4)全數落地**:選項 A + 感度由 meta 重建 + 不做過渡期 C;FM-1 關閉、`seg-v2` 凍結、M14 ③④⑤ 重新宣告)· 計畫 [KI-005-A/](KI-005-A/README.md) | ✅ A1+A2 全數完成(2026-08-07),M14 ③④⑤ 已重新宣告 |
| [KI-004](KI-004-sim-world-unit-domain-mismatch.md) | sim(source unit)與 world domain 混用:corridor gate 緊 100× → 真實急停 run 全被標 `suspect`;離線 ε(t) 量測原點錯誤(D2a base offset + D2b scale)→ **實測偏差 12.5°/67°,M14 ② 撤回,S1 落地後重新宣告** | BD-004(§2,K-1/K-2/K-3 已拍板;S1 已落地) | 🟡 S1 ✅ 已落地(2026-08-06)/ S2·S3 待辦 |
| [KI-003](KI-003-top-left-controls-overlap.md) | 左上角 session/protocol 啟動按鈕覆蓋 SettingsPanel 的 Sensitivity/FOV/Resolution | BD-003(§3) | ✅ 已修(2026-08-05) |
| [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) | br-field camera 未錨定 sim origin(D1)+ protocol 場景載入驗證舊 drill(D2)(PR #34 review) | BD-002(§3) | ✅ D1+D2 已修(2026-07-15) |
| [KI-001](KI-001-input-lag-sim-clock-drift.md) | 開火/鍵盤嚴重輸入延遲(sim 邏輯時鐘漂移) | BD-001(§3) | ✅ Task 1+2 已修(2026-07-09) |

---

## 2. 未解 / 進行中(OPEN)

> 狀態:🔴 診斷中 · 🟡 已定解法待落地 · ✅ 已修(移至 §3 並標日期/commit)。

### BD-016 🔴 KI-016 — `sessionPlanFamilyOrder` metadata 驗證仍鎖死 `TEST_FAMILY_IDS`；診斷完成,修法待落地(2026-08-26)

| | |
|---|---|
| **發現處 / 根因** | 稽核「Session Plan 家族清單能否改成下拉/置換 preset」時讀碼發現:`main.ts:516-521` 把 `activeSessionPlanSelection.families` 塞進匯出的 `sessionPlanFamilyOrder`,但 [metadata.ts:330-338](../../src/data/metadata.ts#L330) 的 `requireSessionPlanFamilyOrder` 只驗證 `TEST_FAMILY_IDS` 四個值。WP-45 T5 在 [SessionRunner.ts:49](../../src/session/SessionRunner.ts#L49) 建了 `KNOWN_SESSION_FAMILY_IDS`(`TEST_FAMILY_IDS ∪ TRANSFER_PILOT_FAMILY_IDS`)當允許清單,但只更新了那一份,`metadata.ts` 這份獨立寫死的驗證從未跟上——兩份允許清單各自維護、其中一份漂移,是 GD-7(hitbox 單一來源)想避免的同一種模式。完整診斷見 [KI-016](KI-016-session-plan-family-order-validator-stale-allowlist.md)。 |
| **為何從未觸發** | `main.ts:360-361` 的 `createSessionPlanSetup({ families: TEST_FAMILY_IDS, ... })` 目前寫死餵四家族常數,從未把 `TRANSFER_PILOT_FAMILY_IDS` 或 `sessionPlanPresets.ts` 的 preset 註冊表接進操作端 UI,所以 `'peek-click-transfer'` 從未真的流進這條驗證路徑。這是被另一個尚未落地的功能(preset 切換)意外遮住,不是被修好——任何未來讓 `families` 帶到 `'peek-click-transfer'` 的改動都會立刻踩到。 |
| **決策(修法方向,尚未落地)** | 收斂成單一來源:允許清單搬到 `sessionSchedule.ts` 匯出,`SessionRunner.ts` 與 `metadata.ts` 都改為 import 同一個 export,不在 `metadata.ts` 內另拼一次聯集(否則只是把重複換位置,問題會再發生)。 |
| **理由** | 這條 gap 目前無外部症狀(未被任何已知操作路徑觸發),但一旦「Session Plan preset 切換」開放給操作端 UI(該功能已在 [DECISIONS.md GD-24 FR-G9](../exec-plan/DECISIONS.md) 被決議為「切換既有具名 preset 對任何操作者開放」但實際尚未接線),就會立刻炸——屬於「著手做那個功能前必須先清的地雷」,故獨立開 KI/BD 帳本追蹤,不與 preset 切換本身的 feature 決策混記。 |
| **偏離計畫** | 使用者拍板本輪只交診斷文件與修法計畫,不落地程式碼;落地時機留待後續。 |
| **遺留 OQ** | 無——修法方向已明確,純粹是排程問題(何時落地)。 |
| **狀態** | 🔴 診斷完成,修法待落地(2026-08-26)。 |

### BD-004 🔴 KI-004 — sim/world 單位域混用(corridor gate + 離線 ε 原點);**診斷完成,修法待拍板**(2026-08-05)

| | |
|---|---|
| **發現處 / 根因** | 排查「08:03 匯出零位移」時,重現用的 09:39 匯出(含真實 A/D 橫移)暴露:`meta.suspect` 在**有做急停**時為 true、**完全不動**時為 false。追碼確認唯一觸發者為 [main.ts:527](../../src/main.ts#L527) 的 corridor gate,它拿 **source unit** 的 `state.player.x` 去比 **world unit** 的 `playerCorridor.halfWidthU`。根因是全案有兩個單位域,而橋樑 `SIM_TO_WORLD = 0.01`([main.ts:628](../../src/main.ts#L628),註解自陳為「佔位;WP-6 drill config 接管」,從未接管)**只被套用在 render camera 一處**;所有繞過 camera 直接讀 sim 量的消費者都少乘這個因子。第二處落點在離線推導 `p_eye = (px, eyeY, pz)`([trackingDerivation.ts:191](../../src/metrics/trackingDerivation.ts#L191)、`detectionDerivation.ts` 同實作)。完整診斷見 [KI-004](KI-004-sim-world-unit-domain-mismatch.md)。 |
| **診斷更正(2026-08-05)** | 初版判定「08:03 因 `px ≡ 0` 使 ε 碰巧正確、M14 ② 不撤回」**經實測推翻**。D2 實為**兩個獨立缺陷**:**D2a** 遺漏 camera base offset(`field-low` 的 `eyeZ = depth/2 − standoff = 4`,[SceneManager.ts:67](../../src/render/SceneManager.ts#L67)),**與 `px` 無關、恆成立**;**D2b** 遺漏 `SIM_TO_WORLD`,僅 `px ≠ 0` 時再疊 100×。以引擎自身的 `fire.offsetDeg` 為 ground truth 實測:08:03 偏差中位數 **12.52°**、09:39 **67.11°**(正確公式為 0.21° / 0.14°)。D2a 的來源是 [KI-002 / D1](KI-002-br-field-camera-anchor-protocol-load.md) 引入 `eyeZ` 修正射線原點時,**離線推導從未跟上**。 |
| **決策(2026-08-05 使用者拍板)** | **K-1 雙域 + 顯式換算**(不統一單位):kinematics 域 = Source unit、geometry 域 = world unit,`SIM_TO_WORLD` 升為引擎級具名常數並進匯出。**K-2 M14 ② 撤回**,S1 落地後重新宣告(①③④⑤⑥ 維持:分段走 ω(t),只依賴 `aim`)。**K-3 允許選手自由位移** → corridor 由「移動紀律 gate」降為「場景淨空覆蓋觀測項」,**不再觸發 `suspect`**。落地分 S1 修正性 / S2 additive 資料模型(逐 tick eye pose + `meta.validity` 拆解)/ S3 文件 ADR,詳見 [KI-004 §5](KI-004-sim-world-unit-domain-mismatch.md)。 |
| **理由** | **K-1**:幾何早已整體是 world domain,只有 `player.x/z` 是離群值 —— 搬離群值成本 O(1),搬子系統要重標 GLTF 資產/`propBounds`、`DrillConfig` 座標 ×100、**改 `hitbox` 預設值(違反 WP-23/GD-7 逐位不變)**、bump `schemaVersion` 並重錄全部 golden,是 stage 級工程;而 ε 為角度、scale-invariant,同域即正確。CS2 校準(WP-15/GD-13)活在速度常數不在位置單位,保留 `vx`=u/s 即保住校準。**K-2**:12.5°/67° 的系統性偏差非加註可處理。**K-3**:自由位移是研究設計選擇;越出淨空走廊的真實後果是**視覺遮擋**,依 GD-6 場景幾何永不進 sim,不可能影響命中判定 → 屬「該記錄的觀測」而非「該作廢的 run」。 |
| **架構層結論(跨 WP,故入本帳本而非 KI 內)** | **parity 是一致性閘,無法發現兩側一起錯** —— 本案即為實證(C-D4 只約束 Python 對 TS,未約束 TS 內 render 與 metrics 兩層)。S1 必須補**正確性閘**,且 oracle 已存在且免費:`fire.offsetDeg` 與 ε(t) 是同一構念、不同實作路徑、不同資料來源,可直接互驗(限 `aimPunch == 0` 的首發)。此閘若早存在,D2a/D2b 第一天即被抓到。 |
| **偏離計畫** | ① 本診斷階段:無,零程式碼改動。② **S1 落地時**:T4(TS 修法)與 T5(Python 同步 + 重產 parity fixture)**合併為單一已驗證綠的 commit**(`6f4b540`)——TS 修法後 `epsilon-parity.test.ts` 必紅(fixture 未重產),與 repo 硬規「每個 commit 綠」衝突,比照 **BD-001**(§3,下方)的 TDD 偏離慣例。③ 2026-08-05 使用者拍板**前拉** S2 的 ②③(`meta.simToWorld`/`meta.validity`)與 ① 的**靜態部分**(`meta.scene.eye`)進 S1(新增 T2),理由是 D2a 的結構性根因是「匯出在數學上無法還原原點」,只修 derivation 仍是把猜的改成對的猜,唯有讓匯出自我描述才能讓「猜」本身消失。 |
| **遺留 OQ** | **OQ-KI4-2**(改寫)corridor 觀測項的記錄粒度——**S1 已落布林**(`meta.validity.corridorExceeded`),粒度升級待 S2/研究者定義 · **OQ-KI4-5**(新)自由位移下越出淨空走廊造成的視覺遮擋是否需在報告層加註 · ~~**OQ-KI4-6**~~ ✅ 關閉(2026-08-06,T3):`clearance.halfWidthU` **不拆**與執行期觀測門檻的欄位。OQ-KI4-1/3/4 已隨 K-1/K-3/K-2 關閉。 |
| **影響面(診斷結論)** | **受影響**:`meta.suspect` 語意、離線 ε(t)/on-target/TOT%/`t_acquire`/`t_detect`/`eccentricity_at_spawn`(**所有**匯出,非僅 `px ≠ 0`)、**M14 ② 撤回**(**已於 S1 落地後重新宣告,見下**)、**WP-30/31 entry blocker 恢復**(全部逐段軌跡指標建在 ε 上;**該 blocker 仍維持**,見下)、`run_pipeline` 的 `mean_epsilon_deg` 診斷欄。**不受影響**:引擎命中/彈道/`offsetDeg`(全走 camera,兩端同域)、sim 決定性(S1 不動 sim)、submovement 分段與 M14 ①③④⑤⑥(走 ω(t),只依賴 `aim`)、WP-29 T1/T2(只吃 events 與 `ticks[].keys`)。 |
| **後續更正(2026-08-06)** | 本條的「**M14 ①③④⑤⑥ 維持:分段走 ω(t),只依賴 `aim`**」(見上方「決策」與「影響面」兩列)**已被推翻**。該推論就本條的量測原點缺陷而言仍正確,但 `ticks[].aim` 另有獨立缺陷 —— render 速率寫入 / sim 速率讀取的 ZOH aliasing(**BD-005** / [KI-005](KI-005-omega-render-sim-aliasing.md));且本條 §2 對照表所載「08:03 無鍵盤輸入」對 M14 ④/⑤ 構念效度的後果當時未被追下去(**BD-006** / [KI-006](KI-006-m14-sample-no-counterstrafe.md))。**現況:M14 ②③④⑤ 撤回,僅 ①⑥ 維持。** 本條其餘診斷(D1 / D2a / D2b / K-1 / K-3)與 **S1 修法計畫全部不受影響,照原計畫進行**。 |
| **S1 落地(2026-08-06)** | K-1/K-2/K-3 全數落地(commits `43675ab`/`f6027ed`/`465f986`/`6f4b540`,詳細任務拆解見 [KI-004-S1/README.md](KI-004-S1/README.md))。**閘 ①**(`fire.offsetDeg` oracle,兩份真實 fixture 各 N=1 合格首發):08:03 修法前 8.19°(紅)→ 修法後 0.000°(綠);09:39 修法前 88.53°(紅)→ 修法後 0.030°(綠),均 ≤ 0.5° 容差。**閘 ②**(`eyeBase.z≠0` 且 `px≠0` 閉式幾何):TS/Python 各自對閉式解相對誤差 ≤1e-9。**parity fixture 已重產**且 `epsilon-parity.test.ts` 轉綠(`options.eyeOrigin.source==='meta'`,即匯出自帶的 `meta.simToWorld`/`meta.scene.eye` 已被消費,非 `legacy-default`)。回歸:`tsc --noEmit` exit 0、`npm run test:ci` 88 files/694 tests + 19 e2e 全綠、`uv run pytest` 183 passed;`src/sim`/`SharedState`/`SimLoop.step` 零 diff。**M14 ② 於 T6 依此證據重新宣告**(見 [WP-28 progress.md](../exec-plan/active/stage4/wp-28-research-foundation/progress.md)「M14 ② 重新宣告」段)。**效度聲稱不擴大**:仍限「單一匿名 counter-strafe 樣本」。**WP-30/31 entry blocker 未完全解除** —— KI-004 這條理由已解除,但 KI-005(BD-005,🟡 已定解法待落地)與 KI-006(BD-006,🔴 已確認、處置待拍板)兩條獨立理由尚未落地,entry blocker 依舊維持。 |
| **狀態** | 🟡 S1 ✅ 已落地(2026-08-06)/ S2(逐 tick eye pose)· S3(文件/ADR)待辦。KI-004 整體仍 OPEN(S2/S3 未落地)。 |

---

---

## 3. 已決策 / 已修(CLOSED)

### BD-015 ✅ KI-015 — Drill Results 的重測／匯出操作不可發現(2026-08-26)

| | |
|---|---|
| **發現處 / 根因** | Results 是 `position:fixed; inset:0` 的全螢幕 overlay；底部 `#drill-controls` 雖因較高 z-index 仍可點，但被 backdrop 視覺上切離結果內容。Restart 會重置 recorder 與隱藏結果，使用者卻無法在 Results 內得知此後果或先行匯出。完整診斷見 [KI-015](KI-015-drill-results-retest-discoverability.md)。 |
| **決策** | `ResultScreen` 新增 sticky 操作列，以 optional `onRestart` / `onExportJSON` / `onExportCSV` callbacks 表達意圖；`main.ts` 注入既有 `restartActiveDrill()` 與 export 流程。Restart 為 primary action，顯示資料清除提醒並要求確認；「返回設定」只關閉 Results。 |
| **理由** | 不讓 UI 直接依賴 DrillRunner、recorder 或 export 模組，可保留 UI → main orchestration → core 的依賴方向，也不會產生第二套重置或匯出語意。把操作放在 Results 內處理的是可發現性問題，不需要改動現有 overlay layering。 |
| **影響面** | 受影響：Results DOM、main UI 接線與 ResultScreen 單測。未受影響：DrillRunner、SimLoop、SharedState、recorder、metrics 計算、匯出 schema、SessionRunner / protocol 排程。 |
| **遺留 OQ** | 正式 Assessment / Session Plan 裡「重測是否計入正式資料」需另行訂定協定規則；本次只把既有單一 drill Restart 能力移到可發現的位置，不變更 session 語意。 |
| **狀態** | ✅ 已修(2026-08-26)。 |

### BD-014 ✅ KI-014 — spider-shot 周邊目標朝下沉入 placeholder-room 地板(2026-08-26)

| | |
|---|---|
| **發現處 / 根因** | [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md)(北牆遮擋)修復後,使用者實機重測回報「現在地板高度也會遮蓋球體」。追碼確認 `TargetManager.ts` 的 `peripheralPos()` 公式在 azimuth=180°(朝下)、`angularRadiusDegRange` 取上限時,y 座標最負。代入 `spider-shot-v2` 實際參數(`centerDistanceU=8`、`TARGET_Y=1.5`、角距上限 25°)算出 y≈−1.99,而 `placeholder-room` 地板在 y=0——目標中心已埋進地板近 2 個單位,加上 hitbox 半徑幾乎全沉。`spider-shot-v1`(角距固定 15°)同公式算出最深僅 y≈−0.61,這正是 [KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md) OQ-KI11-3 當年記錄過的數字,但只點出「比房高更寬」沒有追「已是負值、沉入地板」這一半;WP-44/46 把角距上限從 15° 放寬到 25°,把原本輕微的邊界情況推到幾乎全沉的程度。與 KI-012 同一族問題(drill 目標幾何 vs. 場景固定房間邊界不相容),但這次是地板(下邊界)而非北牆(遠邊界),兩者是房間六個面中獨立的兩面。完整診斷(含公式代入與 v1/v2 對照)見 [KI-014](KI-014-spider-shot-peripheral-target-sunk-below-floor.md)。 |
| **決策** | 比照 KI-012 做法:`SceneConfig.ts` 的 `ProceduralRoomConfig` 新增選填 `floorY?: number`(比照既有 `eyeZ?` 慣例,省略=0 逐位不變);`SceneManager.ts` 的 `#buildRoom()` 用 `floorY` 定位地板,並讓四面牆下緣跟著一起下移(牆高=`height-floorY`,置中於 `[floorY,height]`,上緣仍固定於 `height`,不影響 KI-012 §6 OQ-KI12-1 記錄過的「周邊目標探出牆頂仍可見」行為);`placeholder-room.ts` 設 `floorY:-3`,覆蓋 v2 實測最深 y≈−1.99,留約 0.87 安全邊界。 |
| **理由** | 不採「縮小 `angularRadiusDegRange` 上限」——這是 WP-44/46 未經 pilot 校準的候選值,拍板時已明確保留調整空間,為場景幾何限制反向遷就它本末倒置;場景幾何依 GD-6 本就可自由調整、不驚動 sim/drill config,是唯一不影響已定案協定數值的修法,與 KI-012 的修復哲學一致。 |
| **偏離計畫** | 無。於使用者對 KI-012 修復的實機重測中回報觸發,依協議走 known_issue 流程(KI-014 tech spec + 本帳本);修復同時在 `spider_shot_v1.test.ts`/`spider_shot_v2.test.ts` 各新增回歸測試,透過真實 `TargetManager`/`createSharedState` 程式碼路徑(非手算公式斷言)鎖死 azimuth=180°/角距上限驗證世界 y 落在地板之上,防止角距上限日後再調大時第三次重蹈覆轍(不夠時測試會轉紅)。 |
| **遺留 OQ** | **OQ-KI14-1**:2.0° 角直徑的中心目標即使完全無遮擋,螢幕投影直徑仍偏小(本次以 4°/8° 對照驗證過「越小越難看見」的趨勢),但這是尺寸感知問題不是遮擋問題,是否調整候選值屬 WP-46 校準範圍的產品決策。**OQ-KI14-2**:`floorY=-3` 是針對 v2 目前角距上限(25°)算出的安全邊界,若日後上限再調大(約超過 29°)需要重新驗證;新增的回歸測試會在那種情況下轉紅充當守門員。**OQ-KI14-3**(承 KI-012 OQ-KI12-2):`clearance.ts` 仍不查房間牆體/地板/天花板幾何,這已是同一類問題第二次靠人工重現找到,是否要補房間邊界檢查屬獨立架構決策。 |
| **影響面** | **受影響**:`placeholder-room` 場景的地板/牆體下緣視覺呈現。**不受影響**:`spider_shot_v1.ts`(協定凍結,零改動)、`spider_shot_v2.ts`、`TargetManager.ts`/`HitDetector.ts` 任何判定邏輯、`clearance.ts` 驗證結果、`placeholder-room` 上其他既有 drill 的 camera/raycast 原點、匯出資料格式。`floorY` 為新增選填欄位,省略時對其他所有場景逐位不變。 |
| **狀態** | ✅ **已修(2026-08-26)**。驗證:新增的 v1/v2 回歸測試經真實 `TargetManager` 程式碼路徑跑出朝下最深周邊目標 y(v1≈−0.61、v2≈−1.99),皆 `> floorY(-3) + hitbox 半徑`,測試全綠;視覺截圖確認房間幾何延伸無縫(牆體下緣跟地板一起延伸,無背景色透縫);`tsc --noEmit` exit 0;完整 `npm run test:ci` 全綠。 |

---

### BD-013 ✅ KI-013 — 過早點擊研究員模式/單一 Drill 調整撞 controls 的 TDZ(2026-08-26)

| | |
|---|---|
| **發現處 / 根因** | 於 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) 用 Playwright 重現使用者操作流程時,`page.on('pageerror', ...)` 意外攔到 `ReferenceError: Cannot access 'controls' before initialization`。追碼確認:`main.ts` 的 `setAppMode()`(~L394)與傳給 `createResearcherMenu()` 的 `onSelectDrillControls` callback(~L437)皆呼叫 `syncControlsVisibility()`,而它讀取的 `const controls = createControls(...)` 要到檔案尾端(~L1119)才執行,中間隔著兩個 top-level `await`(`measureDisplayRefresh()`/`measureDisplayHz()`,各自要跑數個 rAF 取樣、耗時可觀)。對應按鈕在這兩個 `await` 之前就已建立並掛上 click handler,故使用者若在懸置期間點擊,會在仍屬 TDZ 的 `controls` 上觸發 `ReferenceError`。`const`/`let` 的 TDZ 存取(含 `typeof`)一律拋錯,不像未宣告全域變數那樣能安全判斷「尚不存在」。 |
| **為何肉眼不易察覺** | `setAppMode()`/`onSelectDrillControls` 呼叫 `syncControlsVisibility()` **之前**已完成真正該做的事(`appMode = next`、`researcherMenu.open()/close()`);例外只在函式最後一步、於事件 handler 內拋出,不中斷模組其餘頂層程式碼。等執行終於跑到 `controls = createControls(...)`,緊接著有一次**無條件**的 `syncControlsVisibility()` 呼叫,會用當下(已被使用者點擊改變過的)`appMode` 正確套用一次可見性——表面上功能正常,例外只安靜留在 console。 |
| **決策** | `controls` 由檔案尾端的 `const` 改為提早宣告的 `let controls: ControlsHandle \| undefined`(比照既有 `researcherMenu`/`markProtocolFullscreenExit` 慣例),`syncControlsVisibility()` 開頭補 `if (controls === undefined) return;` guard;另外 `loadDrillById`/`loadSceneById` 內兩處 `controls.setSelectedScene/setSelectedDrill` 改用 `?.`(型別層級防禦,執行期行為不變,因為這兩個函式實際只會在 `controls` 已建好後才被呼叫)。 |
| **理由** | 不採「把 `createControls(...)` 搬到檔案更前面」——它依賴 `restartActiveDrill`/`loadDrillById`/`loadSceneById`/`tracerView` 等一長串在它之後才定義的變數/函式,搬遷成本與回歸風險遠高於本次修法;`controls` 未就緒時本來就沒有面板可同步,no-op 是唯一正確(非僅「不報錯」)的行為——真正的狀態同步由 `controls` 建好後緊接的無條件呼叫負責,修復前後這條路徑不變。 |
| **偏離計畫** | 無。於 KI-012 診斷過程中意外發現,依協議走 known_issue 流程(KI-013 tech spec + 本帳本);修復後在 `tests/e2e/overlay-layering.spec.ts` 新增一個永久回歸測試(模擬同一按鈕點擊序列並斷言無 `pageerror`),而非僅留一次性重現腳本。 |
| **遺留 OQ** | **OQ-KI13-1**:同一類「頂層 `const` 依賴,中間隔 `await`,但 UI 已可互動」的結構性風險,原則上可能出現在 `main.ts`(~1300 行單一模組作用域)其他晚宣告的頂層 `const`;本次只處理實際重現到的 `controls` 一處,未做全檔案掃描式稽核,留給日後有動機系統性重構時再評估。 |
| **影響面** | **受影響**:`src/main.ts` 的 `controls` 宣告形式與三個既有存取點寫法。**不受影響**:`syncControlsVisibility()`/`loadDrillById()`/`loadSceneById()` 在正常(非競態)路徑下的行為逐位不變、`Controls.ts`/`ResearcherMenu.ts` 元件本身、任何 drill/sim/export 邏輯。 |
| **狀態** | ✅ **已修(2026-08-26)**。驗證:Playwright 連續點擊兩按鈕重現例外後,修復並以 `--repeat-each=5` 跑 5 次無 `pageerror`;新增的 e2e 回歸測試以 `--repeat-each=3` 跑 9 個測試全綠;`tsc --noEmit` exit 0。 |

---

### BD-012 ✅ KI-012 — spider-shot-v1/v2 目標被 placeholder-room 北牆遮擋，完全看不見(2026-08-26)

| | |
|---|---|
| **發現處 / 根因** | 使用者於 WP-46 T-exit 手動驗收 `spider-shot-v2` 回報「沒有看到任何球體」。用 Playwright 驅動真實 Edge 重現操作流程，於 `TargetView.sync()` 加暫時性 log 確認目標確實 spawn 於 `(0,1.5,-8)`、`shape='sphere'`、幾何正確——WP-46 交付的 sphere 渲染管線本身無誤。改測 `spider-shot-v1` 的方塊目標於同一位置，**一樣完全看不到**，排除 WP-46 回歸。追碼確認 [`SceneManager.ts` `#buildRoom()`](../../src/render/SceneManager.ts) 把北牆放在 `z=-depth/2`；`placeholder-room` 原 `roomSize:[10,10,3]`(depth=10)使北牆在 z=-5，而 spider-shot 的 `centerDistanceU`/`distanceURange` 皆為 8(z=-8)，目標整顆埋在牆後。**這是重蹈覆轍**：`TargetManager.ts` 的 `DEFAULT_DISTANCE` 常數旁，WP-5 T1 早已留下「距離須 < 房間半深，否則目標生在牆後被遮擋(距離 8 → z=-8 落在北牆後方)」的明確警語，並把預設距離從 8 降到 4；WP-36 引入 spider-shot 時開了新欄位(`centerDistanceU`/`distanceURange`，非 `targets.distance`)，沒對照到這條同檔案內的警語，原地重踩十二個 WP 之前踩過的坑，WP-44/46 沿用未查覺。完整診斷（含 30° 放大對照實驗、v1/v2 對照證據）見 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md)。 |
| **為何拖了超過一年沒被發現** | ① `HitDetector` 的 raycast 只測 hitbox，不查牆的視覺遮擋（occlusion gate 只在 `propBounds` 非空時觸發，`placeholder-room` 恆空）——中心目標「看不見但打得中」，玩家盲開火不需要真的看到它。② 周邊目標的方位角有時把 Y 座標推出牆高（3u，無天花板），探出牆頂而可見——這正是使用者過去抱怨「太難搜尋」而非「完全看不到」的原因：真正被拿來練習/抱怨的是**周邊**目標（部分可見），必被遮的**中心**目標反而沒人靠視覺瞄過。③ `validateClearance()` 只查 `propBounds`，完全不查房間牆體本身的幾何。 |
| **決策** | 只放大 `placeholder-room` 的 `roomSize` depth(10→20，北牆退到 z=-10，給 distance=8 目標 2u 淨空)，並新增顯式 `eyeZ:4` 釘住 `resolveEyeWorldBase()` 原本 `depth/2-standoff` 的 fallback 值——避免 depth 改動連動搬動 camera/raycast 原點，牽動 `placeholder-room` 上其他既有 drill 的命中判定距離。只改 depth，不改 width/height(是否讓周邊目標完全不探頭是產品決策，留 OQ)。 |
| **理由** | 不採「縮短 spider-shot 的 `centerDistanceU`/`distanceURange`」——這是 v1 的 WP-39 凍結校準值，且 `spiderShotConditions.ts` 的 `W_deg`/`D_deg` 與 WP-46 視角直徑公式皆以 distance=8 為基準，改動會牽動已凍結協定與既有指標校準；場景幾何依 GD-6 本就可自由調整、不進 sim runtime，放大房間是唯一不驚動 sim/drill config 的修法。 |
| **偏離計畫** | 無。診斷由使用者於 WP-46 T-exit 手動驗收時回報觸發(非既定 task)，依協議走 known_issue 流程(KI-012 tech spec + 本帳本)；診斷手段（暫時性 log + 30° 放大對照 + v1/v2 交叉驗證）與所有暫時性除錯程式碼(log、e2e spec)均已於修復前清除，`git status` 確認乾淨後才提交修法。 |
| **遺留 OQ** | **OQ-KI12-1**：周邊目標在特定方位角/角距組合下仍可能探出牆頂(牆高 3u、無天花板)，修復前後皆存在，是否要讓其完全落在可見範圍屬產品/訓練設計決策。**OQ-KI12-2**：`clearance.ts` 仍不查房間牆體幾何，只查 `propBounds`；若日後新 drill 又選到超出房間邊界的 distance，同一類坑可能第三次發生，是否要補一個房間邊界檢查屬獨立架構決策。**OQ-KI12-3**：`DEFAULT_PROCEDURAL_ROOM`(`eyePose.ts`)與 `field-low`/`urban-high` 的 `roomSize` 仍是舊值(depth=10)未動——這些場景要嘛是 GLTF 資產(牆體來自 `.gltf`，不受 `roomSize` 影響)要嘛實務上未曾以 `asset:null` 形態建構，本次未發現受影響路徑。 |
| **影響面** | **受影響**：`placeholder-room` 場景的房間深度視覺呈現。**不受影響**：`spider_shot_v1.ts`(協定凍結，零改動)、`spider_shot_v2.ts`、`TargetManager.ts`/`HitDetector.ts` 任何判定邏輯、`clearance.ts` 驗證結果、`placeholder-room` 上其他既有 drill 的 camera/raycast 原點(`eyeZ` 明確釘住)、匯出資料格式。 |
| **狀態** | ✅ **已修(2026-08-26)**。驗證：`tsc --noEmit` exit 0；`vitest run` 137 files / 1076 tests 全綠(含新增 2 個 spider-shot 距離回歸測試)；`playwright test` 23/25 通過，2 個失敗(`input-sampler.spec.ts` 逾時)單獨執行 5/5 全綠——與 [KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md) 記錄過的同一種既有沙盒並行負載 flake 完全一致，與本次改動無關。 |

---

### BD-011 ✅ KI-011 — spider-shot-v1 缺 sceneId，fallback 到 field-low 撞上 tree/rock 道具(2026-08-25)

| | |
|---|---|
| **發現處 / 根因** | 使用者回報 drill 選單選 `spider-shot-v1` 擲出「DrillConfig 載入失敗: clearance 驗證失敗 — tree-b1/tree-b2/rock-b1/rock-b2」。直接呼叫 `validateClearance(fieldLow, spiderShotV1)` 逐字重現。追碼確認兩層原因疊加：**①** [main.ts](../../src/main.ts) 的 `availableDrills` 登記 `spider-shot-v1` 時缺 `sceneId`，`loadDrillById()` 對缺 `sceneId` 的項目 fallback 到目前 `activeSceneConfig`（app 預設 `field-low`），而非「不驗證」。**②** `spiderShotV1.targets.distance=8` 與 `spiderShot.centerDistanceU=8` 恰與 field-low 的 tree/rock 道具座落距離（z≈-7.5~-9）重疊；以 `TargetManager.sampleSpiderShotPose` 的真實中心/周邊錐形公式數值模擬（`x∈[-2.07,2.07]`,`y∈[-0.61,3.46]`,`z∈[-8,-7.21]`），確認即使 `clearance.ts` 正確理解 `spiderShot` 欄位（目前完全沒有對應分支），算出的真實包絡在 field-low 案例仍會相交——不只是驗證公式算錯，是 field-low 本身對 spider-shot 的全向錐形分佈而言並非淨空場景。完整診斷與四場景掃描證據見 [KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md)。 |
| **既有測試為何沒抓到** | `tests/e2e/session-orchestrator.spec.ts` 透過 `__fpsTest.startDrill()` 走 `fpsTestHarness.ts` 的 `entry.scene`（由 `sceneId !== undefined ? findSceneOption(sceneId).config : undefined` 產生），與 live app 的 `activeSceneConfig` fallback 語意不同——spider-shot-v1 缺 `sceneId` 時，harness 端 `scene===undefined`，`loadDrill()` 的 clearance 檢查整段跳過，使這條真實會發生的使用者路徑此前對 e2e 不可見。 |
| **決策** | `main.ts` 的 `availableDrills` 補 `sceneId: 'placeholder-room'`(比照 hold-click/hold-track 既有「指定 home scene」先例)。`placeholder-room` 是唯一 `propBounds: []` 的既有場景，四個候選場景（`field-low`/`urban-high`/`peek-corridor`/`placeholder-room`）實測掃描僅它零 violation。 |
| **理由** | 不採「修正 `deriveTargetEnvelopes()` 使其理解 `spiderShot` 欄位」作為唯一修法——如根因所述，正確算出的包絡在 field-low 案例仍會相交，單獨修正公式不足以解決本次錯誤；`clearance.ts` 是多 drill 家族共用、已測試的核心驗證邏輯，改動其幾何公式本體的正確性驗證成本遠高於「指到一個乾淨場景」的修復範圍，留為遺留 OQ。 |
| **偏離計畫** | 無。診斷由使用者直接回報觸發(非既定 WP task)，依協議走 known_issue 流程(KI-011 tech spec + 本帳本)；修法前以直接呼叫 `validateClearance` 重現錯誤訊息、掃描候選場景取得實測證據，再落地修法。 |
| **遺留 OQ** | **OQ-KI11-1**：`deriveTargetEnvelopes()` 對任何無 `spawnArea` 的 drill 一律套用 legacy L/R 公式，對 spider-shot 只是近似值（本次恰好與真實包絡重疊，未來參數調整可能顯著偏離）；若日後需要讓 spider-shot 使用有裝飾道具的視覺場景，須先補 `spiderShot` 專屬包絡計算分支。**OQ-KI11-2**：harness 與 live app 對「drill 缺 `sceneId`」的語意分歧（harness 跳過驗證 vs live app fallback 驗證）本身仍存在，其餘缺 `sceneId` 的 drill（`counterstrafe-reversal-v1`/`counterstrafe-free-v1`/`trackingV1`）目前因 `distance` 較短未撞上道具，但同類回歸風險原則上未關閉。**OQ-KI11-3**：`placeholder-room` 是空白房間，spider-shot 真實 y 軸包絡（−0.61~3.46）比其 `roomSize` 高度(3)更寬；若日後要換視覺場景需一併考慮室內尺寸，屬產品/美術決策。 |
| **影響面** | **受影響**:`src/main.ts` 的 `spider-shot-v1` `availableDrills` 登記(+`sceneId`)，連帶 `__fpsTest` harness deps 的 `scene` 欄位（透過既有轉換自動生效，零額外改動）。**不受影響**:`spider_shot_v1.ts`(協定凍結)、`clearance.ts`/`TargetManager.ts` 任何邏輯、其他 drill 的場景綁定或 clearance 結果。 |
| **狀態** | ✅ **已修(2026-08-25)**。驗證:`tsc --noEmit` exit 0；`vitest run` 130 files / 968 tests 全綠；`playwright test tests/e2e/session-orchestrator.spec.ts` 2/2（含 spider-shot-v1 完整 `loadDrill()` 鏈路首次真正驗證 clearance 且不拋錯）；全量 e2e 19/23（`input-sampler.spec.ts` 5 案為既有並行負載 flake，單獨執行 5/5 全綠，與本次改動無關）。 |

---

### BD-010 ✅ KI-010 — Session Plan rest overlay 於自動 advance 失敗時卡死不消失(2026-08-25)

| | |
|---|---|
| **發現處 / 根因** | 使用者以 QA 角色排查 Session Plan 測試流程時回報：休息倒數結束後 `RestOverlay` 仍留在畫面上。追碼確認 [SessionRunner.ts poll()](../../src/session/SessionRunner.ts) 在倒數歸零時以 `void this.advance()` fire-and-forget 觸發下一家族載入，未接 `.catch()`；若 `startFamily()` 內 `options.loadDrillById(...)`（`main.ts`,可能含場景切換的 `await createSceneManagerWithStatus(...)`）拒絕，`phase` 永遠停在 `{kind:'rest', ...}`，`main.ts` 的 `onPhaseChange`（只在 `kind !== 'rest'` 才呼叫 `restOverlay.hide()`）因此永不觸發。完整診斷見 [KI-010](KI-010-rest-overlay-stuck-on-failed-auto-advance.md)。 |
| **與既有測試覆蓋的落差** | [acceptance-stage-g.md §1.1](../../docs/operational/acceptance-stage-g.md#11-g-2-的證據組成與範圍限定誠實記錄非阻塞) 已誠實記錄：WP-42 T-exit 從未有真人在真實硬體上完整走過一次含休息倒數的 Session Plan 全場；`SessionRunnerPoll.test.ts` 原本唯一的 poll 測試只覆蓋 `loadDrillById` 恆成功的情境，這條錯誤路徑此前無任何自動化或人工驗收覆蓋。 |
| **決策** | **F-1**：`poll()` 的自動 advance 呼叫加 `.catch()`——失敗時 `onStatus` 回報錯誤訊息 + `setPhase({kind:'done'})` 安全終止 session（非 sim 相關,不違反 GD-6/D-42.5 的 orchestration-層純 DOM 邊界）。**F-2**：`runTransition()` 的 `void next.finally(...)` 鏈補 `.catch(() => {})`——這是修法過程中發現的獨立同源漏洞:`.finally()` 回傳的衍生 promise 即使 `next` 本身已被呼叫方妥善處理,仍會被 runtime 標記為獨立的 unhandled rejection。 |
| **理由** | 不採「靜默重試」:若錯誤是永久性的(如缺少場景資產),會形成使用者看不到、但持續執行的無限迴圈。不採「退回 `'family'` 重跑當前家族」:`startFamily` 失敗前可能已執行到一半的 `drillRunner.restart()` 等副作用,狀態已不可信,承認 session 無法可靠續跑並中止是唯一安全的作法。F-2 只補內部簿記鏈的 `.catch()`,不改變 `next` 本身傳給呼叫方（F-1 的 `.catch()`、或 `main.ts` 既有 `await sessionPlanRunner.advance()`）的錯誤資訊。 |
| **偏離計畫** | 無。診斷由使用者直接回報觸發(非既定 WP task),依協議走 known_issue 流程(KI-010 tech spec + 本帳本)。依 TDD 先寫 RED 測試（修法前斷言 `phase.kind !== 'rest'` 失敗,證實卡住)、F-1 落地後轉 GREEN;F-2 是驗證 F-1 時,vitest 額外回報一個獨立 `Unhandled Rejection` 才發現的追加修正,同一 commit 一併處理(同源、同檔案,不足以拆成獨立 task)。 |
| **遺留 OQ** | **OQ-KI10-1**：失敗即整場 Session Plan 中止,不嘗試略過該家族續跑其餘家族——屬產品行為決策,需另開 task。**OQ-KI10-2**：未實測真實硬體上具體是哪種錯誤觸發 `loadDrillById` 失敗;本次診斷聚焦於「無論何種原因失敗,狀態機都不該卡死且靜默」這個更上層的健壯性缺口。 |
| **影響面** | **受影響**:`src/session/SessionRunner.ts`(`poll()`/`runTransition()`)。**不受影響**:正常(成功)路徑的狀態轉移、`RestOverlay` show/hide 時機、`buildFamilyOrder` 排程邏輯(WP-41/D-42.6)、sim、輸入、命中判定、匯出資料語意。 |
| **狀態** | ✅ **已修(2026-08-25)**。驗證:`tsc --noEmit` exit 0;`vitest run` 130 files / 968 tests 全綠(含新增 1 案);修法前先以 RED 測試重現卡死,修法後轉 GREEN 且無殘留 unhandled rejection。 |

---

### BD-009 ✅ KI-009 — Session Plan 誤用 QHD 資格閘門檻，改依模式動態解析(2026-08-25)

| | |
|---|---|
| **發現處 / 根因** | 使用者以 QA 角色排查「測試實驗的效能地板解析度」時回報：Session Plan 資格閘要求原生解析度 ≥ 2560×1440(QHD),但 Session Plan 本身不操弄或比較任何解析度條件(四家族皆以 `native` 模式載入)。追碼確認 [main.ts](../../src/main.ts) 只建立一個共用 `eligibilityGateScreen`,供「實驗 session」/「解析度 protocol」/「BR protocol」/「Session Plan」四種模式共用,建立時 `required` 寫死為 `resolutionDetectionProtocol.requiredDisplay`(即 `EXPERIMENT_MAX_CONDITION`)。該 QHD 門檻的理由(GD-10 防線①)只適用於會真的切換 `fhd-1080`/`qhd-1440` render 模式、在同一面板上操弄/比較解析度條件的 resolution/BR 兩個 protocol,對 Session Plan 沒有依據。完整診斷見 [KI-009](KI-009-session-plan-qhd-gate-too-strict.md)。 |
| **決策** | 新增 `SESSION_PLAN_MIN_CONDITION = {minW:1920, minH:1080}`([constants.ts](../../src/display/constants.ts)),與 `EXPERIMENT_MAX_CONDITION` 並列、語意分離。`EligibilityGateScreenOptions.required` 型別放寬為 `EligibilityRequirement \| (() => EligibilityRequirement)`;`main.ts` 改傳入函式,依 `pendingSessionMode === 'session-plan'` 動態回傳對應門檻;`EligibilityGate.ts` 的說明文字改在 `open()` 當下才 resolve 並重繪。 |
| **理由** | 不採「Session Plan 另建一個獨立的 `createEligibilityGateScreen` 實例」——會複製 fullscreen/perf 探測與 UI 邏輯,且與 [WP-42 T0 §0-3](../exec-plan/completed/stage7/wp-42-session-orchestrator/README.md) 已拍板「沿用既有 `sessionSetupForm`→`eligibilityGate` 接線型式」的結論衝突;函式型 `required` 是改動面最小、且不影響其餘三個模式既有門檻與行為的作法。 |
| **偏離計畫** | 無。診斷由使用者直接回報觸發(非既定 WP task),依協議走 known_issue 流程(KI-009 tech spec + 本帳本)。 |
| **遺留 OQ** | 無。修法只影響 Session Plan 一個模式的門檻與說明文字時機,其餘三個模式逐位不變。 |
| **影響面** | **受影響**:`src/display/constants.ts`、`src/ui/EligibilityGate.ts`、`src/main.ts` 的 Session Plan 啟動路徑。**不受影響**:`runEligibilityGate` 判定邏輯本體、`實驗 session`／`解析度 protocol`／`BR protocol` 三個模式的門檻與行為、sim、輸入、匯出語意。 |
| **狀態** | ✅ **已修(2026-08-25)**。驗證:`tsc --noEmit` exit 0;`vitest run` 130 files / 968 tests 全綠(含新增 1 案)。 |

---

### BD-008 ✅ KI-008 — `fitts-v1` 門檻偏離 pre-registration + D=0 誤擋 + xcorr 空表未標 blocked(2026-08-17)

| | |
|---|---|
| **發現處 / 根因** | [PR #39](https://github.com/ziy900409/FPS_aim_analyst/pull/39)(WP-31 advanced-diagnostics)`chatgpt-codex-connector[bot]` 三則 inline review,追碼逐條證實非 false positive。**D1**:[fitts.py:81](../../research/src/modules/metrics/algorithms/fitts.py#L81) 的 `DEFAULT_FITTS_PARAMS` 為 `min_samples=10, min_id_range_bits=0.5`,對照凍結的 [T0-entry-gate.md D-31.5](../exec-plan/active/stage4/wp-31-advanced-diagnostics/T0-entry-gate.md#L60) 值 `min_samples=20, min_id_range_bits=1.0`,兩欄皆偏離一半。**D2**:同檔 `_result` 的 `d_ratio = math.inf if min_d <= 0 else max_d/min_d`,之後 `not math.isfinite(d_ratio)` 把「D=0 造成比值無定義(其實是展幅最大)」誤判為「展幅不足」。**D3**:[coach_report.py:619](../../research/src/report/coach_report.py#L619)(修法前)`blocked = verdict is not None and verdict.verdict == "blocked-by-data"`,對零 peek 的 export(空 `xcorr_table` → `reliability_gate` 回傳空 tuple,見 [coupling.py:392](../../research/src/modules/metrics/algorithms/coupling.py#L392))得到 `verdict is None`,被誤判為未 blocked。完整診斷見 [KI-008](KI-008-fitts-v1-threshold-drift-and-xcorr-empty-table.md)。 |
| **為何不是一行修法** | D1 的兩個常數改動會**實際翻轉 09:24 session 的判定**(`ok`→`blocked-by-data`),牽連 `research/src/modules/metrics/notebooks/t3/outputs/` 下 4 份 golden 產物、`notebooks/t-exit/outputs/` 的 09:24 coach report HTML,以及 `docs/operational/analysis-advanced-diagnostics.md` 內載明「09:24 ok」的三處判定表/段落——全部需同步重新產生與改寫,否則文件/golden 產物/程式碼三方會互相矛盾。`test_coach_report.py` 原本以 09:24 作為「三構念皆通過」的範例 fixture,也需改為 09:37。 |
| **決策** | **D1**:直接改回 T0 凍結值(`min_samples=20, min_d_ratio=2.0, min_id_range_bits=1.0`),不評估其他候選——T0 doc 明文禁止事後調整,偏離值本身就是違規,唯一正確動作是複原。**D2**:只在 `d_ratio` 有限且低於門檻時才擋(`math.isfinite(d_ratio) and d_ratio < params.min_d_ratio`);`+inf` 視為通過,把「D 完全無變異」的把關工作留給本就為此設計的獨立門檻 `id_range_bits`。**D3**:`verdict is None` 與 `verdict.verdict == "blocked-by-data"` 一律視為 blocked,共用 `gate-v1` 唯一的 `insufficient_n` 缺口文案,不新增詞彙——「零 session 可判」與「有 session 但 n 不足」在語意上是同一件事的兩種發生方式。 |
| **理由** | **D1**:C-D3 的核心是「寧可少一個指標,不能有一個會說錯話的指標」;偏離凍結門檻讓 09:24 的低 r² 回歸數字被端上報告,正是 C-D3 要防的那種錯話。**D2**:`min_d_ratio` 是最小展幅測試,除以零產生的 `+inf` 是展幅的最大可能值,用同一個有限性檢查去擋兩種相反情況是邏輯錯誤,不是門檻鬆緊的問題。**D3**:`verdict is None` 不是「沒有東西可判」的中性狀態,而是「有效樣本數為零」的極端情況,理應收斂到既有的 `insufficient_n` 分支,而非產生一個對應不到任何已知 reason 的「n=0 但未 blocked」異常狀態。 |
| **架構層結論(跨 WP,故入本帳本)** | 三個缺陷共同指向同一類回歸盲區:**pre-registered 常數與邊界值(0、空集合)不被既有測試套件的「正常路徑」覆蓋**。D1 的 `test_fitts_params_are_frozen` 存在但斷言了錯誤的值(等於把 bug 寫進了回歸測試本身,而非抓住它);D3 的邊界情況(零 peek)已被 `test_export_without_visible_events_produces_a_valid_empty_report` 實際執行過,只是沒有斷言到受影響欄位。**測試涵蓋執行路徑不等於測試涵蓋正確性**——是外部 review(而非既有套件)抓到本案,提醒日後 pre-registered 常數宜考慮加一條「與凍結文件逐字比對」的機制性檢查,不能只靠人工複製貼上。 |
| **偏離計畫** | 無。三者皆屬 PR review 觸發的既有程式碼修正(非既定 WP task),依協議走 known_issue 流程(KI-008 tech spec + 本帳本);診斷與修法同一 session 完成,拆為與 D1/D2/D3 對應的最小改動集合,搭配同一輪測試 + golden 重新產生一次驗證。 |
| **落地(2026-08-17)** | **D1**:`fitts.py` 常數改回 20/2.0/1.0;`coach_report.py` 的 `_FITTS_GAP_REASONS` 兩處人類可讀文字同步更新(`min_samples(10)`→`(20)`、`min_id_range_bits(0.5)`→`(1.0)`)。**D2**:`_result` 的 `d_ratio` 判定式改為 `math.isfinite(d_ratio) and d_ratio < params.min_d_ratio`。**D3**:`_xcorr_block` 的 `blocked`/`gapReason`/`gapText` 改用 `verdict is None or verdict.verdict == "blocked-by-data"`。**測試**:`test_fitts_params_are_frozen` 改斷言正確值;新增 `test_zero_eccentricity_sample_does_not_spuriously_block_the_ratio_gate`(D2 直接單元測試 `_result` 純函式);`test_passing_p2_diagnostics_render_in_the_research_block_with_full_annotations` 的範例 fixture 從 09:24 改為 09:37;`test_export_without_visible_events_produces_a_valid_empty_report` 擴充斷言 `xcorr["blocked"] is True`/`gapReason == "insufficient_n"`/研究區塊不含 xcorr 列(D3 回歸)。**Golden 產物重新產生**:`generate_fitts_report.py` 與 `generate_coach_reports.py` 各重跑一次,git diff 僅限 09:24 相關檔案(數值/HTML)與 synthetic_counterstrafe 報告(純文字門檻數字更新,判定不變)。**文件**:`analysis-advanced-diagnostics.md` 三處判定表(凍結 registry、當次判定、T-exit 收斂表)與 WP-32 交接段落同步改寫,標註 KI-008/BD-008 更正。 |
| **遺留 OQ** | **OQ-KI8-1**(D2 目前無真實 fixture 觸發,是否需專門採集含置中 spawn 的樣本實測)· **OQ-KI8-2**(D3 邊界情況是否需額外匯出驗證層門檻,現況判定不需要,回歸測試已足夠)——詳見 [KI-008 §4](KI-008-fitts-v1-threshold-drift-and-xcorr-empty-table.md#4-open-questions)。 |
| **影響面** | **受影響**:`fitts-v1` 對 09:24 session 的判定(`ok`→`blocked-by-data`,r²=0.0669 的回歸數字不再進報告)、`coach-report-v2` 的 09:24 研究向/缺口區塊內容、`analysis-advanced-diagnostics.md` 判定表與 WP-32 交接結論的措辭(**結論本身不變**:空清單、無指標建議晉升)。**不受影響**:09:18/09:37 的 Fitts 判定(門檻改動不影響其結果)、SPARC 與 xcorr(gate-v1)三個 session 的判定、任何 `src/` 檔案、任何原始匯出資料(`ticks`/`events`/`omegaSource`/`constructPresence`)。 |
| **狀態** | ✅ **已修(2026-08-17)**。D1+D2+D3 全數落地;`uv run pytest`/golden 產物/文件三方同步一致。 |

---

### BD-006 ✅ KI-006 — M14 效度閘樣本不含 counter-strafe 構念;**C+B 全數落地,CLOSED**(2026-08-07)

| | |
|---|---|
| **發現處 / 根因** | 為 BD-005 清點兩份真實匯出的行為內容時確認:M14 ④/⑤ 引用的 08:03 匯出 `vx ≠ 0` 的 tick = **0**、`keys` 全程為 `[]`、`counter` 事件 **0**;同日 09:39 則有 1,415 個橫移 tick 與 24 個 `counter` 事件。`counter` 的產生條件為「反向鍵按下且 `vx` 反向」([SimLoop.ts:76](../../src/loop/SimLoop.ts#L76)),`vx ≡ 0` 使其恆不成立 —— **記錄邏輯正確,是樣本裡沒有該行為**。完整診斷見 [KI-006](KI-006-m14-sample-no-counterstrafe.md)。 |
| **與 BD-004 的界線(避免重複記帳)** | 「08:03 無鍵盤輸入 / 零位移」這個**原始事實**首見於 [KI-004 §2 對照表](KI-004-sim-world-unit-domain-mismatch.md),當時作為排查 `suspect` 反直覺行為的線索,**未**就 M14 ④/⑤ 的構念效度作出結論。BD-006 只處理那個未被追下去的結論,不重複單位域診斷。 |
| **決策(部分確定 2026-08-06)** | 原三選項中,**A(改用 09:39)已自動出局** —— 這是 BD-005 拍板「不做過渡期選項 C」的**邏輯後果而非獨立決策**:選項 A 的修法改變的是「記錄什麼」,09:39 檔內的 `aim` 已把 beat 假象寫死且不會回溯清洗,故無法產出有效 ω(t) 證據。**剩 B**(修法後重新採樣,明確要求受試者執行完整 counter-strafe)**為唯一路徑**,採集時機與規模待定(= OQ-KI5-6 / OQ-KI6-1,同一件事)。**C**(於 `research/src/modules/ingest/` 新增 **construct presence gate**:由 drill 宣告核心構念,ingest 時斷言其存在,否則產 `construct_absent:*` flag)**建議無論如何都做**,仍待拍板。<br>註:09:39 的**構念完整性**不受影響(1,415 橫移 tick / 24 `counter` 事件),仍可用於**不依賴 ω** 的分析(counter 時序、`t_stop`、`residualSpeed`、首發時機);出局的只是「作為分段效度樣本」這個用途。 |
| **理由(C 的部分)** | 既有閘門(schema / dt / 純度)全部只驗**形式**,沒有任何一關會問「這份 counter-strafe 匯出裡有 counter 嗎」。更糟的是 `meta.suspect` 當時因 BD-004 的 corridor 單位域錯誤而**是反的** —— 有做急停的被標 suspect、完全不動的反而乾淨,挑樣本時的「乾淨」訊號**系統性地偏好了構念缺席的那一份**。此閘若早存在,08:03 第一天即被擋下。 |
| **架構層結論(與 BD-004 同源)** | BD-004 的結論是「parity 是一致性閘,無法發現兩側一起錯」;本案再加一條同構的:**一致性閘與目視檢核無法發現「量錯了對象」**。疊圖不顯示 `vx`/`keys`,檢核者無從察覺受試者沒在動,而站樁 flick 本來就會產生漂亮的單峰波形。兩者共同指向:量測層需要的是**內容層面的正確性閘**,不只是形式閘。 |
| **偏離計畫** | 無。診斷/決策階段零程式碼改動;C 落地階段(見下)為新增,非修改既有程式碼,`git diff --stat` 不觸 `src/`(NFR-C-1)。 |
| **C 落地(2026-08-07)** | **交付**:`research/src/modules/ingest/algorithms/construct.py`(registry `construct-v1` + 家族解析 + 檢查純函式 + session 級 flag 詞彙)+ `run_pipeline` 佈線(`constructPresence` summary 區塊 + 專屬 exit code **2**,與 schema/IO 失敗的 exit 1 可區分)。**四份 committed fixture 判定與實測值**(pre-registration 證據,詳見 [KI-006-C/README.md §2.3](KI-006-C/README.md)):08:03(`counterstrafe_ad_v1`)——3,507 ticks、`vx≠0`=0、佔比 **0.0000**、`counter`=**0** → **absent**;09:39(`counterstrafe_ad_v1`)——2,723 ticks、`vx≠0`=1,415、佔比 0.5196、`counter`=24 → present;`synthetic_counterstrafe_v2`——48 ticks、佔比 0.2917、`counter`=2 → present(家族經 `synthetic_` 前綴剝離解析,§2.4①);`synthetic_timeline_v1`——96 ticks、佔比 0.4062、`counter`=3,但家族 `timeline` 未註冊 → **unknown**(誠實揭露,不擴大猜測範圍,§2.4②)。**凍結門檻(D-C5)**:`min_counter_events=1`(二元、無門檻,單獨即可擋下 08:03)、`min_moving_tick_ratio=0.05`(輔助判準,距最小通過樣本 0.2917 有 5.8× 邊際、距缺席樣本 0.0000 為無窮大,落在數量級空隙而非事後擬合到決策邊界)。**D-C1 取捨**:構念宣告落 **Python registry**、不做引擎 `DrillConfig`/`meta.construct` 自我描述欄 —— 換取零引擎改動 + 可回溯套用到既有的 08:03(自我描述欄對「補欄之後」的匯出才有效,而最需要被擋下的正是既有匯出);**殘餘風險**:新增 drill 不被強制宣告,以 `construct_unknown` 兜底(TD-3,見 KI-006-C R-5)。**回歸**:`uv run pytest` 195→**221 passed**、`npx tsc --noEmit` exit 0、`npm run test:ci` 案數與期望值逐條不變、`git diff --stat` 僅 `research/` 四檔,無 `src/` 路徑。**⚠️ 明確聲明:C 落地不解除任何 M14 撤回** —— 它交付的是「下次不會再量錯對象」,不是「這次量對了」;M14 ④⑤ 的重新宣告仍需 [A2-T2/T3/T4](KI-005-A/A2-blocked-plan.md) 的新採樣 + `seg-v2`,且 ④ 的 KI-006 理由**只能由新樣本本身**解除。B(重新採樣)的 KI-006 條件已交付為驗收清單([KI-006-C/README.md §6](KI-006-C/README.md) B-1~B-5),委派 A2-T1 執行。 |
| **B 落地(2026-08-07)** | [KI-005-A / A2-T1](KI-005-A/A2-blocked-plan.md) 於同一台 240 Hz 機器實際採集 3 個 `counterstrafe_ad_v1` session(09:18/09:24/09:37)。[KI-006-C/README.md §6](KI-006-C/README.md) B-1~B-5 驗收清單逐項核對:B-2(`present==true`)/B-3(採完立即跑閘)/B-4(n=3>2)/B-5(240 Hz + `meta.mouseIntegration`)皆有既有書面證據且獨立重跑確認;**B-1**(採集前明確要求受試者執行完整 counter-strafe)在既有記錄中缺書面佐證,[A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 覆核時提報使用者,使用者(即採集者本人)確認採集前確實口頭要求過,記入 [KI-005-A/progress.md A2-S5](KI-005-A/progress.md)。**五項全數滿足 ⇒ KI-006 CLOSED**;M14 ④⑤ 隨 A2-T4 重新宣告。 |
| **遺留 OQ** | ~~**OQ-KI6-1**~~ ✅ **關閉(2026-08-07)**:B 已完成,見上「B 落地」段 · ~~OQ-KI6-2~~ ✅ 關閉(2026-08-06):construct presence gate 納入本輪 · ~~OQ-KI6-3~~ ✅ 關閉(2026-08-07):門檻以 `construct-v1` 凍結,證據見上 · ~~**OQ-KI6-4**~~ ✅ **關閉(2026-08-07)**:**n > 2**(至少 3 個 session),嚴於原建議的 n ≥ 2([KI-006-C/README.md §6](KI-006-C/README.md) B-4)。 |
| **影響面** | **受影響**:**M14 ④⑤ 已隨 [A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告**(理由與 BD-005 相互獨立,兩者於同日各自解除)、[analysis-segments.md](../operational/analysis-segments.md) 的 “Real-export validation” 段(已加註)、**WP-30/31 entry blocker**(第三條獨立理由,已解除)。**不受影響**:M14 ①(ingest/dt 屬 schema 與取樣層,與行為內容無關)、②③⑥、**引擎程式碼零改動**。 |
| **狀態** | ✅ **CLOSED(2026-08-07)**。C(2026-08-07 落地)+ B(2026-08-07 落地,見上)全數完成,五項驗收條件(B-1~B-5)全數滿足;M14 ④⑤ 已隨 [A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告。**效度聲稱不擴大**:仍限單一匿名受試者、n=3 session、非母體層級證據。 |

---

### BD-005 ✅ KI-005 — ω(t) 受 render/sim beat 汙染;**A1+A2 全數落地,M14 ③④⑤ 已重新宣告**(2026-08-07)

| | |
|---|---|
| **發現處 / 根因** | 檢視 [overlay-contact-sheet.png](../../research/out/overlay-contact-sheet.png) 時注意到多數 peek 主 burst 中央有單 tick 深凹口且間距規律。追碼確認:`state.aim` 由 **render path** 寫入(`pointerLock.onMove → CameraController.applyDelta`,[main.ts:202](../../src/main.ts#L202))、由 **sim path** 以 128 Hz 讀取([RingBuffer.ts](../../src/data/RingBuffer.ts) `recordTickFromState`)。240/128 = **1.875 幀/tick**,小數部 0.125 ⇒ 每 **8 tick** 有一個只夾到 1 幀位移 —— 典型 **zero-order-hold aliasing**。角位移總量正確,錯的是「歸屬到哪個 tick」。完整診斷見 [KI-005](KI-005-omega-render-sim-aliasing.md)。 |
| **證據(根因已證實,非推定)** | ① 凹口間距在**兩份 session 各自獨立**皆為 8 的倍數;② 位移守恆 + 物理不可能(peek 14 的 `302 → 17` deg/s 需 ~37,000 deg/s²);③ **決定性證據**:以 `meta.frames.series` 重建逐幀時間、預測每 tick 夾到幾幀,與實測 ω 比對 —— `corr = 0.805`,1 幀 tick 正規化 ω **0.550**(ZOH 模型預測 0.533)、2 幀 tick **1.108**(預測 1.067)、1 幀 tick 佔比 **12.7%**(預測 12.5%)。**三項預測全部命中,誤差 < 4%,且 ω 側未做任何擬合。** |
| **推翻 BD-004 的一條豁免(關鍵)** | BD-004 / [KI-004](KI-004-sim-world-unit-domain-mismatch.md) / [T-exit-gate](../exec-plan/active/stage4/wp-28-research-foundation/T-exit-gate.md) 三處主張「M14 ①③④⑤⑥ 維持 —— 分段走 ω(t),只依賴 `aim`,與量測原點無關」。該推論就**量測原點**而言正確,但 `ticks[].aim` 另有一個獨立缺陷:它是 render 速率寫入、sim 速率讀取的訊號。**M14 ③④⑤ 因此同樣撤回**;① 與 ⑥ 不涉 ω 差分,維持。 |
| **決策(2026-08-06 使用者拍板)** | **採選項 A**;**感度由 meta 重建**(OQ-KI5-1);**A 先、B 另案**(OQ-KI5-2);**不做過渡期選項 C,直接等 A**(OQ-KI5-3)。<br>**連帶必要條件**:拍板後核對匯出 schema 發現 **`meta` 缺 hip 基準 FOV** —— `WeaponMeta.ads.fovDeg`(ADS)與 `sensitivity` 都在,但基準 FOV 從未接進 [metadata.ts](../../src/data/metadata.ts)([SettingsPanel.ts:47](../../src/ui/SettingsPanel.ts#L47) 的 `fov` getter 註解自陳「(WP-7 metadata)」卻漏接)。ADS gain = `sensitivityRatio × (adsFovDeg / hipFov)` ⇒ **選項 A 落地時必須同時補 `meta.fovDeg`(additive v2 欄)**,否則 WP-24 的 ADS drill 無法重建增益。hip 期間 gain ≡ 1 不受影響,現有兩份樣本全程未開鏡故以今日 meta 即可重建。<br>**連帶後果(重要)**:既然不落 C,**既有 08:03 / 09:39 兩份匯出在 A 落地後仍不具備可用的 ω(t)** —— 選項 A 改變的是「記錄什麼」,舊檔的 `aim` 已把假象寫死。故 M14 ③④⑤ 的重新宣告**必須等新採樣**,與 BD-006 選項 B 收斂為同一次採集。 |
| **選項明細(存查)** | **選項 A**:於 [`applyInput`](../../src/loop/SimLoop.ts#L66) 在 tick 窗內積分 mouse delta —— `consume` 已依 `event.timeStamp` 精確交付落窗事件,改為以同一套 `sensitivity × RAD_PER_COUNT × adsGain` 累加成 `dYawTick/dPitchTick` 寫入 TickRecord。**選項 B(與 A 互補)**:以 preallocated arena opt-in 記錄 ~1000 Hz 原始 mouse sample(`getCoalescedEvents` 已收下、目前丟棄),約 0.7 MB/30s。**選項 C**:純分析側緩解(依 session 算 beat 週期 → 前置 notch + `render_sim_beat` flag),可回溯套用。**選項 D 不採**:對齊速率需動 `SIM_HZ = 128`(綁 CS2 64 Hz recoil 子節奏與決定性 golden),且 240/144/165 Hz 為主流硬體。 |
| **理由** | **A** 讓每個輸入事件依自身時間戳落進唯一正確的 tick ⇒ 結構上不可能有 aliasing,且**與 displayHz 完全無關**;不碰 render path,`state.aim`/camera/手感/ADR-2 雙迴圈邊界全部不變;比照 `recordKeyEvents` 做 opt-in ⇒ 關閉時逐位不變,golden 與決定性回歸保住。**B** 補的是解析度而非正確性:128 Hz 下一次 200 ms flick 僅 25 點,3–4 點寬的修正動作無法分辨,WP-31 的 submovement/SPARC/Fitts 需要 ~1000 Hz。**A 修正錯誤,B 提高解析度,兩者非互斥。** |
| **架構層結論(跨 WP,故入本帳本)** | **合成 fixture 結構上不可能重現此缺陷** —— `make_synthetic_export` 直接產生 ω/`aim` 序列,完全不經 render path。T3 的 243 組合掃參與 `seg-v1` 凍結值(含 **SG window = 7**)因此全部是在一條不含此假象的理想訊號上調出來的;而 beat 週期為 **8 tick**,**濾波窗短於假象週期,數學上不可能濾除**。這是「合成 fixture 解鎖開發」這條 WP-28 核心策略的一個結構性盲區:凡缺陷源自 render/sim 交界,合成路徑永遠看不到。 |
| **硬體 confound(研究效度)** | `beat_period = 1 / |displayHz/simHz − round(displayHz/simHz)|`:240 Hz → 8 tick、144 Hz → 8、**165 Hz → ~3.5**(落進 flick 主峰帶寬,更糟)、60 Hz → 過半 tick 讀到 ω = 0。**受試者的螢幕刷新率會系統性改變量到的 ω 波形**,修復前跨受試者比較不成立。 |
| **偏離計畫** | 無。本階段為診斷 + 決策入帳,零程式碼改動。診斷所需的測試 A 僅讀取既有匯出,未新增採集。 |
| **遺留 OQ** | ✅ **OQ-KI5-1/2/3 已關閉**(見「決策」列);✅ **OQ-KI5-4 隨之關閉** —— 無 C 清洗路徑,`seg-v2` 重掃必須用修法後的新匯出。🟡 **OQ-KI5-5** 是否把 `beat_period_ticks` 納入 `meta.display.gate`(A 落地後價值降為稽核舊匯出/偵測回歸)· ✅ **OQ-KI5-6 已關閉(2026-08-07)**:新採樣與 KI-006 選項 B **合併為同一次採集**,規模 n > 2 session(見下「A2-T1 前置決策」段)。 |
| **影響面** | **受影響**:所有匯出的 `ticks[].aim` 逐 tick 差分量(ω(t)、角加速度、jerk),汙染幅度隨螢幕刷新率變動;**M14 ③④⑤ 撤回**(③ 結論成立但證據力失效 —— 合成訊號不含此假象;④ 的 0.95 計入被假象切碎後又合併的段,有效產率實為 **4/19**;⑤ 的 SG window 7 < beat 8,凍結值於真實資料不適用);**WP-30/31 entry blocker 維持**(本 KI 為獨立於 KI-004 的第二條理由);`seg-v1` 落地後須升版 `seg-v2` 重掃(依 D-28.7 不得原地調參)。**不受影響**:引擎命中/彈道/`fire.offsetDeg`/sim 決定性(皆不做逐 tick aim 差分)、遊戲手感與 camera 表現(render path 本身無 bug)、WP-29(只吃 `events` 與 `ticks[].keys`)、M14 ①⑥。 |
| **A1 落地(2026-08-06)** | **實作形狀**:`applyInput` 於 tick 窗內依事件 `timeStamp` 積分 mouse delta(`dYaw`/`dPitch`,rad),寫入 `TickRecord`;`meta.fovDeg`/`meta.mouseIntegration` additive 欄;app 佈線層**全域啟用**(OQ-A-1);Python `omega_deg_s` 新增 `tick-integral`/`aim-diff-legacy` 雙 source + `strict` 模式。**實測前後數字**(240 Hz pump,合成資料):修法前(舊法 aim-diff)lowRatio≈0.1154/lowMean≈0.553/highMean≈1.058(對照本文預測 0.125/0.533/1.067,精確重現簽名);165/144/60 Hz 舊法 CV 分別≈0.351/0.280/1.040(顯著非零,證明非 240 Hz 特例)。修法後四種節奏 `dYaw` CV 皆≈1.1e-15(達 NFR-A-6 的 ≤1e-9 門檻)。守恆閘(hip-only)`\|Σ dYaw − Δaim.yaw\| ≤ 1e-12`。**兩個計畫階段新發現的缺口**(見 [KI-005 §6.1](KI-005-omega-render-sim-aliasing.md) 引用段 / [KI-005-A §2.4](KI-005-A/README.md)):① `InputSampler.onPointerMove` 原無 pointer-lock 閘 → T3 補齊,措辭與 fire/ads 同源,`bufferOverflow` 口徑因此只減不增;② `main.ts` 從未啟用 `recordKeyEvents` 的前車之鑑 → T4 在 app 佈線層全域啟用 mouse 積分(不等同啟用 `recordKeyEvents` 本身,那維持關閉,見下)。**偏離協議**:T4(`applyInput`/recorder/`main.ts` 佈線)與 T5(Python 雙路徑 + 合成 fixture 補欄)因合成 fixture 補欄會連動 Python 既有測試期望值,依實作順序擇一合併或分離,已記入 [KI-005-A/progress.md](KI-005-A/progress.md);本次選擇**保持 T4/T5 各自獨立綠燈 commit**(合成 fixture 補欄留在 T5)。OQ-A-1(app 全域開啟)/ OQ-A-2(`recordKeyEvents` 本次不動,登錄 TD-5,須在 A2-T1 採樣前由研究者決定)已拍板,見 [KI-005-A/progress.md §6](KI-005-A/progress.md)。**明確未交付項**:M14 ③④⑤ **未重新宣告**(需 A2 的新採樣,現有 08:03/09:39 兩份匯出因不做選項 C 回溯清洗,在 A1 修法後仍不具備可用的 ω(t));WP-30/31 entry blocker **未解除**——三條理由中僅 KI-004 那條已由 KI-004/S1 解除,KI-005 本身(A1 落地但 A2 未完成)與 KI-006(處置待拍板)兩條仍在。回歸:`npx tsc --noEmit` exit 0、`npm run test` vitest 89 files/739 tests 全綠、`npx playwright test` 20/20 全綠、`uv run pytest` 195 passed;`src/sim/`/`SharedState`/`simStep` 零 diff。 |
| **A2-T1 前置決策(2026-08-07,使用者拍板)** | 三項決策收斂,解除 A2-T1 開工前的決策性阻塞:**① OQ-A-5/OQ-KI5-6**——新採樣與 [KI-006](KI-006-m14-sample-no-counterstrafe.md) 選項 B **合併為同一次採集**,不分兩次採。**② OQ-A-2 重新開放後決議**——A2-T1 採樣**開啟** `recordKeyEvents`(TD-5);理由是 `counter` 事件雖已用原始 timeStamp,但**另一把**移動鍵的放開時刻仍只能從 `ticks[].keys` 反推(±1 tick / 7.8ms 量化),KI-006 的構念分析若要精量「鬆鍵到按反向鍵」間隔,需要 sub-tick 釋放時刻。**③ OQ-KI6-4**(KI-006 側)——**n > 2** session(至少 3 個),嚴於原建議的 n ≥ 2。**② 已落地(2026-08-07)**:[main.ts:355](../../src/main.ts#L355) 的 `createDataRecorder(...)` 加上 `recordKeyEvents: true`;`tests/e2e/input-sampler.spec.ts` 新增案直讀 `__aimDebug.recorder.recordKeyEvents === true`(比照 FR-A-7 的 `mouseIntegration` 驗證模式)。回歸:`tsc --noEmit` exit 0、`npm run test:ci` Vitest 89 files/739 tests 不變 + Playwright 21/21(新增 1 案)、`uv run pytest` 221 passed 不變;純 additive,無 e2e 案斷言 `events` 陣列整體長度或形狀,零既有測試改寫。 |
| **A2-T1 落地(2026-08-07)** | 研究者於同一台 240 Hz 機器實際採集三個 `counterstrafe_ad_v1` session(09:18/09:24/09:37)。DoD 逐項核對(獨立重跑 `run_pipeline` 覆核,不僅信任提交的產物)全數通過:`omega_deg_s(strict=True)` 三份皆解出 `source=="tick-integral"`;`counter` 事件 23/25/20、橫移佔比 0.656/0.654/0.644;`events` 含 `key` 事件 86/84/78 筆(`recordKeyEvents` 接線在真實硬體上確認生效);`constructPresence.present==true` 三份皆是;n=3>2 滿足 OQ-KI6-4。**副產物**:發現並修復 [KI-007](KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md)(`experimentSession.exit()` 未接單一 session 流程,導致 `meta.suspect` 對正常收尾誤判)。 |
| **A2-T2 落地(2026-08-07)** | 四項複驗**整體通過**,支持 A1 修法在真實硬體資料上有效。**④(FM-1 的唯一驗證點)**:`Σ dYaw` vs `Δaim.yaw`(hip-only)殘差 ≤ 5.6e-16,`Σ dPitch` vs `Δaim.pitch` 殘差 ≤ 7.1e-16——機器精度內完全相等,**FM-1 視為關閉**,不觸發選項 B 提前。**②**:`merged_adjacent_peaks` 比例 09:18/09:24/09:37 為 57.1%/57.9%/65.0%,顯著低於基準(文件原載 15/19≈79%;今日重跑 09:39 為 20/21≈95.2%)。**①**:凹口偵測器(逐字沿用 T0 §2a 公式)於新匯出降至 3/2/2 個(基準 34 個,降幅 >90%),非 literal 0;**波形視覺化覆核**顯示殘餘凹口分佈於貫穿整段 burst 的細碎鋸齒紋理中(非孤立、非週期性,間距非 8 的倍數,與 `vx` 反轉不重合),與基準的孤立週期性深凹訊號特徵不同,判讀為 tick-integral(更高解析度的原始逐 tick 訊號)固有雜訊底噪,非根因復發——使用者看圖後確認接受此判讀。**③**:未 flag 樣本數 09:18/09:24/09:37 為 9/8/7,方向與預期相符,但追碼確認 09:39 基準(今日重跑)`quality` 為空字典,因其 `meta.scene` 缺 `eye` 欄位(預期 KI-004/S1 落地前的舊匯出)觸發 `resolve_eye_origin(strict=True)` 正確拒答,**與 KI-004/S1 的獨立修法效果混淆**,不單獨歸功於 A1。完整數字與判讀見 [KI-005-A/progress.md §2e](KI-005-A/progress.md)。 |
| **A2-T3 落地(2026-08-07)** | `seg-v2` 重掃並凍結。沿用 `run_sweep.py` 既有 6 個合成邊界案例評分邏輯,放寬 SG window 搜尋至 `{5,7,9,11,13}`(seg-v1 原受 beat=8 隱性限制,現已隨 A1 解除),**新增**以 A2-T1 三份真實 tick-integral 匯出的 `merged_adjacent_peaks` 比例作為第二評分維度——seg-v1 原始掃參從未能用真實資料驗證,因為真實匯出當年必然帶 aliasing。135 組候選通過全部合成案例,最佳集中在 `sg_window=11, peak_sigma_k=0.75`。使用者要求先看 seg-v1 vs 候選疊圖比較,確認**segment 起訖邊界逐位不變**(只有 `merged_adjacent_peaks` 內部分類改善,非模糊真實反向轉折時機)後,拍板凍結 `SEG_V2_PARAMS`(`sg_window=11, sg_poly=3, peak_sigma_k=0.75, peak_floor_deg_s=60.0, low_ratio=0.1, stop_ratio=0.2`)——選 success rate 與 seg-v1 持平(98.3%)的候選,而非 merged 比例更低但 success rate 較差的另一候選。三份真實匯出的 `merged_adjacent_peaks` 從 seg-v1 的 60.0%(36/60)降至 seg-v2 的 38.3%(23/60)。`seg-v1`(`DEFAULT_SEGMENT_PARAMS`)原地凍結不變(D-28.7);`run_pipeline.py::run()` 依 `omega_deg_s(...).source` 自動選版(`tick-integral`→`seg-v2`、`aim-diff-legacy`→`seg-v1`)。**TD-3 拍板不改**:`omega[0]=nan` 契約兩個 source 繼續共用,理由是下游多處已假設此契約、改動代價（source 依賴分支）大於效益（每視窗 1 tick ≈7.8ms）。回歸:`tsc --noEmit` exit 0、`npm run test:ci` 不變、`uv run pytest` 221→228 passed(既有僅 `test_synthetic_export_produces_all_three_artifacts` 一案期望值刻意改寫,因預設合成匯出帶 dYaw/dPitch 而正確改選 seg-v2)。完整數字見 [KI-005-A/progress.md §2f](KI-005-A/progress.md)。 |
| **A2-T4 落地(2026-08-07)** | M14 ③④⑤ 逐項重新宣告 + KI-006 解除判定。**③**:A2-T2 完成,A2-T3 以同一組合成邊界案例重驗證(135 組候選全過,max boundary error ≤ 2 tick),證據力較 A2-T2 當下更紮實。**④**:兩個獨立理由同時解除——KI-005 側(A2-T2 守恆閘機器精度通過 FM-1 關閉 + A2-T3 `seg-v2` 凍結)與 KI-006 側(§6 B-1~B-5 驗收清單全數滿足,見 [BD-006「B 落地」段](#bd-006-✅-ki-006--m14-效度閘樣本不含-counter-strafe-構念c+b-全數落地closed2026-08-07),KI-006 轉 CLOSED)。**⑤**:A2-T3 `seg-v2` 已重掃凍結。**WP-30/31 entry blocker 三條理由(KI-004/KI-005/KI-006)全數解除,正式解除**——WP-30/WP-31 可展開。效度聲稱不擴大:仍限單一匿名受試者、n=3 session、非母體層級證據;引用四項複驗時如實帶出①非 literal 0、③與 KI-004/S1 混淆兩項限制。純文件任務,零程式碼改動;`tsc --noEmit`/`test:ci`/`uv run pytest` 三連對照 A2-T3 基線不變。詳見 [KI-005-A/progress.md §2g](KI-005-A/progress.md)。 |
| **狀態** | ✅ **A1+A2(T1–T4)全數完成(2026-08-07)**。根因經測試 A 證實,修法依 2026-08-06 拍板(A / meta 重建 / 不做 C)落地;真實硬體資料複驗支持修法有效,FM-1 關閉;`seg-v2` 已重掃凍結並在真實資料上驗證優於 `seg-v1`;**M14 ③④⑤ 已於 A2-T4(2026-08-07)逐項重新宣告,WP-30/31 entry blocker 已解除**。 |

---

### BD-007 ✅ KI-007 — `experimentSession.exit()` 未接單一 session 流程;`suspect` 對正常收尾誤判(2026-08-07)

| | |
|---|---|
| **發現處 / 根因** | [KI-005-A / A2-T1](KI-005-A/A2-blocked-plan.md) 新採樣驗證時,09:18/09:24 兩份匯出 `meta.suspect === true`,但研究者確認錄製期間**未**中途退出全螢幕,只在整個測試結束後才退。追碼確認:`experimentSession.exit()` 只在多條件 protocol 流程呼叫([main.ts:939](../../src/main.ts#L939)/[970](../../src/main.ts#L970)),單一「實驗 session」drill 流程完全不呼叫。`active` 因此對整頁生命週期恆 `true`,drill 結束後研究者為了下載匯出檔而退出全螢幕的正常動作,和「錄製中途意外掉出全螢幕」在程式碼眼中無法區分,兩者都會把 `suspect` 釘死為 `true`(無重置路徑)。完整診斷見 [KI-007](KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md)。 |
| **為何不是一行修法** | 「實驗 session」流程刻意支援同一次資格閘通過後連續跑多個 drill(`restartActiveDrill()`/`onLoadDrill` 不需重新過閘)。若天真地在 drill `ended` 時對所有模式呼叫 `exit()`,會讓連續多 drill 用例的偵測窗口在第一個 drill 後就永久關閉,後續 drill 若真的中途掉出全螢幕反而測不到——方向錯了。真正該問的是「這次退出發生在 drill 正在錄製,還是已經結束、正在等下一步」。 |
| **候選修法** | **F-1(建議)**:`handleFullscreenChange` 的判定改為 `active && drillRunner.phase` 屬於 `'countdown'`/`'running'`(排除 `'idle'`/`'ended'`),精準對應 GD-10 原意,不影響連續多 drill 支援。F-2:在 `phase === 'ended'` 時對非 protocol 模式呼叫 `exit()`(需額外追蹤啟動模式,且會誤關連續多 drill 的偵測窗口)。F-3:不修,靠操作紀律規避(治標不治本)。詳見 [KI-007 §4](KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md)。 |
| **對既有資料的影響** | **不需要重採**——`ticks`/`events`/`omegaSource`/`constructPresence` 皆不讀 `suspect`,[A2-T1](KI-005-A/A2-blocked-plan.md) 的 DoD 判定不受影響。09:18/09:24 的 `suspect === true` 記錄為**已確認的誤判**,不影響其作為 M14 效度證據的可信度。A2-T2 四項複驗只讀 `ticks`,可正常進行。 |
| **F-1 落地(2026-08-07)** | `experimentSession.handleFullscreenChange` 新增 `recording: boolean` 參數,guard 改為 `if (!active || !recording || present || suspect) return;`;唯一呼叫點 [main.ts](../../src/main.ts) 的 `fullscreenchange` listener 傳入 `recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running'`(**OQ-KI7-1 拍板:涵蓋 countdown**)。`markProtocolFullscreenExit`(protocol condition 層級的獨立機制)不受影響,原樣保留。新增 3 案([experimentSession.test.ts](../../src/display/experimentSession.test.ts)):非錄製期間退出不標記(核心回歸)、非錄製期間退出後錄製恢復仍能偵測真實失效(證明不是整個關掉偵測)、既有五案改傳 `recording=true` 延續覆蓋。**回歸**:`npx tsc --noEmit` exit 0;`npm run test:ci` Vitest **89 files/741 tests**(739+2)全綠、Playwright 21/21 不變;`git diff --stat` 僅 `src/display/experimentSession.ts`/`.test.ts` + `src/main.ts` 三檔。 |
| **偏離計畫** | 無。診斷由 A2-T1 驗證過程中的異常觀察觸發,修法當日拍板當日落地(小型獨立修復,無 TDD 偏離)。 |
| **遺留 OQ** | ~~OQ-KI7-1~~ ✅ 已關閉(涵蓋 countdown)· **OQ-KI7-2** 舊有 08:03/09:39 fixture 是否需回溯核對(建議不需要,無相關欄位可比對) |
| **影響面** | **受影響**:`meta.suspect` 對單一「實驗 session」流程的可信度(僅此欄位,不影響任何 sim/命中/匯出核心資料)——修復後應能正確區分「錄製中掉出全螢幕」與「錄完正常退出去抓檔案」。**不受影響**:construct presence gate、`omega_deg_s`、`ticks`/`events` 記錄邏輯、KI-005/KI-006 的既有結論與資料。 |
| **狀態** | ✅ **已修(2026-08-07)**。09:18/09:24 兩份既有匯出的 `suspect === true` 是修法**前**採集,不回溯清洗(比照 KI-005 OQ-KI5-3 拍板精神),已於 [KI-005-A/progress.md](KI-005-A/progress.md) 記錄為已確認誤判。 |

---

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
