# KI-005 — ω(t) 受 render/sim 速率 beat 汙染(zero-order-hold aliasing)

> 類型:量測管線缺陷(research 效度)。
> 狀態:✅ **選項 A 已落地(A1,2026-08-06)**;**A2(新採樣 + 複驗 + `seg-v2` 重掃 + M14 重新宣告)待排程,⛔ blocked on 新採樣**(見 [A2-blocked-plan.md](KI-005-A/A2-blocked-plan.md))。**A1 交付的是量測儀器的正確性,不是效度恢復**——M14 ③④⑤ 仍維持撤回,見 §7 與「A1 落地後的殘餘限制」。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-005。落地計畫:[KI-005-A/README.md](KI-005-A/README.md)。
>
> ⚠️ **本 KI 推翻 [KI-004](KI-004-sim-world-unit-domain-mismatch.md) / BD-004 的一條豁免**。KI-004 三處
> 主張「M14 ①③④⑤⑥ 不受影響 —— 分段走 ω(t),只依賴 `ticks[].aim`,與量測原點無關」。該推論就
> **量測原點**而言正確,但 `ticks[].aim` 本身另有一個獨立缺陷:它是以 render 速率寫入、以 sim 速率
> 讀取的訊號。**M14 ③④⑤ 因此同樣受影響**(§5)。
>
> 發現路徑:檢視 [research/out/overlay-contact-sheet.png](../../research/out/overlay-contact-sheet.png)
> 20 張 ω(t) 疊圖時,注意到多數 peek 的主 burst 中央有單 tick 深凹口,且凹口間距目視規律。

---

## 1. 症狀

`research/out/` 的 20 張 peek 疊圖中,多數主 burst 內出現**單 tick 寬、深達鄰值 20–40%** 的凹口。
最極端者 peek 14:相鄰兩 tick 為 `302 → 17` deg/s。

下游後果(取自 [pipeline-summary.json](../../research/out/pipeline-summary.json)):

| 觀測 | 數值 |
|---|---|
| 分段成功率(M14 ④ 引用值) | 19/20 = **0.95** |
| 帶 `merged_adjacent_peaks` 的 segment | **15 / 19(79%)** |
| `duration_ms` / `peak_omega_deg_s` / `mean_epsilon_deg` 的未 flag 樣本數 | **n = 4**(n_flagged = 15) |

亦即:**成功率 0.95 的表面之下,真正產出乾淨逐段指標的只有 4 / 19 = 21%。**

## 2. 根因

`state.aim` 由 **render path** 寫入、由 **sim path** 讀取,兩者速率不可通約:

