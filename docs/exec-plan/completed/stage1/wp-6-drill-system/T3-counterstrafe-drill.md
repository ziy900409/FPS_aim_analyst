# T3 — Counter-strafe drill 設定檔

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `drills/counterstrafe_ad_v1.json` |
| **Status** | ⬜ TODO |

## Objective
交付至少 1 個**完整可玩**的 counter-strafe drill 設定檔（FR-6.3），`drillId` 對齊匯出 metadata（附錄 C `counterstrafe_ad_v1`）。

## In scope
- `drills/counterstrafe_ad_v1.json`：左右交替 peek、合理目標數（如 20）、倒數、結束條件。

## Out of scope
- 多 drill 選單（→ WP-8）；統計（→ WP-8）。

## Design notes
- 對齊附錄 C：`"drillId": "counterstrafe_ad_v1"`。
- 參數選擇貼合 counter-strafe 練習（左右交替、距離適中）；數值佔位，pilot 校準。

```jsonc
{
  "drillId": "counterstrafe_ad_v1",
  "targets": { "count": 20, "distance": 8 },
  "sequence": { "alternation": "LR", "seed": 1 },
  "timing": { "countdownMs": 3000, "interTargetMs": 0 },
  "endCondition": { "type": "targetCount", "value": 20 }
}
```

## Steps
- [ ] 建 `drills/counterstrafe_ad_v1.json`（上方）。
- [ ] 用 DrillLoader 載入 → 驗證通過 → 可玩（手動跑一輪）。
- [ ] 確認 `drillId` 與附錄 C 一致（WP-7 metadata 會用）。

## Definition of Done
- [ ] drill 可端到端遊玩（倒數 → 左右交替 peek → 結束）；`drillId` 對齊 metadata 命名。

## Commit
`feat(wp-6): counterstrafe_ad_v1 範例 drill 設定檔（FR-6.3）`
