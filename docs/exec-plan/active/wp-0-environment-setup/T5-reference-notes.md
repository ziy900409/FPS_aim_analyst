# T5 — Reference notes（WP-1 預備學習）

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **非阻塞**：可在 T1–T4 任意時點進行，不擋 WP-0 exit-gate 的程式驗收。

| | |
|---|---|
| **Depends on** | 無（可平行） |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `docs/architecture/notes-fps-controls.md`（docs only） |
| **Status** | ✅ DONE（2026-06-30） |

## Objective

研讀 Three.js `PointerLockControls` 範例與 three-fps 類 repo，把 WP-1（FPS 控制 + Pointer Lock + 原始輸入）會踩到的關鍵點先整理成筆記，降低學習爬升對時程的衝擊（FR-0.5）。

## In scope
- 閱讀 `PointerLockControls` 官方範例、一個 three-fps 開源 repo。
- 輸出 `docs/architecture/notes-fps-controls.md`：精簡、可操作。

## Out of scope
- 任何 WP-1 程式（本 task 只產文件）。

## Design notes（筆記應涵蓋的問題清單）

- Pointer Lock 取得需**使用者手勢**（click）；Esc / 失焦會自動解除 → 重取流程怎麼接。
- `requestPointerLock({ unadjustedMovement: true })` 關 OS 加速；僅 Chromium 支援，須 catch `NotSupportedError` fallback（ADR-5，附錄 B）。
- yaw/pitch 累積與 pitch 夾角（避免翻轉）。
- `pointermove` 的 `movementX/Y` 與 `getCoalescedEvents()` 差異（後者供 WP-3 次幀採樣）。
- 為何視角更新屬「輸入/render」而急停 movement 屬「sim」（雙迴圈分工，ADR-2）— 釐清 WP-1 與 WP-2/3 邊界。

## Steps

- [x] 讀 `PointerLockControls` 範例與一個 three-fps repo；記來源連結。
- [x] 寫 `docs/architecture/notes-fps-controls.md`：依上方問題清單逐點整理，附程式片段引用（附錄 B 對照）。
- [x] 在 progress.md 記一筆完成 + 連結。

## Definition of Done

- [x] `docs/architecture/notes-fps-controls.md` 存在且涵蓋問題清單全部要點。
- [x] 至少標注 `unadjustedMovement` fallback 與 yaw/pitch 夾角兩個 WP-1 高風險點。

## Commit

`docs(wp-0): FPS 控制 / Pointer Lock 預備學習筆記（FR-0.5）`
