# KI-015 — Drill Results 缺少可發現的重測與資料保留操作

> 類型：UI flow / usability bugfix 紀錄。
> 狀態：**✅ 已修**（2026-08-26）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-015。

## 1. 症狀

Drill 結束後，`Drill Results` 以全螢幕 backdrop 顯示；現有 `Restart` 雖仍可操作，卻位於結果頁外的
底部控制列。使用者容易把被遮暗的背景視為不可操作，因此不知道如何以相同設定重測。

此外，Restart 會清空目前 recorder 與結果畫面，但 Results 內沒有資料保留提示，也沒有與結果脈絡相連的
JSON / CSV 匯出入口。這使「查看結果 → 保留資料 → 再測」不是一條可發現的流程。

## 2. 根因

`ResultScreen` 只負責呈現指標，沒有 next-action 區塊；`Controls` 的 Restart、drill / scene 選擇與
`ExportPanel` 的 JSON / CSV 各自存在於 backdrop 外部。雖然 layering 保證它們技術上可點擊，視覺階層卻
把它們與結果頁分離。

## 3. 修復決策

在 `ResultScreen` 內新增 sticky 操作列：

```text
Drill Results
  └─ 操作列
      ├─ 再測目前 Drill（primary；先確認會清除目前畫面結果）
      ├─ 匯出 JSON
      ├─ 匯出 CSV
      └─ 返回設定
```

- `ResultScreen` 只透過 optional callback 發出意圖；不得 import `DrillRunner`、recorder 或 export 模組。
- `main.ts` 重用既有 `restartActiveDrill()` 與 export payload 建立流程，確保 UI 不產生第二套重置／匯出語意。
- Restart 前明確要求確認，並在操作列長駐提醒先匯出需要保留的資料。
- 「返回設定」只關閉 Results，不重置本輪資料；使用者可先閱讀或調整設定，再由既有控制列選擇下一步。

未採用只提高背景 `Restart` 的 z-index 或改按鈕顏色：現有 layering 本來就可點，問題是使用者流程與視覺
脈絡，而非 hit testing。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/ui/ResultScreen.ts` | 新增 Results 內 sticky 操作列、確認提示與 callback 邊界。 |
| `src/main.ts` | 將既有重測與 JSON / CSV 匯出流程接入 Results callbacks。 |
| `src/ui/ResultScreen.test.ts` | 覆蓋結果頁內操作、匯出 callback、確認後重測與取消重測。 |

## 5. 回歸重點

1. Drill 結束 → Results 內可見「再測目前 Drill」、JSON、CSV、返回設定。
2. 點 Restart 並確認 → 呼叫既有 restart path；新一輪不混入前一輪 recorder 資料。
3. 取消確認 → 不啟動重測。
4. JSON / CSV 匯出不會關閉或重置 Results。
5. 長結果內容捲動時，操作列仍留在 Results 面板底部。

## 6. 遺留產品規則

練習／單一 Drill 的重測語意明確。正式 Assessment 或 Session Plan 中，是否允許將完成的條件重新計為正式
資料，仍須在協定層另行決策；本修復不改變既有 session 排程或 protocol 語意。
