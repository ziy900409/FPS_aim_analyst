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
| [KI-006](KI-006-m14-sample-no-counterstrafe.md) | M14 ④/⑤ 的真實資料效度閘所用樣本(08:03)**不含 counter-strafe 構念**:`vx ≡ 0`、`keys` 全空、`counter` 事件 0 → 量到的是站樁純 flick。**M14 ④⑤ 撤回**(理由獨立於 KI-005) | BD-006(§2,處置待拍板) | 🔴 已確認,處置待拍板 |
| [KI-005](KI-005-omega-render-sim-aliasing.md) | ω(t) 受 render(240Hz)/sim(128Hz)**zero-order-hold aliasing** 汙染:每 8 tick 一個假凹口 → `merged_adjacent_peaks` 15/19,有效產率僅 4/19。**推翻 KI-004「①③④⑤⑥ 不受影響」的豁免,M14 ③④⑤ 撤回** | BD-005(§2,**修法已拍板**:選項 A + 感度由 meta 重建 + 不做過渡期 C) | 🟡 已定解法待落地 |
| [KI-004](KI-004-sim-world-unit-domain-mismatch.md) | sim(source unit)與 world domain 混用:corridor gate 緊 100× → 真實急停 run 全被標 `suspect`;離線 ε(t) 量測原點錯誤(D2a base offset + D2b scale)→ **實測偏差 12.5°/67°,M14 ② 撤回,S1 落地後重新宣告** | BD-004(§2,K-1/K-2/K-3 已拍板;S1 已落地) | 🟡 S1 ✅ 已落地(2026-08-06)/ S2·S3 待辦 |
| [KI-003](KI-003-top-left-controls-overlap.md) | 左上角 session/protocol 啟動按鈕覆蓋 SettingsPanel 的 Sensitivity/FOV/Resolution | BD-003(§3) | ✅ 已修(2026-08-05) |
| [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) | br-field camera 未錨定 sim origin(D1)+ protocol 場景載入驗證舊 drill(D2)(PR #34 review) | BD-002(§3) | ✅ D1+D2 已修(2026-07-15) |
| [KI-001](KI-001-input-lag-sim-clock-drift.md) | 開火/鍵盤嚴重輸入延遲(sim 邏輯時鐘漂移) | BD-001(§3) | ✅ Task 1+2 已修(2026-07-09) |

---

## 2. 未解 / 進行中(OPEN)

> 狀態:🔴 診斷中 · 🟡 已定解法待落地 · ✅ 已修(移至 §3 並標日期/commit)。

### BD-006 🔴 KI-006 — M14 效度閘樣本不含 counter-strafe 構念;**已確認,處置待拍板**(2026-08-06)

| | |
|---|---|
| **發現處 / 根因** | 為 BD-005 清點兩份真實匯出的行為內容時確認:M14 ④/⑤ 引用的 08:03 匯出 `vx ≠ 0` 的 tick = **0**、`keys` 全程為 `[]`、`counter` 事件 **0**;同日 09:39 則有 1,415 個橫移 tick 與 24 個 `counter` 事件。`counter` 的產生條件為「反向鍵按下且 `vx` 反向」([SimLoop.ts:76](../../src/loop/SimLoop.ts#L76)),`vx ≡ 0` 使其恆不成立 —— **記錄邏輯正確,是樣本裡沒有該行為**。完整診斷見 [KI-006](KI-006-m14-sample-no-counterstrafe.md)。 |
| **與 BD-004 的界線(避免重複記帳)** | 「08:03 無鍵盤輸入 / 零位移」這個**原始事實**首見於 [KI-004 §2 對照表](KI-004-sim-world-unit-domain-mismatch.md),當時作為排查 `suspect` 反直覺行為的線索,**未**就 M14 ④/⑤ 的構念效度作出結論。BD-006 只處理那個未被追下去的結論,不重複單位域診斷。 |
| **決策(部分確定 2026-08-06)** | 原三選項中,**A(改用 09:39)已自動出局** —— 這是 BD-005 拍板「不做過渡期選項 C」的**邏輯後果而非獨立決策**:選項 A 的修法改變的是「記錄什麼」,09:39 檔內的 `aim` 已把 beat 假象寫死且不會回溯清洗,故無法產出有效 ω(t) 證據。**剩 B**(修法後重新採樣,明確要求受試者執行完整 counter-strafe)**為唯一路徑**,採集時機與規模待定(= OQ-KI5-6 / OQ-KI6-1,同一件事)。**C**(於 `research/src/modules/ingest/` 新增 **construct presence gate**:由 drill 宣告核心構念,ingest 時斷言其存在,否則產 `construct_absent:*` flag)**建議無論如何都做**,仍待拍板。<br>註:09:39 的**構念完整性**不受影響(1,415 橫移 tick / 24 `counter` 事件),仍可用於**不依賴 ω** 的分析(counter 時序、`t_stop`、`residualSpeed`、首發時機);出局的只是「作為分段效度樣本」這個用途。 |
| **理由(C 的部分)** | 既有閘門(schema / dt / 純度)全部只驗**形式**,沒有任何一關會問「這份 counter-strafe 匯出裡有 counter 嗎」。更糟的是 `meta.suspect` 當時因 BD-004 的 corridor 單位域錯誤而**是反的** —— 有做急停的被標 suspect、完全不動的反而乾淨,挑樣本時的「乾淨」訊號**系統性地偏好了構念缺席的那一份**。此閘若早存在,08:03 第一天即被擋下。 |
| **架構層結論(與 BD-004 同源)** | BD-004 的結論是「parity 是一致性閘,無法發現兩側一起錯」;本案再加一條同構的:**一致性閘與目視檢核無法發現「量錯了對象」**。疊圖不顯示 `vx`/`keys`,檢核者無從察覺受試者沒在動,而站樁 flick 本來就會產生漂亮的單峰波形。兩者共同指向:量測層需要的是**內容層面的正確性閘**,不只是形式閘。 |
| **偏離計畫** | 無。本階段為診斷 + 決策入帳,零程式碼改動。 |
| **遺留 OQ** | **OQ-KI6-1**(收斂)A 已出局,剩 B;採集時機與規模待定(= OQ-KI5-6)· **OQ-KI6-2** construct presence gate 是否納入本輪 · **OQ-KI6-3** 構念存在性門檻如何 pre-register 以免事後調參 · **OQ-KI6-4** M14 真實資料項是否應要求 n ≥ 2 個 session(建議趁重新採樣一併滿足)。 |
| **影響面** | **受影響**:**M14 ④⑤ 撤回**(理由與 BD-005 相互獨立 —— 即使 aliasing 完全修好,以 08:03 重跑仍不構成 counter-strafe drill 的效度證據)、[analysis-segments.md](../operational/analysis-segments.md) 的 “Real-export validation” 段、**WP-30/31 entry blocker**(第三條獨立理由)。**不受影響**:M14 ①(ingest/dt 屬 schema 與取樣層,與行為內容無關)、②③⑥、**引擎程式碼零改動**。 |
| **狀態** | 🔴 已確認,處置待拍板。 |

---

### BD-005 🟡 KI-005 — ω(t) 受 render/sim beat 汙染;**根因已證實 + 修法已拍板,待落地**(2026-08-06)

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
| **遺留 OQ** | ✅ **OQ-KI5-1/2/3 已關閉**(見「決策」列);✅ **OQ-KI5-4 隨之關閉** —— 無 C 清洗路徑,`seg-v2` 重掃必須用修法後的新匯出。🟡 **OQ-KI5-5** 是否把 `beat_period_ticks` 納入 `meta.display.gate`(A 落地後價值降為稽核舊匯出/偵測回歸)· 🟡 **OQ-KI5-6**(新)新採樣的時機與規模,是否與 BD-006 選項 B 合併並順帶滿足 OQ-KI6-4(n ≥ 2 session)。 |
| **影響面** | **受影響**:所有匯出的 `ticks[].aim` 逐 tick 差分量(ω(t)、角加速度、jerk),汙染幅度隨螢幕刷新率變動;**M14 ③④⑤ 撤回**(③ 結論成立但證據力失效 —— 合成訊號不含此假象;④ 的 0.95 計入被假象切碎後又合併的段,有效產率實為 **4/19**;⑤ 的 SG window 7 < beat 8,凍結值於真實資料不適用);**WP-30/31 entry blocker 維持**(本 KI 為獨立於 KI-004 的第二條理由);`seg-v1` 落地後須升版 `seg-v2` 重掃(依 D-28.7 不得原地調參)。**不受影響**:引擎命中/彈道/`fire.offsetDeg`/sim 決定性(皆不做逐 tick aim 差分)、遊戲手感與 camera 表現(render path 本身無 bug)、WP-29(只吃 `events` 與 `ticks[].keys`)、M14 ①⑥。 |
| **狀態** | 🟡 **已定解法待落地**。根因經測試 A 證實;修法 2026-08-06 拍板(A / meta 重建 / 不做 C)。**尚未動任何程式碼。**落地範圍:`applyInput` tick 窗積分(opt-in)+ `meta.fovDeg` additive 欄 + 決定性回歸測試 + 新採樣 + `seg-v2` 重掃。 |

---

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
