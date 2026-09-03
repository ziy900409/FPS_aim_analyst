# WP-55 T3 — All Tracking Drill Coverage

## Objective

覆蓋 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`，讓三類現有 tracking drill 都能輸出 contact samples、P0 summary 與 reason-coded blocked result；BR/projectile transfer tracking 必須與 pure tracking 分層。

## Dependencies

- T2 completed。
- T0 roster 已凍結；若 WP-54 新 tracking drill 已存在，只驗 contract compatibility，不擴大成 WP-54 release。

## Steps

1. 為 `tracking_v1` 建至少一份 fixture，產出 contact samples、TOT、RMS epsilon、acquisition parity。
2. 為 `tracking_longrange_v1` 建至少一份 fixture，產出 contact samples，並驗證 longrange hitbox/source unit 對表。
3. 為 `tracking_br_v1` 建至少一份 fixture，產出 aim-ray contact samples，並保留 ADS/projectile/hitscan companion fields。
4. BR report/test 分開呈現 `aimRayOnTarget` 與 ballistic `hit`；pure tracking summary 不讀 hit count、damage 或 kill。
5. protocol-incompatible run 不進 aggregate，但仍顯示 reason code 與 exclusion count。
6. 若 WP-54 候選 drill 已存在，只驗證能接入 contact artifact contract；不發布新 pilot metric。
7. 重跑 legacy drill id、frozen parameters 與 target lifecycle tests。

## Required coverage matrix

| Drill | Required evidence | Special rule |
|---|---|---|
| `tracking_v1` | contact samples、TOT、RMS epsilon、acquisition parity | pure tracking summary 不讀 hit count |
| `tracking_longrange_v1` | contact samples、longrange hitbox/source unit parity | hitbox/epsilon 單位必須可追溯 |
| `tracking_br_v1` | aim-ray contact samples、ADS/projectile/hitscan companion fields | ballistic hit 與 aim-ray on-target 分欄 |
| WP-54 candidates | contract compatibility only | 不擴大到 WP-54 pilot metric release |

## Definition of Done

- [ ] `tracking_v1` fixture 產出 contact samples、TOT、RMS epsilon、acquisition parity。
- [ ] `tracking_longrange_v1` fixture 產出 contact samples，且 longrange hitbox/source unit 對表。
- [ ] `tracking_br_v1` fixture 產出 aim-ray contact samples，且 ADS/projectile/hitscan companion fields 不污染 pure summary。
- [ ] BR report/test 分開呈現 `aimRayOnTarget` 與 ballistic `hit`；pure tracking summary 不讀 hit count、damage 或 kill。
- [ ] protocol-incompatible run 不進 aggregate，且 reason code/exclusion count 可追溯。
- [ ] WP-54 新 tracking drill 若已存在，只有 contract compatibility evidence，沒有混入新 metric release scope。
- [ ] legacy drill id、frozen parameters、target lifecycle tests 全綠。

## Commit

```text
test(tracking): cover contact artifacts across tracking drills
```
