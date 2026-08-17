# WP-32 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(三個上游 exit 複驗 + **晉升清單凍結(關閉 OQ-S4-4)** + 移植紀律五條 + SG 係數策略 + `filter_degenerate` 子集決議;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-31 T-exit ✅ | Low |
| ✅ | **T1** TS ω(t)(tick-integral,strict)+ **SG 凍結係數表**(≤1e-12 對表)+ ω golden(≤1e-9) | [T1-ts-kinematics-sg.md](T1-ts-kinematics-sg.md) | T0 | **High** |
| ✅ | **T2** TS `seg-v2` 分段移植 + segment golden(**index 逐位相等**,非容差) | [T2-ts-segmentation.md](T2-ts-segmentation.md) | T1 | **High** |
| ✅ | **T3** 共享 peek 窗抽出(零語意變更)+ `phase-v1` + `sync-v1` 晉升 + golden | [T3-phase-sync-promotion.md](T3-phase-sync-promotion.md) | T2 | Med |
| ✅ | **T4** 逐 tick ε 抽出(零語意變更)+ `curve-v1` 101 點 L/R 晉升 + golden | [T4-curve-promotion.md](T4-curve-promotion.md) | T1 | Med |
| ✅ | **T5** 結果頁 research-promoted 區塊 + `blocked` 態 + **統計 = 匯出 E2E** | [T5-result-screen.md](T5-result-screen.md) | T3 + T4 | Med |
| ⬜ | **T-exit(M15)** `acceptance-stage-d.md` + C-D5 入 CLAUDE.md §4 + 文件對帳 + stage4 收斂 | [T-exit-gate.md](T-exit-gate.md) | T5 | — |

**T4 只依賴 T1**(吃 ω 與既有 ε,不吃分段)→ 可與 T2 並行;一 task 一 commit 的紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-32 狀態翻 ✅,並宣告 **M15**。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine,含四支 `promoted-*.test.ts`)。

## 本 WP 特有的五條紀律

1. **`src/` diff 範圍封閉**:只允許 `src/metrics/`、`src/ui/ResultScreen.ts`、`src/main.ts`。`src/sim`/`src/input`/`src/loop`/`src/data` 出現 diff = 越界,立即 fail 回頭檢視。**不 bump `schemaVersion`、不重錄任何決定性 baseline 或 golden。**
2. **抽出 ≠ 改寫**(T3 的 peek 窗、T4 的逐 tick ε):判準 = 既有測試**零修改**全綠 + `git diff` 可逐行對照為搬移。一旦既有測試需要改一個字,即代表語意被動到,停手。
3. **既有構念禁第二定義(C-D4)**:peek 窗界複用 `compute.ts`、逐 tick ε 複用 `trackingDerivation.ts`、`t_detect` 呼叫 `deriveDetectionMetrics`。在 `researchMetrics.ts` 內重推任何一項 = 直接違約。
4. **C-D3 紅線落到結果頁**:晉升清單為 T0 凍結的**封閉三項**(`phase-v1`/`sync-v1`/`curve-v1`);WP-31 的 SPARC(`stratified_only`)/ xcorr(`research_only`)/ Fitts 一律不得出現。T5 以測試斷言結果頁 metric id 集合等於封閉清單(多一個即 fail)。
5. **`blocked` 優於錯值**:`meta.mouseIntegration` 缺席時 `computePromotedMetrics` 回 `{status:'blocked'}`,**禁止**回退 `aim-diff-legacy` omega([KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) 的 beat aliasing bug)。
