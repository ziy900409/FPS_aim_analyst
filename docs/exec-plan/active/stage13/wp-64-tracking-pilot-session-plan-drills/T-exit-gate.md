# T-exit — WP-64 驗收與交付 gate

> Parent：[README.md](README.md) · 前置：T1～T3 全完成

| | |
|---|---|
| **Objective** | 以可重跑證據判定 selected Tracking Pilot drills 是否安全成為 Session Plan 的 ad hoc research drills。 |
| **Dependencies** | T1、T2、T3。 |
| **Risk** | Low；若任一 validity gate 缺證據則不得宣告完成。 |
| **Estimate** | 0.5 dev-day。 |
| **Commit** | `docs(wp-64): close tracking pilot scheduling work package` |

## Exit procedure

1. 對照 README A-64.1～A-64.9，逐項貼上測試名稱、指令、exit code、數量或 diff 證據；禁止只寫「完成」。
2. 重跑：
   - `npx tsc --noEmit`
   - `npx tsc --noEmit -p tsconfig.node.json`
   - `npm run build`
   - `npx vitest run`
   - `npx playwright test tests/e2e/session-orchestrator.spec.ts tests/e2e/tracking-pilot-live.spec.ts --project=edge --workers=1`
3. 比對 selected/unselected Pilot ids、runtime/family/weapon/history 四張 projection 表；任何不對稱均退回 owning task。
4. 審查 ad hoc export：至少一份真實 payload 可由 plan item/rep 回指 config facts，且沒有 assessment/manifest eligibility 語意。
5. 審查 `git diff --name-only` 與 source diff，確認 hard-constraint zero-touch 項目真的未改。
6. 執行 `graphify update .`，確認知識圖與 production source 同步。
7. 同步本 WP README/status、checklist、progress、stage13 index、top-level exec-plan index與 `DECISIONS.md`。若 WP/GD 編號曾順延，所有連結一次修正。

## Exit matrix

| Gate | PASS evidence | FAIL condition |
|---|---|---|
| Selection precision | 1–2 selected 全可排程；其餘 Pilot 全不可排程 | 全九項或未核准項出現在 picker |
| Runtime coherence | selected 全有 `field-low` runtime entry | compile 成功但 load unknown/clearance 因 scene 漂移失敗 |
| Instrument integrity | weapon override 被擋；config/seed/hitbox/guard 未改 | 任一 config fact 不同或可換武器 |
| Orchestration separation | ad hoc 由 SessionRunner；formal 由 TrackingPilotRunner | 任一路徑偽造/接管另一方語意 |
| Auditability | custom audit + item/rep + seed/weapon/scene 可對帳 | payload 無法回指 program/config |
| Research separation | practice、no assessment、unregistered history | 任何 selected run 進正式 history/claim |
| Regression | typecheck/build/Vitest/兩支 E2E 全 exit 0 | 失敗、skip 新增或 expected 放寬 |
| Architecture | sim/input/render/hitbox/research 零語意 diff | 新 tick work、第二構念、第二 config/seed 定義 |

## Definition of Done

- [ ] A-64.1～A-64.9 每項都有具名、可重跑證據。
- [ ] Exit matrix 八列全 PASS，無以「後續再補」取代 release gate。
- [ ] OQ-64.1～64.4 全數 resolved；任何 deferred 項有 owner、觸發條件與新 WP 指向。
- [ ] `progress.md` 含 final test counts、browser、HEAD、commit 列表、surprises、殘留限制。
- [ ] stage/top-level index與全域 decision ledger 狀態同步，且只 stage 自己的行被修改。
- [ ] worktree/staged file 清單經人工對照，只包含本 WP 核准的檔案。

## Completion rule

只有全部 gate 通過才標 ✅ complete。若功能可跑但 validity separation 不成立，狀態是 ❌ revise，不得以「研究工具而已」降低標準。
