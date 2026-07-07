# WP-18 — f5-subtick:F5 移動 drill + sub-tick 命中內插(🟢 ready · 未展開 stub)

> stage2 執行計畫的 WP 子資料夾——**佔位 stub,尚未展開**(本資料夾只有本檔)。
> **門控已解除(2026-07-07,M8 ✅);兩個 entry 條件皆達成,待排程展開(建議隨 stage3 一起排,下游 = WP-22)。**
> 上層 spec:[../README.md](../README.md)

| | |
|---|---|
| **目標** | F5 移動目標 drill + 目標 sub-tick 命中內插(FR-B17:命中位置對齊 fire 時間戳,取代「最近 tick 位置」的已知偏差)+ 追蹤指標 |
| **里程碑** | — |
| **相依** | ~~門控:OQ-S2-5~~ **✅ 已解(GD-7,2026-07-06 grill)**+ WP-17(M8) |
| **對應 FR** | FR-B17 |
| **估時** | +2–3.5 dev-days(門控解除後另計,不在 stage2 主估時內) |
| **狀態** | 🟢 entry 全達成(2026-07-07)· 未展開;待排程——建議隨 stage3 一起(下游 = WP-22) |

---

## 為什麼(曾)門控 — 現已解除

> **狀態更新(2026-07-07):兩個 entry 條件皆達成,門控解除。** 以下為門控原委與解除依據,保留供展開時參照。

「移動 + counter-strafe」同屏會造成**能力混淆**:移動追蹤能力與急停執行品質
在資料中無法分離,研究設計(自變因/依變因/drill 隔離方式)未決之前,
實作只會產出無效度資料。決議點 = **OQ-S2-5**([../README.md §8](../README.md);
規格附錄 F / GD-1 遺留議題)——**已於 GD-7 拍板**(drill 隔離 + 指標層獲取/追隨分離)。

**「門控解除」≠「立即展開」**:WP-18 不在 stage2 主估時內(+2–3.5 dev-days 另計),
唯一下游消費者為 stage3 [WP-22 T1](../../stage3/wp-22-perception-integration/README.md)。
排程建議 = 隨 stage3 規劃一起排(WP-19/20/21 可並行,WP-18 併入關鍵路徑更順),
而非在 stage2 尾段單獨展開。展開時比照同層其他 WP 建全套 task 檔。

## Entry 條件(全部達成後才展開 task 檔)

1. ~~OQ-S2-5 決議~~ **✅ 已解(2026-07-06 grill)**:落 [DECISIONS.md **GD-7**](../../../DECISIONS.md)
   ——drill 隔離(純追蹤與急停分離)+ 指標層獲取/追隨分離(`t_acquire` vs 追蹤窗口內
   TOT%/RMS ε)+ 資料策略(記錄全套:逐 tick 目標/玩家位置,欄位落 WP-16 schema v2)。
2. **WP-17(M8)✅(2026-07-07)**:stage2 主鏈已交付,決定性防線在位(移動目標動 sim 每 tick
   狀態,必須在回歸防線上改)。**兩個 entry 條件皆達成 → 門控解除。**

## 展開時的內容來源(屆時比照其他 WP 建全套檔)

- 範圍收斂:[../README.md §0.2](../README.md)(規格 §1.3 階段 B(4))與
  [../README.md §3](../README.md) WP-18 列。
- 研究設計依據:規格附錄 F([../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](../../../../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md))。
- 技術要點(FR-B17):fire 時間戳 t 落於 tick n / n+1 之間 → 目標命中位置取兩 tick
  位置的內插(sub-tick 對齊),取代「最近 tick 位置」;移動目標的 per-tick 更新
  屬 sim loop 既定擴充點(規格移動目標條目,2026-07-03 已納入)。
- **指標與資料定義(2026-07-06 已拍板,展開時直接引用)**:[DECISIONS.md GD-7](../../../DECISIONS.md)
  (on-target/ε(t)/t_acquire/TOT%/RMS ε 正規定義同 [CONTEXT.md §A](../../../../CONTEXT.md));
  原始欄位(逐 tick `tx/ty/tz/px/pz`)由 WP-16 schema v2 供給。
- **展開時納入範圍**:timed presentation 政策(追蹤 drill 依時長呈現)+ render 端
  目標 alpha 內插(移動目標視覺平滑;player 已有,目標比照 `RenderSnapshot` prev/curr)。
- **下游消費者**:stage3 [WP-22 T1](../../stage3/wp-22-perception-integration/README.md)
  (追蹤 drill × BR 場景);交付形狀對帳點 = stage3 OQ-S3-5(本 WP T0 展開時互驗)。
- 檔案結構:README(full)+ task-checklist + progress + T0-entry-gate → Tn → T-exit-gate,
  格式照本資料夾同層其他 WP。
