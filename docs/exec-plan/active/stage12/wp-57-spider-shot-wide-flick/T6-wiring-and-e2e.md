# WP-57 T6 — Arm-time 接線與實機 E2E

## Objective

把 drill 接上研究者控制列，讓 resolver 在 arm 時真的被呼叫一次；並以真瀏覽器證明三件事：**目標完整落在畫面內**、**resize 不改 sim**、**practice-only 零污染**。同時回填 OQ-57.3／57.4 的實機觀察。

## Steps

1. 讀當時的 `main.ts`：roster 陣列（約 line 179–181）與 `activeDrillConfig` 兩個賦值點（約 line 1236／1279），確認 arm 順序仍是「賦值 → `createTargetManager` 消費」。
2. roster 新增一項並綁 T3 的 scene id。**關鍵差異**：其他 drill 的 `source` 是模組載入期常數，本 drill 的 resolved config 必須在 arm 時產生——在兩個賦值點呼叫 `resolveSpiderShotWideV1(settingsPanel.fov, sceneManager.camera.aspect)`，把回傳值賦給 `activeDrillConfig`。
3. resolver 邏輯**不得**進 render callback；`main.ts` 只負責取兩個數字並呼叫一次。
4. 若 resolver 擲 typed error（FR-57.14），走既有 drill 載入失敗路徑呈現訊息，不 crash、不靜默回退到別的 drill。
5. E2E（`tests/e2e/spider-shot-wide.spec.ts`）：
   - **on-screen**：跑一段 run，對每個 `visible` 事件的目標座標做投影，斷言落在畫面內（`abs(ndc) <= 1 − screenMargin`）。這是 FR-57.4 的實機驗證，與 T1／T2 的純函式版互補；
   - **resize 不變性**：run 中途改變視窗尺寸，斷言後續 spawn 序列與未 resize 對照組逐位一致（NFR-57.5 的實機版）；
   - **translation locked**：斷言玩家世界座標在整段 run 內固定，而 yaw/pitch 仍可由滑鼠改變（FR-57.8）；
   - **practice-only**：斷言零 history mutation、無 compatibility cell、`DrillMetricRegistry` 無此 exact ID（FR-57.13）；
   - **交替與 timeout**：斷言 `zone` 嚴格中心↔周邊交替，且中心目標不受 `peekTimeoutMs` 撤除（`centerExemptFromTimeout`）。
6. 實機回填：
   - **T3 延後項（D-57.T3-3）**：FOV 60／75／120 三檔各一張實機截圖，顯示中心目標與左右最大 yaw 落點，並記錄目標對背景牆的可辨識度（README §3.1「視覺空曠」風險證據）。T3 沒有任何實機視覺證據，這是 arena 第一次被人眼看到。
   - **OQ-57.3**：以 FOV 60／75／120 三檔實玩，記錄「貼邊感」是否合適、目標是否曾感覺被切；
   - **OQ-57.4**：記錄 timeout 率、周邊到達總次數、每 cell 樣本數，判斷 `peekTimeoutMs = 2500` 是否造成右截、`timeLimitMs = 90000` 是否足夠。
7. 若 OQ-57.3／57.4 需要調整常數，**在本 task 內調整並重跑 T1～T3 的相關測試**（常數變更會改 arena 需求與 golden 之外的斷言）；調整後的值與理由寫進 [progress.md](progress.md) Decision Log。
8. 跑全量 Vitest + 全量 Playwright + `npm run build`。

## Invariants

- resolver 每次 arm 呼叫一次且僅一次；不在 render callback 內、不 per-tick。
- 不修改其他 roster 項的 `source`／`sceneId`。
- 不新增 Assessment 家族、不改 `TestFamilyId`、不改 `SessionPlanPreset`。
- 常數調整不得放寬 §2.5 的 arena 淨空或 FR-57.4 的 on-screen 保證。

## Definition of Done

- [ ] 可從研究者控制列載入並跑完整段 run。
- [ ] E2E on-screen 斷言綠（每個 visible 目標的投影都在畫面內）。
- [ ] E2E resize 不變性綠（實機版 NFR-57.5）。
- [ ] E2E translation locked 綠（位置固定、視角可動）。
- [ ] E2E practice-only 綠（零 history／零 compatibility／不在 registry）。
- [ ] E2E 交替與 `centerExemptFromTimeout` 綠。
- [ ] T3 延後的 FOV 60／75／120 三張實機截圖已附 [progress.md](progress.md)，含視覺空曠／可辨識度觀察（D-57.T3-3）。
- [ ] OQ-57.3／57.4 有實機證據回填（三個 FOV 檔位的觀察 + timeout 率 + 每 cell 樣本數）；若調整常數，相關測試已重跑且綠。
- [ ] 全量 Vitest／Playwright／`npm run build` exit 0。

## Commit

```text
feat(main): wire spider wide flick drill with arm-time resolution
```
