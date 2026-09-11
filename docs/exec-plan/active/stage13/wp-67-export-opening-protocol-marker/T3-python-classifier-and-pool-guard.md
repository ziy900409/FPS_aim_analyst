# WP-67 T3 — 離線分類器與混池 guard（Python）

> FR-67.5／67.6 · NFR-67.5 · C-D1／C-D2／C-D4 · D-67-4／D-67-5 · **FM-4／FM-5** · [README §0.3](README.md)

## Objective

把「這份匯出屬哪一種開場」變成**一個可執行的函式**，而不是一段散落在文件裡、每個分析腳本各自重寫一遍的規則；並讓「兩種協定混進同一池」在程式層面就爆掉。

## 為什麼分類器只能在 Python 側

中間窗（WP-65 落地後、WP-67 落地前）的匯出沒有 `meta.opening`，唯一指紋是**原始 JSON 裡有沒有 `meta.validity.pointerLockLost` 這個鍵**。TS 的 `parseValidity()` 會把缺欄補 `false`，所以 parse 之後這個指紋就消失了（README §0.3）。Python 的 `load_export()` 把 `meta` 原封當 dict 帶出（[loader.py:186](../../../../../research/src/modules/ingest/algorithms/loader.py#L186)），是唯一看得到原始鍵面的地方。⇒ 這不是「放哪邊比較順手」的問題，是**只有一邊做得到**。

同時這也解釋了 OQ-67.3 為什麼關閉：TS 側就算想做也做不出正確的第二實作，硬做只會製造 C-D4 禁止的第二定義。

## Steps

1. **新檔** `research/src/modules/ingest/algorithms/opening.py`：`OpeningProtocol` 型別別名、`classify_opening()`、`MixedOpeningProtocolError`、`require_single_protocol()`，簽名與 docstring 照 [README §2.4](README.md)。
   - **C-D2**：純函式。禁 matplotlib／`print`／file I/O——輸入是**已載入**的 `meta` dict 與 `Export` 序列，不自己讀檔。
   - `classify_opening()` 的四條規則依序短路，`unknown` 只在形狀不合時出現（不要把「缺欄」也歸 `unknown`，那會讓全部舊資料變成不可用）。
2. **不改 `loader.py`**。`load_export()` 已經把 meta 原封帶出，本 task 一行都不需要動它。若發現非改不可 ⇒ 先回頭確認是不是走偏了（改了它就可能破壞 FM-5 的前提）。
3. **fixtures**（`research/fixtures/exports/`）：三份最小 JSON，各自代表一個分類分支——
   - pre-WP-65：無 `opening`、無 `validity.pointerLockLost`
   - 中間窗：無 `opening`、**有** `validity.pointerLockLost`
   - WP-67 之後：有 `opening.protocol`
   
   三份都必須能通過 `load_export()`（schema v2 必填欄位齊全），否則測到的是 loader 不是分類器。
4. **測試** `research/src/modules/ingest/algorithms/tests/test_opening.py`，至少七條：
   - 三份 fixture 各自分類正確（三條）
   - `opening.protocol` 是未知字串 ⇒ `'unknown'`
   - **FM-5 反證**：把中間窗 fixture 的 `validity.pointerLockLost` 刪掉、改成 TS parse 後的形狀（即補上 `pointerLockLost: False` 的 pre-WP-65 meta）⇒ 斷言分類器回 `'armed-countdown-v1'`，並在測試名與註解寫明「**這是已知限制**：正規化過的 meta 不可餵入」
   - **FM-4 正向**：一池三份同協定 ⇒ `require_single_protocol()` 正常回傳該協定、不拋錯
   - 一池混兩種 ⇒ 拋 `MixedOpeningProtocolError`，且**錯誤訊息含兩邊的檔名**（斷言訊息內容，不只斷言有拋）
   - `allow_mixed=True` ⇒ 回 `'unknown'` 且不拋錯
5. **C-D1 覆核**：`opening.py` 不 import 任何 TS 產物；`src/` 沒有任何檔案 import 本模組（`git diff --stat main...HEAD -- src/` 在本 commit 應只含 T1/T2 的改動，不因本 task 增加）。

## Definition of Done

- [ ] `uv run pytest research/src/modules/ingest/algorithms/tests/test_opening.py` exit 0；七條案例名逐條列入 `progress.md`
- [ ] 三份 fixture 皆可被 `load_export()` 載入（測試中實際呼叫，非手寫 dict）
- [ ] 混池錯誤訊息含**檔名**的斷言已通過（貼出該斷言行）
- [ ] `git diff --stat -- research/src/modules/ingest/algorithms/loader.py` 為**空**
- [ ] `grep -rn "import" research/src/modules/ingest/algorithms/opening.py` 的輸出不含任何 TS／`src/` 路徑（C-D1，貼輸出）
- [ ] FM-5 的已知限制已寫在 docstring **與**測試名中

## Commit

```text
feat(wp-67): classify export opening protocol and guard mixed pools
```
