# T2 — 壓槍 drill 全鏈路 E2E(drill → 匯出 → 統計)

> Part of [WP-17 integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Med / Med |
| **Touches** | NEW `tests/e2e/spray-drill.spec.ts`(必要時 MODIFY `__fpsTest` debug API 最小擴充 fire(n)) |
| **狀態** | ✅ PASS 2026-07-07 |

## Objective

真瀏覽器(Playwright)驗證整條研究資料鏈:壓槍 drill 跑完 → 匯出 v2 → 統計/結果頁,
COI 斷言維持——stage2「能玩且資料可信」在 CI 常駐。

## In scope
- `__fpsTest` 驅動(沿用 `tests/e2e/full-drill.spec.ts` 的 drill 驅動模式):
  啟 drill → 合成 fire(30)(debug API,不硬測 pointer lock 真滑鼠)→ 結束 → 斷言:
  - 匯出 payload:v2 欄齊(`schemaVersion`、aimPunch、spread、recoilIndex、ammo)、30 筆 fire;
  - 統計 = 匯出不變式(E2E 層再驗一次);
  - 結果頁:軌跡對照區塊 DOM 存在(WP-16 T3 產物)。
- COI 斷言(`crossOriginIsolated === true`)於本 spec 重申(沿用 isolation.spec 模式)。
- debug API 若缺合成 fire(n) 入口 → 最小擴充(dev/test-only 路徑,production 剝除慣例)。

## Out of scope
- 真滑鼠 / pointer lock 硬測(既有 input-sampler.spec 涵蓋);效能量測(驗收清單 B 抽查);
  多 FPS pump(T1 已在 vitest 層覆蓋)。

## Steps

- [x] spec 撰寫(drill 驅動 + fire(30) 合成)。
- [x] 四組斷言:匯出 v2 / 統計不變式 / 結果頁 DOM / COI。
- [x] `npx playwright test spray-drill` 綠。
- [x] `npm run test:ci` 全綠。

## Definition of Done

- Playwright 綠且斷言覆蓋四點(匯出 v2、統計、呈現、COI);`test:ci` exit 0;
  debug API 擴充(若有)不出現在 production build。

## Commit

`test(wp-17): T2 壓槍 drill 全鏈路 E2E(drill → 匯出 v2 → 統計,COI 維持)`
