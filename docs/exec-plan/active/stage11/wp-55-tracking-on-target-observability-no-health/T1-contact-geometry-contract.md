# WP-55 T1 — Contact Geometry Contract

## Objective

建立 `deriveTrackingContactSamples()` 與 exact-hitbox truth fixtures，凍結逐 tick `onTarget`、`epsilonDeg`、blocked reasons 與 metrics parity 的語意；不得建立一套與 engine/metrics 分離的近似 hitbox。

## Dependencies

- T0 completed。
- OQ-55-4 的 BR ballistic vs aim-ray 呈現至少有 provisional decision。

## Steps

1. 定義 `TrackingContactSample`、`TrackingContactDerivationResult` 與 closed `TrackingContactBlockedReason`。
2. 實作或定位 shared ray-hitbox geometry source；必須與 engine hit geometry 和 `deriveTrackingMetrics()` 使用同一 hitbox 來源或可證明等價的 adapter。
3. 實作 `deriveTrackingContactSamples(payload)` 的 scored tick window selection；只輸出 active target telemetry 的 scored ticks。
4. 讓 `epsilonDeg` 與 existing angular center error 使用同一來源/公式，避免 report/replay 各算一套。
5. 補 synthetic fixtures：perfect on-target、known miss、edge hit、target invisible、presentation boundary。
6. 補 compatibility fixtures：metadata hitbox、legacy/default hitbox fallback、invalid hitbox、missing eye origin。
7. 建 parity tests，證明 contact-derived TOT/RMS/acquisition 與 `deriveTrackingMetrics()` 對表。

## Invariants

- 不新增 health、HP、damage、kill count 作為 tracking 判定來源。
- `onTarget` 定義為 aim ray intersects exact hitbox；射擊 hit event 不得覆寫 contact state。
- `blocked` 結果不得輸出空 samples 假裝成功。
- Same payload 的 derivation 必須 deterministic；不得依 render FPS、wall clock、DOM 或 Three.js state。

## Required tests

- perfect on-target、known miss、edge hit 與 hitbox boundary oracle 逐列一致。
- invisible target 或 presentation gap 不跨 window 污染 contact samples。
- metadata hitbox 與 legacy/default hitbox fallback 路徑皆可重建；不可解析時回 blocked reason。
- `deriveTrackingMetrics()` 的 acquisition、TOT、RMS epsilon 與 contact artifact summary 對表。

## Definition of Done

- [ ] `TrackingContactSample`、`TrackingContactDerivationResult` 與 `TrackingContactBlockedReason` contract 已凍結並有 typed tests。
- [ ] shared ray-hitbox geometry source 已定位或抽出；沒有複製獨立近似 hitbox。
- [ ] `deriveTrackingContactSamples(payload)` 只讀 export 後資料，不進 sim/render hot path。
- [ ] perfect on-target、known miss、edge hit、target invisible、presentation boundary fixtures 全綠。
- [ ] metadata hitbox、legacy/default hitbox fallback 與 invalid/missing data blocked fixtures 全綠。
- [ ] contact-derived TOT/RMS/acquisition 與 `deriveTrackingMetrics()` parity tests 全綠。
- [ ] progress.md 記錄實際 interface、geometry source、fixture matrix 與任何 blocked reason 調整。

## Commit

```text
feat(tracking): add exact-hitbox contact derivation contract
```
