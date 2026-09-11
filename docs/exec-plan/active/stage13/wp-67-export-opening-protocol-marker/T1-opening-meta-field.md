# WP-67 T1 — `meta.opening` 欄位：型別、`collectMeta()` 驗證、`parseOpening()`

> FR-67.1／67.2／67.3／**67.4** · NFR-67.1／67.3 · D-67-2 · **FM-1** · [README §2.3](README.md)

## Objective

在資料層加上 `meta.opening`，並把本 WP 最容易被做錯的一條契約——**缺席不補預設**——同時以型別、parser 行為與測試三者釘死。

## 為什麼這是 High risk

repo 裡最近一條同型決策（[D-65-3](../../../DECISIONS.md)）走的是**相反**方向：optional-in / required-out，parse 時把缺欄補 `false`。照著抄是最自然的動作，而且抄了之後**所有測試都會綠**——錯誤只會在半年後有人把中間窗的資料混進 v0 池時才浮現（FM-1）。所以本 task 的斷言必須直接對準「缺席保持缺席」，而不只是對準「有值時讀得回來」。

## Steps

1. **型別**（[metadata.ts](../../../../../src/data/metadata.ts)）：新增 `OpeningMeta`，簽名與註解照 [README §2.4](README.md)。註解**必須**寫出「缺席 ≠ `immediate-v0`」以及它與 D-65-3 相反的理由——這段註解是 FM-1 的第一道防線。
2. **`Meta` 新增 `readonly opening?: OpeningMeta`**。放在 `validity` 之後、`weapon?` 之前（與其餘 additive 區塊同群）。頂層鍵集合恰多一鍵（NFR-67.3）。
3. **`CollectMetaArgs` 新增 `opening?: OpeningMeta`**，`collectMeta()` 以既有慣例驗證：
   - `protocol` 不在 `'immediate-v0' | 'armed-countdown-v1'` 之內 → 拋出指名 `opening.protocol` 的錯誤
   - `countdownMs` 非正有限數 → 拋出指名 `opening.countdownMs` 的錯誤（比照 `requirePositiveFiniteNumber`）
   - `args.opening === undefined` → 輸出**不帶** `opening` 鍵（不是帶 `undefined`，而是鍵不存在；canonical JSON 對兩者的位元組不同）
4. **`parseOpening()`**（[exportPayloadSchema.ts](../../../../../src/data/exportPayloadSchema.ts)）：比照 `parseValidity()` 的位置與錯誤回報形狀，但**行為刻意不同**——
   - `raw.opening === undefined` → 回 `undefined`，**不產生任何預設物件**
   - 形狀錯 → 推入 `errors` 並回 `undefined`（與既有 parse 慣例一致）
5. **測試**（`metadata.test.ts` ＋ `exportPayloadSchema.test.ts`），至少五條，案例名必須點出意圖：
   - `collectMeta` 省略 `opening` ⇒ `'opening' in meta === false`
   - `collectMeta` 帶合法 `opening` ⇒ 逐欄相等
   - `collectMeta` 帶非法 `protocol` / 非正 `countdownMs` ⇒ 各拋出**指名欄位**的錯誤
   - **FM-1 反證**：`parseExportPayload()` 吃一份無 `opening` 的 payload ⇒ `payload.meta.opening === undefined`（且 `'opening' in payload.meta === false`）
   - **FM-1 反證之二**：同一份 payload 經 `canonicalExportJSON()` 後**與 T0 記錄的 digest 逐字相同**
6. **NFR-67.1 驗證**：`CANONICAL_DIGEST_BEFORE_T5` 的 8 筆**一個字都不改**。若有任何一筆變紅 ⇒ 代表第 4 步補了預設值，**回頭修程式，不准改 digest 表**。

## Definition of Done

- [ ] `npx vitest run src/data` exit 0；新增五條案例（案例名逐條列入 `progress.md`）
- [ ] `CANONICAL_DIGEST_BEFORE_T5` 的 8 筆 digest 與 T0 記錄**逐筆相同**，且該表在本 commit 的 diff 中**零修改**（貼 `git diff -- src/data/exportPayloadSchema.test.ts | grep -c "^[+-].*digest"` 的輸出）
- [ ] `npx vitest run tests/regression` exit 0、fixture 零修改（`git status -- tests/` 為空）
- [ ] `npm run typecheck` exit 0
- [ ] `Meta` 頂層鍵集合恰多 `opening` 一鍵（以 `Object.keys()` 差集斷言，非目視）
- [ ] 型別註解已寫出「缺席 ≠ `immediate-v0`」與 D-67-2 的不對稱理由

## Commit

```text
feat(wp-67): add optional meta.opening without defaulting absent runs
```
