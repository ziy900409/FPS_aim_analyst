# T5 — 移動目標跨 FPS 決定性回歸 + drill registry 掛線整合

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4(移動目標 + 內插 + presentation + drill 就緒) |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/loop/__tests__/determinism.test.ts` + `tests/regression/`(移動目標跨 FPS 不變性)、`src/main.ts`(`tracking_v1` 進 drill registry);ADD 移動目標決定性 fixture |
| **狀態** | ⬜ |

## Objective

移動目標的決定性契約進回歸防線(M1 不變性擴到移動目標),並把 `tracking_v1` 掛進 app drill registry 使其可實機選取施測——WP-18 交付面在回歸套件上長期受保護。

## In scope
- **移動目標跨 FPS 決定性回歸**:沿用既有 determinism 套件模式(同輸入序列、不同 render FPS/frame 切法 → per-tick sim **狀態**逐位一致),新增移動目標案例:
  - 目標 per-tick `pos`(linear/pingpong/sine)逐位一致。
  - sub-tick 命中序列(fire 時間戳 → 命中/位置)逐位一致。
  - **不**斷言 wall-clock 時間戳(CLAUDE.md §4 決定性定義)。
- **既有 baseline 零破壞**:stage1/2 punch/彈著/spawn golden 全綠維持(移動目標為 additive 案例,不改既有 fixture)。
- **drill registry 掛線**([main.ts](../../../../src/main.ts):82-83 `drills` 陣列):`tracking_v1` 加入為可選取 drill;匯出 metadata 已含 `motion`([main.ts](../../../../src/main.ts):289),確認追蹤 drill 的 motion/seed/presentation 皆入 meta。
- **手動實機抽查**(記 progress,非自動閘):`tracking_v1` 在 app 可跑、目標平滑移動(render 內插)、無掉 tick、匯出含逐 tick `tx/ty/tz` 非常數(目標真的在動)。

## Out of scope
- 場景整合(`field-low`,WP-22 T1)、E2E(WP-22 T1 的追蹤 × 場景 E2E;本 WP 交付 drill 型,E2E 在消費端)、結果頁 UI。

## Steps

- [ ] 既有 determinism/regression 套件基準全綠(改動前)。
- [ ] 移動目標跨 FPS 不變性 fixture(pos + 命中序列逐位)+ 收編回歸套件。
- [ ] `tracking_v1` 進 drill registry + 匯出 meta(motion/seed/presentation)確認。
- [ ] 手動實機抽查(平滑移動 / 無掉 tick / tx-tz 非常數)記 progress。
- [ ] `npx vitest run` + `npm run test:ci` 全綠(exit 0)。

## Definition of Done

- 移動目標跨 FPS per-tick 狀態逐位一致進回歸套件;既有 baseline 零破壞;`tracking_v1` app 內可選取施測、匯出 motion/seed/presentation meta 完整、逐 tick 目標位置非常數;`test:ci` exit 0。

## Commit

`feat(wp-18): T5 移動目標跨 FPS 決定性回歸 + tracking_v1 drill 掛線整合`
