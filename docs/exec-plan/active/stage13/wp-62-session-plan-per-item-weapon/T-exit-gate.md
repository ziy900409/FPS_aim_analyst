# WP-62 T-exit — 驗收 gate

## Objective

以逐項具名證據宣告 WP-62 交付。本 WP **無獨立里程碑**，T-exit gate 即交付判定（比照 WP-27／WP-58）。

## Steps

1. 對 README §5 的 **A-62.1～A-62.7** 逐條列出證據：測試檔名 + 案例名、或指令 + 實際輸出。**不接受**「已完成」「運作正常」這類主觀語句。
2. 跑最終全量：`npm run typecheck` ×2、`npm run build`、全量 Vitest、全量 Playwright（`--workers=1`），記錄實測數字並與 T0 基線對比（只增不減）。
3. 收斂 OQ-62.1／62.2／62.3：各標記為「已決議（決議內容）」或「採用預設假設（理由）」，兩者皆須寫進 `progress.md`；不得留在未定狀態。
4. 把 FM-3（彈匣不足靜默停火）、FM-4（ADS 武器 × 禁 ADS drill）確認為**明帳接受的殘留風險**並寫入 `progress.md` 的已知限制段，附上離線偵測方式（`ammo` 逐發、`ads` 事件 + `meta.weapon.ads`）。
5. 更新索引：
   - [task-checklist.md](task-checklist.md) 全部 Done box 翻 ✅ + 交付段；
   - [stage13 README](../README.md) 的 WP 清單狀態與編號分配段；
   - [exec-plan README](../../../README.md) 階段 M 段落的 WP 範圍（WP-60 ~ WP-62）；
   - `DECISIONS.md` 的 `GD-n` 條目狀態翻 ✅ 並補 commit。
6. 執行 `graphify update .` 讓知識圖譜跟上本 WP 的程式碼變更。
7. 判定 WP 是否移入 `completed/`（協議 §3.5）；stage13 其餘 WP 仍 active 時，維持本 WP 於 `active/` 並在 checklist 標交付。

## Invariants

- 每條驗收條目都有可執行或可觀察的證據。
- 全量測試相對 T0 基線只增不減。
- 未決 OQ 一律有明文處置，不得留白。
- frozen 軌逐位不變的證據必須是**實跑產出的 digest 對比**，不是「沒改到那條路徑」的推論。

## Definition of Done

- [ ] A-62.1～A-62.7 逐條有具名證據（測試檔名 + 案例名，或指令 + 輸出）
- [ ] 最終全量：typecheck ×2、build、Vitest、Playwright 全數 exit 0，數字記入 `progress.md` 並與 T0 基線對比
- [ ] OQ-62.1／62.2／62.3 全數收斂（決議或明文預設假設）
- [ ] FM-3／FM-4 以「明帳接受的殘留風險 + 離線偵測方式」寫入 `progress.md`
- [ ] 四個索引（task-checklist／stage13 README／exec-plan README／DECISIONS.md）全部同步
- [ ] `graphify update .` 已執行

## Commit

```text
docs(wp-62): T-exit acceptance for per-item weapon selection
```
