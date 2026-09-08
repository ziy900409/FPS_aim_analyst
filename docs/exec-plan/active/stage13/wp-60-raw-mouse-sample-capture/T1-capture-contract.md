# WP-60 T1 — 擷取契約：Arena／型別／Strict Parser

## Objective

依 T0 凍結的格式建立原始取樣的**資料契約**：preallocated arena、additive optional 匯出型別、strict parser 與 provenance metadata。本 task **不接線**（不動 `SimLoop`）—— 契約先凍結，擷取路徑在 T2。

## Inputs to read

- [README.md](README.md) §2.3 Interface contracts、§2.4 容量與體積推算、§2.5 決定性契約衝擊。
- T0 收斂的 OQ-60.2（序列化格式）／OQ-60.3（Pointer Lock 事件）／OQ-60.5（容量常數）。
- `src/data/RingBuffer.ts`（`TickArena` 的 typed-array 配置與 `recorderOverflow` 慣例）。
- `src/data/DataRecorder.ts`（`recordKeyEvents` 這個 additive 選配錄製的既有先例）。
- `src/data/exportPayloadSchema.ts`（WP-50 `meta.replay` 的 strict／absent 先例）。
- `CONTEXT.md`（**命名前必讀**；本 task 新增術語需回寫）。

## Steps

1. 新增 `src/data/mouseSampleArena.ts`：`MouseSampleArena`（三個 `Float64Array`，建構期一次配置）+ `mouseSampleCapacityForDrill()`。滿了回 `false` 並設 `overflow`，**丟棄末端、不繞圈**（README §2.5 有理由）。
2. 在 `DataRecorder` 加 `recordMouseSample(dx, dy, tMs)` 與 `recordMouseSamples?: boolean`（**預設 `false`**）；`accumulateMouse` **一行不動**；`snapshot()` 在關閉時**不輸出**該區塊。
3. 匯出型別 additive：`ExportPayload.mouseSamples?: MouseSampleBlock`、`Meta.mouseSampling?: MouseSamplingMeta`。缺席合法。
4. 依 OQ-60.3 落地 Pointer Lock 中斷的記錄方式（建議 additive optional `pointer_lock` DrillEvent，比照 `key` 事件的選配紀律）。
5. 擴充 `parseExportPayload()`：缺席合法；**宣稱但形狀不符**（三個 columnar 陣列不等長、`dtUs` 有負值、`t0Ms` 非有限）產生**指名欄位**的 typed error。
6. 建 fixture 矩陣：legacy（無區塊）／有效區塊／不等長／負 `dtUs`／溢位／`recorded > capacity`，各正負向一例。
7. 跑既有 export round-trip、golden、metrics、history parser 回歸；**期望值零修改**。
8. 量測序列化耗時（README §3.3 指出這是 drill 結束後的一次性成本），記入 `progress.md`。
9. 在 `CONTEXT.md` 定義新術語：**原始滑鼠取樣 (raw mouse sample)**、**時間間隙 (time gap)**、**取樣區段 (sample segment)**。⚠️ **不得使用 `LOD` 縮寫**（與 `THREE.LOD` 衝突，README R7）。

## Invariants

- `recordMouseSamples` 關閉時，匯出 JSON 與本 WP 之前**逐位相同**（含 key 順序）。
- `TickRecord` 既有欄位、`DrillEvent` 既有成員語意、`meta.schemaVersion` **不變**。
- `mouseSampling.overflow` **不得** OR 進 `meta.suspect`（FR-60.9）—— tick 資料仍然有效。
- arena 於建構期一次配置；`record()` 內零 `push`、零物件配置。
- 本 task 不 import DOM／`three`；不讀時鐘（時間戳由呼叫端傳入）。

## Definition of Done

- [ ] `MouseSampleArena` 單元測試：容量邊界（滿前一筆／恰滿／滿後一筆）、`overflow` 轉態、`reset()` 清空、`snapshot()` 三陣列等長。
- [ ] 關閉錄製時，既有 export round-trip fixture 的序列化輸出與 `git show HEAD:` 版本**逐位相同**（測試以字串比對釘死，非「看起來一樣」）。
- [ ] strict parser 的六格 fixture 矩陣全綠；四種非法形狀各自擲出**指名該欄位**的 typed error（斷言錯誤訊息含欄位名，非只斷言 throw）。
- [ ] `meta.mouseSampling.overflow = true` 時 `meta.suspect` 不變的斷言通過。
- [ ] 既有全量 Vitest 綠、既有 golden／determinism／export 測試**期望值零修改**（`git diff` 可證）。
- [ ] `npm run typecheck`（兩個 tsconfig）exit 0；`npx vite build` exit 0。
- [ ] 60 s 規模樣本的 `JSON.stringify` 耗時記入 `progress.md`（含測法）。
- [ ] `CONTEXT.md` 新增三個術語；全 repo 無 `LOD` 縮寫命名。

## Commit

```text
feat(data): add raw mouse sample capture contract
```
