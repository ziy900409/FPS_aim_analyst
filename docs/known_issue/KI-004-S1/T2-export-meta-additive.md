# T2 — 匯出自我描述:`meta.simToWorld` + `meta.scene.eye` + `meta.validity`

> 交付 **FR-S1-13 / 14 / 15**(= KI-004 §5.1 **S2 ②③ + ① 的靜態部分,2026-08-05 使用者拍板前拉進 S1**)
> 上游:[S1 README §2.3a](README.md) · 依賴:**T1 已 commit**(需要 `SIM_TO_WORLD` 與 `resolveEyeWorldBase`)。
> 性質:**純 additive 資料模型,零語意變更**。corridor 的語意修正在 T3,ε 的原點修正在 T4;本 task 只把「還原原點所需的資訊」放進匯出。

**In scope**:`src/data/metadata.ts`(型別 + validator + `collectMeta`)· `src/data/export.ts`(`suspect` 組裝的相容路徑)· `src/main.ts`(填入三個新區塊)· `docs/operational/schema.md`(記錄新欄位)· `research/fixtures/exports/synthetic_counterstrafe.json`(補新 meta)。
**Out of scope**:**逐 tick** eye world pose(留 S2 —— 靜態 base 已足以還原原點,逐 tick 版屬 GD-7 raw-over-derived 的完整形式)· corridor 比較式與 `suspect` 語意(T3)· derivation(T4)。

---

## 為什麼這一刀值得前拉

KI-004 §2.3 的**結構性根因**:匯出記了射線的**方向**(`ticks[].aim`),卻沒記射線的**原點**;真實原點的三個片段分處 render / module 常數 / sim 三層,**都不在匯出裡** ⇒ 離線分析者在數學上無法還原,只能靠「約定」猜 —— 而約定猜錯了兩次(D2a、D2b)。

只修 derivation(T4)是把「猜」從錯的改成對的;**只有這一刀能讓「猜」這件事本身消失**。三個純量 + 一個布林區塊,additive、不 bump `schemaVersion`,是 S1 裡投報率最高的一刀。

> **實作坑(KI-004 §5.1 明文,必讀)**:eye pose **不可**從 render camera 讀 —— camera 位置是 render 以 `alpha` 內插的,讀它會讓匯出依賴 render 幀率,**破壞決定性並違反 ADR-2**。正確做法:在 **data/meta 層**以 `resolveEyeWorldBase(activeSceneConfig)`(T1 的純函式)決定性算出。`src/data` 不在 GD-6 的禁引用清單內,`meta.scene` 本就已進匯出,合規。

---

## Steps

### 1. `meta.simToWorld`(FR-S1-13)

- [ ] `Meta` / `CollectMetaArgs` 新增 `simToWorld?: number`;`collectMeta` 以 `requirePositiveFiniteNumber` 驗證,預設 `SIM_TO_WORLD`。
- [ ] `main.ts` 的 `collectMeta` 呼叫傳入常數(import 自 `src/loop/constants.ts`,不寫字面值)。
- [ ] 位置:**top-level**,與 `unit: 'source'` / `vStrafe` 同級 —— 它描述的是**兩個單位域之間的橋樑**,不隸屬任何場景。

### 2. `meta.scene.eye`(FR-S1-14)

- [ ] `SceneMeta` 新增 `eye?: { x: number; y: number; z: number }`(world domain);`requireSceneMeta` 三分量各以 `requireFiniteNumber` 驗證(**允許 0 與負值** —— `br-field` 的 `eyeZ: 0`,見 KI-002/D1)。
- [ ] `main.ts:403` 的 `scene:` 區塊填入 `resolveEyeWorldBase(activeSceneConfig)`。
- [ ] 掛在 `meta.scene` 底下的理由:eye base 是**場景推導量**,與 `sceneId` / `assetPackVersion` 同源;`simToWorld` 則不是,故分開。
- [ ] ⚠️ `meta.scene` 本身是 optional(`scene?: SceneMeta`)⇒ 缺席時 eye 也缺席。T4 的 `resolveEyeOrigin` 必須把「`meta.scene?.eye` 或 `meta.simToWorld` 任一缺席」視為 **miss**(退 `legacy-default`),不得只拿到一半就當 `'meta'`。

### 3. `meta.validity`(FR-S1-15)

- [ ] `Meta` 新增 `validity?: { corridorExceeded: boolean; perfFloor: boolean; recorderOverflow: boolean; bufferOverflow: boolean }`。
- [ ] `main.ts` 逐項填入現行既有來源:
  - `corridorExceeded` ← `sharedState.validity.playerCorridorExceeded`(**語意於 T3 修正,本 task 原樣搬運**)
  - `perfFloor` ← `frames.summary.p95 > PERF_FLOOR_MS`
  - `recorderOverflow` ← `snapshot.recorderOverflow`
  - `bufferOverflow` ← `sharedState.inputMeta.bufferOverflow`
- [ ] `suspect` **保持逐位不變**(向後相容):本 task 不增不減任何 OR 項。
  - 提醒:`bufferOverflow` **現行不在** `suspect` 的 OR 集合內。`validity` 記錄它是**新增觀測**,不是把它併進 `suspect`;把它併進去會是未經授權的語意擴大。
  - 補一條測試釘死:對同一組輸入,`meta.suspect` 在本 task 前後**逐位相同**。
