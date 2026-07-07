# T-exit — Exit gate(M6:壓槍玩法成立)

> Part of [WP-13 sim-camera-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告 **M6**:真瀏覽器內按住連發壓槍成立——視覺上跳、彈道 = viewAngles + rawPunch×2
+ spread、彈孔沿 pattern 分布;三計時效度防線不退化。

## Steps

- [ ] `npm run test:ci`(typecheck + vitest + playwright)exit 0,輸出記 progress。
- [ ] E2E 斷言清單確認:fire(10) punch 向量 = M5、彈著漂移方向、COI 斷言維持
      (WP-9 既有三防線不退化)。
- [ ] 手動壓槍驗證(dev server,鎖定後 AK 按住 30 發):
      ① 鏡頭上跳可見、放開後回落;② 彈孔分布 = 直升→之字 pattern 形狀;
      ③ 壓槍下拉可將彈著拉回目標(視覺≠彈道分離的手感確認);
      ④ overlay punch 數值與畫面一致。證據(截圖/錄影路徑)記 progress。
- [ ] 決定性回歸(WP-2 既有 + WP-11 fire 維度)全綠再確認。
- [ ] progress.md 寫 Outcomes;checklist 全 ✅;[../README.md §3](../../../active/stage2/README.md) WP-13 翻 ✅、
      **M6 標日期**;[exec-plan/README.md](../../../README.md) 同步。

## Definition of Done

- `test:ci` exit 0;手動驗證四項皆有證據;M6 於兩層索引標記 ✅ + 日期。
- M6 過 → WP-15(校準)/WP-16(指標匯出)可展開;WP-14 若尚未完成不阻塞此門
  (velocity gate 耦合屬 WP-14 T2)。

## Commit

`docs(wp-13): exit gate — 宣告 M6 壓槍玩法成立(視覺/彈道分離 + E2E golden)`