# WP-58 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／排程層現況稽核／決策凍結 | [T0-entry-gate.md](T0-entry-gate.md) | WP-56 不受影響之確認 | Med |
| ✅ | **T1** Drill ↔ Family 雙向單一來源 | [T1-drill-family-registry.md](T1-drill-family-registry.md) | T0 | Med |
| ✅ | **T2** Session Program 純函式編譯器 | [T2-program-compiler.md](T2-program-compiler.md) | T1 | Med |
| ✅ | **T3** SessionRunner 游標化／runtime 接線 | [T3-runner-cursor-and-wiring.md](T3-runner-cursor-and-wiring.md) | T2 | **High** |
| ✅ | **T4** Session Plan 表單改版／程式預覽 | [T4-setup-ui-and-preview.md](T4-setup-ui-and-preview.md) | T2（可與 T3 並行） | Med |
| ✅ | **T5** Metadata 稽核欄位／逐輪匯出／cohort 隔離 | [T5-metadata-and-export.md](T5-metadata-and-export.md) | T3 | Med/High |
| ✅ | **T6** E2E 整合／回歸對帳 | [T6-e2e-and-regression.md](T6-e2e-and-regression.md) | T3 + T4 + T5 | Med |
| ✅ | **T-exit** WP-58 驗收 | [T-exit-gate.md](T-exit-gate.md) | T1～T6 | Med |

## Package Definition of Done

- [x] 使用者情境「Drill A ×3（間隔 30s）→ 60s → Drill B ×3 → 60s → Drill C ×3」可在表單編排、在預覽表看見 17 步、並無人工介入跑完。
- [x] frozen「標準 Assessment」路徑的家族順序、休息時長、熱身解析與匯出內容與本 WP 之前**逐位一致**，且有測試證據。
- [x] `compileSessionProgram()` 為決定性純函式，五條編譯規則與非法輸入矩陣全綠，模組邊界掃描通過。
- [x] 全 repo 只有一份 family allowlist、一個 Session Plan runtime、一條 rest overlay 路徑（KI-016 不重演）。
- [x] practice-only drill 可排入 program 但不取得 Assessment 資格；`custom` session 不進 frozen trend cohort。
- [x] 同一 drill 的每一輪產生唯一檔名的匯出，並可定位 `itemIndex`／`repIndex`；每輪 seed 可稽核。<br>**T0 更正（OQ-58.1 收斂為「逐輪相同」）**：唯一檔名由既有 `startedAt` 保證（不加 rep 序號）；「每輪 seed 可稽核」= 沿用既有 `sequence.seed` 的 metadata 機制，**不新增逐輪 seed 推導**。另須寫入「reps 重播同一組刺激、不得視為 i.i.d. 取樣」的分析限制。
- [x] 既有決定性／hit／recoil／ADS／result／history／replay 回歸**零修改**全綠；build／typecheck／Vitest／Playwright exit 0。

## Commit discipline

每個 task 單獨 commit；建議 subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md)與上層 stage12 checklist。

---

## 交付（2026-09-09）

WP-58 ✅ **T-exit 交付**。T6 交上來的 OQ-58.6／58.7 皆由 owner 拍板並在 T-exit 落地（詳見 [progress.md](progress.md) §T-exit §0）：

- **OQ-58.6** — `tracking` 家族的代表 drill 改為已綁場景的 `tracking_scene_v1`，並新增**不變量 5**（每個家族的代表 drill 必須自綁場景；`counterstrafe` 為唯一明帳例外）與 frozen live e2e 的實機證據。
- **OQ-58.7** — Session Plan 進入 `done`（正常收工或中止）即 `experimentSession.exit()`，收斂為單一掛點。

全量 Vitest **2,688 passed／2 skipped**、`npm run test:ci` exit 0（含全量 Playwright **99 passed**）。A-58.1～9 逐項有具名測試證據。
