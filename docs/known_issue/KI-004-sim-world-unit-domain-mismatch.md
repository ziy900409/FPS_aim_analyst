# KI-004 — sim domain(source unit)與 world domain 混用:corridor gate 100× 過緊 + 離線 ε(t) 原點錯尺度

> 類型:單位域(unit domain)一致性 bugfix 診斷 + 修改計畫(tech spec)。
> 狀態:**✅ S1 已落地(2026-08-06)**;S2(逐 tick eye pose)/ S3(文件/ADR)待辦(見 §5.1)。M14 ② 已於 S1 落地後重新宣告([BD-004](BUGFIX-DECISIONS.md) S1 落地段)。**WP-30/31 entry blocker 仍維持** —— 該 blocker 有三條相互獨立的理由(KI-004/KI-005/KI-006),本次僅解除 KI-004 這一條;KI-005/KI-006 尚未落地。
>
> ⚠️ **2026-08-05 更正**:本文件初版稱「08:03 匯出 `px ≡ 0`,ε 碰巧正確,M14 數值不撤回」。**該敘述已證實為誤** —— D2 實際上有**兩個獨立缺陷**,其中 D2a(遺漏 camera base offset)與 `px` 無關,在 08:03 上同樣造成 ~12.5° 誤差。**M14 ② 撤回**(§3、§4;**已於 S1 落地後重新宣告,見上**)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-004。
> 發現路徑:排查「[counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json](../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json) 為何零位移」時,重現用的第二份匯出暴露此問題。
>
> ⚠️ **2026-08-06 後續更正(本文件的一條推論已被推翻)**:本文件 §「影響面」與 §「決策 K-2」three 處主張
> 「**M14 ①③④⑤⑥ 不受影響 —— 分段走 ω(t),只依賴 `aim`,與量測原點無關**」。該推論**就本 KI 的量測原點
> 缺陷而言仍正確**,但 `ticks[].aim` 另有一個**獨立**缺陷:它以 render 速率(~240 Hz)寫入、以 sim 速率
> (128 Hz)讀取,逐 tick 差分後產生 zero-order-hold aliasing → 見 **[KI-005](KI-005-omega-render-sim-aliasing.md)**。
> 此外,本文件 §2 對照表記載的「08:03 **無**鍵盤輸入」這個事實,其對 M14 ④/⑤ **構念效度**的後果當時未被追下去
> → 見 **[KI-006](KI-006-m14-sample-no-counterstrafe.md)**。
> **結果:M14 ③④⑤ 亦已撤回(2026-08-06),僅 ①⑥ 維持。**本文件其餘診斷(D1 corridor gate / D2a 遺漏
> camera base offset / D2b 遺漏 `SIM_TO_WORLD` / K-1 雙域 / K-3 自由位移)**全部不受影響,S1 修法照原計畫進行**。

---

## 1. 症狀

### 1.1 直接症狀:任何真實急停 run 都被標 `suspect: true`

2026-08-05 兩份同 drill(`counterstrafe_ad_v1`)、同場景(`field-low`)、同機器的匯出構成天然對照組:

| | 08:03(**無**鍵盤輸入) | 09:39(**有**鍵盤輸入) |
|---|---|---|
| `ticks[].keys` | 3,507 筆全空 | `A` 617 / `D` 587 / `A+D` 33 |
| `counter` 事件 | 0 | 24 |
| `max |px|` | 0 | **169.25** |
| frames p95 | 4.235 ms(地板 8.33) | 4.235 ms(地板 8.33) |
| `recorderOverflow` | false | false |
| display gate | pass | pass |
| **`meta.suspect`** | **false** | **true** |

