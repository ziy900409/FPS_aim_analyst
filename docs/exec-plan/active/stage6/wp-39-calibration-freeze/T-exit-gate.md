# T-exit(M16) — 驗收 + 文件定稿 + stage6 收斂

> Part of [WP-39 calibration-freeze](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/acceptance-stage-f.md`、`docs/operational/pilot-protocol-stage6.md`、[CONTEXT.md](../../../../../CONTEXT.md)、本 WP README/task-checklist、[../README.md](../README.md)、視需要 `docs/exec-plan/completed/stage6/` |
| **狀態** | ⬜ |

## Objective

收斂 WP-39 與整個 stage6:驗證 `acceptance-stage-f.md` 12 項驗收條件全項通過;定稿 `pilot-protocol-stage6.md`;完成文件對帳;把 [stage6 README](../README.md) 的 WP-39 狀態翻 ✅ 並宣告 **M16 達成**,視需要把整個 `active/stage6/` 移入 `completed/stage6/`。

## In scope

1. 覆核 T3 的驗收清單 F 全項是否為 ✅(含跨家族一致性回歸測試)。
2. 定稿 `docs/operational/pilot-protocol-stage6.md`:施測程序、pilot seed roster 慣例、四個維度的候選探索方式、資格閘沿用。
3. 定稿 `docs/operational/acceptance-stage-f.md`。
4. [CONTEXT.md](../../../../../CONTEXT.md) 補新術語:`STAGE6_PROTOCOL_VERSION`、`DIAGNOSIS_THRESHOLDS_V1`、pilot seed roster 慣例。
5. [../README.md](../README.md):WP-39 狀態列翻 ✅;§4 里程碑門控 M16 完成條件覆核;頂部狀態段落更新為「stage6 交付」。
6. 覆核 §7 Open Questions(OQ-S6-24~27)是否全部關閉或明確移交。
7. 視使用者拍板,把 `docs/exec-plan/active/stage6/` 整個資料夾移入 `docs/exec-plan/completed/stage6/`(沿用既有 stage 完成慣例)。

## Out of scope

- 任何新功能開發或協定變更。

## Steps

- [ ] 逐一覆核 12 項驗收條件狀態,附證據連結。
- [ ] 定稿 `pilot-protocol-stage6.md`。
- [ ] 定稿 `acceptance-stage-f.md`。
- [ ] 回寫 CONTEXT.md 新術語。
- [ ] 翻 stage6 README §3/§4/頂部狀態段落。
- [ ] 覆核 §7 OQ 逐條關閉或移交狀態。
- [ ] 視拍板結果移動資料夾至 `completed/stage6/`。
- [ ] 最終 `npm run test:ci` 全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 驗收清單 F 全項通過 | `acceptance-stage-f.md` 逐項 ✅ + 證據連結 |
| ② | `pilot-protocol-stage6.md` 定稿 | 文件存在且涵蓋施測程序 |
| ③ | CONTEXT.md 新術語回寫 | diff 可見 |
| ④ | stage6 README WP-39 狀態翻 ✅,M16 宣告達成 | diff 可見 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`docs(wp-39): T-exit — calibration-freeze 驗收 + acceptance-stage-f.md 定稿 + M16 收斂`
