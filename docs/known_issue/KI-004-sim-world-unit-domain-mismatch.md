# KI-004 — sim domain(source unit)與 world domain 混用:corridor gate 100× 過緊 + 離線 ε(t) 原點錯尺度

> 類型:單位域(unit domain)一致性 bugfix 診斷 + 修改計畫(tech spec)。
> 狀態:**🔴 診斷完成,修法待拍板**(2026-08-05)。**尚未動任何程式碼。**
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-004。
> 發現路徑:排查「[counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json](../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json) 為何零位移」時,重現用的第二份匯出暴露此問題。

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

### 1.2 潛在症狀(更嚴重):離線 ε(t) 的觀察者原點錯 100 倍

同一根因也落在 [`trackingDerivation.ts`](../../src/metrics/trackingDerivation.ts) / [`detectionDerivation.ts`](../../src/metrics/detectionDerivation.ts) 的 `p_eye`。ε(t)、on-target、TOT%、`t_acquire`、`t_detect`、`eccentricity_at_spawn` 在 `px ≠ 0` 時全部失真。**08:03 那份 `px ≡ 0`,恰好把這個 bug 完全遮住**(見 §4)。

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

### 2.3 D2 — 離線推導的 `p_eye`

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
| 離線 ε(t)/on-target/TOT%/`t_acquire` | `px ≠ 0` 時原點錯 100×,值無效 | **High**(研究效度) |
| `t_detect`/`eccentricity_at_spawn`(GD-8) | 同上 | **High** |
| **M14 ② ε parity** | 數值仍成立(Python 與 TS 逐位一致),但**只在 `px ≡ 0` 的 fixture 上有意義**;構念正確性未被驗證 | **需加註,非撤回** |
| stage4 WP-30/31 | 全部逐段軌跡指標建在 ε(t) 上 → 一旦用含橫移的匯出即失真 | **High**(阻塞) |
| WP-29 T1/T2 | **不受影響**:peek 時間軸與 Sync 族只吃 `events` 與 `ticks[].keys`,不碰 `px/pz` | 無 |
| 引擎命中/彈道/offsetDeg | **不受影響**:全部經 camera,兩端同為 world domain | 無 |
| 決定性(determinism) | **不受影響**:sim 演進未變,只是與 world 幾何的換算缺失 | 無 |

---

## 4. 為何既有測試與 parity 閘沒有抓到

三層防護同時失效,值得記錄:

1. **唯一的真實 fixture `px ≡ 0`**。08:03 那份完全沒有鍵盤輸入 → `p_eye = (0, 1.6, 0)` 恰好等於真正的 world 原點 → ε(t) 在該檔上**碰巧正確**。M14 的真實資料檢核因此無法暴露 D2。
2. **ε parity 是對表,不是效度驗證**。Python [angular.py:127](../../research/src/modules/kinematics/algorithms/angular.py#L127) 忠實移植了 TS 的 `origins = (px, eye_height, pz)`,兩側**同樣錯**,相對誤差仍 ≤1e-9 → 閘門綠燈。這是 C-D4「TS 為既有構念權威」的固有盲區:對表只能保證兩實作一致,不能保證構念正確。
3. **合成 fixture 不含橫移**。`make_synthetic_export` 的 `px` 由 `vx * dt` 累加,但幾何 fixture 用的是 ε=0 / 已知偏角的靜態情境,未涵蓋「玩家橫移 + 固定目標」的交叉。

---

## 5. 修法候選(待拍板;本文件不預設結論)

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

**先決問題**:`CONTEXT.md` 的「正規單位 = source unit、資料不得用公尺」與現況(目標/hitbox/eyeHeight 皆為公尺尺度)牴觸。修法拍板前需先決定**哪一個域是資料層的正規域**,否則任何修法都只是把不一致搬家。此為 §7 的 OQ-KI4-1。

---

## 6. 驗證計畫(修法落地時的 DoD)

1. **紅測試先行**(比照 BD-001 的 TDD 偏離慣例:紅綠合併為單一已驗證 commit):
   - D1:以 `px` 掃過 `halfWidthU * (1/SIM_TO_WORLD)` 邊界的合成 state,斷言 gate 在**正確門檻**翻轉。
   - D2:合成「玩家橫移 + 已知目標幾何」fixture(手算 ε),斷言 `deriveTrackingMetrics` 回傳手算值;此測試在修法前必須**紅**。
2. `npm run test:ci` exit 0(既有 82 files / 641 tests + 19 e2e 零迴歸)。
3. `uv run pytest` exit 0;Python 側同步修正後**重產** `research/fixtures/parity/epsilon-*.json`,並在 [WP-28 progress.md](../exec-plan/active/stage4/wp-28-research-foundation/progress.md) 補記 M14 ② 的重新宣告。
4. 以 [09:39 匯出](../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json)(含真實橫移)實跑:確認 `suspect` 判定符合修法後意圖,且 ε(t) 落在合理量級。
5. 決定性回歸零影響(sim 演進未動)。

---

## 7. Open Questions

| # | 問題 | 影響 | Owner |
|---|---|---|---|
| **OQ-KI4-1** | 資料層的正規單位域到底是 source unit 還是 world unit?`CONTEXT.md` 聲明前者,但 `tx/ty/tz`/`hitbox`/`eyeHeight` 實作為後者 | 決定 D1/D2 所有 Option 的取捨;不決定就修 = 把不一致搬家 | 使用者 / 研究者 |
| **OQ-KI4-2** | 修法後 09:39 這份(world domain 位移 −1.69,超出 ±1 走廊)**仍會**是 suspect。走廊 ±1 world unit 對 counter-strafe drill 是否合理?或應改為「單向漂移量」而非絕對位移? | 走廊寬度定值;影響往後每份 pilot 資料的可用性 | 研究者 |
| **OQ-KI4-3** | 09:39 的 `px` 從 0 單調漂到 −169(未在原點附近振盪)。屬受試者行為,還是 drill 缺少歸位機制? | 影響 OQ-KI4-2 的定值方式 | 研究者(**已於 2026-08-05 詢問,未回覆**) |
| **OQ-KI4-4** | M14 ② 是否需要重新宣告?(數值未變,但構念正確性的證據基礎改變) | stage4 里程碑帳面 | 使用者 |

---

## 8. 修改紀錄

尚未修改任何程式碼。本文件僅為診斷 + 修改計畫。