| 環節 | 位置 | 速率 |
|---|---|---|
| 寫入 `state.aim` | `pointerLock.onMove → CameraController.applyDelta`([main.ts:202](../../src/main.ts#L202)、[CameraController.ts:89](../../src/view/CameraController.ts#L89)) | rAF ≈ **240 Hz**(`meta.display.refreshEstimateHz`) |
| 讀取 `state.aim` | `recordTickFromState`([RingBuffer.ts](../../src/data/RingBuffer.ts)) | `SIM_HZ` = **128 Hz** |

`state.aim` 因此是一條 **render 速率的 zero-order-hold 階梯**,被 128 Hz 取樣後逐 tick 差分。
240 / 128 = **1.875 幀/tick**,小數部 0.125 ⇒ 每 **8 個 tick** 有一個 tick 只夾到 1 幀的位移,
其餘夾到 2 幀:

```
畫面更新 (4.167ms) │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │
sim 讀取  (7.813ms) └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──
每 tick 夾到幀數:    1  2  2  2  2  2  2  2  1  2  2  2
                     ↑                       ↑ 週期 8 tick
```

**角位移總量正確,錯的是「歸屬到哪一個 tick」** —— 故 ω = Δθ/Δt 逐 tick 忽高忽低。
`aim` 的絕對值、命中判定、`fire.offsetDeg` 全部不受影響(它們不做逐 tick 差分)。

### 通用式

```
frames_per_tick = displayHz / simHz
beat_period_ticks = 1 / |frames_per_tick − round(frames_per_tick)|
```

| 螢幕 | frames/tick | beat 週期 | 備註 |
|---|---:|---:|---|
| 240 Hz | 1.875 | **8 tick** | 本案兩份匯出 |
| 144 Hz | 1.125 | 8 tick | |
| 165 Hz | 1.289 | **~3.5 tick** | 更糟:週期落進 flick 主峰帶寬 |
| 360 Hz | 2.813 | ~5.3 tick | |
| 60 Hz | 0.469 | — | render < sim,過半 tick 讀到 ω = 0 |

⇒ **受試者的螢幕刷新率會系統性改變量到的 ω 波形**。這是與硬體相關的未受控 confound,
跨受試者比較在修復前不成立。

## 3. 證據

### 3.1 間距 —— 8 的倍數(兩份 session 獨立)

以「快速運動中的單 tick 凹口」(`w[i] < 0.6·min(w[i±1])` 且 `w[i±1] > 80`)偵測:

| 匯出 | 凹口數 | 間距分布 |
|---|---:|---|
| `...08_03_45.617Z` | 27 | 8, 48, 56, 64, 72, 80, 88 —— **全為 8 的倍數** |
| `...09_39_06.031Z` | 34 | 同上,眾數 = 8 |

### 3.2 位移守恆 + 物理不可能

peek 14:`... 214, **302, 17**, 152 ...` deg/s。302 + 17 = 319 ≈ 2 × 160(鄰域均值)。
真人若真在 7.8125 ms 內由 302 減速至 17 deg/s,需 ~**37,000 deg/s²**,超出人體上肢極限數個量級。

### 3.3 測試 A —— 以記錄的幀時序反推,預測命中(**決定性證據**)

`meta.frames.series`(6,143 筆逐幀間隔)可重建每一幀的時間點。據此計算每個 sim tick 窗
`(t−7.8125, t]` 內夾到幾幀,再與實測 ω 比對。**唯一自由參數為 frame log 起始錨點**
(`frameLog.reset()` 於 drill start,與 tick 時間軸無共同錨),ω 側未做任何擬合:

| 每 tick 夾到幀數 | 正規化 ω 實測 | ZOH 模型預測 `n × 4.1667 / 7.8125` | 樣本佔比 |
|---:|---:|---:|---:|
| 1 幀 | **0.550** | 0.533 | 12.7%(預測 **12.5%**) |
| 2 幀 | **1.108** | 1.067 | 87.3% |

`corr(frames_in_tick, normalised ω) = **0.805**`(n = 307 個高速平順 tick)。
**三項獨立預測(兩個比值 + 一個佔比)全部命中,誤差 < 4%。**

### 3.4 為何濾波器擋不住

`seg-v1` 的 SG window = **7 tick**,beat 週期 = **8 tick**。**濾波窗短於假象週期,數學上不可能濾除**
—— beat 原封不動穿過平滑,分段器將每個凹口視為兩個 peak 的分界,產生 `merged_adjacent_peaks`。

## 4. 為何沒被更早抓到

1. **合成 fixture 結構上不可能重現此缺陷**。`make_synthetic_export` 直接產生 ω 波形/`aim` 序列,
   **完全不經過 render path**。T3 的 243 組合掃參、`seg-v1` 凍結值(含 SG window = 7)因此全部
   是在一條「不含此假象」的理想訊號上調出來的。
2. **真實資料檢核沒有獨立 oracle**。M14 ④ 的判準是「分段成功率 + 疊圖人工檢核」,而人工檢核
   的結論是「merges within one noisy principal burst」—— 方向判斷正確(確實不是兩個真 burst),
   但把**確定性儀器假象**歸因為 noise。
3. 這與 [KI-004 §「為何沒被抓到」](KI-004-sim-world-unit-domain-mismatch.md) 是**同一個結構性弱點**:
   量測層缺乏正確性閘,只有一致性閘與目視檢核。

## 5. 影響面

| 對象 | 影響 | 嚴重度 |
|---|---|---|
| `ticks[].aim` 逐 tick 差分(ω(t)、角加速度、jerk) | **全部匯出受影響**,汙染幅度隨螢幕刷新率變動 | **High** |
| **M14 ③** 合成 fixture 邊界誤差 ≤2 tick | 結論本身仍成立,但**證據力失效**:合成訊號不含此假象,故該閘無法保證真實資料上的行為 | **撤回理由** |
| **M14 ④** 真實資料分段成功率 0.95 + 疊圖 | 0.95 計入了被假象切碎後又合併的段;有效產率實為 4/19 | **撤回** |
| **M14 ⑤** `seg-v1` 參數凍結 | SG window 7 < beat 8,凍結值在真實資料上不適用 | **撤回** |
| KI-004 / BD-004 的「①③④⑤⑥ 維持」 | ③④⑤ 部分**不再成立**(② 已由 KI-004 撤回,① 與 ⑥ 不涉 ω,維持) | — |
| **WP-30 / WP-31** | phase/101pt、SPARC/xcorr/Fitts 全部建在 ω(t) 及其導數上 → **entry blocker 維持**(KI-004 已因 ε 恢復,本 KI 再加一條獨立理由) | **High** |
| WP-29(peek 時間軸 / Sync) | **不受影響**(只吃 `events` 與 `ticks[].keys`) | — |
| 引擎命中 / 彈道 / `fire.offsetDeg` / sim 決定性 | **不受影響**(不做逐 tick aim 差分) | — |
| 遊戲手感 / camera 表現 | **不受影響**(render path 本身沒有 bug) | — |

## 6. 修法(2026-08-06 使用者拍板)

### 6.1 拍板結果

| OQ | 決議 | 影響 |
|---|---|---|
| **OQ-KI5-1** 感度取得方式 | **由 meta 重建**(不暴露 `CameraController` 唯讀快照) | 需補一個 additive 欄,見 §6.2 |
| **OQ-KI5-2** A/B 順序 | **A 先**。B 另案,不綁本次落地 | ω 正確性優先於解析度;WP-31 開工前再議 B |
| **OQ-KI5-3** 過渡期選項 C | **不做,直接等 A** | 既有兩份匯出**不做**回溯清洗;`seg-v2` 重掃一律使用修法後的新匯出 |

**連帶結論**:既然不落選項 C,現有 08:03 / 09:39 兩份匯出在 A 落地前**不具備可用的 ω(t)**。
M14 ③④⑤ 的重新宣告因此必須等新採樣,無法用既有樣本搶跑(與 [KI-006](KI-006-m14-sample-no-counterstrafe.md)
的選項 B「重新採樣」自然合流 —— **兩個 KI 的重新宣告路徑收斂為同一次採集**)。

> **選項 A 的可執行計畫**:[KI-005-A/](KI-005-A/README.md)(tech spec + T0–T6 + T-exit;task 索引
> [task-checklist.md](KI-005-A/task-checklist.md))。切為兩個 stage —— **A1 ✅ 已落地(2026-08-06)** 為引擎/分析側修法,
> 全部由測試客觀判定;**A2**(新採樣 → 複驗 → `seg-v2` → M14 重新宣告)⛔ blocked on 新採樣,
> 見 [A2-blocked-plan.md](KI-005-A/A2-blocked-plan.md)。
>
> 計畫在查碼階段另發現兩個必須同刀處理的缺口(見其 §2.4),**兩者皆已隨 A1 處理**:
> ① [`InputSampler.onPointerMove`](../../src/input/InputSampler.ts#L132) 原**沒有** pointer-lock 閘
> (fire/ads 都有)—— 若不補,A 落地後會把未鎖定期間的滑鼠移動積分成 camera 從未套用的角位移;
> **已於 [T3](KI-005-A/T3-pointer-lock-gate.md) 補齊**(措辭與 fire/ads 閘同源),`bufferOverflow` 口徑因此**只減不增**(記入 [schema.md](../operational/schema.md))。
> ② [main.ts:342](../../src/main.ts#L342) 原**從未啟用** `recordKeyEvents` 的前車之鑑——若 A 照抄
> 「opt-in 預設關閉」而不動 `main.ts`,新採樣仍不會帶 `dYaw`,修法對研究零效果;
> **已於 [T4](KI-005-A/T4-tick-window-integration.md) 在 app 佈線層全域啟用**(OQ-A-1 拍板),`recordKeyEvents` 本身仍維持關閉(TD-5,登錄於 [KI-005-A/progress.md](KI-005-A/progress.md))。

### 6.2 落地前必須補的缺口 — `meta` 缺 hip FOV

> ✅ **已補(2026-08-06,[KI-005-A/T2](KI-005-A/T2-export-meta-additive.md))**:`meta.fovDeg` 已上線,additive v2 欄,來源
> `settingsPanel.fov`(未讀 `camera.fov`)。同批也上線 `meta.mouseIntegration`(§2.3 型別見 T2)。

拍板「由 meta 重建」後,實際核對匯出 schema 發現:

| 量 | 是否在 meta | 位置 |
|---|---|---|
| `sensitivity` | ✅ | `meta.sensitivity`(= 1) |
| ADS 感度比 | ✅ | `meta.weapon.ads.sensitivityRatio` |
| ADS FOV | ✅ | `meta.weapon.ads.fovDeg`(= 40) |
| **hip 基準 FOV** | ❌ **缺** | 無。[SettingsPanel.ts:47](../../src/ui/SettingsPanel.ts#L47) 的 `fov` getter 註解自陳「(WP-7 metadata)」,但從未接進 [metadata.ts](../../src/data/metadata.ts) |

ADS gain = `sensitivityRatio × (adsFovDeg / hipFov)` ⇒ **缺 hipFov 則 ADS 期間的 gain 無法重建**。

- **hip 期間 gain ≡ 1**,不受影響;現有兩份樣本全程未開鏡(無 `ads` 事件)⇒ 以今日 meta 即可重建。
- 但 **WP-24 的 ADS drill 會直接踩空**。故選項 A 落地時**必須同時補 `meta.fovDeg`(hip 基準 FOV,additive v2 欄)**,否則只是把缺口延後成另一個 KI。
- 單一快照即足夠:SettingsPanel 於 Pointer Lock 鎖定時整組隱藏([KI-003](KI-003-top-left-controls-overlap.md) 的 `#top-left-controls` 統一切換),drill 進行中無法改 sensitivity/FOV ⇒ 不存在 drill 內變動需逐 tick 記錄的情形。

> 此缺口本身也是一個**獨立於 KI-005 的可重現性漏洞**:現行匯出無法還原 ADS 感度鏈,任何 ADS drill 的
> 滑鼠增益都不可稽核。補 `meta.fovDeg` 同時關掉這個洞。

### 6.3 選項明細

### 選項 A — tick 窗內積分 mouse delta(**✅ 採用**)

[`applyInput`](../../src/loop/SimLoop.ts#L66) 目前對 `type === 'mouse'` 直接忽略,但
[`consume`](../../src/input/consume.ts) 已把落在 `[tickStart, untilT)` 的滑鼠事件依 `event.timeStamp`
精確交付。改為在 tick 窗內以同一套 `sensitivity × RAD_PER_COUNT × adsGain` 累加成
`dYawTick / dPitchTick`,寫入 TickRecord 新欄位。

- **每個事件依自身時間戳落進唯一正確的 tick** ⇒ 結構上不可能有 ZOH aliasing,且與 displayHz 無關。
- **不碰 render path**:`state.aim`、camera、手感、ADR-2 雙迴圈邊界全部不變。
- 比照 `recordKeyEvents` 做 **opt-in**(`recordMouseIntegration`)⇒ 關閉時逐位不變,
  golden 與決定性回歸保住(CLAUDE.md §4)。
- **感度來源(OQ-KI5-1 已拍板 = meta 重建)**:`sensitivity × RAD_PER_COUNT × adsGain`,其中
  `adsGain` = 1(hip)或 `meta.weapon.ads.sensitivityRatio × (meta.weapon.ads.fovDeg / meta.fovDeg)`(ADS)。
  **`meta.fovDeg` 為本次必須新增的 additive 欄,見 §6.2。**

### 選項 B — 錄原始 mouse sample stream(**延後;WP-31 開工前再議**)

InputRing 已以 `getCoalescedEvents()` 收下 ~1000 Hz 的每一筆樣本、各帶自身 `timeStamp`
([InputSampler.ts:132](../../src/input/InputSampler.ts#L132)),但 sim 消費後即丟棄。
以 preallocated arena(禁 `push`,守 GC 紀律)opt-in 記 `{t, dx, dy}`。

- 30 s × 1000 Hz × 3 × 8 B ≈ **0.7 MB**,在 `research/README.md` 的 fixture 上限內。
- **A 修正錯誤,B 提高解析度** —— 128 Hz 下一次 200 ms flick 僅 25 點,3–4 點寬的修正動作無法分辨;
  WP-31 的 submovement 分解 / SPARC / Fitts 需要 ~1000 Hz。

### 選項 C — 純分析側緩解(過渡期,不動引擎)—— **❌ 不採(2026-08-06 拍板:直接等 A)**

1. 每個 session 由 `meta.display.refreshEstimateHz / meta.simHz` 算出 beat 週期;
2. 進 SG 前先做 beat 週期長度的 moving average 或 notch;
3. 新增 quality flag `render_sim_beat`(對 ω 做 autocorrelation,於預測 lag 顯著即標記)。

可**回溯**套用至所有既有匯出。缺點:治標,且無法救回已被假象吃掉的細部結構。

### 選項 D — 對齊速率(**不採**)

要求 displayHz 為 simHz 整數倍。`SIM_HZ = 128` 綁 CS2 語意(64 Hz recoil 子節奏 = 128/2)與決定性
golden,不可動;而 240/144/165 Hz 是主流硬體,不可能要求受試者更換。**僅可作為診斷用臨時 build**
(240/120 = 2.0 整除),絕不進 main。

## 7. 驗證計畫

1. ✅ **測試 A 已完成**(§3.3)—— 根因確立,無需新資料。
2. ✅ **A1 已交付**——決定性單元測試(RED→GREEN):[KI-005-A/T4](KI-005-A/T4-tick-window-integration.md) 餵等速合成滑鼠輸入,以 240/165/144/60 Hz 四種 pump 節奏。修法前(舊法 aim-diff)240 Hz 組實測 lowRatio≈0.1154(預期 0.125)、lowMean≈0.553(預期 0.533)、highMean≈1.058(預期 1.067)——精確重現本文 §3.3 簽名;165/144/60 Hz 舊法 CV 皆顯著非零(≈0.351/0.280/1.040),證明非 240 Hz 特例。**新法**(`dYaw`/`dPitch`)四種節奏下 CV ≈1.1e-15,達 GREEN。此測試留為回歸閘(**刷新率不變性閘**,NFR-A-4)。
3. ✅ **A1 已交付**——既有 golden / 決定性回歸:[KI-005-A/T4](KI-005-A/T4-tick-window-integration.md) 的 opt-in 關閉逐位不變測試;`npm run test:ci`(vitest 89 files/739 tests)全綠,`src/sim/`/`SharedState`/`simStep` 零 diff。另加**守恆閘**(NFR-A-5):`|Σ dYaw − Δaim.yaw| ≤ 1e-12`(hip-only)。
4. ⛔ **A2(blocked on 新採樣)**——真實資料複驗 —— 必須用修法後的新匯出。
   > ⚠️ 本項於 2026-08-06 更正。初稿寫「以 09:39 匯出重跑 `run_pipeline.py`」是**錯的**:選項 A 改變的是
   > **記錄什麼**,既有匯出的 `ticks[].aim` 已經帶著假象寫死在檔案裡,重跑分析不可能讓它變乾淨。
   > 加上 OQ-KI5-3 拍板不做選項 C(不回溯清洗),**既有兩份匯出在本 KI 修好後仍不可用於 ω(t)**。
   複驗須:採一份新匯出(同一台 240 Hz 機器),確認 ① 凹口消失(§3.1 的偵測器回傳 0)、
   ② `merged_adjacent_peaks` 比例顯著下降、③ 未 flag 樣本數上升、④ 新舊欄位的角位移總量一致
   (守恆檢查,證明修的是歸屬而非量值)。**A1 只在合成資料上證明了④(守恆閘 G-2);真實資料上是否成立 —— 即 coalesced sum 是否等於 dispatched movement(FM-1)—— 是 A1 落地後仍未證偽的唯一假設**,見「A1 落地後的殘餘限制」。
5. ⛔ **A2(blocked on 新採樣)**——參數重掃:選項 A 落地後 `seg-v1` 必須以**修法後的新匯出**重新掃參並升版(`seg-v2`),
   依 D-28.7 不得原地調參。
6. ✅ **A1 已交付**——`meta.fovDeg` 補欄(§6.2):additive,缺席時既有匯出仍可載入;新增後 ADS drill 的感度鏈可稽核。同批交付 `meta.mouseIntegration`(自我描述積分模型,FR-A-6)與 `ticks[].dYaw/dPitch`。

> **A1 落地後的殘餘限制**(誠實列出,防止「儀器修好」被誤讀成「效度恢復」):
>
> - **TD-1 — 仍是 128 Hz 解析度**。選項 A 修的是**歸屬錯誤**,不是取樣率。128 Hz 下 200 ms flick 僅 25 點,細部修正動作(3–4 點寬)仍無法分辨;需選項 B(~1000 Hz raw sample stream,WP-31 開工前再議)。
> - **TD-2 — ADS 切換幀的歸屬殘差**。camera 的 gain 階躍量化到 render 幀,積分器量化到事件時刻;守恆閘目前只對 hip-only 樣本宣告 exact,含 ADS 切換的樣本以「切換 tick 排除」處理。根治需 render 側也走事件時刻(選項 B 範圍)。
> - **FM-1 未證偽 — coalesced sum 是否等於 dispatched movement**。合成注入路徑上守恆閘為 exact(數學保證),但這是否對**真實滑鼠硬體**成立(即 render 端與量測端是否看到同一份輸入流)在 A1 內無法驗證,必須等 A2-T2 用真實新匯出覆核。若不成立,代表選項 B 是唯一能仲裁的資料來源,須提前。
> - **M14 ③④⑤ 仍撤回**。A1 交付的是「量測儀器修好了」,不是「證據力恢復了」——證據力只能由**修法後的新匯出**建立,且 M14 ④⑤ 另被 [KI-006](KI-006-m14-sample-no-counterstrafe.md)(真實樣本無 counter-strafe 構念)以獨立理由擋著。WP-30/31 entry blocker 未解除。

## 8. 遺留 Open Questions

| OQ | 問題 | 狀態 / 決議 | 待決者 |
|---|---|---|---|
| ~~**OQ-KI5-1**~~ | ~~選項 A 的 `sensitivity`/`adsGain` 取得方式~~ | ✅ **關閉(2026-08-06)**:**由 meta 重建**。連帶必須補 `meta.fovDeg`(§6.2) | 使用者 |
| ~~**OQ-KI5-2**~~ | ~~選項 A 與 B 的落地順序~~ | ✅ **關閉(2026-08-06)**:**A 先**;B 另案,WP-31 開工前再議 | 使用者 |
| ~~**OQ-KI5-3**~~ | ~~過渡期是否落選項 C~~ | ✅ **關閉(2026-08-06)**:**不做,直接等 A**。既有兩份匯出不回溯清洗 | 使用者 |
| ~~**OQ-KI5-4**~~ | ~~`seg-v2` 重掃是否需先取得新樣本~~ | ✅ **關閉(2026-08-06)**:隨 OQ-KI5-3 自動確定 —— **必須用修法後的新匯出**,無 C 清洗路徑可用 | 使用者 |
| **OQ-KI5-5** | 是否把 `beat_period_ticks` 加入 `meta.display.gate` 作為 session 級警示欄 | 🟡 **未決**。註:A 落地後 ω 不再受 displayHz 影響,此欄的價值降為「稽核既有舊匯出」與「偵測未來回歸」;不阻塞 A1 | 使用者 |
| ~~**OQ-KI5-6**~~ | ~~新採樣的時機與規模:是否與 [KI-006](KI-006-m14-sample-no-counterstrafe.md) 選項 B 合併為同一次採集,以及是否趁此滿足 OQ-KI6-4(n ≥ 2 session)~~ | ✅ **關閉(2026-08-07)**:**合併為同一次採集**;規模依 OQ-KI6-4 決議 **n > 2**(至少 3 個 session)。實際排程時間待研究者訂,執行細節見 [KI-005-A/A2-blocked-plan.md](KI-005-A/A2-blocked-plan.md) | 使用者 |
