# T2 — fullscreen 流程 + 資格閘(不合格拒入)

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(模式/DisplayState 就緒) |
| **Risk / Cplx** | **High** / Med(跨硬體判斷正確性 = GD-10 防線①的全部) |
| **Touches** | ADD `src/display/eligibilityGate.ts`、`src/ui/`(gate 畫面);MODIFY `src/main.ts`(實驗 session 進入流程)+ 測試 |
| **狀態** | ✅ 2026-07-08 |

## Objective

GD-10 防線①(FR-C7):實驗 session 進入前自動檢查**原生解析度 ≥ 實驗最高條件、
fullscreen 已進入、效能地板通過**;不合格 = **拒入並明示原因**——防「FHD 面板跑 QHD
條件 = 方向性錯誤資料」的統計必然。

## In scope
- `eligibilityGate.ts`:`runEligibilityGate(required, warmupP95Ms): GateReport`
  ([../README.md §2.3](../README.md))。三檢查:
  - 原生解析度:`screen.width × dpr ≥ required.minW && screen.height × dpr ≥ required.minH`。
  - fullscreen:`document.fullscreenElement != null`(gate 畫面提供進入按鈕;
    Fullscreen API 需 user gesture)。
  - 效能地板:warmup 探測(既有場景 idle render N 秒,frame p95 ≤ `PERF_FLOOR_MS`,
    T0 決議值)——T3 frameLog 未到位前先用局部量測,T3 落地後改консolidated 來源。
- gate 畫面(純 TS DOM):三項 pass/fail 逐項顯示 + 不合格原因(如「面板原生 1920×1080
  < 條件需求 2560×1440」);`GateReport.details` 全量進 `meta.display.gate`(事後可審查)。
- **fullscreen 中途退出防護**:`fullscreenchange` 監聽,實驗 session 中退出 →
  session 標 `suspect` + UI 警示(failure mode 表)。
- 實驗 session 概念最小落地:`enterExperimentSession(required)` 流程(gate → 鎖模式
  接口)——protocol 排程本體歸 WP-22 T2。

## Out of scope
- 對抗平衡/條件序列(WP-22 T2)、效能地板門檻校準(OQ-S3-1 pilot 後)。

## Steps

- [x] `eligibilityGate` 三檢查 + 單元測試(screen/dpr/fullscreen mock 矩陣)。
- [x] gate 畫面 + fullscreen 請求流程;拒入路徑以 UI 單元測試驗證(逐項原因 + 重試)。實機縮小視窗/假 required 端到端確認留 moderator(OQ-20.3)。
- [~] **DPI 矩陣手動驗證**:Windows 縮放 100%/125%/150% 的 `screen × dpr` 還原機制已以單元矩陣釘死(+ FHD 反例);真實面板端到端確認留 moderator 實機(OQ-20.3,progress ledger)。
- [x] fullscreenchange → suspect 測試(`experimentSession.test.ts`)。
- [x] `npx vitest run` 全綠(53 檔 / 390 test)。

## Definition of Done

- 三檢查各自可獨立紅/綠(測試矩陣);拒入畫面明示原因;DPI 矩陣三檔全對;
  `gate` 全量記 meta;中途退出 fullscreen 升 suspect。

## Commit

`feat(wp-20): T2 fullscreen 流程 + 資格閘(原生解析度/fullscreen/效能地板,不合格拒入)`
