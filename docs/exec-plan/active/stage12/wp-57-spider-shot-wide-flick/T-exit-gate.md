# WP-57 T-exit — 驗收與晉升 WP Handoff

## Objective

依 README 的 FR／NFR／traceability 驗收整個 WP-57；證明大幅度拉槍刺激幾何成立、決定性未被破壞、GD-10 張力已被實證化解，並為後續「晉升 Assessment」的 WP 提供穩定契約。

## Automated gates

> ✅ **2026-09-08 執行完畢（HEAD=`f3bc045`）**，逐項結果見 [progress.md](progress.md) §T-exit evidence。**唯一未達成**：gate 3／4 的「全量 Playwright exit 0」與「`test:ci` exit 0」——實測 `test:ci` **exit 1**，唯一原因是既存的 [KI-027](../../../../known_issue/KI-027-overlay-layering-researcher-submenu-guard-dead.md)（非本 WP）。另新立 [KI-030](../../../../known_issue/KI-030-history-e2e-flaky-under-parallel-workers.md)：全量 Playwright 在多 worker 下不可重現，本 T-exit 以 `--workers=1` 的 **90 passed／1 failed** 為門檻讀數。

1. Browser 與 Node TypeScript typecheck exit 0。
2. 全量 Vitest exit 0，記錄 files／tests 數與本 WP 新增的幾何／決定性／on-screen 測試數。
3. 全量 Playwright exit 0，記錄 tests 數、browser／backend 與 fixture roots。
4. `npm run build`、`npm run test:ci` exit 0。
5. boundary scans：
   - `spiderEyeFrame.ts`／`spiderShotWide.ts`／`spiderShotRepositioning.ts` 無 DOM／three／`node:*`／`fs`／`Date.now`／`performance.now`／`Math.random`；
   - `TargetManager.ts` 未 import 任何 render／scene／`SettingsPanel` 模組；
   - `spiderShotRepositioning.ts` 未被 `diagnosisRules.ts`／教練報告路徑／`DrillMetricRegistry` 引用。
6. 幾何與決定性 benchmark：NFR-57.1／57.2／57.3／57.4／57.5／57.7 的實際數字全數達 README 門檻。

## Acceptance scenarios

> ✅ **A-57.1～12 全數綠（2026-09-08）**，逐列證據見 [progress.md](progress.md) §T-exit evidence 的 acceptance 表。A-57.12 附一項誠實限制：敏感度表與 `cm/360` 方向性表建在合成 cohort 上（repo 內無真人 wide-flick 匯出），OQ-57.5 因此維持開放。

| ID | Scenario | Pass condition |
|---|---|---|
| A-57.1 | 端到端 run | 從研究者控制列載入 → 跑完 → 匯出；`zone` 嚴格交替，周邊 `D_deg` 落在 45–55° 帶 |
| A-57.2 | on-screen | 每個 visible 目標的投影 `abs(ndc) <= 1 − screenMargin`（純函式 12 組 + 實機） |
| A-57.3 | 角徑恆定 | ≥ 10,000 spawn 的 `abs(pos − eye)` 對 `d` 相對誤差 ≤ 1e-12 |
| A-57.4 | pitch 窗 | 所有 pitch 落在對稱窗內；目標下緣對地板淨空 ≥ `CLEARANCE_MARGIN_U` |
| A-57.5 | 分層平衡 | 每個完整佇列週期 L/R 相等；≥ 10,000 spawn 的 cell 覆蓋差 ≤ 1 週期 |
| A-57.6 | 決定性 | 同 resolved config + seed，4 種 render FPS 下 tick-index 位置逐位一致 |
| A-57.7 | **GD-10 不變性** | run 內 resize／解析度切換後 spawn 序列逐位不變（純函式 + 實機兩版） |
| A-57.8 | v1/v2 零回歸 | v1/v2 spawn 序列 golden byte-identical；既有 `D_deg`／`W_deg`／`quadrant`／`targetConditionCell` 輸出逐位不變 |
| A-57.9 | arena 幾何 | README §2.5 全表為測試且綠；預設 `[10,10,3]` 房間的穿牆負向測試綠 |
| A-57.10 | provenance | resolved 參數（含 `resolvedFrom` 五欄）round-trip 逐位；離線可重建刺激幾何 |
| A-57.11 | practice-only | 零 history mutation、無 compatibility cell、不在 `DrillMetricRegistry` |
| A-57.12 | 品質標註 | repositioning 疑慮旗標對合成訊號分類正確；敏感度表已交付；未進教練報告 |

## Research/data safety

