# WP-70 T5 — fullscreen 效度鏈路的迴歸防線

> ⚠️ **這個 task 存在的理由是 KI-040 §5**：WP-69 的 119 條 e2e 全綠卻漏掉本 bug，因為每一條
> Session Plan e2e 都走 `startSessionPlanWithoutGate()`，**從不進入 fullscreen**。
> 若本 WP 修完仍沒有走過 fullscreen 的測試，就是把同一個盲區原封不動留給下一個人。

## Objective

為「真的進入 fullscreen → 錄製中退出 → 該 run 標記 → 恢復 → 下一 run 乾淨」建立迴歸防線。

## 形狀由 T0 的 OQ-70.1 實測結論決定

### 路徑 A —— Playwright 可取得真 fullscreen（T0 判定可行）

1. 新增 e2e，覆蓋完整鏈路：
   - 真的通過資格閘（**不**用 `startSessionPlanWithoutGate`）進入 fullscreen，斷言
     `document.fullscreenElement != null` 且 `crossOriginIsolated === true`；
   - 錄製中退出 fullscreen → 斷言該 run 的 `meta.validity.fullscreenExited === true`；
   - 走 T4 的恢復入口回到 fullscreen → 同一項 restart、cursor 不動；
   - 下一個 run 全程在 fullscreen → 斷言其 `fullscreenExited === false`、`suspect === false`
     （**這一條才是 FR-70.1 的 live 反證**）。
2. 把 `startSessionPlanWithoutGate` 的存在與其盲區寫進 e2e 檔頭註解，讓下一個人知道哪些測試不覆蓋
   fullscreen。

### 路徑 B —— Playwright 無法可靠取得 fullscreen（T0 判定不可行）

1. **不假裝有覆蓋**。改為兩層具名替代證據：
   - 單元／整合層：以注入的 `fullscreenchange` 事件驅動完整鏈路（旗標 → meta → 橫幅 → 恢復流程），
     覆蓋除「瀏覽器真的給不給 fullscreen」以外的全部邏輯；
   - **具名手動驗證清單**：寫進 `docs/operational/`，逐步驟可勾選，含瀏覽器版本欄位與預期觀察值。
2. 在 `progress.md` 與 T-exit **明帳**：哪一段沒有自動化覆蓋、owner 是誰、為什麼、後續處置條件
   （例如「Playwright 支援後補上」）。⚠️ 不得只寫「已用手動驗證」而不說範圍。

## Definition of Done

- [ ] `npx playwright test --project=edge --workers=1` exit 0，計數記入 `progress.md`
- [ ] 採路徑 A：鏈路四段（進 fullscreen / 錄製中退出標記 / 恢復不推進 / 下一 run 乾淨）各有具名斷言
- [ ] 採路徑 B：單元層鏈路測試具名且綠 **且** 手動清單已落 `docs/operational/`
      **且** `progress.md` 具名記載未覆蓋範圍、owner、後續處置條件
- [ ] 無論哪條路徑：**「下一 run 乾淨」有證據**（這是 FR-70.1 的核心，不得只證「會標記」）
- [ ] e2e 檔頭或 `progress.md` 記載 `startSessionPlanWithoutGate` 的盲區，避免下次重演

## Commit

```text
test(wp-70): guard the fullscreen validity lifecycle
```
