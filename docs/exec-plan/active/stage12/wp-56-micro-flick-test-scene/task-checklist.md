# WP-56 — Task Checklist

> 主規格：[README.md](README.md) · 執行紀錄：[progress.md](progress.md)

## T0 — Entry Gate

- [x] 讀當時 `AGENTS.md`、Graph Report、CodeGraph status與相關 Stage 12／active plans。
- [x] 記錄 `DrillConfig`、schema、TargetManager、DrillRunner、SimLoop、SceneManager、main registry 的最新 impact。
- [x] 凍結 FOV、yaw/pitch bounds、target angular size、separation、distance與 quota/time policy（2026-09-04 使用者以明確T1實作指令採Candidate A + 60 kills）。
- [x] multi-target bounded sampling、single-hit replacement與 GLTF scene方案 PoC有可重現 evidence。
- [x] OQ-56.2～5 有 owner-confirmed 結論或明確 blocked owner/deadline。
- [x] production code diff=0，PoC artifacts清除。

## T1 — Contract and Fixtures

- [x] optional population、pitch/separation與translation policy types完成。
- [x] strict schema合法／非法組合與field-path errors完成。
- [x] 所有 legacy drill fixtures parse／trace相容。
- [x] `micro_flick_three_target_test_v1` practice config與scene binding完成。
- [x] Assessment/history/full replay未被註冊的負向測試成立。

## T2 — Three-target Lifecycle

- [x] 初始 tick補滿三個 unique visible/alive targets。
- [x] 命中只替換 exact ID，兩個 survivors ID/position不變。
- [x] replacement ≤1 sim tick；spawn budget尾段與end condition正確。
- [x] restart同seed sequence hash一致；不同seed有反空洞差異。
- [x] 10k spawn bounds/separation與30/60/144/240 FPS parity全綠。

## T3 — Corridor Scene and Presentation

- [x] GLTF environment allowlist與no-weapon/no-target inventory gate通過。
- [x] camera、FOV、eye pose、panel geometry、lighting與end-wall depth符合凍結契約。
- [x] sphere visual/hitbox同源；TargetView pool最大為3。
- [x] scene load、fallback、rapid switch、dispose與50-cycle resource test全綠。
- [x] 1080p/720p projection safe-region與contrast自動量測達標。

## T4 — Fixed Player, Hit and HUD

- [x] locked policy下W/A/S/D不改player/camera base，mouse yaw/pitch仍有效。
- [x] multi-target nearest raycast、exact target-id hit與miss/no-replacement tests全綠。
- [x] visible/fire/hit event target IDs與sim timestamps一致。
- [x] Crosshair中心各軸誤差≤1 CSS px；HUD scope符合README。
- [x] micro-flick replay不是full；Practice不寫history。

## T5 — Automated Integration and Performance

- [x] (2026-09-07) Playwright happy path：載入→三靶→命中補位→完成→restart。
- [x] (2026-09-07) failure path：asset fail、rapid scene switch、stale target ID、miss與dispose。
- [x] (2026-09-07) P95 target tick/render、cached first frame與1k replacement resource gate達標。
- [x] (2026-09-07) typecheck、Vitest、build、Playwright與legacy determinism regressions全綠。
- [x] (2026-09-07) commands、環境、samples與結果寫入progress。

## T6 — Visual Acceptance

- [x] (2026-09-07) 1920×1080 initial/replacement/fallback與1280×720 initial approved screenshots完成，含metadata。
- [x] (2026-09-07) 對稱走廊、中央消失點、灰白分層、深色天花板、panel rhythm與紅球對比逐項通過。
- [x] (2026-09-07) 畫面無槍、手、muzzle、editor、FPS counter或ammo bar。
- [x] (2026-09-07) Engineering owner完成OQ/visual sign-off；generic fallback列為accepted difference並寫入progress。

## T-exit

- [x] (2026-09-07) FR-56.1～15與NFR-56.1～9都有客觀 evidence（traceability 表見 progress.md T-exit Evidence Log）。
- [x] (2026-09-07) practice-only／no-full-replay／no-history boundary有自動測試（T1/T4 negative fixtures）。
- [x] (2026-09-07) 全測試、perf、resource、visual與failure matrix通過；A-56.1～12全數有機器可讀或已核准的人工證據。
- [x] (2026-09-07) README、task-checklist、progress與上層Stage 12索引同步。
- [x] (2026-09-07) boundary scans（engine無drill/scene id特例、spawn無`Math.random`/時鐘、GLTF無weapon/hands/target節點）通過；staged names只含本WP檔案，平行WP-57變更未觸碰。`graphify update .`未執行——本task未改production code，且graphify產物正被平行工作佔用（沿用T3先例）。

## Commit discipline

每個 task 單獨 commit；建議 subject 見各 task file。完成 task 後同步本清單與 [progress.md](progress.md)。
