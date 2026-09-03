# WP-55 T4 — Replay Observability

## Objective

讓 replay 或離線 replay trace 可逐 frame 對表 contact state，證明同一 frame 的 target/aim/contact state 與 artifact row 一致；若產品 Replay UI 不在 scope，則以 self-contained HTML replay trace 交付。

## Dependencies

- T2 and T3 completed。
- OQ-55-1 決定產品 Replay overlay 或離線 HTML/JSON replay artifact。

## Steps

1. 實作 `sampleReplayContact(samples, replayTimeMs)` 或等價 pure helper。
2. 以 `t` 對表 replay frame 的 target id、target center、aim、`onTarget`、`epsilonDeg`。
3. 測試 seek、playback、rate change 下 contact frame 不漂移、不 stale commit。
4. 若 OQ-55-1 選產品 UI：Replay overlay 顯示 contact state，且不改 sim state、SharedState 或 live render ownership。
5. 若 OQ-55-1 選離線 artifact：self-contained HTML replay trace 可逐 frame/逐 row 檢視 contact。
6. replay fixture 覆蓋 presentation boundary、missing sample、blocked artifact。
7. UI 或離線 HTML 的 contact state 不只靠顏色表達；至少有文字/label 可稽核。

## Invariants

- Replay contact sampling 是 pure helper；不得依 DOM、Three.js、wall clock 或 live sim。
- Replay 對表只讀 derived contact artifact，不回寫 sim state。
- Missing sample 或 blocked artifact 必須顯示 reason-coded unavailable state，不顯示 fake off-target。
- Product overlay 若實作，不得破壞 WP-50 replay ownership、seek determinism 或 return flow。

## Required tests

- `sampleReplayContact()` 對 exact time、between tick、before first、after last、missing sample 的輸出穩定。
- seek/playback/rate change 對相同 replay time 取得相同 targetId/onTarget/epsilonDeg。
- presentation boundary 不跨 target window 污染。
- blocked artifact 在 replay/HTML trace 中顯示 closed reason。

## Definition of Done

- [x] `sampleReplayContact(samples, replayTimeMs)` 或等價 helper 已實作並有 deterministic tests。
- [x] replay frame alignment 對表 `t`、target id、target center、aim、`onTarget`、`epsilonDeg`。
- [x] seek/playback/rate change 下 contact frame 不漂移、不 stale commit。
- [x] 產品 Replay overlay 或 self-contained HTML replay trace 依 OQ-55-1 決策交付。
- [x] replay fixture 覆蓋 presentation boundary、missing sample、blocked artifact。
- [x] contact state 不只靠顏色表達；文字/label 可稽核。
- [x] progress.md 記錄 replay/HTML evidence、fixture roots 與任何 product UI debt。

## Evidence

- `src/replay/replayContact.ts` 新增 pure `sampleReplayContact()`，以 latest-at-or-before row 對表 contact sample，但不跨 target id / presentation boundary。
- `buildReplayContactTrace()` / `renderReplayContactTraceHtml()` 交付離線 JSON/HTML replay contact trace；HTML self-contained，contact state 以 `on-target` / `off-target` / `unavailable: <reason>` 文字呈現，不只靠顏色。
- `src/replay/replayContact.test.ts` 覆蓋 exact time、between tick、before first、after last、empty/missing sample、presentation boundary、seek/playback/rate-change determinism、blocked artifact 與 HTML embedded JSON。
- 依 OQ-55-1，本切片不做產品 Replay overlay；product UI overlay 保留到 T5/T6 之後的 optional/future work。

## Commit

```text
feat(tracking): align contact artifacts with replay frames
```
