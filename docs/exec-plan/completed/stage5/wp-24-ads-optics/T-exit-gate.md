# T-exit — Exit gate(ADS 鏈交付宣告)

> Part of [WP-24 ads-optics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README 狀態 + [上層 README §3](../README.md)) |
| **狀態** | ✅（2026-07-13） |

## Objective

宣告 WP-24 收斂:ADS 可用(輸入 → zoom/gain → overlay)且**狀態完整可記錄**——
WP-26 T3 的整合 drill(ADS on/off 條件)自此有完整武器面可消費。

## Steps

- [x] `npm run test:ci` exit 0(證據記 progress)。→ `tsc --noEmit` clean + Vitest **68 files / 556 tests** + Playwright **16 tests**(含 `WP-24 ADS smoke`)全綠。
- [x] 交付證據記 progress(Outcomes):
  - **輸入鏈**:EV_ADS 分桶消費 + stuck 防護 + ring 零破壞(T1)。
  - **zoom/gain**:GD-16 公式 golden + punch/aim 分離零改動(T2)。
  - **記錄**:tick flag/事件/meta round-trip + 決定性 ads fixture(T3)。
  - **手動**:開鏡體感(FOV/感度/overlay/準心置中)使用者實機確認(2026-07-10,T2 progress)。
- [x] OQ ledger 收斂:OQ-S5-1(GD-16)/OQ-S5-6/OQ-24.1 回填(progress OQ ledger 三項皆 ✅)。
- [x] CONTEXT.md 回寫:ADS/heldAds/zoom 感度換算 術語入 §A/§G(與本 task 同 commit)。
- [x] 索引翻牌:本資料夾 README 狀態 → ✅;[上層 README §3](../README.md) WP-24 列 → ✅。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;四項交付證據可追;OQ 收斂;CONTEXT 術語入帳;索引一致;
  **WP-26 T3 可直接以 config 宣告 ADS 條件**。

## Commit

`docs(wp-24): exit gate — ADS 鏈交付(輸入/zoom/overlay/記錄;GD-16)`
