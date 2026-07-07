# T4 — session setup 表單(自陳欄)+ meta.display 手動欄

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(meta.display 區塊就緒);與 T2/T3 可並行 |
| **Risk / Cplx** | Low / Low |
| **Touches** | ADD `src/ui/SessionSetup.ts`;MODIFY `src/data/metadata.ts`(手動欄)、`src/main.ts`(掛線)+ 測試 |
| **狀態** | ⬜ |

## Objective

GD-10 防線③的手動半邊(FR-C9):瀏覽器讀不到的顯示硬體事實(螢幕型號/原生解析度/
面板尺寸/觀看距離)由 session setup 表單自陳,進 `meta.display` 手動欄——**moderator
分析用,不承擔混淆控制**(語意記 schema)。

## In scope
- `SessionSetup.ts`(純 TS DOM,D1):四欄——`monitorModel`(自由文字)、
  `nativeW/nativeH`(數字;與自動偵測值並列顯示供受試者核對)、`panelInches`、
  `viewingDistanceCm`;全部**選填**(遠端受試者可能不知道)+「不確定」勾選。
- 表單時機:實驗 session 進入流程(T2 gate 之前或之後,與 gate 畫面同一流程頁);
  一般練習不彈出。
- `meta.display` 手動欄填值;schema.md 註記「self-reported, moderator-only」語意。
- 自陳 nativeW/H 與自動 `screen × dpr` 不一致 → 不擋(自動值才是 gate 依據),
  但記 `nativeMismatch: true`(分析端審查旗標)。
- **session 識別欄(FPSci R3,2026-07-07 grill 拍板——原 out-of-scope 懸案在此解決)**:
  `participantId`(必填,研究者發放代號)+ `sessionLabel`(選填,pre/post/day-N),
  進 meta `session` 區塊(v2 reserved,形狀歸 WP-16 T1)——跨場次離線串接鍵。

## Out of scope
- 知情同意等 pilot 行政欄(protocol 文件層,WP-22 T2 對帳是否需要)、
  表單資料的本地持久化(localStorage 便利性——觸發:pilot 多 session 重填煩)。
- 受試者管理/上傳後端(本地匯出為交付邊界,規格 §14;`participantId` 只是 metadata 鍵,
  非帳號系統)。

## Steps

- [ ] 表單元件 + 驗證(數字欄範圍 sanity)+ 單元測試。
- [ ] meta 手動欄 + `nativeMismatch` 邏輯 + 匯出測試。
- [ ] session 識別欄(`participantId`/`sessionLabel`)+ meta `session` 區塊 + 匯出測試。
- [ ] 流程掛線(實驗 session 才出現)實機驗證記 progress。
- [ ] schema.md 手動欄語意對帳。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 表單六欄(顯示四欄 + session 識別二欄)+ 不確定選項可用;匯出含手動欄、
  `nativeMismatch` 與 meta `session` 區塊;一般練習不受干擾;
  schema.md 語意明確(self-reported)。

## Commit

`feat(wp-20): T4 session setup 表單(顯示硬體自陳欄)+ meta.display 手動欄`
