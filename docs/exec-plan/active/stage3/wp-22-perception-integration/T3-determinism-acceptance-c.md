# T3 — 決定性回歸擴充 + 驗收清單 C + pilot protocol 文件

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1, T2 |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/loop/__tests__/`(回歸收編);ADD `docs/operational/acceptance-checklist-c.md`、`docs/operational/pilot-protocol-stage3.md` |
| **狀態** | 🟡 AUTO PASS 2026-07-09 14:59Z;manual true-fullscreen walkthrough pending |

## Objective

stage3 的防線與判準定稿(FR-C15):三條新決定性不變性收編進回歸套件;
驗收清單 C(M10 的機械判準)+ pilot 施測程序文件——交付的最後一哩。

## In scope
- **決定性回歸收編**(單元版 → 回歸套件,與 stage1/2 baseline 並列):
  - 跨場景不變性:同合成輸入,placeholder-room vs field-low vs urban-high →
    sim 狀態(tick index 鍵)逐位一致。
  - 跨解析度不變性:同合成輸入,三模式 → 同上。
  - seeded spawn 重現:同 seed → spawn 序列 golden;**既有 stage1/2 baseline 全綠維持**
    (無 seed 路徑零漂移)。
- `acceptance-checklist-c.md`(比照附錄 E 清單 A/B 句式;T0 草稿定稿):
  逐項 = 判定方式(自動測試名 / 手動步驟),涵蓋:場景置換×2、淨空拒載、資格閘
  拒入/放行、三模式 buffer 斷言、protocol 全流程 E2E、偵測 round-trip、追蹤×場景 E2E、
  三不變性、`test:ci` exit 0、ATTRIBUTIONS 稽核。
- `pilot-protocol-stage3.md`:兩實驗的施測程序(追蹤:場景×速度條件;偵測:
  解析度×2 對抗平衡)、受試者面說明(資格閘不過怎麼辦)、匯出檔命名/收集慣例、
  已知誤差界線(顯示鏈延遲、t_detect proxy 性質、upscale 語意——引 GD 條目)。
- 清單 C 全項首次執行:結果矩陣記 progress(紅項修到綠或明確標注)。

## Out of scope
- 新功能;分析端統計(spec 已定);規格書 v1.3 對帳(stage3 README §9 獨立項,
  可與本 task 並行由 docs slice 處理)。

## Steps

- [x] (2026-07-09 14:52Z) 三不變性收編回歸套件 + 既有 baseline 全綠。
- [x] (2026-07-09 14:57Z) `acceptance-checklist-c.md` 定稿(每項判定方式明確)。
- [x] (2026-07-09 14:57Z) `pilot-protocol-stage3.md` 初版(含誤差界線節)。
- [x] (2026-07-09 14:59Z) 清單 C 全項執行,結果矩陣記 progress(AUTO green;manual true-fullscreen walkthrough pending)。
- [x] (2026-07-09 14:59Z) `npm.cmd run test:ci` exit 0。

## Definition of Done

- 回歸套件含三不變性且全綠、既有 baseline 未動;清單 C 每項可機械判定或有明確
  手動步驟,且首輪執行全綠;pilot 文件含誤差界線(可直接拿去跑 pilot)。

## Commit

`feat(wp-22): T3 決定性回歸擴充(場景/解析度/seed)+ 驗收清單 C + pilot protocol`
