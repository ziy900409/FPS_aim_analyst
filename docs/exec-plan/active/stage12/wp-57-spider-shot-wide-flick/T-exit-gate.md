# WP-57 T-exit — 驗收與晉升 WP Handoff

## Objective

依 README 的 FR／NFR／traceability 驗收整個 WP-57；證明大幅度拉槍刺激幾何成立、決定性未被破壞、GD-10 張力已被實證化解，並為後續「晉升 Assessment」的 WP 提供穩定契約。

## Automated gates

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

- [ ] 本 drill 的效度聲稱限定為「researcher-only／practice 的大幅度拉槍刺激成立」；**不宣稱**信度、常模或跨選手可比較性。
- [ ] `pitch` 明確記錄為干擾項，不出現在 `targetConditionCell`，也不在任何呈現層被當條件變因。
- [ ] repositioning 旗標的限制（與刻意停頓不可分離）已在文件與 progress 誠實記錄。
- [ ] 時序參數（`peekTimeoutMs`／`timeLimitMs`）與 `kLo`／`screenMargin` 的校準狀態已如實標註（已回填／仍為候選）。
- [ ] 每 cell 樣本數的實際數字已記錄，並明確說明其不足以支撐信度檢定（C-D3）。
- [ ] 測試只用 fixtures／已驗證 temp root；真實 `data/session-history/` 無 mutation。

## Architecture regression

- [ ] `TargetManager` 的三支 spiderShot 分支狀態完全隔離（不共用 `nextSide`、不共用佇列）。
- [ ] resolver 的唯一呼叫點在 arm 時；render callback 內無 resolver 呼叫、無 FOV／aspect 讀取進 sim。
- [ ] `PLAYER_EYE_HEIGHT_U` 仍是眼高的唯一 sim 側來源；arena `eyeHeight` 與其相等已釘死。
- [ ] `spiderShotMetrics.ts` 零修改；`spiderShotConditions.ts` 只有 additive `side`。
- [ ] 既有決定性／命中／recoil／export／history regression 零修改通過。
- [ ] 無第二套夾角／角徑／ω 實作（C-D4）。

## Documentation and graph

- [ ] README 的 OQ／assumptions／planning defaults 已更新為實際交付值（哪些已凍結、哪些仍為候選）。
- [ ] [progress.md](progress.md) 貼齊 test／benchmark／實機截圖／敏感度表／OQ 收斂證據；[task-checklist.md](task-checklist.md) 全 ✅。
- [ ] `docs/operational/analysis-spider-shot.md` 與 `CONTEXT.md` 與實作一致（eye-frame、`side` 語意、`resolvedFrom`）。
- [ ] `docs/exec-plan/DECISIONS.md` 的 GD-32 已反映最終落地內容。
- [ ] `docs/exec-plan/README.md` §2 已新增 stage12 WP-57 列與狀態；若 stage12 之後建立 stage 層 README／checklist，一併對帳。
- [ ] `graphify update .` 完成；CodeGraph pending 同步或已直接讀。
- [ ] `git status --short`、`git diff --cached --stat` 與 staged names 只含預期 code／tests／docs，無 payload artifacts。

## Exit criteria

Automated gates、A-57.1～12、research safety 與 architecture regression 全數有客觀證據才可宣告 WP-57 完成。

以下任一只有人工敘述而無 test／measurement 時，T-exit **不通過**：
- **A-57.7（GD-10 不變性）** —— 這是本 WP 唯一與硬約束正面接觸的點；
- A-57.8（v1/v2 零回歸）；
- A-57.2（on-screen 保證）；
- A-57.4（pitch 窗地板淨空）。

## Commit

```text
docs(stage12): close WP-57 spider shot wide flick
```
