# WP-51 T2 — Canonical Cross-WP Journeys

## Objective

證明storage、History/Result/trend與3D Replay在同一Assessment identity上端到端相接，並同時證明Practice不會進入任何歷史路徑。

## Dependencies

- T1 runner/fixtures/evidence可用。
- WP-48～50必要exit gates全綠；未綠項目依T0 matrix保持blocked。

## Scenarios

1. **Dev Assessment canonical**：由DEV driver完成正式測試；等待save state後驗證單一JSON、Result identity、History Participant→exact drill→startedAt排序、Run Detail、trend point、Replay與Back context。
2. **Preview public smoke**：public API seed同等Assessment，從launch UI依公開navigation走History→Result→Replay；驗證production bundle無DEV hook與dev/preview headers。
3. **Restart rebuild**：關閉server、清browser context、以同root重啟；不重新seed，驗證lists/order/result/replay identity與之前一致。
4. **Exact grouping/order**：兩Participant、多exact drill IDs、相同startedAt tie、不同runId；驗證不family merge、排序stable且趨勢只含所選exact drill/cohort。
5. **Historical/current parity**：同payload的當次Result與historical Result使用同projection，主要metrics、quality與unknown fields行為一致。
6. **Practice**：完成Practice後Result與manual download可用；API spy為零save，filesystem/list participants均無entry；依OQ-50.2驗證in-memory Replay action或明確無action。
7. **Unknown metric/incompatible cohort**：仍可Result/Replay；unknown metric是empty state，incompatible records列出但不進同一trend series。
8. **Replay support**：full可play/seek/rate/event；partial有持續限制；unsupported/invalid不出現假play action且可返回。

## Assertions

- 每層identity以participantId/drillId/runId/payload hash交叉核對，不只比畫面文字。
- auto-save等待observable save state/API response，不用固定sleep；JSON寫入完成後無`.tmp`殘留。
- browser tests只assertmanifest中的IDs/order，不assert全域總數。
- Replay返回還原History filter/scroll/focus；current Result返回不重新執行session。

## Failure ownership

storage/API/path defect回WP-48；route/result/metric/trend回WP-49；support/seek/scene/return ownership回WP-50。每個修復需新增upstream regression並重跑其exit gate。

## Definition of Done

- [ ] dev canonical Assessment從完成到Replay/Back全程通過，且disk/API/UI identity一致。
- [ ] preview public smoke通過且無DEV-only hook。
- [ ] restart後只從JSON重建相同列表、Result與Replay。
- [ ] exact grouping/order、parity、cohort與unknown metric cases通過。
- [ ] Practice保留Result/download並有零API/零file/零history證據。
- [ ] full/partial/unsupported/invalid及source return均有automated evidence。

## Suggested commit

```text
test(stage10): cover canonical history and replay journeys
```