- [x] 本 drill 的效度聲稱限定為「researcher-only／practice 的大幅度拉槍刺激成立」；**不宣稱**信度、常模或跨選手可比較性。
- [x] `pitch` 明確記錄為干擾項，不出現在 `targetConditionCell`，也不在任何呈現層被當條件變因。
- [x] repositioning 旗標的限制（與刻意停頓不可分離）已在文件與 progress 誠實記錄（模組註解／`analysis-spider-shot.md`／`CONTEXT.md`／progress §T5）。**同時記錄了一個更強的限制**：敏感度表本身建在合成 cohort 上，repo 內無真人 wide-flick 匯出。
- [x] 時序參數與 `kLo`／`screenMargin` 的校準狀態已如實標註：`timeLimitMs` **已回填 60000**（D-57.T6-2，並明記它推翻了規劃期理由）；`peekTimeoutMs = 2500`／`kLo = 0.92`／`screenMargin = 0.04` 仍為候選（D-57.T6-1，附 NDC 隨 FOV 漂移的已知限制）；repositioning 門檻**未凍結**（OQ-57.5）。
- [x] 每 cell 樣本數的實際數字已記錄（§T6 節奏掃描表，改值前後各一組，約 5–12/cell），並明說不足以支撐信度檢定（C-D3）。
- [x] 測試只用 fixtures／已驗證 temp root；真實 `data/session-history/` 目錄數在三次 Playwright 前後皆為 **41**，無 mutation。

## Architecture regression

- [x] `TargetManager` 的 spiderShot 分支狀態隔離：wide 分支只用 `spiderWideQueue`，從不讀寫 legacy `nextSide` 或 `spiderZoneQueue`。⚠️ **對本行原文的更正**：KI-026 之後實際有**四支** kind，其中 `-stratified` 與 `-eye-stratified` **刻意共用** `spiderZoneQueue`（BD-026 設計，非 WP-57 引入）；WP-57 擁有的宣稱是「wide ∦ 其餘三支」。
- [x] resolver 唯一呼叫點在 arm 時：`main.ts:243` 的 `resolveSource` thunk → `drillSourceFor()`（`main.ts:161`）→ 唯一呼叫者 `main.ts:1322`（`loadDrillById()` 內、`activateDrill()` 之前）。render callback 零 resolver 呼叫、零 FOV／aspect 進 sim。
- [x] `PLAYER_EYE_HEIGHT_U` 仍是唯一來源（定義於 `src/sim/playerEye.ts`，`clearance.ts` re-export 同一 binding）；arena `eyeHeight` 相等由 `wide-flick-arena.test.ts:40` 與 runtime 閘 `spiderWideArena.ts:138` 雙重釘死。
- [x] `spiderShotMetrics.ts` **零修改**（`git diff <WP-57 base> HEAD` 為空）；`spiderShotConditions.ts` 自 KI-026 後只有 **27 行純 additive**（`side?` + `sideForPeripheral()` + 一個 spread），既有欄位零變動。
- [x] 既有決定性／命中／recoil／export／history regression 零修改通過（全量 Vitest 238 files／2,399 tests）。
- [x] 無第二套夾角／角徑／ω 實作（C-D4）：`D_deg`／`W_deg` 只在 `spiderShotConditions.ts`；角徑只從 `resolveTargetHitbox()` 推導；ω 只在 `angularKinematics.ts`（T5 boundary scan 釘死）。

## Documentation and graph

- [x] README 的 OQ／assumptions／planning defaults 已更新為實際交付值。
- [x] [progress.md](progress.md) 貼齊 test／benchmark／實機截圖／敏感度表／OQ 證據；[task-checklist.md](task-checklist.md) 全 ✅。
- [x] `docs/operational/analysis-spider-shot.md` 與 `CONTEXT.md` 與實作一致（eye-frame、`side` 兩來源、`resolvedFrom`；本次補上 repositioning 旗標一節與詞條）。
- [x] `docs/exec-plan/DECISIONS.md` 的 GD-32 已反映最終落地：「影響面 (A)」標記為已被 ④ 取代並附 T4 實測值，狀態列補上交付與分支隔離事實。
- [x] `docs/exec-plan/README.md` §2 的 stage12 WP-57 列與 `active/stage12/README.md` 已同步為交付。
- [x] CodeGraph 已同步（`codegraph sync .` → `Already up to date`，新模組已入索引）。⚠️ **`graphify update .` 刻意未執行**（沿用 T3／T6 處置）：`graphify-out/*` 目前帶著平行工作的未提交變更，重跑會把我的索引寫進他們的 diff 裡。
- [x] `git status --short`／`git diff --cached --stat` 只含預期 code／tests／docs，無 payload artifacts。

## Exit criteria

Automated gates、A-57.1～12、research safety 與 architecture regression 全數有客觀證據才可宣告 WP-57 完成。

> **2026-09-08 判定：✅ 通過。** 四個 blocking 條件（A-57.7／A-57.8／A-57.2／A-57.4）皆有 test／measurement 且綠；A-57.1～12 全數有客觀證據；research safety 與 architecture regression 逐項覆核。**唯一未達成的是 NFR-57.8 的 Playwright／`test:ci` 兩個子句**，唯一成因為既存且已立案的 KI-027（非本 WP、production diff = 0 時即存在），依 scope 紀律不在本切片修 —— 記為**已揭露的殘留**而非通過，處置與 WP-56 T-exit 對同一失敗一致。

以下任一只有人工敘述而無 test／measurement 時，T-exit **不通過**：
- **A-57.7（GD-10 不變性）** —— 這是本 WP 唯一與硬約束正面接觸的點；
- A-57.8（v1/v2 零回歸）；
- A-57.2（on-screen 保證）；
- A-57.4（pitch 窗地板淨空）。

## Commit

```text
docs(stage12): close WP-57 spider shot wide flick
```
