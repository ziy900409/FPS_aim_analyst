# T0 — Entry gate(GD-16 感度模型拍板 + hold/toggle 語意 + 現況基線)

> Part of [WP-24 ads-optics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(M8 ✅ 為既成事實,驗證非執行) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [DECISIONS.md](../../../DECISIONS.md)(GD-16)+ [CLAUDE.md](../../../../../CLAUDE.md) §4 候選 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅ 2026-07-10 T0 PASS |

## Objective

動輸入鏈與相機之前先鎖:ADS 感度換算模型(研究構念,錯了跨條件不可比)、
hold/toggle 操作語意、與 fire 事件鏈的現況基線(T1 比照移植的參照)。

## In scope

- **GD-16(OQ-S5-1)拍板**:ADS 感度模型定案(計畫預設 CS2 式
  `sensitivity × sensitivityRatio × (adsFov/hipFov)`,ratio 預設 1.0)。
  含:模型選項對照(CS2 式 vs monitor-distance match)、選擇理由、
  pre-registered 凍結聲明 → 入 [DECISIONS.md](../../../DECISIONS.md) **GD-16**。
- **OQ-S5-6 拍板**:hold vs toggle(預設 hold);config 候補欄形狀記 ledger。
- **現況基線**:fire down/up 事件鏈讀碼證據(`EV_FIRE` packed 佈局、`heldFire` 維護、
  stuck-fire 防護掛點、consume 分桶語意)——T1 全面比照的移植對照表;
  `CameraController.applyDelta`/`setFov`/punch 分離註解現況;
  既有輸入鏈測試清單(T1 零破壞閘)。
- **CLAUDE.md §4 候選**:「ADS 只落輸入/render/data 層;ads 狀態(事件 + 逐 tick flag)
  必記錄」——與本 task 同 commit 回寫。

## Out of scope

- 任何 `src/` 變更(T1 起);overlay 視覺設計細節(T3)。

## Steps

- [x] `npm run test:ci` 乾淨基準 exit 0 記 progress。
- [x] GD-16 決議(模型 + 理由 + 凍結)入 DECISIONS.md;OQ-S5-1/S5-6 回填上層 §8。
- [x] fire 鏈現況對照表(EV_FIRE→EV_ADS 移植點清單)記 progress。
- [x] 既有輸入鏈測試清單(零破壞閘)記 progress。
- [x] CLAUDE.md §4 追加候選約束(與本 task 同 commit)。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- GD-16 已入帳(明確公式,非「傾向」);hold/toggle 定案;移植對照表 + 測試清單
  記 progress;CLAUDE.md §4 含新約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-24): T0 entry gate — GD-16 ADS 感度模型拍板 + fire 鏈移植基線`
