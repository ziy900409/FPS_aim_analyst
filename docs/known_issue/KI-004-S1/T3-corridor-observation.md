# T3 — corridor gate 改 world 域比較 + 依 K-3 脫離 `suspect`

> 交付 **FR-S1-3 / FR-S1-4**(+ FR-S1-15 的語意收尾)(KI-004 §5.1 S1 ②)· 上游:[S1 README](README.md) · 決策 [BD-004 K-3](../BUGFIX-DECISIONS.md)
> 依賴:**T2 已 commit**(`meta.validity.corridorExceeded` 已是匯出欄位,本 task 才能安心把它移出 `suspect` 而不遺失資訊)。

**In scope**:[main.ts:527](../../../src/main.ts#L527) 的 `afterTick` 比較式 · [main.ts:380](../../../src/main.ts#L380) 的 `suspect` 組裝 · 新增邊界掃描測試。
**Out of scope**:`meta.validity` 的欄位形狀(T2 已落)· corridor 觀測**粒度**升級(OQ-KI4-2 / TD-1b)· `clearance.halfWidthU` 是否拆欄(OQ-S1-4,**本 task 決定不拆**)。

---

## 缺陷回顧(一句話)

```ts
if (Math.abs(state.player.x) > activeSceneConfig.playerCorridor.halfWidthU) {   // ❌
//            ^ source unit                      ^ world unit
```

實際門檻 = 1 source unit = **0.01 world unit**,比設計意圖(±1 world unit)**緊 100 倍**;`vStrafe = 250 u/s` 下玩家在 **4 ms**(不到一個 sim tick)內就越界 ⇒ `meta.suspect` 語意反轉:**不動 = 可信、做急停 = 可疑**。

`halfWidthU` 確實是 world domain 的量 —— 同一常數在 [clearance.ts:248](../../../src/scene/clearance.ts#L248) `samplePlayerCorridor()` 被拿去跟 `propBounds`(GLTF world 座標)做淨空取樣。

---

## Steps

### 1. 紅測試先行(BD-001 的 TDD 偏離慣例:紅+綠合併為單一已驗證 commit)

- [ ] 新增邊界掃描測試(建議 `tests/regression/corridor-observation.test.ts`):
  - 以合成 state 讓 `player.x` 掃過 `halfWidthU / SIM_TO_WORLD`(`halfWidthU = 1` → **100 source unit**)的兩側。
  - 斷言 `state.validity.playerCorridorExceeded` 在 `|px| = 100` 附近翻轉,而**不是**在 `|px| = 1`。
  - 斷言 `|px| = 50`(= 0.5 world unit,走廊內)時旗標為 `false` —— 這條在修法前必為**紅**(現行實作 `50 > 1` → true)。
- [ ] 新增 `suspect` 語意測試:僅 corridor 越界(其餘 validity 來源皆 false、frames p95 未超地板)時,`meta.suspect === false` **且** `meta.validity.corridorExceeded === true` —— 亦即「事實被記錄、但 run 不作廢」。修法前為**紅**(現行 `suspect` 為 true)。
- [ ] 新增 `suspect` **只減不加**測試(NFR-S1-2b):其餘三個來源(session/protocol suspect、`perfFloor`、`recorderOverflow`)各自單獨為真時,`suspect` 仍為 `true`;`bufferOverflow` 單獨為真時 `suspect` 仍為 `false`(維持現行語意,**不得**被順手併入)。
- [ ] 在工作區實跑,**證實兩條為紅**,把輸出貼進 [progress.md](progress.md)。這是唯一能證明「測試真的在測東西」的步驟。

> 測試落點提醒:現行 `afterTick` 回呼是 [main.ts:526-530](../../../src/main.ts#L526) 的 inline closure,單元測試不易直接取用。允許在測試中複製比較式會**再造一份定義**(正是 KI-004 的病)。改法:把判定抽為具名純函式(例如 `src/scene/corridor.ts` 的 `isOutsideCorridor(playerX: number, halfWidthU: number, simToWorld: number): boolean`),`main.ts` 與測試共用同一份。

### 2. 修法

- [ ] `afterTick` 改為 world 域比較(D1-Option A,K-1 的落地形式):

```ts
afterTick(state): void {
  if (isOutsideCorridor(state.player.x, activeSceneConfig.playerCorridor.halfWidthU, SIM_TO_WORLD)) {
    state.validity.playerCorridorExceeded = true;
  }
},
```

- [ ] [main.ts:379-382](../../../src/main.ts#L379) 的 `suspect` 組裝**移除** `sharedState.validity.playerCorridorExceeded ||` 這一項(K-3:corridor 由「移動紀律 gate」降為「場景淨空覆蓋觀測項」)。
- [ ] 同步改寫該處註解:現行寫「純觀測 suspect:玩家逸出走廊(GD-6)、……」——**玩家逸出走廊已不再是 suspect 來源**,留著會誤導。新註解須說明 K-3 的理由:越出淨空走廊的真實後果是**視覺遮擋**,而依 GD-6 場景幾何永不進 sim,**不可能**影響命中判定 ⇒ 屬「該記錄的觀測」而非「該作廢的 run」。
- [ ] `state.validity.playerCorridorExceeded` **保留**(仍逐 tick 寫入),不刪欄位、不改 `SharedState` 形狀。

### 3. 觀測資訊的去向(OQ-S1-2 已關閉)

`meta.validity.corridorExceeded` 已於 **T2** 落地 ⇒ 越界事實**進匯出**,把它移出 `suspect` 不會遺失任何資訊。這正是「該記錄的觀測 vs 該作廢的 run」被分成兩個欄位的意義。

- [ ] 複查 T2 的 `meta.validity` 填入路徑仍指向同一個 `sharedState.validity.playerCorridorExceeded`(本 task 只改**寫入該旗標的條件**,不改讀取端)。
- [ ] 確認 `meta.validity.corridorExceeded` 的語意在 T3 後才**正確**(T2 期間搬運的是舊的 100× 過緊判定)—— 這一點必須寫進 [schema.md](../../operational/schema.md) 該欄的說明與 [progress.md](progress.md),避免日後有人拿 T2 與 T3 之間的中途版本解讀資料。
- [ ] (選配,零風險)在既有 dev overlay 掛一個唯讀 readout,讓 pilot 期間可目視越界狀態。**僅 `import.meta.env.DEV`**,不進 production build。

### 4. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— 特別確認 `src/loop/SimLoop.test.ts:106` 那條自帶 `0.05` 門檻的 afterTick 測試不受影響(它自建 closure,與本 task 的 main.ts wiring 無關)。

---

## Definition of Done

- [ ] 邊界掃描測試存在,且**修法前經實測為紅**(證據在 progress.md),修法後綠。
- [ ] 判定邏輯為具名純函式,`main.ts` 與測試共用同一份(無第二份比較式)。
- [ ] `meta.suspect` 的組裝**不含** `playerCorridorExceeded`;該處註解已改寫並標註 K-3。
- [ ] `suspect` **只減不加**:其餘三個來源各自單獨為真時仍為 `true`;`bufferOverflow` 未被併入(測試釘死,NFR-S1-2b)。
- [ ] `meta.validity.corridorExceeded` 在「僅越界」情境下為 `true`,與 `suspect === false` 並存(測試斷言兩者同時成立)。
- [ ] `state.validity.playerCorridorExceeded` 仍逐 tick 寫入(欄位與 `SharedState` 形狀不變)。
- [ ] 匯出 schema 零**新增**變更:本 task 不再動欄位(T2 已落),`schemaVersion` 維持 2。
- [ ] `git diff` 不觸及 `src/sim/`、`SimLoop.step` 的狀態轉移;決定性回歸案數與 T0 基線一致。
- [ ] `npx tsc --noEmit` exit 0 · `npm run test:ci` exit 0。
- [ ] OQ-S1-4(是否拆 `clearance.halfWidthU`)的決定記入 progress —— **預設不拆**,理由:K-3 下 corridor 已非 gate,拆欄會新增兩個需人工同步的數字。

## Commit message

```
fix(ki-004): corridor 觀測改 world 域比較 + 依 K-3 脫離 meta.suspect

KI-004 / S1 ②(FR-S1-3/4)。原比較式左式為 source unit、右式為 world unit,
實際門檻緊 100×(1 u = 0.01 world unit),vStrafe 250 u/s 下 4ms 即越界 ——
meta.suspect 語意反轉:不動 = 可信、做急停 = 可疑。

改為 |player.x| × SIM_TO_WORLD > halfWidthU;並依 K-3(允許選手自由位移)
把 corridor 從 suspect 來源拆除,降為純觀測項:越界的真實後果是視覺遮擋,
而場景幾何永不進 sim(GD-6),不可能影響命中判定。越界事實改由前一刀落地的
meta.validity.corridorExceeded 記錄 —— 事實被記錄、但 run 不作廢。

suspect 只減不加:其餘 OR 項(session/protocol、perfFloor、recorderOverflow)
逐位不變,bufferOverflow 維持不進 suspect(以測試釘死)。

TDD(BD-001 慣例):邊界掃描 + suspect 語意兩條測試先證實為紅,再修法轉綠,
紅綠合併為本 commit。sim 演進零改動,匯出欄位零新增。
```
