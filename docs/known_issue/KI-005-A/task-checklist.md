# KI-005 / A — Task checklist

> master task index。一個 task = 一個垂直切片;**當前 task 未 commit 不開下一個**(CLAUDE.md §3.1)。
> tech spec:[README.md](README.md) · running log:[progress.md](progress.md)

---

## Stage A1 —— 可立即落地(不需新資料)

| # | Task | 交付 FR | 風險 | Done |
|---|---|---|---|---|
| T0 | [Entry gate:基線量測與受影響面盤點](T0-entry-gate.md) | — | Low | ✅ |
| T1 | [`mouseGain.ts` — counts→rad / gain / 角度累加單一來源](T1-mouse-gain-single-source.md) | FR-A-2 · FR-A-3 | **High** | ✅ |
| T2 | [匯出自我描述:`meta.fovDeg` + `meta.mouseIntegration`](T2-export-meta-additive.md) | FR-A-5 · FR-A-6 | Low | ✅ |
| T3 | [`pushMouse` 補 pointer-lock 閘](T3-pointer-lock-gate.md) | FR-A-8 | Low | ✅ |
| T4 | [tick 窗積分:`ticks[].dYaw/dPitch` + 三個閘](T4-tick-window-integration.md) | FR-A-1/4/7/9/10 | **High** | ✅ |
| T5 | [Python `omega_deg_s` 新欄位路徑 + `source` 揭露](T5-python-omega-source.md) | FR-A-11 · FR-A-12 | Med | ✅ |
| T6 | [文件 / 帳本對帳 + M14 解除條件明文化](T6-docs-ledger-reconcile.md) | FR-A-13 · FR-A-14 | Low | ✅ |
| T-exit | [A1 Exit gate:交付判定](T-exit-gate.md) | — | Low | ✅ |

**相依**:嚴格序列 `T0 → T1 → T2 → T3 → T4 → T5 → T6 → T-exit`。T1–T4 都動 `main.ts`,並行只會製造衝突。

**commit 顆粒度**:T5 的合成 fixture 補欄會讓 Python 測試期望值變動。
- 若 T4 一併改動 `research/fixtures/exports/synthetic_counterstrafe.json` ⇒ **T4 + T5 合併為單一已驗證綠的 commit**(比照 [BD-001](../BUGFIX-DECISIONS.md) 的 TDD 偏離慣例)。
- 若把 fixture 補欄全部留在 T5 ⇒ T4 可獨立綠燈 commit。

實作時擇一,並記入 [progress.md](progress.md) 與 BD-005。

> **T3 排在 T4 之前的理由**:mouse 樣本入 ring 的 pointer-lock 閘若沒先補,T4 的積分會把「未鎖定期間的滑鼠移動」算成 camera 從未套用的角位移 —— 守恆閘必破、ω 出現幽靈峰(見 [README §2.4 ①](README.md))。

---

## Stage A2 —— ⛔ **blocked on 新採樣**

> 詳見 [A2-blocked-plan.md](A2-blocked-plan.md)。**A1 的 exit gate 不包含這四項**。

| # | Task | 阻塞於 | Done |
|---|---|---|---|
| A2-T1 | 新採樣(240 Hz 機器,含 counter-strafe 構念;與 KI-006 選項 B 合流) | 研究者排程(OQ-A-5)+ KI-006 拍板 | ⛔ |
| A2-T2 | 四項複驗(含**關閉 FM-1 假設**的守恆檢查) | A2-T1 | ⛔ |
| A2-T3 | `seg-v2` 重掃 + 凍結(D-28.7 不得原地調參) | A2-T2 | ⛔ |
| A2-T4 | M14 ③④⑤ 逐項重新宣告 | A2-T3 **+ KI-006 獨立解除** | ⛔ |

---

## 每個 task 完成時

1. 更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / Open Questions),與切片一起 stage。
2. 把上表該列的 **Done** 翻 ✅。
3. 若產生跨計畫 / 偏離協議的決策 → 寫 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-005;純屬本 A1 的細節寫 progress。

## A1 全部完成時

- [x] [KI-005](../KI-005-omega-render-sim-aliasing.md) 狀態翻「✅ 選項 A 已落地(A1);A2(新採樣 + 複驗 + `seg-v2`)待排程」+ §7 逐項標記 A1/A2 歸屬 + 殘餘限制段(TD-1/TD-2/**FM-1 未證偽**)
- [x] [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) §1 索引 + BD-005 條目補 A1 落地段(含實測前後數字、兩個計畫階段新發現、明確未交付項)
- [x] [analysis-segments.md](../../operational/analysis-segments.md) · [schema.md](../../operational/schema.md) 同步
- [x] [exec-plan/README.md](../../exec-plan/README.md) · `stage4/README.md` · [MAP.md](../../MAP.md) 三處對帳 —— **M14 ③④⑤ 仍為撤回,只寫解除條件**
- [x] 複查全文:**沒有任何一處把「儀器修好」寫成「效度恢復」**
