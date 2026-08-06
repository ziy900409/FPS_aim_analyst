# T4 — tick 窗積分:`ticks[].dYaw` / `dPitch` + 三個閘

> 交付 **FR-A-1 / FR-A-4 / FR-A-7 / FR-A-9 / FR-A-10** · 上游:[A README §2.2 / §2.6](README.md) · [KI-005 §6.3 選項 A](../KI-005-omega-render-sim-aliasing.md)
> 依賴:**T3 已 commit**(lock 閘是本刀正確性的前提)· 需要 T1 的 `resolveMouseGain`/`AimIntegrator` 與 T2 的 meta 區塊。
> 風險:**High**。本 task 是整個 KI-005 的核心交付。

**In scope**:`src/loop/SimLoop.ts`(`applyInput` mouse 分支)· `src/data/DataRecorder.ts` · `src/data/RingBuffer.ts` · `src/data/export.ts`(ticks 序列化)· `src/main.ts`(佈線 + **啟用**)· 三個閘的測試。
**Out of scope**:Python 消費端(T5)· 文件對帳(T6)· 任何 `ticks[].aim` 的既有語意。

---

## 修法的形狀

[`consume`](../../../src/input/consume.ts) 早已把落在 `[tickStart, untilT)` 的滑鼠事件依 `event.timeStamp` **精確交付**給 `applyInput`——`applyInput` 只是沒有 `mouse` 分支,直接丟棄。本 task 補上那個分支:

```
每個事件依自身時間戳落進唯一正確的 tick
  ⇒ 結構上不可能有 ZOH aliasing
  ⇒ 且與 displayHz 完全無關
```

**不碰 render path**:`state.aim`、camera、手感、ADR-2 雙迴圈邊界全部不變。積分器狀態放在 **`DataRecorder` 閉包(data 層)**,**不進 `SharedState`**——這是保住「`SharedState` 演進零 diff」的關鍵設計選擇。

---

## Steps

### 1. `TickArena` 新增兩個 preallocated 欄(C-7)

- [ ] `TickArena` 新增 `dYaw` / `dPitch` 兩個 `Float64Array(capacity)`,與既有欄位同紀律預配置(**不做條件配置**——固定佈局優先於 0.6 MB 的節省,見 R-8)。
- [ ] `recordFields` 新增兩個參數;`recordTick` / `recordState` 對應傳入。
- [ ] 新增 `hasMouseIntegration: Uint8Array` **或**由 recorder 層決定是否寫入——擇一,但 `snapshot()` 的規則必須是:
  - **未啟用** ⇒ `TickRecord` **不含** `dYaw` / `dPitch` 兩個 key(不是 `undefined`、不是 `0`,而是 key 不存在)⇒ `JSON.stringify` 逐位不變(NFR-A-2)。
  - **已啟用** ⇒ 兩個 key 恆存在(即使該 tick 無滑鼠事件,值為 `0`——「沒動」與「沒記錄」必須可區分)。
- [ ] `reset()` 一併清零累加器。

### 2. `DataRecorder` 的累加器

- [ ] `DataRecorderOptions` 新增 `mouseIntegration?: MouseIntegrationConfig`;`DataRecorder` 暴露唯讀 `mouseIntegration` 與 `configureMouseIntegration(config)`。
- [ ] 閉包持有:一個 `AimIntegrator`(T1)+ 當前 tick 的 `dYawAccum` / `dPitchAccum` 兩個 `number`。
- [ ] `accumulateMouse(dx, dy, ads)`:
  - `step = ads ? gain.adsStep : gain.hipStep`
  - `const d = integrator.applyDelta(dx, dy, step)`;`dYawAccum += d.dYaw`;`dPitchAccum += d.dPitch`
  - **零物件配置**(`applyDelta` 回傳重用物件,同步讀取)。