- [ ] `export.ts:26` 的 `suspect: meta.suspect || recorderOverflow` 維持;若 `meta.validity` 存在,同步把 `validity.recorderOverflow` OR 上 `snapshot.recorderOverflow`(否則 `validity` 與 `suspect` 會對不上)。

### 4. schema 文件

- [ ] [schema.md](../../operational/schema.md) 新增三處:
  - `meta.simToWorld`(top-level 表,§「meta fields」)
  - `meta.scene.eye`(§`meta.scene` 表,第 121 行起)
  - `meta.validity`(新小節,說明四個布林的來源,並**明記** `suspect` 的 OR 集合與 `validity` 的集合**不相同**)
- [ ] 每欄註明「Additive;absence means pre-S1 export → 離線消費者須 fallback 並標記」。
- [ ] **只寫新欄位**;既有欄位的單位敘述對帳(`ticks[].px/pz` 是 source unit、`tx/ty/tz` 是 world)留 **S3**,在新欄位旁留一行 `TODO(S3)` 指路。

### 5. 合成 fixture 補欄

- [ ] `research/fixtures/exports/synthetic_counterstrafe.json` 補上 `meta.simToWorld` 與 `meta.scene.eye`,使 parity 鏈路實際走 `'meta'` 分支(T5 的 generator 會以 `strict=True` 跑)。
  - eye base 取一個**非零 z** 的值(例如 `field-low` 的 `(0, 1.6, 4)`),讓合成 fixture 也覆蓋 D2a 的情境。
  - ⚠️ 這會改變該 fixture 的 ε 期望值 ⇒ parity fixture 必須於 **T5** 重產。本 task 只改匯出 fixture,`epsilon-parity.test.ts` 的紅由 T4/T5 收尾(見 [README §4](README.md) 的 commit 顆粒度)。
- [ ] 兩份**真實** fixture(08:03 / 09:39)**不補欄** —— 它們是歷史匯出,必須保留為 `legacy-default` 的回歸樣本,證明 fallback 路徑與 strict 拋錯真的會發生。

### 6. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— `metadata.test.ts` / `export.test.ts` 需補新欄位的驗證案;既有 `suspect` 相關期望值**必須零變動**。

---

## Definition of Done

- [ ] `meta.simToWorld`、`meta.scene.eye`、`meta.validity` 三者均為 **optional additive**;`schemaVersion` 維持 `2`,無任何欄位被刪除或改名。
- [ ] eye base 由 `resolveEyeWorldBase(activeSceneConfig)` 產出,**未**從 `sceneManager.camera.position` 讀取(以 `git diff` 複查;違反即破壞決定性 + ADR-2)。
- [ ] `meta.suspect` 在本 task 前後**逐位相同**,並有測試釘死;`bufferOverflow` 未被併入 `suspect`。
- [ ] `requireSceneMeta` 的 `eye` 驗證允許 0 與負值(`br-field` 的 `eyeZ: 0`)。
- [ ] `schema.md` 記錄三個新區塊,含「缺席 = pre-S1 匯出」的 fallback 說明與 `TODO(S3)` 指路。
- [ ] `synthetic_counterstrafe.json` 已補欄且 eye base 的 `z ≠ 0`;兩份真實 fixture **未**被改動(`git diff` 複查)。
- [ ] `metadata.test.ts` / `export.test.ts` 補齊新欄位的 happy path + validator 拒絕案。
- [ ] `npx tsc --noEmit` exit 0;`npm run test:ci` 除 `epsilon-parity.test.ts`(因 fixture 補欄而變動,由 T5 收尾)外全綠。
- [ ] `git diff` 不觸及 `src/sim/`、`SharedState` 演進、`SimLoop.step`。

## Commit message

> 本 task 因 fixture 補欄會讓 `epsilon-parity.test.ts` 轉紅,依 [README §4](README.md) 的顆粒度說明,與 T4 + T5 **合併為單一已驗證綠的 commit**。commit message 見 [T5](T5-python-parity-sync.md)。
>
> 若實作時先把 fixture 補欄留到 T5 一起做,則本 task 可獨立綠燈 commit,message 如下:

```
feat(ki-004): 匯出自我描述量測原點 — meta.simToWorld / scene.eye / validity

KI-004 / S1(FR-S1-13/14/15;原 S2 ②③ + ① 靜態部分,經使用者拍板前拉)。
匯出過去只記射線方向(ticks[].aim)不記原點,原點的三個片段分處 render /
module 常數 / sim 三層且都不在匯出裡 —— 離線分析者在數學上無法還原,只能
靠約定猜,而約定猜錯了兩次(D2a 遺漏 camera base offset、D2b 遺漏 SIM_TO_WORLD)。

eye base 在 data 層以 resolveEyeWorldBase(sceneConfig) 決定性算出,
**不從 render camera 讀**(camera 位置經 alpha 內插,讀它會讓匯出依賴
render 幀率,破壞決定性並違反 ADR-2)。

純 additive:schemaVersion 維持 2,meta.suspect 逐位不變(語意修正在下一刀),
bufferOverflow 僅入 validity 觀測、未併入 suspect。
```
