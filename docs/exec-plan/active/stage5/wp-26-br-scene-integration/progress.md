# WP-26 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 br-field 資產 | ⬜ |
| T2 場景上線 | ⬜ |
| T3 整合 drill + protocol | ⬜ |
| T4 E2E + 驗收清單 E | ⬜ |
| T-exit(M13) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-3 br-field 資產路線(程序化生成 vs CC0 pack) | 🟡 待 T0 | 計畫預設:程序化生成 CC0(WP-19 先例;GD-9 完全合規、propBounds 與視覺同源);Kenney/Quaternius 保留為寫實置換備選 |
| OQ-26.1 br-field 雜亂度階層定位(low?mid?新階?)與 clutterTier 值 | 🟡 待 T0 | 預設:`clutterTier: 'low'`(開闊麥田情境,與 field-low 同階但地形尺度不同);若研究需要 BR 場景為獨立對照階,記 GD 議題 |
| OQ-26.2 protocol 條件矩陣(ADS × 彈道 × 角尺寸的組合數與對抗平衡) | 🟡 待 T3 | 預設:2(ADS on/off)× 2(hitscan/projectile)× 2(角尺寸檔)= 8 條件受試者內;實際裁剪為研究設計決策 |
| OQ-26.3 走廊長度與 display scale(遠距檔位在 br-field 的擺法) | 🟡 待 T1/T2 | 承 WP-23 OQ-23.2;地形設計時視線走廊先行 |

---

## Log

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-9(寫實原創 + 白名單——**附圖 PUBG 麥田為情境參考,非復刻目標**;
  雜亂度階層才是實驗規格)、GD-6(純裝飾 + 淨空——BR 地形不進 sim、不擋彈)、
  M9 機制(場景 = 資料,零引擎碼被測試釘死)、WP-22 T2 protocol 機制(條件序列宣告式)。
- 設計要點:本 WP 是 stage5 的**整合交付閘**——BR 跟槍測試「實際可跑」的定義 =
  `tracking_br_v1` 在 br-field 一鍵執行、匯出含 ads/hit/追蹤欄、離線推導可算跟槍效率、
  三條決定性不變性全綠(驗收清單 E)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 上游驗證 + OQ-S5-3 拍板,docs-only;
  T1 資產工作可在 WP-23/24/25 進行中提前並行。
