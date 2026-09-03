# WP-55 T2 — Export-derived Artifact

## Objective

產出 deterministic contact JSON/CSV/HTML artifact 與 closed blocked reason vocabulary，讓每份 tracking run 能由 export 重建逐 tick `onTarget`、`epsilonDeg` 與追溯 identity。

## Dependencies

- T1 completed。
- OQ-55-3 決定 raw export sufficiency vs derived contact JSON/CSV/HTML 的輸出格式。

## Steps

1. 定義 artifact schema：`analysisVersion`、`sourceRunId` 或 export basename、`drillId`、`schemaVersion`、`simHz`、hitbox source、eye origin source、sample count。
2. 產出 deterministic contact JSON；若 OQ-55-3 決定需要 CSV/HTML，同步定義欄位、排序與 round-trip 規則。
3. 實作 closed blocked reason vocabulary：unsupported schema、missing visible event、missing target telemetry、missing eye origin、invalid hitbox、no tracking drill、protocol incompatible。
4. 資料不足時輸出 blocked result；不得輸出空 samples、0 TOT 或空 chart 偽裝成功。
5. 對同一 export 重跑 artifact，證明 byte-equivalent 或 stable deep-equal。
6. 量測 30 秒 tracking reference export artifact generation；目標 runtime < 500 ms，並記錄 environment。
7. 確認 artifact generation 在 export 後分析層執行，不新增 live sim/render per tick allocation contract。

## Artifact contract

| Layer | Required fields | Rule |
|---|---|---|
| Identity | `analysisVersion`、`sourceRunId`/basename、`drillId`、`schemaVersion`、`simHz` | 缺少可追溯 identity 時 blocked |
| Geometry | hitbox source、eye origin source、target center | 顯示 metadata/fallback 來源；不可混用 multiple hitbox definitions |
| Samples | `t`、`targetId`、target center、aim、`onTarget`、`epsilonDeg`、`trackingWindow` | 可與 export ticks 依 `t` 對表 |
| Blocked | closed reasons | 不產生 fake zero output |

## Definition of Done

- [ ] contact artifact schema 已凍結，包含 analysis/version/source/drill/schema/simHz/hitbox/sample identity。
- [ ] deterministic JSON artifact 可由 export 產生；CSV/HTML 若在 scope 內也有欄位與 round-trip tests。
- [ ] blocked reasons 覆蓋 unsupported schema、missing visible event、missing target telemetry、missing eye origin、invalid hitbox、no tracking drill、protocol incompatible。
- [ ] 資料不足時輸出 blocked result，不輸出空 samples 或 0 metrics 假裝成功。
- [ ] 同一 export 重跑 artifact byte-equivalent 或 stable deep-equal。
- [ ] 30 秒 tracking reference export artifact generation < 500 ms，且 environment/fixture/iteration 記錄在 progress.md。
- [ ] generation 已證明位於 export 後分析層，不進 sim/render hot path。

## Commit

```text
feat(tracking): emit deterministic contact artifacts
```