`suspect` 的唯一觸發者是 [main.ts:527](../../src/main.ts#L527) 的 `playerCorridorExceeded`。也就是說:**只有完全不移動的 run 才會被判定「可信」,任何照 drill 要求做急停的 run 都會被判定「可疑」** —— 旗標語意完全反轉。

### 1.2 更嚴重的症狀:離線 ε(t) 的量測原點是錯的(兩個獨立缺陷)

[`trackingDerivation.ts`](../../src/metrics/trackingDerivation.ts) / [`detectionDerivation.ts`](../../src/metrics/detectionDerivation.ts) 把射線原點寫死為 `p_eye = (px, eyeY, pz)`。這相對於**真實的**射線原點(= camera world pose)有兩個各自獨立的錯誤:

| # | 缺陷 | 條件 | 說明 |
|---|---|---|---|
| **D2a** | 遺漏 camera base offset | **恆成立,與 `px` 無關** | 真實原點 = `(0, eyeHeight, eyeZ)`,`field-low` 的 `eyeZ = depth/2 − standoff = 10/2 − 1 = **4**`([SceneManager.ts:67](../../src/render/SceneManager.ts#L67))。推導假設 `z = 0` → 目標在 `z = −4` 時把交戰距離算成 4 而非 8 |
| **D2b** | 遺漏 `SIM_TO_WORLD` | 僅 `px ≠ 0` | 再疊一層 100× 尺度誤差 |

**實測**(以引擎自身在開火當下用真實 camera 算出的 `fire.offsetDeg` 為 ground truth):

| fixture | \|ε_推導 − offsetDeg\| 中位數 | \|ε_正確 − offsetDeg\| 中位數 |
|---|---|---|
| 08:03(`px ≡ 0`,只有 D2a) | **12.52°**(max 12.73) | 0.21° |
| 09:39(`px` → 169,D2a + D2b) | **67.11°**(max 88.55) | 0.14° |

> `ε_正確` = 以 `p_eye = (baseX + px·0.01, 1.6, baseZ + pz·0.01)`、`base = (0, 1.6, 4)` 計算。殘差 0.1–0.2° 來自「fire 時間戳 vs 最近 tick」的取樣差,非系統性偏差。

⇒ **ε(t)、on-target、TOT%、`t_acquire`、`t_detect`、`eccentricity_at_spawn` 在目前所有匯出上都是錯的**,不只是 `px ≠ 0` 的情況。

**關聯**:[KI-002 / D1](KI-002-br-field-camera-anchor-protocol-load.md) 於 2026-07-15 正是為了修正射線原點而引入 `eyeZ`(br-field 設 0、其餘沿用 `depth/2 − standoff`)。**離線推導從未跟上那次改動** —— 同一個構念的兩個實作,只有 render/sim 那一側被修。這是 D2a 的直接來源。

---

## 2. 根因

### 2.1 兩個單位域,只有一個轉換點

專案實際上同時存在兩個座標尺度:

| 域 | 內容 | 代表數值 |
|---|---|---|
| **sim domain(source unit,u)** | `state.player.x/z`、`vx`、`vStrafe`、`CS2_PROFILE`(`maxSpeed 250`、`stopSpeed 80`、`accuracyThreshold 88`) | 250 u/s |
| **world domain(three.js 世界座標,≈公尺)** | 場景幾何、`proceduralRoom.roomSize [10,10,4]`、`eyeHeight 1.6`、目標位置(`tx/ty/tz`、`visible.targetX/Y/Z` = ±2 / 1.5 / −4)、`meta.targets.hitbox {1,2,1}`、`propBounds`、`playerCorridor.halfWidthU` | 目標高 2 |

兩者的橋樑是 [main.ts:628](../../src/main.ts#L628):

```ts
const SIM_TO_WORLD = 0.01; // world unit per source unit（佔位；WP-6 drill config 接管）
```

而它**全 repo 只被套用在一個地方** —— [main.ts:954](../../src/main.ts#L954) 的 render camera 位置:

```ts
sceneManager.camera.position.set(baseX + px * SIM_TO_WORLD, baseY, baseZ + pz * SIM_TO_WORLD);
```

註解自陳這是「佔位,WP-6 drill config 接管」,而該接管**從未發生**。

**引擎自己的命中鏈是自洽的**:`HitDetector` / `targetCenterOffsetDeg` 都吃已經換算過的 `camera`,兩端同為 world domain。這就是為什麼 09:39 那份在 `px = −167` 時 `offsetDeg` 仍只有 0.8–3.2°、首發命中率 90% —— 玩家實際只在 world 座標移動了 −1.67 個單位。

問題出在**所有繞過 camera、直接讀 sim 量的消費者**:它們拿 source unit 去跟 world unit 比較或相減,而沒有乘 `SIM_TO_WORLD`。

### 2.2 D1 — corridor gate(runtime validity)

[main.ts:527](../../src/main.ts#L527):

```ts
if (Math.abs(state.player.x) > activeSceneConfig.playerCorridor.halfWidthU) {
  state.validity.playerCorridorExceeded = true;
}
```

- 左式 `state.player.x` = **source unit**。
- 右式 `halfWidthU` = **world unit** —— 佐證:同一常數在 [clearance.ts:248](../../src/scene/clearance.ts#L248) `samplePlayerCorridor()` 被拿去跟 `propBounds`(GLTF world 座標)做淨空取樣;`field-low`/`placeholder-room`/`urban-high` 皆寫死 `1`,而 `br-field` 由 `hardClearWidthU / 2` 推導 —— 全部是 world domain 的量。

⇒ 閘門實際門檻 = 1 source unit = **0.01 world unit**,比設計意圖(±1 world unit)**緊 100 倍**。以 `vStrafe = 250 u/s` 計,玩家在 **4 ms**(不到一個 sim tick)內就會越界。

### 2.3 D2 — 離線推導的 `p_eye`(量測原點從未被記錄)

**結構性根因**:匯出記了射線的**方向**(`ticks[].aim.yaw/pitch`),卻沒記射線的**原點**。真實原點由三個分處不同層的片段組成,而**三者都不在匯出裡**:

| 片段 | 持有者 | 域 |
|---|---|---|
| `eyeHeight` / `eyeZ ?? depth/2 − standoff` | `SceneConfig` + `SceneManager`(render 層) | world |
| `SIM_TO_WORLD = 0.01` | `main.ts` module 常數 | 換算 |
| `player.x / z` | `SharedState`(sim 層) | source |

`meta.scene` 只記 `sceneId`,沒有 camera 幾何。⇒ **離線分析者在數學上無法從匯出檔還原正確原點**,只能依「約定」猜 —— 而約定猜錯了兩次(D2a、D2b)。

依 GD-7 的 raw-over-derived 原則,**射線原點屬於 raw(儀器姿態,與 `aim` 同級),不屬於 derived**。目前的資料模型缺這一欄。

### 2.3.1 具體落點

[trackingDerivation.ts:191-193](../../src/metrics/trackingDerivation.ts#L191) 與 [:222-224](../../src/metrics/trackingDerivation.ts#L222):

```ts
const ox = tick.px;          // source unit
const oy = options.eyeHeight; // 1.6 → world unit
const oz = tick.pz;          // source unit
...
const dx = target.x - tick.px; // world unit − source unit ❌
```

`detectionDerivation.ts` 的 `angularEccentricityDeg` 為同一份實作(同樣的行)。

匯出 schema 本身就把兩個域混在同一列:`ticks[].px/pz` 是 sim domain,`ticks[].tx/ty/tz` 是 world domain,而**匯出檔沒有記錄 `SIM_TO_WORLD`**,離線分析者無從還原。

[analysis-tracking.md:21](../operational/analysis-tracking.md#L21) 寫「Target/player positions are source units」、[:44](../operational/analysis-tracking.md#L44) 寫「`eyeY` defaults to 1.6 source units」——**規格文件的敘述與實作、與 `meta.targets.hitbox` 的實際尺度都不一致**。[CONTEXT.md 正規單位](../../CONTEXT.md)一節聲明「sim 與所有記錄/匯出資料一律用 CS Source unit……sim/資料不得用公尺」,但 `tx/ty/tz`/`hitbox`/`eyeHeight` 實際上就是公尺尺度。

---

## 3. 影響範圍

| 面向 | 影響 | 嚴重度 |
|---|---|---|
| `meta.suspect` 研究效度旗標 | 語意反轉:有做急停 = suspect,不動 = 可信。所有含真實橫移的 pilot 資料都會帶旗標 | **High**(資料判讀) |
| 離線 ε(t)/on-target/TOT%/`t_acquire` | **所有**匯出皆錯:D2a 恆成立(08:03 實測 12.5°),`px ≠ 0` 再疊 D2b(09:39 實測 67°) | **High**(研究效度) |
| `t_detect`/`eccentricity_at_spawn`(GD-8) | 同上 | **High** |
| **M14 ② ε parity** | **撤回**(2026-08-05 使用者拍板)。parity 機制本身有效且仍綠(Python 與 TS 逐位一致),但兩側**一致地錯** → 「ε 層地基成立」的宣告無效。M14 ①③④⑤⑥ 不受影響(分段走 ω(t),只依賴 `aim`,與 `px`/原點無關) | **✅ S1 落地後重新宣告(2026-08-06)** |
| **WP-30 / WP-31 entry** | 兩者全部逐段軌跡指標建在 ε(t) 上 → entry blocker 恢復,須待 S1 落地並重新宣告 M14 ② | **維持**(見下)—— KI-004 這條理由已解除,但 KI-005(ω 汙染)/ KI-006(樣本無構念)兩條獨立理由仍未落地,entry blocker 整體未解除 |
| `run_pipeline` 的 `mean_epsilon_deg` 逐段診斷欄(D-28.13) | 錯值 | Med(僅診斷用,未進教練報告) |
| stage4 WP-30/31 | 全部逐段軌跡指標建在 ε(t) 上 → 一旦用含橫移的匯出即失真 | **High**(阻塞) |
| WP-29 T1/T2 | **不受影響**:peek 時間軸與 Sync 族只吃 `events` 與 `ticks[].keys`,不碰 `px/pz` | 無 |
| 引擎命中/彈道/offsetDeg | **不受影響**:全部經 camera,兩端同為 world domain | 無 |
| 決定性(determinism) | **不受影響**:sim 演進未變,只是與 world 幾何的換算缺失 | 無 |

---

## 4. 為何既有測試與 parity 閘沒有抓到

三層防護同時失效,值得記錄:

1. **沒有任何正確性 oracle**。M14 的真實資料檢核只看「分段成功率 + 疊圖」(走 ω(t)),從未把 ε 的**絕對值**與任何獨立來源比對。ε 只要「數值穩定、量級看似合理」就過關 —— 而 12.5° 的系統性偏差在單一 fixture 上肉眼不可見。
   > 初版本文件在此處誤判為「`px ≡ 0` 使 ε 碰巧正確」。實測推翻:D2a 與 `px` 無關,08:03 同樣錯 12.5°。
2. **ε parity 是對表,不是效度驗證**。Python [angular.py:127](../../research/src/modules/kinematics/algorithms/angular.py#L127) 忠實移植了 TS 的 `origins = (px, eye_height, pz)`,兩側**同樣錯**,相對誤差仍 ≤1e-9 → 閘門綠燈。這是 C-D4「TS 為既有構念權威」的固有盲區:對表只能保證兩實作一致,不能保證構念正確。
3. **合成 fixture 不含橫移**。`make_synthetic_export` 的 `px` 由 `vx * dt` 累加,但幾何 fixture 用的是 ε=0 / 已知偏角的靜態情境,未涵蓋「玩家橫移 + 固定目標」的交叉。

---

## 5. 修法決策(2026-08-05 使用者拍板)

### 5.0 三項拍板

| # | 決策 | 理由 |
|---|---|---|
| **K-1** | **採「雙域 + 顯式換算」,不統一單位**。明文宣告:**kinematics 域 = Source unit**(`vx`/`vStrafe`/`CS2_PROFILE`/`residualSpeed`)、**geometry 域 = world unit**(位置/`hitbox`/`eyeHeight`/場景/camera);橋樑 `SIM_TO_WORLD` 升為引擎級具名常數並進匯出 | 幾何**早已整體是 world domain**,只有 `player.x/z` 是離群值 —— 搬離群值,不搬子系統。反向(全改 source unit)需重標 GLTF 資產與 `propBounds`、`DrillConfig` 座標 ×100、**改動 `hitbox` 預設值(直接違反 WP-23/GD-7「省略時逐位等同 H1 `{1,2,1}`」)**、`tx/ty/tz` 語意變更 → 必須 bump `schemaVersion` + 全部 golden/determinism 重錄,是 stage 級工程量,而 ε 是角度、scale-invariant,只要同域即正確。CS2 校準(WP-15/GD-13)活在速度與加速度常數,不在位置單位,保留 `vx` = u/s 即保住校準價值 |
| **K-2** | **M14 ② 撤回,S1 落地後重新宣告**;M14 ①③④⑤⑥ 維持 | ε 在兩份 fixture 上分別錯 12.5° / 67°,非「加註」可處理。分段(③④⑤)走 ω(t),只依賴 `aim`,不受影響 |
| **K-3** | **允許選手自由位移** ⇒ corridor **不再是移動紀律**,改為「場景淨空覆蓋」的**觀測項**,且**不得**再單獨觸發 `meta.suspect` | 自由位移是研究設計的選擇。越出淨空走廊的真實後果是**視覺遮擋**(道具可能擋住目標),而依 GD-6 場景幾何永不進 sim,**不可能**影響命中判定 —— 所以它是「該記錄的觀測」,不是「該作廢的 run」 |

### 5.1 落地階段

> **S1 的可執行計畫**:[KI-004-S1/](KI-004-S1/README.md)(tech spec + T0–T6 + T-exit;task 索引 [task-checklist.md](KI-004-S1/task-checklist.md))。**S1 已於 2026-08-06 落地**(commits `43675ab`/`f6027ed`/`465f986`/`6f4b540`;帳本見 [BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-004 的「S1 落地」段)。

| 階段 | 內容 | 對資料語意的影響 |
|---|---|---|
| **S1 修正性 ✅ 已落地(2026-08-06)** | ① `SIM_TO_WORLD` 從 `main.ts` module 常數升為引擎級具名常數(置 `src/loop/constants.ts` 同級,**不掛 `SceneConfig`** —— 掛上去會讓同一 drill 在不同場景產生不同幾何,且讓 sim 行為依賴場景資料,踩 GD-6 精神)② corridor gate 改 world 域比較 + 依 K-3 脫離 `suspect` ③ `trackingDerivation`/`detectionDerivation` 改為接受 eye pose(base + scale),不再寫死 `(px, eyeY, pz)` ④ Python 側同步 ⑤ 重產 parity fixture ⑥ 加 §6 的兩道正確性閘。**前拉**:`meta.simToWorld` + `meta.scene.eye`(靜態 base)+ `meta.validity` 三個 additive 區塊(原規劃於 S2,2026-08-05 使用者拍板前拉,見 [KI-004-S1/README.md §2.3a](KI-004-S1/README.md)) | 匯出**欄位與值不變**(前拉的三個區塊為 additive 新增);ε/t_detect 系列的**計算結果已變**(本來就是錯的,實測 08:03/09:39 偏差 12.52°/67.11° → ≤0.5°)。sim 未動 → determinism baseline 零影響 |
| **S2 資料模型**(additive,**範圍已縮小**) | 因 2026-08-05 前拉,S2 只剩**逐 tick** 記錄 **eye world pose**(射線原點,與 `aim` 方向並列;TD-1,對還原能力零增益,純粹是 GD-7 raw-over-derived 的完整形式) | additive、**不 bump `schemaVersion`** |
| **S3 文件/ADR** | ① `CONTEXT.md` 正規單位一節改寫(現行「資料不得用公尺」**在今天就是假的**,留著會繼續誘導同類 bug)② `analysis-tracking.md`/`analysis-t-detect.md`/`schema.md` 單位敘述對帳(部分已隨 S1 T2/T4 同步射線原點段落,其餘既有欄位單位敘述留 S3)③ (選配)`SimU`/`WorldU` branded type 慣例入 CLAUDE.md §4 | 純文件 |

> **S2 實作坑(必讀)**:eye pose **不可**從 render camera 讀進 tick 記錄 —— camera 位置是 render 以 `alpha` 內插的,讀它會讓 tick 記錄依賴 render 幀率,**破壞決定性並違反 ADR-2**。正確做法:在 **data 層**以 `base + (player.x, 0, player.z) × SIM_TO_WORLD` 決定性算出,`base`/`factor` 以注入方式提供(`src/data` 不在 GD-6 的禁引用清單內,`meta.scene` 本就已進匯出,合規)。

### 5.2 原始候選(保留供追溯)

### D1 — corridor gate

| Option | 內容 | 優點 | 缺點 |
|---|---|---|---|
| **A** 換算後比較 | `Math.abs(state.player.x) * SIM_TO_WORLD > halfWidthU` | 一行、語意最誠實(把 sim 量帶進 world domain 再比) | `SIM_TO_WORLD` 仍是 main.ts 的 module 常數,耦合未解 |
| **B** 走廊改存 sim domain | `SceneConfig` 新增 `playerCorridor.halfWidthSimU`,與 clearance 用的 world 值分離 | 兩個語意各自有欄位,不再共用一個常數 | 需改四個 scene config + validator;兩個數字需人工保持同步 |
| **C** 把 `SIM_TO_WORLD` 升為場景/drill config 欄位 | 兌現 main.ts 註解原本的「WP-6 drill config 接管」 | 一次解掉 D1+D2 的根,且可被匯出 | 改動面最大,需回歸全場景 |

### D2 — 離線 ε 原點

| Option | 內容 | 優點 | 缺點 |
|---|---|---|---|
| **A** 匯出新增換算因子 | `meta.simToWorld`(additive、不 bump `schemaVersion`),`trackingDerivation`/`detectionDerivation`/Python 側一律 `px * simToWorld` | 離線分析可自我還原;舊匯出缺席 → fallback 0.01 並標 flag | 需同步改 TS + Python + 規格三處,並重產 parity fixture |
| **B** 匯出直接寫 world domain 的 `px/pz` | recorder 寫入時就換算 | 消費端零改動 | **破壞既有 schema 語意**(同名欄位改尺度),舊匯出無法辨識;違 additive 政策 |
| **C** 新增 `pxWorld/pzWorld` 欄位並存 | additive,舊欄位不動 | 向後相容 | 同一物理量兩個欄位,與 CONTEXT「單一定義」精神相衝 |

**先決問題已解決**:OQ-KI4-1 由 K-1 拍板為「雙域 + 顯式換算」,`CONTEXT.md` 的敘述於 S3 改寫。上表 D1-A + D2-A 即 K-1 的落地形式(D2 另加 S2 的逐 tick eye pose,使匯出自我描述、免除重建)。

---

## 6. 驗證計畫(修法落地時的 DoD)

> **架構層結論**:parity 是**一致性閘**(A == B),設計上不可能發現 A 與 B 一起錯 —— 這正是本案發生的事。S1 必須補上專案目前缺的**正確性閘**。

**新增閘 ①(免費 oracle,最高優先)**:`fire.offsetDeg` 是引擎在開火當下用**真實 camera** 算出的「準心 → 目標中心」夾角([SimLoop.ts:408](../../src/loop/SimLoop.ts#L408) `targetCenterOffsetDeg`),與 ε(t) 是**同一構念、不同實作路徑、不同資料來源**。

> 回歸測試:對任一匯出,ε(t) 在 first-shot fire 所屬 tick 的值必須與該 `fire.offsetDeg` 相符(容差需涵蓋 tick 取樣與 sub-tick 內插;實測殘差 0.1–0.2°)。
> 限制:`offsetDeg` 含視覺 punch,故僅對 `aimPunchPitch/Yaw == 0` 的首發成立 —— 覆蓋率已足夠。**此閘若早存在,D2a 與 D2b 在第一天就會被抓到。**

**新增閘 ②**:合成幾何 fixture 必須涵蓋 **`eyeZ ≠ 0` 且 `px ≠ 0`** 的交叉情境。現行 WP-28 T2 幾何 fixture 全為原點 `(0,·,0)` 的靜態情境,結構上看不見這個 bug。

1. **紅測試先行**(比照 BD-001 的 TDD 偏離慣例:紅綠合併為單一已驗證 commit):
   - D1:以 `px` 掃過 `halfWidthU / SIM_TO_WORLD` 邊界的合成 state,斷言 gate 在**正確門檻**翻轉,且依 K-3 **不**觸發 `suspect`。
   - D2:上述閘 ①、閘 ② 在修法前必須**紅**(以 08:03 fixture 即可重現 12.5° 偏差)。
2. `npm run test:ci` exit 0(既有 82 files / 641 tests + 19 e2e 零迴歸)。
3. `uv run pytest` exit 0;Python 側同步修正後**重產** `research/fixtures/parity/epsilon-*.json`,並在 [WP-28 progress.md](../exec-plan/active/stage4/wp-28-research-foundation/progress.md) 補記 M14 ② 的重新宣告。
4. 以 [09:39 匯出](../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json)(含真實橫移)實跑:確認 `suspect` 判定符合修法後意圖,且 ε(t) 落在合理量級。
5. 決定性回歸零影響(sim 演進未動)。

---

## 7. Open Questions

| # | 問題 | 現況 | Owner |
|---|---|---|---|
| ~~**OQ-KI4-1**~~ | ~~資料層的正規單位域~~ | ✅ **關閉(2026-08-05)**:K-1 「雙域 + 顯式換算」;`CONTEXT.md` 於 S3 改寫 | 使用者 |
| ~~**OQ-KI4-3**~~ | ~~`px` 單調漂移屬行為還是缺歸位機制~~ | ✅ **關閉(2026-08-05)**:研究設計**允許選手自由位移**;不新增歸位機制,不對位移設紀律門檻 | 使用者 |
| ~~**OQ-KI4-4**~~ | ~~M14 ② 是否重新宣告~~ | ✅ **關閉(2026-08-05)**:K-2 撤回,S1 後重新宣告 | 使用者 |
| **OQ-KI4-2**(改寫) | 自由位移下,corridor 觀測項該記錄什麼粒度?(建議:`max|lateral|`(world u)+ 越界 tick 佔比,而非單一布林) | 🟡 **S1 已落布林**(`meta.validity.corridorExceeded`,見 T2);粒度升級待 S2 或研究者定義後另開 task。不阻塞 S1 | 研究者 |
| **OQ-KI4-5**(新) | 自由位移下,選手可能移出**場景淨空走廊**導致目標被道具視覺遮擋。依 GD-6 這**不會**影響命中判定,但會影響偵測/追蹤類 drill 的刺激可見性 —— 是否需要在報告層對「越界期間的 peek」加註? | 🟡 影響 WP-30/31 的資料篩選;不阻塞 S1 | 研究者 |
| ~~**OQ-KI4-6**~~(新) | ~~走廊語意拆分:`clearance.halfWidthU`(場景淨空取樣,現行 [clearance.ts:248](../../src/scene/clearance.ts#L248) 用途)與執行期觀測門檻是否拆成兩個欄位?後者在 K-3 下已非 gate,可能不需要獨立欄位~~ | ✅ **關閉(2026-08-06,T3)**:**不拆**。K-3 下 corridor 已非 gate,拆欄會新增兩個需人工同步的數字(D1-Option B 的既知缺點);`isOutsideCorridor` 直接消費現有 `SceneConfig.playerCorridor.halfWidthU`,零新增欄位(見 [KI-004-S1/progress.md](KI-004-S1/progress.md) S1-D11) | 實作者 |

---

## 8. 修改紀錄

**S1 已於 2026-08-06 落地**(K-1/K-2/K-3 全數兌現;詳細任務拆解/DoD 見 [KI-004-S1/](KI-004-S1/README.md),決策見 [BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-004「S1 落地」段)。

| Commit | Task | 內容 |
|---|---|---|
| `43675ab` | T1 | `SIM_TO_WORLD` 升引擎級常數(`src/loop/constants.ts`)+ `resolveEyeWorldBase` 單一來源(`src/scene/eyePose.ts`);四場景 camera 初始位置逐位不變 |
| `f6027ed` | T2 | 匯出自我描述:`meta.simToWorld` / `meta.scene.eye` / `meta.validity` 三個 additive 區塊(2026-08-05 拍板前拉自 S2);`meta.suspect` 逐位不變 |
| `465f986` | T3 | corridor gate 改 world 域比較(`src/scene/corridor.ts`)+ 依 K-3 脫離 `meta.suspect`(仍落 `meta.validity.corridorExceeded`) |
| `6f4b540` | T4+T5(合併,BD-001 TDD 偏離慣例) | 離線 ε(t) 原點改用 `eyeOrigin = base + (px,0,pz) × simToWorld`(`src/metrics/eyeOrigin.ts`);新增正確性閘 ①(`fire.offsetDeg` oracle)與 ②(閉式幾何,TS+Python 各一份);Python `angular.py` 同步 + 重產 parity fixture |
| （本次）| T6 | 帳本 / 里程碑對帳:M14 ② 重新宣告(見 [WP-28 progress.md](../exec-plan/active/stage4/wp-28-research-foundation/progress.md))+ 跨文件狀態收斂 |

**實測結果**(閘 ①,以引擎自身 `fire.offsetDeg` 為 ground truth;篩選 `aimPunchPitch/Yaw==0` 的合格首發,兩份真實 fixture 各僅 N=1):08:03 修法前 8.19°(紅)→ 修法後 0.000°(綠);09:39 修法前 88.53°(紅)→ 修法後 0.030°(綠)。閘 ② 兩側對閉式解相對誤差 ≤1e-9。回歸:`tsc --noEmit` exit 0、`npm run test:ci` 88 files/694 tests + 19 e2e 全綠、`uv run pytest` 183 passed,`src/sim`/`SharedState`/`SimLoop.step` 零 diff。

**S2(逐 tick eye world pose)/ S3(文件/ADR 單位敘述全面對帳)尚未落地**,不阻塞 M14 ② 的重新宣告。
