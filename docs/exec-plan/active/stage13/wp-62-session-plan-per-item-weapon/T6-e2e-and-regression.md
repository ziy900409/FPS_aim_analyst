# WP-62 T6 — E2E 整合與 frozen 逐位不變回歸

## Objective

以真實瀏覽器證明「表單逐列選武器 → 實跑 → 匯出帶對的武器」整條路徑成立，並證明 frozen 軌與所有既有回歸零修改全綠（FR-62.6、NFR-62.3）。

## Steps

1. 擴充 `tests/e2e/session-orchestrator.spec.ts`（**不新開平行 spec**，沿用 WP-58 T6 的既有結構）：
   - **DOM 案例**：開表單 → 切 custom → 加兩列不同 drill → 各選不同武器 → 預覽逐步顯示 `data-step-weapon-id` → 送出；
   - **DOM 負向案例**：對 BR 八格選錯武器 → submit 禁用 + 該列 `data-invalid`；
   - **live run 案例**：兩列不同武器實跑完，各自匯出的 `meta.weaponId` 對得上該列選擇，且 `meta.sessionPlanItems[].weaponId` 與之一致。
2. **live 案例的已知陷阱**（沿用 WP-58 T6 的踩坑結論，勿重踩）：
   - drill 必須**綁 `sceneId`**：未綁的 drill 會繼承當下場景，撞 `field-low` 的 clearance 而讓 session 在第一步就中止；
   - drill 即使無人瞄準也會依 `endCondition` 結束，因此 live run 不需要模擬命中；
   - Session Plan 的資格閘（`PERF_FLOOR_MS`，120 Hz 地板）在 CI 永遠過不了 ⇒ 沿用 WP-58 T6 那條**只跳過資格閘拒入、不偽造通過**的 dev-only seam，**不得**改成偽造通過。
3. **環境陷阱檢查**（跑之前先確認，避免把時間花在假失敗上）：
   - Playwright 的 `reuseExistingServer` 會讓 e2e 靜默測到 5173 埠上**別人的** server（外部專案、遺留的 capture dev server、或 worktree 作業時主 checkout 的 server）⇒ 跑之前確認 5173 上是本 checkout 的 server；
   - `.playwright-tmp/history-dev` 從不清理，累積上千個 participant 目錄後 history 相關 e2e 會紅 ⇒ 先數目錄再懷疑程式碼。
4. **frozen 逐位不變**：跑既有 frozen live e2e，比對匯出 payload 與本 WP 前 HEAD 逐位相同（digest 記入 `progress.md`）。
5. **全量回歸**：`npm run test:ci` exit 0（含全量 Vitest + 全量 Playwright + build + 兩個 typecheck）。
   ⚠️ `npm run typecheck` **只掃 `src/` 與 `server/`**；本 task 若在 `tests/` 寫了新型別，須以另一個 tsconfig 或 `vitest`／`playwright` 實跑確認，不能靠 typecheck 綠燈當證據。
6. 記錄實測數字（passed／skipped／時長）與與 T0 基線的差異到 `progress.md`。

## Invariants

- 不新開平行 e2e spec。
- 資格閘 seam 只跳過「拒入」，不偽造通過。
- frozen 軌 e2e 與其匯出零修改、逐位不變。
- 既有回歸測試零修改（新增可以，放寬不行）。

## Definition of Done

- [x] custom 軌 live run 實跑兩列不同武器，各自匯出的 `meta.weaponId` 與該列選擇相符（測試名 + 實際 payload 值記入 `progress.md`）
- [x] `meta.sessionPlanItems[].weaponId`（意圖）與 `meta.weaponId`（事實）在 live 匯出上一致有斷言
- [x] DOM 正向 + 負向（BR 八格）案例各一，皆綠
- [x] frozen live e2e 匯出與本 WP 前 HEAD 逐位相同（digest 對比記入 `progress.md`）
- [x] `npm run test:ci` exit 0；Vitest／Playwright 實測數字與 T0 基線的差異（只增不減）記入 `progress.md`
- [x] 環境陷阱檢查結果記入 `progress.md`（5173 埠歸屬、`.playwright-tmp/history-dev` 目錄數）

## Commit

```text
test(session): cover per-item weapon selection end to end
```
