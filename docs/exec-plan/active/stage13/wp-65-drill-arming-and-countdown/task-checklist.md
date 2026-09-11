# WP-65 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 決策 GD-41（T-exit 落帳，規劃期為草稿）

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／編號重查／基線凍結／OQ 收斂 | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** `'armed'` 相位 + `armRequested` + `countdownRemainingMs` | [T1-armed-phase.md](T1-armed-phase.md) | T0 | **High** |
| ✅ | **T2** App 接線：取鎖解除待命／`start()` 前釋鎖／arena 歸零 | [T2-app-arming-wiring.md](T2-app-arming-wiring.md) | T1 | **High** |
| ✅ | **T3** 待命提示與倒數數字 overlay | [T3-countdown-overlay.md](T3-countdown-overlay.md) | T1（可與 T2 並行） | Low |
| ✅ | **T4** HUD `Time` 卡的時限型倒數 | [T4-hud-remaining-time.md](T4-hud-remaining-time.md) | T1（可與 T2/T3 並行） | Low |
| ✅ | **T5** Pointer Lock 掉鎖效度旗標 → `meta.validity` → Result 警示 | [T5-pointer-lock-validity.md](T5-pointer-lock-validity.md) | T2 | Med |
| ✅ | **T6** Live e2e arm helper／spec 補接／全量回歸 | [T6-e2e-and-regression.md](T6-e2e-and-regression.md) | T2 + T3 + T4 + T5 | **High** |
| ⬜ | **T-exit** WP-65 驗收（A-65.1～A-65.12） | [T-exit-gate.md](T-exit-gate.md) | T1～T6 | Low |

## 建議執行順序

```
T0 ──▶ T1 ──┬──▶ T2 ──▶ T5 ──┐
            ├──▶ T3 ─────────┤──▶ T6 ──▶ T-exit
            └──▶ T4 ─────────┘
```

T3／T4 只依賴 T1 的 `phase` 與 `countdownRemainingMs`，可在 T2 進行期間並行。T5 必須等 T2（偵測點與 arm 訂閱在同一個 `onChange`）。T6 必須等全部。

## Package Definition of Done

- [ ] 受試者情境「載入 drill → 看到『點擊左鍵開始』→ 點擊 → 看到 3、2、1 → 首目標出現」在實機可完整走通，並在 restart／換武器／換場景／換 drill／Session Plan block 五條路徑行為一致
- [ ] `endCondition.type === 'timeLimit'` 的 drill HUD `Time` 卡自總時長單調遞減至 `00:00.0`；`targetCount` 型的 `timeText` 與本 WP 前**逐字相同**
- [ ] drill 錄製中掉 Pointer Lock → 本場**繼續跑到自然結束**、`meta.validity.pointerLockLost === true`、`meta.suspect === true`、Result 顯示建議重測
- [ ] 三場乾淨 run 的 `pointerLockLost` 皆為 `false`（旗標有鑑別力，非恆亮）
- [ ] `createDrillRunner` 省略 `requireArm` 時行為**逐位不變**：`tests/regression/` 全部 determinism / golden fixture **零修改**通過
- [ ] 同一輸入序列跨 ≥ 4 種 render FPS 且於同一 tick index 解除待命時，`TickRecord[]` 逐位一致
- [ ] `meta` 的既有鍵集合零增減；`meta.validity` 恰多一欄；未帶新欄的舊 payload 仍可被 `parseExportPayload()` 與 Python `load_export()` 讀取
- [x] 全 repo 只有一份 e2e 取鎖模擬（helper，`tests/e2e/support/arm.ts`）。~~19 個 `__fps` spec 零修改全綠~~ → **實際為 14 零修改 + 3 補 arm + 2 僅擴充**：`session-orchestrator`／`micro-flick-live`／`spider-shot-wide` 雖走 `__fps`，但**先**以真實 UI／Session Plan 驅動 live drill ⇒ 需要 arm（[progress.md §T6.3b / §T6.7](progress.md)）。**沒有任何既有斷言被修改或放寬**
- [ ] `src/display/experimentSession.ts`、`src/input/PointerLock.ts`、`src/input/InputSampler.ts`、`research/` 四者的 diff 皆為空
- [x] `npm run typecheck` ×2、`npx vitest run`、`npx playwright test --workers=1`（**110 passed / 0 failed**，T0 基線 108）、`npm run build` 四項皆 exit 0（T6 實測）

## Commit discipline

每個 task 單獨 commit；subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md) 與上層 [stage13 README](../README.md)。

> ⚠️ **平行 session 提醒**：[stage13 README](../README.md) 與 [`exec-plan/README.md`](../../../README.md) 是多個 session 共編的索引檔。翻狀態時若撞到同一行衝突，只 stage 自己那幾行，不要整檔覆蓋。
