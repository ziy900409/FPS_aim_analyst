# KI-006 / C — Task checklist

> master task index。一個 task = 一個垂直切片;**當前 task 未 commit 不開下一個**(CLAUDE.md §3.1)。
> tech spec:[README.md](README.md) · running log:[progress.md](progress.md)

---

| # | Task | 交付 FR | 風險 | Done |
|---|---|---|---|---|
| T0 | [Entry gate:基線量測 + fixture 構念統計重現](T0-entry-gate.md) | — | Low | ✅ |
| T1 | [`construct.py`:registry `construct-v1` + 家族解析 + 檢查純函式](T1-construct-registry.md) | FR-C-1~6 · FR-C-9 · FR-C-10 | Med | ⬜ |
| T2 | [`run_pipeline` 佈線:`constructPresence` + 專屬 exit code](T2-pipeline-wiring.md) | FR-C-7 · FR-C-8 · FR-C-11 | Low | ⬜ |
| T3 | [文件 / 帳本對帳 + A2 前置條件回寫](T3-docs-ledger-reconcile.md) | FR-C-10 · FR-C-12~14 | Low | ⬜ |
| T-exit | [Exit gate:交付判定](T-exit-gate.md) | — | Low | ⬜ |

**commit 顆粒度**:各自一個原子 commit,**無 TDD 偏離**——本階段新增的是一道閘,新測試從第一次執行就綠(擋下 08:03 是預期行為,不是既有 bug 轉綠),與 [BD-001](../BUGFIX-DECISIONS.md) 的紅→綠合併情境不同。

**相依**:嚴格序列 `T0 → T1 → T2 → T3 → T-exit`。T1 的測試期望值直接取自 T0 重現的數字。

> **選項 B(重新採樣)不在本清單**。其執行落在 [KI-005-A / A2-T1](../KI-005-A/A2-blocked-plan.md);本計畫只交付 [README §6](README.md) 的驗收清單,並由 T3 回寫 A2 的前置條件。

---

## 每個 task 完成時

1. 更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / Open Questions),與切片一起 stage。
2. 把上表該列的 **Done** 翻 ✅。
3. 若產生跨計畫 / 偏離協議的決策 → 寫 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-006;純屬本階段的細節寫 progress。

## C 全部完成時

- [ ] [KI-006](../KI-006-m14-sample-no-counterstrafe.md) 狀態改為「🟡 C 已落地;B(重新採樣)待 A2」+ §4 選項 C 標「已落地」+ §6 **OQ-KI6-2 關閉**
- [ ] [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) §1 索引 + BD-006 條目補「C 落地」段(含四份 fixture 判定與凍結門檻)
- [ ] [KI-005-A / A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) 前置條件清單改為引用 [README §6](README.md) 的 B-1~B-5
- [ ] [CONTEXT.md](../../../CONTEXT.md) 新增 **construct presence gate** 詞條,與既有 **reliability gate** 互相指路
- [ ] [analysis-segments.md](../../operational/analysis-segments.md) flag 表 + “Real-export validation” 段加註 · [research/README.md](../../../research/README.md) fixture 表 · [MAP.md](../../MAP.md) / [exec-plan/README.md](../../exec-plan/README.md) 的 KI-006 敘述
