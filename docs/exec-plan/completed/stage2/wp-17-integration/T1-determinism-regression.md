# T1 — 決定性回歸擴充(punch/彈著序列 × 多 FPS)

> Part of [WP-17 integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `tests/regression/determinism.test.ts`(或並列 NEW `tests/regression/spray-determinism.test.ts`)、NEW `tests/golden/recoil/spray-baseline.json` |
| **狀態** | ✅ PASS 2026-07-07 |

## Objective

FR-B16 落地:壓槍全狀態(punch、彈著)納入決定性回歸——同 seed 同合成輸入,
與 render FPS 無關;基準檔入 repo,成為 stage2 的長期防線。

## In scope
- 合成輸入序列 fixture:fire down(3s 滿匣)/ up + 合成 aim(含補償動作的固定序列),
  固定 `rngSeed`。
- 斷言(tick index 鍵,**不斷言 wall-clock**,沿用決定性慣例):
  - 兩次執行 → punch 序列(逐 recoil tick)與彈著序列(命中點 + spread 取樣)逐位一致;
  - pump 60 / 144 / 240 三檔 → 同序列。
- 基準檔:首跑鎖定,值先與 M5 golden 交叉 sanity(10 發 punch 向量須在序列中可辨識)
  → `tests/golden/recoil/spray-baseline.json`。

## Out of scope
- E2E(T2);移動軌跡 baseline(WP-14 已重錄,此處只消費不再動)。

## Steps

- [x] (2026-07-07 15:05Z) 合成輸入 fixture 定義(aim + fire 時刻表,註解記語意)。
- [x] (2026-07-07 15:05Z) 兩次執行一致測試 + 三 FPS pump 一致測試。
- [x] (2026-07-07 15:05Z) 基準檔鎖定 + M5 golden 交叉 sanity 記 progress。
- [x] (2026-07-07 15:05Z) `npx vitest run tests/regression` 全綠(含既有 M1 案例不退化)。

## Definition of Done

- 回歸測試綠(重複執行 × 3 FPS 皆一致);基準檔入 repo;斷言鍵為 tick index;
  既有決定性案例不退化。

## Commit

`test(wp-17): T1 決定性回歸擴充 — punch/彈著序列 × 60/144/240 FPS 基準入 repo`
