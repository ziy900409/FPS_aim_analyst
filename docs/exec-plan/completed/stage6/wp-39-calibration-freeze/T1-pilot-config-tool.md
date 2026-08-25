# T1 — pilot config 產生器(近/中/遠距離、可見門檻、Spider Shot 角度、holdDurationMs、feedbackPolicy)

> Part of [WP-39 calibration-freeze](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(阻塞解除 + OQ-S6-24/25 拍板 + seed roster 區間確認) |
| **Risk / Cplx** | Med / Med(觸碰 `main.ts` 的 `assessmentFeedbackPolicy` 寫死值,但只是把常數改為參數,不改判定邏輯) |
| **Touches** | ADD `src/pilot/pilotConfigs.ts`、`src/pilot/pilotConfigs.test.ts`、`docs/operational/pilot-protocol-stage6.md`(起稿);MODIFY `src/main.ts`(`assessmentFeedbackPolicy` 可覆寫) |
| **狀態** | ✅ (2026-08-25) |

## Objective

交付 FR-F17 的核心:一個純 TS、seeded、可重現的參數化 pilot config 產生器,涵蓋四個維度——① `hold-click-v1`/`hold-track-v1` 近/中/遠世界距離、② `hold-click-v1` 可見門檻候選(`onsetThreshold`,`N` 固定 `9`)、③ `spider-shot-v1` 的 `angularRadiusDeg`/hitbox 候選(換算 `D_deg`/`W_deg` 沿用既有 `spiderShotConditions.ts`)、④ `counterstrafe-reversal-v1` 的 `holdDurationMs` 候選。所有產生的 `DrillConfig` 一律 `mode: 'practice'`、seed 落在 `PILOT_SEED_ROSTER_START` 起算的不相交區間。額外交付 `assessmentFeedbackPolicy` 兩個候選值的可達路徑(`main.ts` 目前寫死 `'minimal-end-of-block'`,需要能被 pilot 呼叫端覆寫為 `'unrestricted'`)。

## In scope

1. `src/pilot/pilotConfigs.ts`:
   - `PILOT_SEED_ROSTER_START` 常數(依 T0 列出的既有 seed 區間選定不相交範圍)。
   - `buildHoldClickPilotConfigs(distances, visibilityCandidates)`、`buildHoldTrackPilotConfigs(distances)`、`buildSpiderShotPilotConfigs(cells)`、`buildCounterstrafeReversalPilotConfigs(candidates)` 四個純函式,回傳 `readonly DrillConfig[]`。
   - 每個函式內部複製既有 `*_v1.ts` 的協定骨架(不重寫排程邏輯),只覆寫距離/門檻/角度/`holdDurationMs`/`mode`/`seed` 欄位。
2. `src/main.ts`:`assessmentFeedbackPolicy` 從寫死 `'minimal-end-of-block'` 改為可由呼叫端(pilot 匯出路徑)覆寫為 `'unrestricted'`;既有預設行為(未覆寫時)**零回溯相容成本**——不覆寫時逐位等同現行輸出。
3. `docs/operational/pilot-protocol-stage6.md` 起稿(比照 [pilot-protocol-stage3.md](../../../../operational/pilot-protocol-stage3.md) 格式):四個 pilot 維度的施測程序、seed roster 慣例、資格閘沿用既有 stage3 慣例。
4. **零破壞閘(DoD 首項)**:不呼叫 pilot 產生器時,既有四個協定 config(`hold_click_v1.ts` 等)與 `main.ts` 既有匯出路徑逐位不變。

## Out of scope

- 凍結後的實際數值定案(T2)。
- `acceptance-stage-f.md`(T3)。
- 真人 pilot 施測執行(研究行政層工作)。

## Steps

- [ ] `pilotConfigs.ts` 四個產生器 + seed roster 常數。
- [ ] 決定性測試:相同輸入 → 相同輸出陣列(逐位比較)。
- [ ] 守門測試:所有產出 `DrillConfig.mode === 'practice'`;`buildCompatibilityKey()` 不可達或拋錯。
- [ ] Seed 不相撞測試:pilot seed 與既有四個協定的 assessment seed 逐一比對不相等。
- [ ] `main.ts` `assessmentFeedbackPolicy` 覆寫路徑 + 既有預設路徑零修改回歸測試。
- [ ] `pilot-protocol-stage6.md` 起稿。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 四個產生器決定性可重現 | 單元測試綠 |
| ② | 所有產出 `mode==='practice'`,不進正式歷史 | 守門測試綠 |
| ③ | Pilot seed 與既有 assessment seed 不相撞 | 比對測試綠 |
| ④ | `main.ts` 既有預設路徑零修改 | 既有測試 diff 為空 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-39): T1 — pilot config 產生器(近中遠距離/可見門檻/Spider Shot 角度/holdDurationMs 候選 + seed roster)`
