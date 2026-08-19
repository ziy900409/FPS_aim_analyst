# WP-34 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** 讀碼 spike(候選方案評估 + occlusion-aware 政策拍板;零程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | — |
| ✅ | **T1** `visibilityDerivation.ts`:`visibleFraction`/`tFirstVisible`/`tMeasurementOnset`/`tFullExposure` + 合成 fixture | [T1-visibility-derivation.md](T1-visibility-derivation.md) | T0 | Med |
| 🟡 | **T2** Occlusion-aware `validateClearance` + 新 occlusion 場景內容(impl done; full gate blocked by existing Playwright app-ready timeout) | [T2-occlusion-scene-clearance.md](T2-occlusion-scene-clearance.md) | T0(可與 T1 並行) | Med |
| 🟡 | **T3** `hold-click-v1` 協定 config + 預瞄/反應/取得/首發指標(impl done; full gate blocked by existing Playwright app-ready timeout) | [T3-hold-click-protocol.md](T3-hold-click-protocol.md) | T1 + T2 | Low |
| ⬜ | **T-exit** 驗收 + `analysis-visibility.md` 定稿 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T3 | — |

**T1 與 T2 檔案熱區不重疊**(`src/metrics/` vs `src/scene/`)→ 可並行;一 task 一 commit 的紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-34 狀態翻 ✅,開放 WP-35 entry。
- **單一閘貼證據**:`npm run test:ci`(本 WP 不動 `research/`,不需要 `uv run pytest`)。

## 本 WP 特有的兩條紀律

1. **可見度計算零 render/sim 依賴**:`visibilityDerivation.ts` 只能消費 `ExportPayload` + `SceneConfig`,不得 import `src/render/`/`src/sim/`/`SharedState`。
2. **既有 clearance 行為零回溯相容成本**:T2 新增參數必須完全可省略;既有 `clearance.test.ts` 零修改全綠是機械判準。
