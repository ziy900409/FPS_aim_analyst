# WP-71 T5 — Live e2e、視覺／效能證據與全量回歸

> FR-71.1～71.10 · NFR-71.1～71.7 · FM-71.1～71.8

## Objective

用真 production path 證明 cue 可見、不可互動、不污染資料，並留下可比較的畫面與效能證據。

## Steps

1. 新增 live e2e，沿用既有 arm helper；在 countdown／running 兩個明確 phase 取證，不以固定 sleep 猜時間。
2. countdown 斷言：cue view visible；正式 `SharedState.targets=0`、`tVisible=0`、visible event=0；連點 fire 不會產 hit/kill/target id/RNG 變化。
3. running 首 tick 斷言：cue hidden；正式 center target visible；visible event 恰 1；cue descriptor 與 target pose/size/shape 逐位相等。
4. 覆蓋 Restart、換 weapon、換 scene、換 drill、Session Plan 下一 block，以及 pause→resume-countdown→active；確認 cue 不殘留、不在 resume countdown 顯示。
5. 產生 6 張命名 screenshot：1280×720、1920×1080，各 FOV 60/75/120；每組含 countdown cue 與 running target 可採同一組合成圖／metadata，記 viewport、DPR、FOV、aspect。
6. 記 draw call/mesh/p95：與 T0 baseline 比較，驗 NFR-71.3/71.4；透明路徑若超標，切 fallback 並重跑。
7. 匯出 payload：wide-v1 帶 `openingCue`、control drill 缺鍵；cue on/off 的正式 tick/event/target sequence 除 metadata 外逐位相等。
8. 全量驗證：`npm run typecheck` ×2、`npm run build`、`npx vitest run`、`npx vitest run tests/regression`、`npx playwright test --workers=1`；記精確計數與環境。
9. 修改 code 後執行 `npm run graph:update`，確認 graph HTML 保留。

## Definition of Done

- [ ] countdown/running 的 cue/state/event 反證來自 production path，案例名與數值已記錄。
- [ ] fire-on-cue 不可能命中的負向證據通過。
- [ ] 五條 lifecycle + pause/resume 全綠，無 stale mesh/resource。
- [ ] 6 組 viewport/FOV 視覺證據齊全，使用者 visual gate 結論已回填。
- [ ] +1 draw call/+1 mesh 上限與 p95 無新增 over-budget window 有實測數值。
- [ ] typecheck/build/Vitest/regression/Playwright 全部 exit 0，計數與 T0 差額可解釋。
- [ ] `npm run graph:update` exit 0 且 `graphify-out/graph.html` 存在。

## Commit

```text
test(wp-71): verify opening cue validity and presentation
```
