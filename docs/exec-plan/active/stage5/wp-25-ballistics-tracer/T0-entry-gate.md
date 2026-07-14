# T0 — Entry gate(GD-17 彈道參數域拍板 + 產彈點/命中鏈基線)

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(T1 前置;T2 另需 M11,於 T2 開工時複驗) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [DECISIONS.md](../../../DECISIONS.md)(GD-17)+ [CLAUDE.md](../../../../../CLAUDE.md) §4 候選 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅ PASS(2026-07-13) |

## Objective

動產彈點與命中鏈之前先鎖:彈道參數域(飛行時間 tick 數 → speedU/gravityU 表)、
未命中端點語意、現行開火→命中→記錄鏈的讀碼基線(T1/T3 的零破壞參照)。

## In scope

- **GD-17(OQ-S5-2)拍板**:彈道參數表定案——以飛行時間 tick 數(預設 8–32 tick)
  與下墜角尺寸(0.1–0.5× 目標角高)反推 2–3 組 `{speedU, gravityU, maxRangeU}` 武器檔,
  與 WP-23 遠距 drill 的距離檔位聯動(引用其 T0 反推表)→ 入 DECISIONS.md **GD-17**。
- **OQ-25.1**:未命中 tracer 端點語意定稿(hitscan:engagement plane 投影;
  projectile:消滅點)。
- **現況基線**(讀碼證據記 progress):
  - 產彈點 seam(`SimLoop` 產彈 → `recoilOnFire`/`sampleSpread` → `ballisticRaycast`)
    的呼叫序與方向合成(viewAngles + rawPunch×2 + spread);
  - 命中處理鏈(markKilled/pushImpact/事件寫入)的掛點清單;
  - `ImpactRing`/`ImpactView` pattern 對照表(T1 複製模板);
  - T3 零破壞閘沿用的既有測試清單(fire-determinism/recoil-wiring/決定性回歸)。
- **CLAUDE.md §4 候選**:「彈道模型 config-gated,hitscan 預設逐位不變;projectile
  演進 = 固定步長純函式(禁時鐘/禁 Math.random);子彈永不與場景幾何互動;
  tracer 只讀 SharedState 環形格」——與本 task 同 commit 回寫。

## Out of scope

- 任何 `src/` 變更;lead spec(T4)。

## Steps

- [x] `npm run test:ci` 乾淨基準 exit 0 記 progress。
- [x] GD-17 決議(參數表 + 反推依據)入 DECISIONS.md;OQ-S5-2/OQ-25.1 回填上層 §8/ledger。
- [x] 產彈點/命中鏈/ImpactView 基線讀碼證據記 progress。
- [x] T3 零破壞測試清單記 progress。
- [x] CLAUDE.md §4 追加候選約束(與本 task 同 commit)。
- [x] progress.md 記 entry-gate PASS 宣告(註記:T2 開工前另需 M11 ✅ 複驗)。

## Definition of Done

- GD-17 已入帳(具體數字表,非「傾向」);基線證據 + 測試清單記 progress;
  CLAUDE.md §4 含新約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-25): T0 entry gate — GD-17 彈道參數域拍板 + 產彈點/命中鏈基線`
