# WP-18 — f5-subtick:F5 移動 drill + sub-tick 命中內插(⏸ 門控 stub)

> stage2 執行計畫的 WP 子資料夾——**佔位 stub,尚未展開**(本資料夾只有本檔)。
> 上層 spec:[../README.md](../README.md)

| | |
|---|---|
| **目標** | F5 移動目標 drill + 目標 sub-tick 命中內插(FR-B17:命中位置對齊 fire 時間戳,取代「最近 tick 位置」的已知偏差)+ 追蹤指標 |
| **里程碑** | — |
| **相依** | **門控:OQ-S2-5** + WP-17(M8)✅ |
| **對應 FR** | FR-B17 |
| **估時** | +2–3.5 dev-days(門控解除後另計,不在 stage2 主估時內) |
| **狀態** | ⏸ 門控中(不展開、不排程) |

---

## 為什麼門控

「移動 + counter-strafe」同屏會造成**能力混淆**:移動追蹤能力與急停執行品質
在資料中無法分離,研究設計(自變因/依變因/drill 隔離方式)未決之前,
實作只會產出無效度資料。決議點 = **OQ-S2-5**([../README.md §8](../README.md);
規格附錄 F / GD-1 遺留議題)。

## Entry 條件(全部達成後才展開 task 檔)

1. **OQ-S2-5 決議**落 [DECISIONS.md](../../../DECISIONS.md):drill 隔離方式
   (移動目標與 counter-strafe 是否分 drill / 混合設計)+ 追蹤指標定義。
2. **WP-17(M8)✅**:stage2 主鏈已交付,決定性防線在位(移動目標動 sim 每 tick
   狀態,必須在回歸防線上改)。

## 展開時的內容來源(屆時比照其他 WP 建全套檔)

- 範圍收斂:[../README.md §0.2](../README.md)(規格 §1.3 階段 B(4))與
  [../README.md §3](../README.md) WP-18 列。
- 研究設計依據:規格附錄 F([../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md))。
- 技術要點(FR-B17):fire 時間戳 t 落於 tick n / n+1 之間 → 目標命中位置取兩 tick
  位置的內插(sub-tick 對齊),取代「最近 tick 位置」;移動目標的 per-tick 更新
  屬 sim loop 既定擴充點(規格移動目標條目,2026-07-03 已納入)。
- 檔案結構:README(full)+ task-checklist + progress + T0-entry-gate → Tn → T-exit-gate,
  格式照本資料夾同層其他 WP。