- [ ] `recordTickFromState` / `recordTick`:寫入 arena 時帶上兩個累加值,**寫入後立即歸零**。
  - ⚠️ 歸零時機必須是「寫入 arena 之後」,且 `simStep` 的 `recorder?.recordTickFromState(tickEndMs, state)` 是 tick 的**最後一步**(見 [SimLoop.ts:623](../../../src/loop/SimLoop.ts#L623))⇒ 本 tick 消費的所有事件都已累加完畢。
  - ⚠️ **arena 滿(overflow)時仍須歸零**,否則溢位後的累加值會滲進下一 tick。
- [ ] `reset()` 重置累加器與 `AimIntegrator`(drill restart 時 aim 也是從 0 起——與 `CameraController` 的行為對齊,見 §5 的一致性檢查)。

### 3. `applyInput` 的 mouse 分支(FR-A-1)

- [ ] 在 [`applyInput`](../../../src/loop/SimLoop.ts#L66) 末尾新增:
  ```ts
  } else if (ev.type === 'mouse') {
    // KI-005 / A(FR-A-1):tick 窗內依事件自身 timeStamp 積分角位移。**只寫 recorder,不寫 state**
    // —— sim 演進、命中、彈道一律不受影響(NFR-A-1);未啟用時完全不進此分支(GC 紀律 §4)。
    if (recorder?.mouseIntegration !== undefined) recorder.accumulateMouse(ev.dx, ev.dy, state.heldAds);
  }
  ```
- [ ] ⚠️ `state.heldAds` 取的是**事件時刻**的值:`ads` 事件與 `mouse` 事件在同一個 `consume` 迴圈內依 `timeStamp` 排序交付,故此讀取自動正確。
- [ ] ⚠️ **不得**寫入 `state` 的任何欄位。`git diff` 複查。

### 4. `export.ts` 序列化(FM-7)

- [ ] `serializeTicksCSV`:依 payload 是否含 `dYaw` 決定表頭——缺席時與今日**逐位相同**;存在時在 `pitch` 之後、`keys` 之前插入 `dYaw` / `dPitch` 兩欄。
  - 判定方式:`ticks.length > 0 && ticks[0].dYaw !== undefined`(啟用時所有 tick 皆有,不需 `some`)。
- [ ] `assertFinitePayload`:對存在的 `dYaw` / `dPitch` 做 `formatNumber` 檢查。
- [ ] `buildExportPayload` 不需改動(ticks 原樣傳遞)。

### 5. `main.ts` 佈線 + **啟用**(FR-A-7,OQ-A-1 已拍板「全域開」)

- [ ] 抽一個 `currentMouseGain()`:`resolveMouseGain({ sensitivity: settingsPanel.sensitivity, hipFovDeg: settingsPanel.fov, ads: activeWeaponConfig().ads })`。
- [ ] `createDataRecorder({ simHz: SIM_HZ, mouseIntegration: { gain: currentMouseGain() } })`。
- [ ] 在**每次 drill 開始 / 換武器 / 換 drill** 的既有掛點呼叫 `recorder.configureMouseIntegration({ gain: currentMouseGain() })`(與 `cameraController.setAdsConfig(...)` 同一批動作)。
- [ ] `collectMeta` 的 `mouseIntegration` 區塊(T2)以**同一個 `MouseGain` 物件**填入 ⇒ meta 與實際記錄不可能不一致。
- [ ] ⚠️ **不要**因為 e2e 轉紅就把旗標關掉(FM-4)——那會直接違反 FR-A-7,使整個修法對研究零效果(前車之鑑:`recordKeyEvents` 至今未啟用,見 [README §2.4 ②](README.md))。
- [ ] SettingsPanel 於鎖定中整組隱藏(KI-003)⇒ drill 內不會變動;補一條測試釘死「drill 進行中不重呼 `configureMouseIntegration`」(FM-6)。

### 6. 三個閘(**先寫紅,再修綠**;C-6)

#### 閘 ① — 刷新率不變性(FR-A-10,**本 KI 的核心正確性宣稱**)

```
構造:一串固定的合成 mouse 事件(等速 + 一段 flick),各帶明確 timeStamp,涵蓋 ≥ 64 個 tick
餵法:同一組事件,分別以 pump 節奏 1000/240、1000/165、1000/144、1000/60 ms 驅動 SimLoop
斷言:四組的 ticks[].dYaw / dPitch 陣列**逐位相同**(NFR-A-4,差 = 0,非容差)
修法前紅:同一組資料以 ticks[].aim 差分計算 ω,240 Hz 組必須出現 KI-005 §3.3 的簽名
          —— 1 幀 tick 與 2 幀 tick 的正規化 ω ≈ 0.533 / 1.067、1 幀 tick 佔比 ≈ 12.5%
```

- [ ] 紅證據(修法前於工作區實測)寫入 `progress.md`,含四種節奏各自的 aim-diff ω 變異係數。
- [ ] 綠斷言含「等速輸入下 `dYaw` 的變異係數 ≤ 1e-9」(NFR-A-6)。
- [ ] ⚠️ 事件必須**預排序**餵入(合成路徑),避免遲到事件路徑的非決定性(見 [consume.ts](../../../src/input/consume.ts) 檔頭)。

#### 閘 ② — 守恆(FR-A-9)

```
構造:同上的合成序列,**hip-only**(不含 ads 事件)
斷言:|Σ_ticks dYaw − (aim.yaw_end − aim.yaw_start)| ≤ 1e-12   (目標 0)
      |Σ_ticks dPitch − (aim.pitch_end − aim.pitch_start)| ≤ 1e-12
```

- [ ] `aim.yaw/pitch` 取自**同一組事件餵給 `CameraController.applyDelta`** 的結果——兩側共用 T1 的 `AimIntegrator`,故應逐位相等。
- [ ] 補一個 **pitch 夾角案**:輸入使 pitch 撞到 ±`MAX_PITCH`,守恆仍成立(D-A2 的驗證)。
- [ ] ⚠️ **不含 ADS 切換**:FM-2 的殘差在 A1 不做宣稱(OQ-A-6)。若要加 ADS 案,只斷言「切換 tick 以外的 tick 守恆」。

#### 閘 ③ — opt-in 關閉時逐位不變(NFR-A-2)

- [ ] 同一組輸入,`mouseIntegration` 未啟用時的 `serializeJSON(payload)` 與 T4 前的 golden **byte-identical**。
- [ ] `TickRecord` 不含 `dYaw` / `dPitch` 兩個 key(不是 `undefined`)。
- [ ] `serializeTicksCSV` 的表頭逐位不變。

### 7. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— 因 §5 啟用,產生匯出 round-trip 的 e2e 會多出兩欄:**每一條變動的期望值逐條書面歸因**於「新增 additive 欄」並記入 `progress.md`(FM-4)。
- [ ] 決定性回歸(`src/loop/__tests__/`、`tests/regression/`)**必須逐位不變**;有任何變動即代表誤觸 sim(NFR-A-1),立即停。
- [ ] `git diff --stat` 複查:未觸及 `src/sim/`、`SharedState` 演進、`simStep` 的狀態轉移(`applyInput` 的新分支不寫 `state`)。

---

## Definition of Done

- [ ] **閘 ①(刷新率不變性)**:240/165/144/60 Hz 四種 pump 節奏下 `dYaw`/`dPitch` **逐位相同**;修法前同組資料的 aim-diff ω 在 240 Hz 組重現 KI-005 §3.3 的簽名(0.533/1.067、12.5%),紅證據記 `progress.md`。
- [ ] **閘 ②(守恆)**:`|Σ dYaw − Δaim.yaw| ≤ 1e-12`(hip-only),含 pitch 夾角案。
- [ ] **閘 ③(opt-in 關閉)**:匯出 JSON **byte-identical**、CSV 表頭逐位不變、`TickRecord` 不含新 key。
- [ ] `applyInput` 的 mouse 分支**只寫 recorder、不寫 `state`**(`git diff` 複查)。
- [ ] arena 兩欄為 preallocated `Float64Array`;累加器在寫入 arena 後歸零,**含 overflow 路徑**。
- [ ] `main.ts` **已啟用**,且 `collectMeta` 的 `mouseIntegration` 與 recorder 使用**同一個 `MouseGain` 物件**。
- [ ] e2e round-trip 匯出含 `ticks[].dYaw` / `dPitch` 與 `meta.mouseIntegration`;所有變動的既有期望值**逐條書面歸因**。
- [ ] 決定性回歸與既有 golden(opt-in 關閉路徑)**逐位不變**。
- [ ] `npx tsc --noEmit` exit 0;`npm run test:ci` exit 0。
- [ ] `git diff` 不觸及 `src/sim/`、`SharedState` 演進、`simStep` 狀態轉移。

## Commit message

> ⚠️ 若本 task 一併改動 `research/fixtures/exports/synthetic_counterstrafe.json`(補 `dYaw` 欄),Python 側測試會轉紅,須與 [T5](T5-python-omega-source.md) **合併為單一已驗證綠的 commit**(比照 [BD-001](../BUGFIX-DECISIONS.md) 的 TDD 偏離慣例);此時 message 見 T5。
> 若把 fixture 補欄全部留在 T5,則本 task 可獨立綠燈 commit,message 如下:

```
feat(ki-005): tick 窗內積分 mouse delta — ticks[].dYaw / dPitch(選項 A 核心)

KI-005 / A(FR-A-1/4/7/9/10)。state.aim 由 render path 以 ~240 Hz 寫入、由 sim
以 128 Hz 讀取後逐 tick 差分 —— 是一條 zero-order-hold 階梯,240/128 = 1.875
使每 8 個 tick 有一個只夾到 1 幀,ω(t) 因而忽高忽低(角位移總量正確,錯的是
「歸屬到哪一個 tick」)。SG window 7 < beat 週期 8,數學上不可能濾除。

consume() 早已依 event.timeStamp 把滑鼠事件精確分桶到唯一正確的 tick,只是
applyInput 直接丟棄。本刀補上該分支:每個事件依自身時間戳落進唯一正確的 tick
⇒ 結構上不可能 alias,且與 displayHz 無關。

不碰 render path:state.aim、camera、手感、ADR-2 雙迴圈邊界全部不變。積分器
狀態放在 DataRecorder 閉包(data 層),不進 SharedState ⇒ sim 演進零 diff。

三個閘:① 240/165/144/60 Hz 四種 pump 節奏下 dYaw 逐位相同(修法前 240 Hz 組
重現 KI-005 §3.3 的 0.533/1.067 與 12.5% 簽名)② Σ dYaw ≡ Δaim.yaw(守恆,
證明修的是歸屬而非量值)③ opt-in 關閉時匯出 byte-identical。

app 佈線層**啟用**(FR-A-7):opt-in 只保 golden 逐位不變,不得成為「功能上線
但實務未生效」—— recordKeyEvents 至今未在 main.ts 啟用即是前車之鑑。
```
