# WP-50 T1 — Additive Replay Contract／Capture／Support Classifier

## Objective

依T0凍結結果補足future run的full replay資料，建立strict backward-compatible parser、exact profile registry與support reason codes；現有metrics/export語意逐位或結構相容。

## Steps

1. 新增`ReplayMeta`、optional replay tick/event states與versioned capability types；欄位只包含T0證明會被replay消費的狀態。
2. 在preallocated recorder path additive capture target IDs/lifecycle、必要camera/recoil/weapon與shot/projectile visuals；不得配置無界per-tick structures或改sim順序/RNG。
3. 擴充strict parser/canonical serializer；legacy v2 absence合法，宣稱replay v1但shape不符產typed error/reason。
4. 建exact `ReplayProfileRegistry`與pure classifier，分離schema validity、playability、full fidelity、scene asset與overflow理由。
5. 建legacy/new/corrupt/overflow/unknown-drill/asset-mismatch fixtures；至少一official exact drill產生full候選payload。
6. 跑metrics/golden/determinism/export/history parser regressions與T0 payload-size benchmark。

## Invariants

- 原`TickRecord`欄位、event meaning、meta schema v2與metrics consumers不變。
- `meta.replay`缺席不是invalid；profile缺席不做family fallback。
- support classifier無DOM/Three/fs/wall-clock；相同payload輸出相同stable reason order。
- recorder overflow或advertised capability缺資料不得full。

## Definition of Done

- [ ] old fixtures parse/serialize/metrics/golden結果維持；new replay v1 strict round-trip成立。
- [ ] exact profile與full/partial/unsupported/invalid reason matrix tests全綠。
- [ ] recorder hot path與payload size符合T0 gate，無unbounded allocation。
- [ ] official full候選fixture可追溯到capture path；legacy不被誤升full。
- [ ] progress記blast radius、測試數、benchmark與實際contract。

## Commit

```text
feat(replay): add versioned replay recording contract
```
