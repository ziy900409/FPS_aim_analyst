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

- [ ] 擴充既有 `session-orchestrator.spec.ts`，不開平行 spec
- [ ] 真 DOM picker → eligibility → field-low → running → ended → download 全通
- [ ] 不縮 production duration、不繞過 runner
- [ ] ad hoc payload audit facts 全對帳
- [ ] SessionRunner 擁有完成；TrackingPilotRunner records 不變
- [ ] `tracking-pilot-live.spec.ts` 原 expected 全綠
- [ ] history roots before/after 不變
- [ ] 跨 render FPS sim state bit-exact
- [ ] runbook 明列非 manifest／primary only／reps 非獨立樣本
- [ ] full verification exit 0；`graphify update .`
- [ ] commit：`test(wp-64): verify ad hoc tracking pilot session plans`

## T-exit

- [ ] A-64.1～A-64.9 逐項具名證據
- [ ] Exit matrix 八列全 PASS
- [ ] OQ 全 resolved/deferred-with-owner
- [ ] full typecheck/build/Vitest/兩支 Edge E2E exit 0
- [ ] hard-constraint zero-diff audit 完成
- [ ] WP/stage/global index/decision ledger 同步
- [ ] staged files 只含本 WP 核准範圍
- [ ] commit：`docs(wp-64): close tracking pilot scheduling work package`

