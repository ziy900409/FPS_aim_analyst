# WP-64 — Task Checklist

> 一 task = 一垂直切片 = 一原子 commit。每完成一項，同步 [progress.md](progress.md)。

## T0 — Entry gate

- [x] 重查 WP/GD 編號與 stage 落點；撞號完整順延 — WP-64 / GD-40 維持，落點不變
- [x] CodeGraph impact / worktree / 平行 WP 熱區對帳 — 兩處規劃期敘述已修正
- [x] WP-54 與 WP-62 focused baselines exit 0 — 238 + 66 passed
- [x] OQ-64.1：精確核准 1–2 個 config，記錄 symbol/id/seed/role — 2deg_5dps (54012) + reversal_high (54101)
- [x] OQ-64.2：Controls visibility 決策 — Session Plan-only
- [x] OQ-64.3：live eligibility 決策 — 不做
- [x] OQ-64.4：alternate seed 決策 — 只用 primary
- [x] `git diff -- src tests` 為空
- [x] commit：`docs(wp-64): complete tracking pilot scheduling entry gate`

## T1 — Curated scheduling contract

- [x] CodeGraph impact 已記錄 — 沿用 T0 §2（同一 code state），T1 以全量 suite 覆核，見 progress T1 §1
- [x] 紅測試先行：selection precision + complement exclusion
- [x] 建立唯一 curated registry，無手寫 id／array index contract
- [x] `tracking` family roster 由 curated registry 推導
- [x] declared weapon roster 由相同 registry 推導
- [x] compiler 覆蓋 mismatch/equal weapon、reps、兩種 rest boundary
- [x] 全九項 history exclusion 維持
- [x] 三道 mutation test 會咬 — 兩道測試轉紅、一道 module-construction fail fast
- [x] focused/full Vitest、typecheck ×2、build exit 0 — 2984 passed / 255 files
- [x] `graphify update .` — 4859 nodes / 12016 edges
- [x] **偏離**：coherence 迫使 `main.ts` runtime entry + Controls surface filter 提前落在 T1（D-64-T1-1）
- [x] commit：`feat(wp-64): register curated tracking pilot session drills`

## T2 — Runtime / UI / export

- [x] CodeGraph impact 已記錄 — 見 progress T2 §1（`AvailableDrill`/`loadDrillById`/`sessionPlanAuditFields` 三者 T2 前零覆蓋）
- [x] ~~runtime entry 由 curated registry 推導，scene 固定 `field-low`~~ — 已於 T1 落地（D-64-T1-1）；T2 升級為**行為**斷言
- [x] ~~unselected Pilot ids 不在 runtime registry~~ — T2 改為 `resolveAvailableDrill()` 對 7 個 id 各拋 `Unknown drill`
- [x] OQ-64.2 surface policy 已實作且有**雙側測試** — OQ-64.5 關閉：seam = `src/drill/drillRegistry.ts`（D-64-T2-1）
- [x] Session Plan picker 精確顯示 selected ids 於 tracking 群組 — 2 在、7 缺席（跨全部 optgroup）
- [x] 鍵盤可選取/加入；提示不只靠顏色 — 新列控制項皆 input/select/button 且有 aria-label
- [x] export item/rep/family/seed/weapon/scene round-trip 對帳 — seed 走 `meta.spawn.trackingTrajectory`（見 progress T2 §3.1）
- [x] 無 assessment／manifest eligibility 欄位偽造 — `startSessionPlan()` 函式體掃描 7 個禁用符號
- [x] formal pilot runner/manifest 與 config values 零 diff — `git status` 只列本 task 的 6 改 + 2 新檔
- [x] focused/full Vitest、typecheck ×2、build exit 0 — 3014 passed / 256 files
- [x] `graphify update .` — 4869 nodes / 12052 edges
- [x] commit：`feat(wp-64): wire pilot drills into session plans`

## T3 — E2E / validity regression

- [x] 擴充既有 `session-orchestrator.spec.ts`，不開平行 spec — +2 test，未新增 spec 檔
- [x] 真 DOM picker → eligibility → field-low → running → ended → download 全通 — DOM 軌到 `#eligibility-gate`，live 軌走既有 `startSessionPlanWithoutGate()` seam（閘仍執行、只跳過拒入）
- [x] 不縮 production duration、不繞過 runner — 三次 26 s block 實跑，1.6 min
- [x] ad hoc payload audit facts 全對帳 — plan 座標 / familyOrder / 兩個 rest / trajectory 物件 / hitbox / weapon / `scene.sceneId`
- [x] SessionRunner 擁有完成；TrackingPilotRunner records 不變 — block log 0 列、品質橫幅隱藏
- [x] `tracking-pilot-live.spec.ts` 原 expected 全綠 — 1 passed，2.7 min，一字未改
- [x] history roots before/after 不變 — 三個 root deep-equal（含**真實** `data/session-history/`，見 progress T3 §1）
- [x] 跨 render FPS sim state bit-exact — 既有四 pump suites 全綠；未新增第二定義（progress T3 §7）
- [x] runbook 明列非 manifest／primary only／reps 非獨立樣本 — runbook 新章 + operator-manual callout
- [x] full verification exit 0；`graphify update .`
- [x] **T3 額外修復**：T1 遺留的紅燈 e2e（picker option 36→38）——`typecheck`/Vitest 都掃不到 `tests/e2e/`（progress T3 §3）
- [x] commit：`test(wp-64): verify ad hoc tracking pilot session plans`

## T-exit

- [x] A-64.1～A-64.9 逐項具名證據 — progress T-exit §2
- [x] Exit matrix 八列全 PASS — progress T-exit §3
- [x] OQ 全 resolved/deferred-with-owner — OQ-64.1～64.5 全數 closed，無 deferred
- [x] full typecheck/build/Vitest/兩支 Edge E2E exit 0 — typecheck ×2、build、Vitest 3014、Edge 21 passed
- [x] hard-constraint zero-diff audit 完成 — `d8fe0ac..63d3187` 的 sim/input/render/config/research path 空
- [x] WP/stage/global index/decision ledger 同步 — README/progress、stage13、top-level index、GD-40
- [x] staged files 只含本 WP 核准範圍 — commit 前人工對照，不含 WP-65
- [x] commit：`docs(wp-64): close tracking pilot scheduling work package`
