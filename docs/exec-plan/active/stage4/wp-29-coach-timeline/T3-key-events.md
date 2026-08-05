# T3(選配,gated)— `DataRecorder` additive `key` 事件

> Part of [WP-29 coach-timeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **本 task 預設不執行。** 只有 [T2](T2-sync-precision.md) 判定為 `insufficient` 時才展開;判定為 `sufficient` → 標 **skipped**;判定為 `blocked-by-data` → 標 **deferred**(等 OQ-S4-9 樣本後重跑 T2 評估)。

| | |
|---|---|
| **相依** | **T2 判定 = `insufficient`**(唯一觸發條件) |
| **Risk / Cplx** | Med / Low — 改動小但**跨越 research/engine 邊界**,是本 stage 唯一動 `src/` 的非 WP-32 task |
| **Touches** | MODIFY [`src/data/DataRecorder.ts`](../../../../../src/data/DataRecorder.ts)(`DrillEvent` 加 `key` variant)、[`src/loop/SimLoop.ts`](../../../../../src/loop/SimLoop.ts) `applyInput`(記錄點)、[`schema.md`](../../../../operational/schema.md)(additive 對帳)、對應 vitest;MODIFY `research/src/modules/metrics/algorithms/peek.py`(優先取 `key` 事件) |
| **狀態** | ⬜ (gated) |

## Objective

FR-D10:當 `t_release` 的 ±1 tick 量化被證實吃掉 Sync 族的效應量時,把鍵的 down/up 以 **input `timeStamp`** 精度記進匯出——**additive、data 層、sim 零侵入**,且不破壞任何既有決定性 baseline。

## In scope

- **`DrillEvent` 新增 variant**:`{ type: 'key'; code: string; down: boolean; t: number }`
  - `t` = input event `timeStamp`(與 `counter`/`fire` 同基準,`performance.now()` 時鐘域);
  - `code` 沿用既有 canonical 名(`A`/`D`/`W`/`S`,對齊 `ticks[].keys` 詞彙),**不引入第二套鍵名慣例**。
- **記錄點**:[`SimLoop.applyInput`](../../../../../src/loop/SimLoop.ts) 的 `ev.type === 'key'` 分支——與既有 `counter` 判定**並列**寫入,不改 `state.held` 的更新順序、不改 `counter` 事件的觸發條件。
- **schema 政策**:`key` 為 **additive optional** 事件型別;**不 bump `schemaVersion`(維持 2)**;舊匯出缺席 = 該功能未啟用(非錯誤)。CSV events header 追加對應欄位或沿用既有 `key`/`down` 欄(以不新增欄為優先,對帳寫 `schema.md`)。
- **research 側消費**:`build_peek_windows` 在 `key` 事件存在時以其推導 `t_release`(sub-tick),缺席時 fallback 回 `ticks[].keys`(±1 tick),並以 flag 區分兩條路徑(`release_from_key_event` / `release_from_tick_keys`)。
- **重跑 T2 判定**:以新精度重跑 `evaluate_release_precision`,判定值寫 progress。

## Out of scope

- 任何 sim 狀態、命中判定、輸入消費順序的改動(GD-6/ADR-2 紅線)。
- `RawInputTrace` / schema v3 / polling rate 實驗(stage4 §2.1 out of scope,P3)。
- 為 `key` 事件新增 UI 或結果頁欄位(WP-32 才碰結果頁)。

## Steps

- [ ] `DataRecorder.ts`:`DrillEvent` 加 `key` variant(型別 + 記錄計數不受影響)。
- [ ] `SimLoop.applyInput`:key 分支追加 `recorder?.recordEvent({ type:'key', ... })`;確認 `counter` 條件與 `state.held` 更新順序逐位不變。
- [ ] vitest:新事件寫入/欄位正確 + **既有決定性測試零修改全綠**(`npm run test:ci`)。
- [ ] `schema.md`:`events[].key` 章節 + CSV 對帳 + 「additive、不 bump schemaVersion」明文。
- [ ] `peek.py`:雙路徑 `t_release` + flags;單元測試(有 key 事件 / 無 key 事件 / 混合)。
- [ ] 重錄一份含 strafe 的匯出(OQ-S4-9 樣本或新錄)→ 重跑 T2 評估,判定寫 progress。
- [ ] 兩閘輸出貼 progress。

## Definition of Done

1. **既有 baseline 零重錄**:`npm run test:ci` exit 0,且**沒有任何既有 golden / 決定性 fixture 被修改**(`git diff --stat` 證據:`tests/golden/` 內既有檔案零變更)。
2. `meta.schemaVersion` 仍為 `2`;既有 v2 匯出(無 `key` 事件)在 `load_export` 與 `computeMetrics` 下行為逐位不變(回歸測試)。
3. 新事件 vitest 綠:down/up 各一、`t` 取 input `timeStamp`、`code` 使用 canonical 名。
4. `schema.md` 含 `key` 事件表(欄位/型別/來源/必填性)+ CSV 對帳 + additive 政策一句話;[../README.md §9](../README.md) 文件對帳項打勾。
5. `peek.py` 雙路徑測試綠;`t_release` 來源以 flag 可辨識。
6. **重跑後的 T2 判定**寫入 progress(新 `n` / 樣本 SD / 量化 SD / 判定);若仍 `insufficient` → 記為已知限制並開 OQ,**不再擴大改動**(P3 儀器研究不在本 stage)。
7. progress 記錄本 task 的**觸發證據**(T2 判定原文引用),證明非自發性動引擎。

## Commit

`feat(wp-29): T3 additive key 事件(input timeStamp 精度 t_release;schemaVersion 不變、golden 零重錄)`
