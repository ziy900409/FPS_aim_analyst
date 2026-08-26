# WP-43(暫用編號)— Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(覆核 §0 讀碼發現;拍板 §2①②③④⑤ 五個決策;正式提出 §0-5/§7 缺口供使用者拍板;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Med |
| ✅ | **T1** 啟動畫面兩分岔 + `ResearcherMenu.ts` + `Controls.ts` 顯隱條件 | [T1-launch-researcher-menu.md](T1-launch-researcher-menu.md) | T0 | Med |
| ✅ | **T2** `SessionPlanSetup.ts` 排序清單 + 休息秒數 input;`SessionRunner.ts`/`metadata.ts` 型別與邏輯變更 | [T2-session-plan-reorder-rest.md](T2-session-plan-reorder-rest.md) | T0(可與 T1 並行) | Med–High |
| ✅ | **T-exit** 驗收 FR-H1~H4;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1 + T2 | — |

T1/T2 檔案熱區大致不重疊,可並行;`main.ts` 為共用檔案但改動區塊不同,T-exit 需等兩者完成才能一次性覆核零衝突。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §5](../README.md) 的 WP-43 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的四條紀律

1. **不得修改 `src/session/sessionSchedule.ts`(`buildFamilyOrder()` 本體)或 `src/session/sessionPlanPresets.ts`**:`SessionRunner.start()` 只是不再呼叫它們,函式本身與既有測試零改動(README §1.1 Out of scope)。
2. **`sessionPlanFamilyOrder`/`sessionPlanRestSeconds` 不得流入任何 `src/sim`/`src/metrics` 計算**:純 additive 稽核記錄欄位,比照 wp-40 對 `dpi` 的同款守門紀律。
3. **`Controls.ts` 顯隱條件變更前,先列出既有 e2e/手動驗收依賴其可見性的斷言**(README §3 失效模式第二項),避免無聲破壞既有回歸覆蓋。
4. **不得在未經使用者拍板前處置「實驗 session」按鈕(OQ-S8-5)**:T1 預設保留原按鈕、暫不歸類,不擅自刪除或塞入研究員模式。
