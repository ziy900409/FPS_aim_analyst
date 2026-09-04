# WP-56 — Task Checklist

> 主規格：[README.md](README.md) · 執行紀錄：[progress.md](progress.md)

## T0 — Entry Gate

- [ ] 讀當時 `AGENTS.md`、Graph Report、CodeGraph status與相關 Stage 12／active plans。
- [ ] 記錄 `DrillConfig`、schema、TargetManager、DrillRunner、SimLoop、SceneManager、main registry 的最新 impact。
- [ ] 凍結 FOV、yaw/pitch bounds、target angular size、separation、distance與 quota/time policy。
- [ ] multi-target bounded sampling、single-hit replacement與 GLTF scene方案 PoC有可重現 evidence。
- [ ] OQ-56.2～5 有 owner-confirmed 結論或明確 blocked owner/deadline。
- [ ] production code diff=0，PoC artifacts清除。

## T1 — Contract and Fixtures

- [ ] optional population、pitch/separation與translation policy types完成。
- [ ] strict schema合法／非法組合與field-path errors完成。
- [ ] 所有 legacy drill fixtures parse／trace相容。
- [ ] `micro_flick_three_target_test_v1` practice config與scene binding完成。
- [ ] Assessment/history/full replay未被註冊的負向測試成立。

## T2 — Three-target Lifecycle

- [ ] 初始 tick補滿三個 unique visible/alive targets。
- [ ] 命中只替換 exact ID，兩個 survivors ID/position不變。
- [ ] replacement ≤1 sim tick；spawn budget尾段與end condition正確。
- [ ] restart同seed sequence hash一致；不同seed有反空洞差異。
- [ ] 10k spawn bounds/separation與30/60/144/240 FPS parity全綠。

## T3 — Corridor Scene and Presentation

- [ ] GLTF environment allowlist與no-weapon/no-target inventory gate通過。
- [ ] camera、FOV、eye pose、panel geometry、lighting與end-wall depth符合凍結契約。
- [ ] sphere visual/hitbox同源；TargetView pool最大為3。
- [ ] scene load、fallback、rapid switch、dispose與50-cycle resource test全綠。
- [ ] 1080p/720p projection safe-region與contrast自動量測達標。

## T4 — Fixed Player, Hit and HUD

- [ ] locked policy下W/A/S/D不改player/camera base，mouse yaw/pitch仍有效。
- [ ] multi-target nearest raycast、exact target-id hit與miss/no-replacement tests全綠。
- [ ] visible/fire/hit event target IDs與sim timestamps一致。
- [ ] Crosshair中心各軸誤差≤1 CSS px；HUD scope符合README。
- [ ] micro-flick replay不是full；Practice不寫history。

## T5 — Automated Integration and Performance

- [ ] Playwright happy path：載入→三靶→命中補位→完成→restart。
- [ ] failure path：asset fail、rapid scene switch、stale target ID、miss與dispose。
- [ ] P95 target tick/render、cached first frame與1k replacement resource gate達標。
- [ ] typecheck、Vitest、build、Playwright與legacy determinism regressions全綠。
- [ ] commands、環境、samples與結果寫入progress。

## T6 — Visual Acceptance

- [ ] 1920×1080與1280×720 approved screenshots完成。
- [ ] 對稱走廊、中央消失點、灰白分層、深色天花板、panel rhythm與紅球對比逐項通過。
- [ ] 畫面無槍、手、muzzle、editor、FPS counter或ammo bar。
- [ ] owner完成OQ與visual sign-off，差異與允許偏差寫入progress。

## T-exit

- [ ] FR-56.1～15與NFR-56.1～9都有客觀 evidence。
- [ ] practice-only／no-full-replay／no-history boundary有自動測試。
- [ ] 全測試、perf、resource、visual與failure matrix通過。
- [ ] README、task-checklist、progress與上層Stage 12索引（若存在）同步。
- [ ] `graphify update .`、CodeGraph pending、git status/diff/staged names完成對帳。

## Commit discipline

每個 task 單獨 commit；建議 subject 見各 task file。完成 task 後同步本清單與 [progress.md](progress.md)。

