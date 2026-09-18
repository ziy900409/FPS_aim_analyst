# WP-71 T4 — Metadata 自述、術語與跨 WP 分池契約

> FR-71.8／71.9 · NFR-71.6 · FM-71.6／71.7 · C-D4

## Objective

讓匯出能分辨 cue 有／無，並把 opening target cue 與既有 `preAim`、`t_visible`、未落地的 `meta.opening` 清楚切開。

## Steps

1. `TargetsMeta` 新增 `openingCue?: 'countdown-anchor-v1'`；`collectMeta()` 只在 config opt-in 時寫鍵。
2. `exportPayloadSchema.parseTargetsMeta()` additive optional-in：舊 payload 缺席保持缺席；新輸出則依 config 採 opt-in run required-out、非 opt-in run absent-out；未知值報指名 `meta.targets.openingCue` 的 parse error。
3. 正反測試：wide-v1 live payload 帶鍵；其他 drill 不帶；舊 fixture parse/canonical bytes 不變；非法 literal fail。
4. frozen digest 若移動，先印新舊鍵集合差集；非 opt-in fixture 任一位移即 bug，不准直接 rebaseline。
5. `CONTEXT.md` 新增「opening target cue／開場定位提示」；明寫不是 `preAim` 指標、不是正式 target visibility、`t_visible` 不提前。
6. 更新 `docs/operational/analysis-spider-shot.md`：wide-v1 WP-71 前後不可只按 drillId 混池；分池需看 `meta.targets.openingCue`。
7. 在 WP-67 README/progress 加 cross-WP alert：未來 `meta.opening.protocol` 分池需與 cue 維度組合，不得覆蓋 `armed-countdown-v1` 原語意。
8. 更新 GD-48 實際欄位形狀與相容性證據；狀態仍保持進行中到 T-exit。

## Definition of Done

- [ ] optional-in、opt-in required-out、非 opt-in absent-out 與非法值測試全綠，錯誤路徑具名。
- [ ] 未 opt-in drill/export canonical bytes 逐位不變；差異集合僅允許 opt-in run 的 `meta.targets.openingCue`。
- [ ] live payload 實際值記入 `progress.md`。
- [ ] CONTEXT／operational／WP-67 alert 三處語意一致，無 `preAimCue` 命名。
- [ ] `npm run typecheck`、metadata/schema targeted tests exit 0。

## Commit

```text
feat(wp-71): export the opening cue condition
```
