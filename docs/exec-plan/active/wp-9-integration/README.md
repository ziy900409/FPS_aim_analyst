# WP-9 — 整合、測試與緩衝 ★M4（階段 A 交付）

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-9（PLAN §5）— *整合、測試與緩衝* |
| **里程碑** | **M4 — 階段 A 交付**：規格附錄 E 驗收清單全數通過 |
| **相依** | 全部（WP-0 ~ WP-8） |
| **Type** | 整合 + 驗證：端到端 E2E、計時效度、決定性回歸、緩衝 |
| **Module / 觸及路徑** | NEW `tests/e2e/full-drill.spec.ts`、`tests/validity/reaction-time.test.ts`、`tests/regression/determinism.spec.ts`、`docs/operational/acceptance-stage-a.md`；MODIFY 既有測試 |
| **必讀** | 規格 附錄 E（驗收清單）· 附錄 F（風險）· §6（非功能）· §9.2（計時效度 150–250 ms）· §14（方法論）· [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 3–5 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

把 WP-0~8 整合驗證為可交付的階段 A：端到端跑完整 drill → 匯出 → 統計（Playwright），驗證計時效度（反應時間分布落在文獻 150–250 ms），跑決定性回歸（自動化），並保留緩衝處理未預期問題。完成即達 **M4：規格附錄 E 驗收清單全數通過**，階段 A 交付。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-9.1** | 端到端整合測試（Playwright）：完整 drill → 匯出 → 統計，全鏈路通過。 | T1 |
| **FR-9.2** | 計時效度驗證：反應時間分布對照文獻 150–250 ms（合理範圍）。 | T2 |
| **FR-9.3** | 決定性回歸測試（Vitest，自動化）：CI 等級守護 M1 的決定性不退化。 | T3 |
| **FR-9.4** | 緩衝：處理整合期未預期問題；最終 map 附錄 E 全清單。 | T4 |

### Non-functional Requirements

- **附錄 E 為交付閘**：所有驗收項逐一對照證據。
- **回歸自動化**：決定性 + 指標測試可重複執行（CI 或本機腳本）。
- 統計 = 匯出（WP-8/WP-7 同源）在 E2E 交叉驗證。

### Constraints

- E2E 在 Chrome/Edge（階段 A 鎖定）；驗 Pointer Lock / `crossOriginIsolated` / 原生輸入 / 匯出下載。
- 計時效度為**分布合理性**檢查（受試者內相對值，§14），非絕對硬體延遲。
- 決定性回歸沿用 WP-2 T4 的測試骨架，納入完整 sim（movement/急停/輸入消費）。

### Out of scope
- 階段 B physics / 真 CS2 校準。
- pilot 實驗設計（§14 屬研究者，非工程；本 WP 只交付工具 + 方法論提醒）。
- 跨瀏覽器全面 QA（階段 A out of scope）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-9.1** | E2E 如何模擬 Pointer Lock + 原生滑鼠？ | Playwright 以合成輸入驅動 + 對 `crossOriginIsolated`/匯出檔斷言；Pointer Lock 行為以可控 harness（測試掛點）觸發，真原生輸入在手動驗收補。 | T1 |
| **OQ-9.2** | 計時效度的「合理」判準？ | 以受試者自身多次反應時間的中位數/分布落在 ~150–250 ms 量級為 sanity（非單值硬閾）；偏離則查管線（誤用 Date.now/frame）。 | T2 |
| **OQ-9.3** | 決定性回歸要不要 CI？ | 若 repo 有 CI 則加 workflow；否則提供 `npm run test:ci` 本機腳本，exit code 為閘。 | T3 |
| **OQ-9.4** | 附錄 E 哪幾項需手動 vs 自動？ | 自動：COI/決定性/匯出 schema/首發/反應分布；手動：原生輸入無加速、實際遊玩手感。逐項標註。 | T4 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
tests/e2e/full-drill.spec.ts          ← NEW (Playwright：drill→匯出→統計 全鏈路)          [FR-9.1]
tests/validity/reaction-time.test.ts  ← NEW (反應時間分布對照 150–250 ms)                  [FR-9.2]
tests/regression/determinism.spec.ts  ← NEW (自動化決定性回歸，沿用 WP-2 T4)               [FR-9.3]
docs/operational/acceptance-stage-a.md ← NEW (附錄 E 驗收清單 + 證據對照)                   [FR-9.4]
package.json                          ← MODIFY (test:ci 腳本；可選 CI workflow)            [FR-9.3]
```

### Data flow（E2E 全鏈路，FR-9.1）

```
Playwright：
  啟動 app（dev/preview，帶 COOP/COEP）
  → 斷言 crossOriginIsolated===true
  → 以測試 harness 啟動 counterstrafe_ad_v1 drill，合成完整一輪（移動/急停/開火/命中）
  → 觸發匯出 → 攔截下載 JSON
  → 斷言 JSON 符 schema（WP-7 T5）、events 含 visible/counter/fire、meta 完整
  → 斷言結果頁 §5 八指標數值與匯出資料一致（WP-8 統計=匯出）
```

### Interface contracts（測試 harness）

```ts
// 為 E2E 暴露最小測試掛點（dev/test build only）
window.__fpsTest = {
  startDrill(id: string): void;
  feedInput(seq: InputEvent[]): void;     // 合成輸入序列（含時間戳）
  forceExportJSON(): unknown;             // 回傳 payload 供斷言
  getMetrics(): Metrics;
};
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| 統計 ≠ 匯出 | 兩來源分歧 | E2E 斷言兩者一致（FR-9.1）；不一致即 fail |
| 反應時間異常（如 <50ms 或 >1s 系統性偏移） | 計時管線 bug | FR-9.2 sanity；偏離 → 查 Date.now/frame 誤用（附錄 F） |
| 決定性退化 | 後續改動偷渡 frame 依賴 | FR-9.3 自動回歸守護；CI/本機 exit code 閘 |
| 附錄 E 漏項 | 驗收不全 | T4 逐項對照 + 證據連結；缺項不交付 |

### Concurrency model
測試執行；無生產 worker。E2E 單瀏覽器序列執行。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **計時效度被破壞未被發現** | Med | **High** | FR-9.2 分布 sanity + FR-9.3 決定性回歸 + COI E2E 斷言；三道防線（附錄 F 對應） |
| E2E 無法真模擬原生輸入 | Med | Med | harness 合成輸入做自動鏈路；原生無加速以手動驗收補（OQ-9.1/9.4 標註） |
| 統計與匯出分歧上線 | Low | High | E2E 交叉斷言一致（FR-9.1） |
| 緩衝不足/隱藏整合 bug | Med | Med | WP-9 預留 1–1.5 天緩衝（PLAN 9.4）；附錄 E 為硬閘 |

### Technical debt
- 原生輸入 E2E 自動化困難 → 部分手動驗收。*Trigger*：需更高自動化覆蓋時引入更強 input harness。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 WP-0~8 全部 exit ✅（M1/M2/M3 達成）；鎖 OQ-9.1~9.4。 | WP-0~8 | Low | Low |
| **T1** E2E 整合測試 | [T1-e2e-integration.md](T1-e2e-integration.md) | Playwright：drill→匯出→統計全鏈路 + 統計=匯出（FR-9.1）。 | T0 | High | High |
| **T2** 計時效度驗證 | [T2-timing-validity.md](T2-timing-validity.md) | 反應時間分布對照 150–250 ms（FR-9.2）。 | T0 | Med | Med |
| **T3** 決定性回歸（自動化） | [T3-determinism-regression.md](T3-determinism-regression.md) | 自動化決定性回歸 + CI/腳本閘（FR-9.3）。 | T0 | Med | Med |
| **T4** 緩衝 + 附錄 E 驗收 | [T4-buffer-acceptance.md](T4-buffer-acceptance.md) | 處理未預期問題；map 附錄 E 全清單（FR-9.4）。 | T1, T2, T3 | Med | Med |
| **T5 / T-exit** Exit gate（M4） | [T5-exit-gate.md](T5-exit-gate.md) | 附錄 E 全綠；宣告 **M4 階段 A 交付**；收尾。 | T1–T4 | Med | Low |

### Acceptance criteria（PLAN WP-9 / 規格附錄 E / M4）→ task map
- [ ] 端到端整合（drill→匯出→統計）→ **T1**
- [ ] 計時效度（反應時間 150–250 ms 合理）→ **T2**
- [ ] 決定性回歸自動化 → **T3**
- [ ] 附錄 E 驗收清單全數通過 → **T4 + T5**

## Assumptions
- **A1**：WP-0~8 全部 exit ✅（M1/M2/M3 達成）。
- **A2**：計時效度為分布合理性（§14 受試者內相對值），非絕對延遲。
- **A3**：部分附錄 E 項（原生輸入手感）以手動驗收補（OQ-9.4）。
