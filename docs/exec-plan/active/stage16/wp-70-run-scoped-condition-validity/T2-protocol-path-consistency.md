# WP-70 T2 — protocol 路徑補上錄製窗判準

> ⚠️ 本 task 的方向與 T1 **相反**：T1 放寬（跨 run 不繼承），T2 **收緊**（protocol 路徑本來漏判）。
> 兩者同一個 WP 落地，`progress.md` 必須分別記錄，不得混為「一次調整」。

## Objective

消除 fullscreen 退出判準的**第二套實作**（C-D4）：protocol 路徑目前未套用 KI-007 的錄製窗閘。

## 背景（規劃期讀碼所見，T2 須以當前行號複核）

```ts
// main.ts 的 fullscreenchange 處理器
experimentSession.handleFullscreenChange(fullscreen, recording); // ← 有 recording 閘
if (!fullscreen) markProtocolFullscreenExit?.();                 // ← 沒有
```

`markProtocolFullscreenExit` 接到 `activeProtocolRunner.markCurrentConditionSuspect('fullscreen-exit')`。
⇒ **drill 之間（`idle`／`ended`）退出全螢幕也會把 protocol 的當前 condition 標 suspect**，
而 KI-007 當初正是為了避免這種誤判才引入 `recording` 判準——但只套用在 `experimentSession` 上。

## Steps

1. 以當前行號複核上述不對稱仍然成立（不沿用本文件的行號）。
2. 讓 protocol 路徑套用**同一個** `recording` 值。⚠️ 不得複製判準運算式，要用同一個變數
   （C-D4：一個構念一個定義）。
3. 找出所有因此改變期望值的既有測試，逐條檢視：
   - 若期望值改變是**本 task 的意圖**（drill 之間退出不再標記）⇒ 更新期望值並在測試註解寫明
     「KI-007 判準，WP-70 T2 補齊」；
   - 若期望值改變**不在意圖內** ⇒ 那是真回歸，停下來查（FM-70.5）。
4. 新增測試：protocol 條件在 `idle`／`ended` 退出全螢幕 **不**標記；在 `countdown`／`running` 退出
   **仍**標記（成對，缺任一條都會讓另一條在 rig 沒跑起來時也綠）。

## Definition of Done

- [ ] `npx vitest run` exit 0
- [ ] 成對測試（錄製中標記 / 非錄製中不標記）皆具名且皆綠
- [ ] source-scan 或型別層證明 protocol 與 session 路徑**共用同一個** `recording` 判準值（C-D4）
- [ ] 所有期望值變動的既有測試**逐條列在 `progress.md`**，每條附變動理由與 KI-007 依據（FM-70.5）
- [ ] `npx vitest run tests/regression` 計數與 baseline 逐數相同，或差異逐條有理由

## Commit

```text
fix(protocol): apply the recording window to fullscreen exits
```
