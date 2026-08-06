# T3 — `pushMouse` 補 pointer-lock 閘

> 交付 **FR-A-8** · 上游:[A README §2.4 ①](README.md) · 依賴:**T2 已 commit**。
> 性質:**輸入採集口徑修正**。本身是一行條件式,但**若不先做,T4 的守恆閘必破**。

**In scope**:`src/input/InputSampler.ts` 的 `onPointerMove` · 對應測試 · `docs/operational/schema.md` 的 `bufferOverflow` 口徑註記。
**Out of scope**:tick 窗積分(T4)· `InputRing` 的資料結構 · fire/ads 的既有閘(不動)。

---

## 這是計畫階段查碼才發現的缺口

[`InputSampler.onPointerMove`](../../../src/input/InputSampler.ts#L132) **無條件**把 coalesced 樣本推進 ring:

```ts
function onPointerMove(e: PointerEvent): void {
  const samples = e.getCoalescedEvents?.() ?? [e];
  for (const ev of samples) {
    if (!ring.pushMouse(ev.movementX, ev.movementY, ev.timeStamp)) meta.bufferOverflow++;
  }
}
```

而同一檔的 `onMouseDown`(fire)與右鍵 ads **都有** `isLocked()` 閘,理由逐字為「未鎖定不採計(避免取鎖點擊 / UI 點擊污染量測)」。

**目前無害**——`applyInput` 丟棄 mouse 事件,ring 裡的滑鼠樣本從未被任何人讀。
**T4 落地後就有害**——未鎖定時的滑鼠移動會被積分成角位移,而 camera 根本沒轉:

| 後果 | 說明 |
|---|---|
| 守恆閘(FR-A-9)必破 | `Σ dYaw` 會多出 camera 從未套用的位移 |
| ω(t) 出現幽靈峰 | drill 前後、Esc 解鎖期間的滑鼠移動全部變成「角速度」 |
| 與 fire/ads 口徑不一致 | 同一個 sampler 裡三類事件兩套規則,是下一個 KI 的溫床 |

> 這與 [KI-005 §6.2](../KI-005-omega-render-sim-aliasing.md) 發現 `meta.fovDeg` 缺席是同一性質:**不補就是把洞延後成另一個 KI**。

---

## Steps

### 1. 補閘

- [x] `onPointerMove` 開頭加 `if (!isLocked()) return;`,措辭與註解比照 `onMouseDown` 的既有理由。
- [x] 更新 `onPointerMove` 的 doc comment:說明此閘與 fire/ads 同源,且是 KI-005 / A 的 tick 窗積分正確性前提。
- [x] **不動** `onMouseUp` 的「不受 isLocked 閘門限制」設計(那是 stuck-fire / stuck-ads 防護,語意不同,見該函式註解)。

### 2. 口徑變更的可追溯性(FM-8)

- [x] `bufferOverflow` 的累加點口徑改變:mouse 分支自此**只可能在鎖定中**累加。
  - 只會**減少**入 ring 事件數(不會增加)⇒ 不可能製造新的 overflow。
  - 但**舊資料的 `bufferOverflow` 數不可與新資料直接比較**。
- [x] [schema.md](../../operational/schema.md) 的 `meta.bufferOverflow` / `meta.validity.bufferOverflow` 段落加一行:記錄口徑變更日期與理由(比照 [KI-004 T3](../KI-004-S1/T3-corridor-observation.md) 對 `corridorExceeded` 的處理)。
- [x] `progress.md` 記錄 T0 抄錄的累加點清單與本次差異。

### 3. 測試

- [x] 未鎖定時派送 `pointermove`(含 coalesced 多樣本)→ ring `size()` **不變**、`bufferOverflow` 不累加。
- [x] 鎖定中派送同一組事件 → ring 內容與時間戳**逐位不變**(對照 T3 前的行為;既有兩案沿用,零變動)。
- [x] 解鎖 → 移動 → 重新鎖定 → 移動:只有鎖定期間的樣本入 ring(涵蓋 Esc / 失焦情境)。
- [x] fire / ads / key 三類事件的既有行為**零變動**(回歸)。
- [x] 既有 e2e `input-sampler.spec.ts` 的「pointermove coalesced 子樣本各入 ring」案因本次閘門生效而轉紅(自動化無真實 Pointer Lock)——比照同檔既有 fire 案的負向路徑慣例改寫斷言,歸因記於 `progress.md`(FM-4 的同一紀律)。

### 4. 回歸

- [x] `npx tsc --noEmit`
- [x] `npm run test:ci`
- [x] `git diff --stat`:`InputSampler.ts` + 測試 + `schema.md` + `tests/e2e/input-sampler.spec.ts`(後者為 §3 步驟 5 anticipated 的 FM-4 改寫,非範圍外變更)。

---

## Definition of Done

- [x] `onPointerMove` 有 `isLocked()` 閘,措辭/註解與 `onMouseDown` 同源。
- [x] 未鎖定時 `pointermove`(含 coalesced 多樣本)**不入 ring**、`bufferOverflow` 不累加,有測試。
- [x] 鎖定中的 ring 內容與時間戳**逐位不變**,有測試。
- [x] fire / ads / key 三類事件行為零變動。
- [x] `schema.md` 記錄 `bufferOverflow` 的口徑變更(日期 + 理由 + 「舊新不可直接比較」)。
- [x] `progress.md` 記錄累加點差異(對照 T0 抄錄)。
- [x] `npx tsc --noEmit` exit 0;`npm run test:ci` exit 0。
- [x] `git diff` 不觸及 `src/sim/`、`SharedState` 演進、`SimLoop`、`src/data/`。

## Commit message

```
fix(ki-005): pointermove 入 ring 補 pointer-lock 閘,對齊 fire/ads 口徑

KI-005 / A(FR-A-8)。InputSampler 的 fire 與 ads 都有 isLocked() 閘(「避免
取鎖點擊 / UI 點擊污染量測」),唯獨 onPointerMove 無條件入 ring。目前無害
—— applyInput 丟棄 mouse 事件;但下一刀(tick 窗積分)落地後,未鎖定期間的
滑鼠移動會被積分成 camera 從未套用的角位移:守恆閘必破、ω(t) 出現幽靈峰。

口徑變更:mouse 分支的 bufferOverflow 自此只可能在鎖定中累加(只減不增,
不可能製造新 overflow),但舊新匯出的該欄不可直接比較 —— 已記入 schema.md。

onMouseUp 的「不受 isLocked 限制」設計不動(stuck-fire / stuck-ads 防護)。
```
