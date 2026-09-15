# WP-70 T3 — 橫幅改由旗標真值驅動，文案改為 run 級

## Objective

修 KI-040 的缺陷 C。現行 `hideSuspectWarning()` 只有一個 production 呼叫點（資格閘 `onEnter`），
於是顯示狀態與旗標真值**雙向**脫鉤：

- restart 後旗標仍真、橫幅也不消（使用者回報的症狀）；
- 走資格閘重入時橫幅被關掉、但旗標仍真 ⇒ **UI 說沒事、資料說 suspect**（更危險的那一向）。

T1 之後旗標已是 per-run，橫幅必須跟著 per-run 反映，否則缺陷 C 的反向錯誤依然存在。

## Steps

1. 橫幅的顯示狀態改由**旗標真值**推導（每場開始即反映新值），而非由呼叫端決定。
   實作上維持 D1（純 TS + DOM overlay），DOM 於建構期一次配置、更新只改 text/style（NFR-70.4）。
2. **文案改寫**（FR-70.7）：現行「⚠ 已離開 fullscreen — 本 session 資料標記為 suspect(條件失效)。」
   在 run 級判準下**是錯的**。新文案須表達：
   - 失效範圍是**這一次測試**，不是整個 session；
   - 操作員的下一步（回到全螢幕 / 重新測試本項），與 T4 的入口文案一致。
   ⚠️ 文案定稿前對齊 `CONTEXT.md` 的正規術語（CLAUDE.md §2：命名前先對齊）。
3. 檢查是否有其他地方沿用舊的 session 級措辭（`docs/operational/`、operator manual、e2e 斷言字串），
   列成清單交 T6 統一改（本 task 只改 UI 本身，避免把文件變更混進 UI 切片）。
4. 測試：
   - 旗標假 ⇒ 橫幅 hidden；旗標真 ⇒ 橫幅 visible 且文案含 run 級措辭；
   - **新 run 開始後橫幅自動收起**（per-run 反映，這是缺陷 C 的正向反證）；
   - 更新路徑零新增 DOM node（`createElement` 計數不變，NFR-70.4，比照 `PauseOverlay.test.ts` 的
     `createdCount` 手法）。

## Definition of Done

- [ ] `npx vitest run` exit 0
- [ ] 「新 run 開始 ⇒ 橫幅自動收起」有具名測試，且改動前會紅
- [ ] 「旗標真 ⇒ 橫幅顯示」與「旗標假 ⇒ 隱藏」成對具名測試
- [ ] 更新路徑 `createElement` 呼叫數不變（機械計數，非目視）
- [ ] 新文案不含「本 session」字樣；舊措辭殘留點清單已列入 `progress.md` 交 T6
- [ ] 文案用詞已對齊 `CONTEXT.md`（若新增術語則同步補該檔，並在 `progress.md` 註明）

## Commit

```text
fix(ui): drive the suspect banner from the run flag
```
