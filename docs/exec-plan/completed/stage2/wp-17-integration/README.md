# WP-17 — integration:全鏈路 E2E + 決定性回歸 + 驗收清單 B(M8)

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../../../completed/stage2/README.md)
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | stage2 交付門:決定性回歸擴充(punch/彈著序列 × 多 FPS)、`__fpsTest` 壓槍 drill 全鏈路 E2E(drill → 匯出 → 統計)、驗收清單 B 全項通過 → **M8** |
| **里程碑** | **M8**:stage2 交付 |
| **相依** | WP-15(M7)、WP-16 |
| **對應 FR** | FR-B16(+ 驗收清單 B 抽查覆蓋 FR-B1~B15) |
| **估時** | 1.5–2.5 dev-days |
| **狀態** | ✅ **M8 交付(2026-07-07)**:驗收清單 B 全 10 項通過、`test:ci` exit 0、文件對帳收斂 |

---

## 1. 範圍

**In scope**:

```
tests/regression/determinism.test.ts     ← MODIFY 擴充 punch/彈著案例(或並列 NEW spray-determinism.test.ts) [T1]
tests/golden/recoil/spray-baseline.json  ← NEW 基準檔(punch/彈著序列,tick-index 鍵)                        [T1]
tests/e2e/spray-drill.spec.ts            ← NEW 壓槍 drill 全鏈路(fire(30) 經 debug API)                     [T2]
規格書附錄 E 增節(驗收清單 B)+ 兩層索引 M8 宣告                                                            [T-exit]
```

**Out of scope**:新功能/新欄位(全鏈路暴露缺口 → 記 blocker 回上游 WP 修,本 WP 不就地補);
效能 profiling 深潛(NFR 抽查在驗收清單 B 內,超標才另立案)。

## 2. 關鍵契約

- 決定性(FR-B16):同 `rngSeed` + 同合成輸入序列(fire down/up + 合成 aim)→
  punch 序列與彈著序列(tick index 鍵)逐位一致,pump 60/144/240 FPS 不變;基準檔入 repo。
- E2E 經 `__fpsTest` debug API 驅動(合成 fire(30),不硬測 pointer lock 真滑鼠);
  COI 斷言(`crossOriginIsolated === true`)維持——三計時防線不退化(NFR)。
- 驗收清單 B:比照規格附錄 E 格式,~10 項,每項客觀可勾(M5–M7 證據 + NFR 抽查)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 全鏈路才暴露的上游缺口(欄位缺 / 時序錯) | M8 卡住 | 記 blocker 回上游 WP 修;本 WP 不就地補功能(範圍紀律) |
| 多 FPS pump 下序列不一致 | 決定性破功 = 研究效度危機 | 最高優先歸因(M5 golden 可切分公式 vs 接線);修復前 M8 不宣告 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | WP-15(M7)/ WP-16 exit 驗證 | — | Low |
| **T1** | [T1-determinism-regression.md](T1-determinism-regression.md) | punch/彈著決定性回歸 × 60/144/240 FPS | T0 | Med |
| **T2** | [T2-e2e-full-chain.md](T2-e2e-full-chain.md) | 壓槍 drill 全鏈路 E2E(含 COI) | T1 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | **M8 門**:驗收清單 B + 宣告(原 outline T3 併入本檔) | T1, T2 | — |
