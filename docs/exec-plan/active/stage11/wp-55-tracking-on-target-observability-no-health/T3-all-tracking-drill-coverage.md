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

- [x] `tracking_v1` fixture 產出 contact samples、TOT、RMS epsilon、acquisition parity。
- [x] `tracking_longrange_v1` fixture 產出 contact samples，且 longrange hitbox/source unit 對表。
- [x] `tracking_br_v1` fixture 產出 aim-ray contact samples，且 ADS/projectile/hitscan companion fields 不污染 pure summary。
- [x] BR report/test 分開呈現 `aimRayOnTarget` 與 ballistic `hit`；pure tracking summary 不讀 hit count、damage 或 kill。
- [x] protocol-incompatible run 不進 aggregate，且 reason code/exclusion count 可追溯。
- [x] WP-54 新 tracking drill 若已存在，只有 contract compatibility evidence，沒有混入新 metric release scope。
- [x] legacy drill id、frozen parameters、target lifecycle tests 全綠。

## Evidence

- 新增 `src/metrics/trackingContactCoverage.ts`：從 T2 `buildTrackingContactArtifact()` 投影 coverage report，blocked artifact 以 `excluded` run 保留 reason counts，不進 aggregate。
- 新增 `src/metrics/trackingContactCoverage.test.ts`：覆蓋 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`，並以 WP-54 core/reversal candidate 只驗 contact-contract compatibility。
- BR companion 分欄：`ads`、`aimRay`、`ballistic` 分開輸出；pure summary 只從 contact samples 計算，測試以 fire/hit event 差異證明不讀 hit count。
- Verification：`npm.cmd run typecheck` exit 0；T3 focused regression 13 files / 72 tests passed。

## Commit

```text
test(tracking): cover contact artifacts across tracking drills
```
