# T1 — 感度換算 CS2 化(0.022°/count)+ meta 語意標記

> Part of [WP-12 input-seams](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(標注方式已拍板) |
| **Risk / Cplx** | Low / Low |
| **Touches** | MODIFY `src/view/CameraController.ts`、`src/data/metadata.ts`、`src/main.ts`(collectMeta 呼叫)、`docs/operational/schema.md` + 測試 |
| **狀態** | ✅ 2026-07-06 |

## Objective

把佔位感度常數換成 CS2 語意,使壓槍的滑鼠補償距離對得上玩家在 CS2 的肌肉記憶
(練槍軟體的準功能性需求,稽核 A4);同刀標記匯出語意,保護跨階段資料可比性。

## In scope
- [CameraController.ts:19](../../../../../src/view/CameraController.ts):
  `const RAD_PER_COUNT = 0.0022;` → `THREE.MathUtils.degToRad(0.022)`(= 0.022×π/180
  ≈ 3.8397e-4 rad/count);註解改寫:CS2 語意、出處 GD-5,「佔位/pilot 校準」字樣退場。
- `metadata.ts`:`Meta` 型別 + `collectMeta` 增 `sensitivityModel: 'cs2-0.022deg'`
  (常數字串,由 collectMeta 內部填,不加呼叫端參數——語意跟實作綁定)。
- `schema.md` meta 節補欄位說明(含「無此欄 = 階段 A 佔位語意」註記)。

## Out of scope
- `DEFAULT_SENSITIVITY`/設定面板值域調整(手感校準屬 pilot;面板範圍若不敷使用記 OQ 給 WP-13 手動驗證時回報)。
- `schemaVersion` bump(WP-16)。

## Steps

- [x] 常數替換 + 註解;`CameraController` 既有測試更新期望值(若有寫死角度)。
- [x] 新測試:`sensitivity=1.0` 下 1000 counts → yaw 變化 = `degToRad(22)`(±1e-12);
      `sensitivity=2.0` → 線性 2 倍。
- [x] `collectMeta` 增欄 + 測試(payload 含 `sensitivityModel`);`assertFinitePayload` 等
      既有匯出測試不破。
- [x] `schema.md` 對帳(meta 節 + 變更註記)。
- [x] `npx vitest run` 全綠;`npm run typecheck` exit 0。

## Definition of Done

- 換算測試綠(兩個精度斷言);匯出 payload 含 `sensitivityModel`;schema.md 與 payload 一致;
  `git grep 0.0022 src/` = 0。

## Commit

`feat(wp-12): T1 感度換算 CS2 0.022deg/count + meta sensitivityModel 語意標記`
