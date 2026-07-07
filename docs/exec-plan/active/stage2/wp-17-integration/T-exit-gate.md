# T-exit — Exit gate(M8:stage2 交付;含驗收清單 B)

> Part of [WP-17 integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 原 outline 的 T3(驗收清單 B)**併入本檔**(比照 issue-26「T7 / T-exit」合併寫法)。

| | |
|---|---|
| **相依** | T1, T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/兩層索引)+ `../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`(附錄 E 增節) |
| **狀態** | ✅ PASS 2026-07-07 |

## Objective

宣告 **M8 = stage2 交付**:驗收清單 B 全項客觀通過、CI 全綠、文件對帳收斂、
technical debt 落帳成為 stage3 的入口。

## Steps

- [x] **驗收清單 B 撰寫**(比照規格附錄 E 格式,~10 項,每項客觀可勾),落規格書**附錄 E-B**。涵蓋:
      ① M5 golden(彈道表/punch 向量/抑制係數) ② M6 壓槍手感 E2E ③ M7 校準(cl_showpos + pattern)
      ④ schema v2 對帳 + 溢位保護 ⑤ 決定性 punch/彈著 × 3 FPS ⑥ COI 三計時防線
      ⑦ `Math.random` 於 `src/sim`/`src/recoil` grep = 0 ⑧ 彈孔單一 draw call
      ⑨ 壓 30 發不掉 tick(NFR 抽查) ⑩ `test:ci` exit 0。
- [x] 逐項執行 + 勾選;證據(指令輸出/測試名)連結記 progress(見 2026-07-07 T-exit log)。
- [x] `npm run test:ci` 最終跑 **exit 0**(Vitest 43 files/326 + Playwright 10),輸出記 progress。
- [x] [../README.md §3](../README.md) WP-17 翻 ✅、**M8 標日期**;[exec-plan/README.md §2/§3](../../../README.md) 同步。
      **stage2 資料夾移 `completed/`:暫緩**——WP-18(F5)仍在 `active/stage2/` 且 entry 僅餘 M8(現已達成),
      整個 stage2 尚未全數交付;待 WP-18 收斂或使用者指示再整體移入(協議 §5,已於 progress 記錄待確認)。
- [x] progress.md 寫 stage2 Outcomes 總結(交付 / Surprises / technical debt——
      [../README.md §7](../README.md) 四項有意識妥協照抄收錄)。

## Definition of Done

- 驗收清單 B 全 ✅ 且入規格書;M8 於兩層索引 ✅ + 日期;`test:ci` exit 0 證據可追;
  technical debt 清單落 progress(stage3 規劃的既知起點)。

## Commit

`docs(wp-17): exit gate — 宣告 M8 stage2 交付(驗收清單 B 全項通過)`
