# WP-23 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 hitbox config 化 | ⬜ |
| T2 遠距 drill config | ⬜ |
| T3 round-trip + 決定性 | ⬜ |
| T-exit(M11) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-4 遠距 drill 設計矩陣(角尺寸/角速度/距離/hitbox;角尺寸下限) | 🟡 待 T0 | 計畫預設:角高 0.5°–2° × 角速度 5–20°/s 各 2 階;下限 0.5°(混疊防線);T0 拍板記此處 |
| OQ-23.1 hitbox 單一來源落點(型別/常數宣告在哪一檔) | 🟡 待 T0 | 候選:`src/state/types.ts`(Vec3 同居地)或 `src/drill/DrillConfig.ts`;T0 讀碼後定 |
| OQ-23.2 遠距 drill 的 display scale 與場景尺度(`field-low` 是否直接可用) | 🟡 待 T2 | 預設沿用既有 display scale 機制;`field-low` 走廊長度不足時記 WP-26 br-field 需求 |

---

## Log

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(同幾何零新門檻——hitbox config 化必須保住「命中 ⇔ on-target 同 AABB」)、
  WP-18 交付形狀(motion/sub-tick 內插/tracking_v1/追蹤指標推導)、2026-07-10 架構評估
  (hitbox 為 {1,2,1} 寫死常數、三處重複:TargetManager.ts:57 / clearance.ts:8 / trackingDerivation DEFAULT_OPTIONS)。
- 設計要點:**零破壞不變式**(省略 hitbox 欄 = 現行常數逐位不變)是 T1 的 DoD 首項;
  遠距 drill 以**角參數**(角尺寸/角速度)反推距離與 hitbox,非直接指定絕對距離。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 上游驗證 + OQ-S5-4 拍板,docs-only。
