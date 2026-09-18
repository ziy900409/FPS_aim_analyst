# WP-71 T0 — Entry gate：編號、上游、baseline 與視覺決策

> FR-71.1～71.10 · OQ-71.1／71.2 · GD-15／GD-48

## Objective

在 production code 前，確認編號、依賴、現況基線與 cue 視覺語意；任何一項不成立就更新計畫，不把假設帶入 T1。

## Steps

1. 重查 `docs/exec-plan/README.md` 最大正式 WP、`DECISIONS.md` 最大 GD、`wp-71-*`／`GD-48` 是否被平行工作取用；若衝突依 GD-15 整包順延並更新全部連結。
2. 驗 WP-57、WP-65、WP-69 exit-gate 均已綠；記錄其 commit／證據連結。WP-70 只需確認不構成程式相依。
3. 跑基線：`npm run typecheck`、`npm run build`、`npx vitest run src/drill/spiderShotWide.test.ts src/sim/spiderEyeFrame.test.ts src/sim/TargetManager.test.ts src/render/TargetView.test.ts`、`npx vitest run tests/regression`，把精確 passed/skipped 計數記入 `progress.md`。
4. 建立現況反證：live countdown 中 `targets=0`、`tVisible=0`、visible event=0；running 首 tick 才各變為 1。記錄測試／debug 取得方式。
5. 複核 WP-67 仍未落 production，凍結 `meta.targets.openingCue` 與 `meta.opening.protocol` 的正交關係。
6. 產出兩種 cue 靜態 screenshot（wireframe neutral；transparent solid + outline），由使用者關閉 OQ-71.1；關閉 OQ-71.2。若未回覆，採 README default 並在 Decision Log 記錄。
7. 記錄 WebGPU baseline：countdown draw call／scene mesh 數、`frameLog` p95、FOV 60/75/120 的中心 anchor 畫面。

## Definition of Done

- [ ] WP/GD 編號重查證據具名，無衝突或已完整順延。
- [ ] 三個上游 exit-gate 證據連結齊全。
- [ ] typecheck/build/targeted Vitest/regression 的精確 exit code 與計數已入 `progress.md`。
- [ ] countdown/running 的 state + event 基線有可重跑證據。
- [ ] OQ-71.1／71.2 已關閉，或降為不阻塞且 default／owner／deadline 完整。
- [ ] draw call／mesh／p95 與三 FOV screenshot baseline 已保存。

## Commit

```text
docs(wp-71): T0 entry gate for opening target cue
```
