# WP-49 T2 — Participant and Exact-Drill Browser

## Objective

用WP-48 compact summary API完成第一、二層瀏覽：Participant搜尋／摘要與exact `drillId`卡片；建立各層loading、empty、error、retry與page/chunk rendering。

## Entry gate

- T1 exit綠。
- WP-48 `HistoryClient.health/listParticipants/listDrills`實際contract與Assessment-only tests綠。
- 對`HistoryClient`、shared DTO與T1 controller執行CodeGraph impact。

## Planned files

```text
src/history/HistoryLibraryController.ts         MODIFY real summary loads
src/ui/history/ParticipantBrowser.ts            NEW
src/ui/history/ParticipantBrowser.test.ts       NEW
src/ui/history/DrillBrowser.ts                  NEW
src/ui/history/DrillBrowser.test.ts             NEW
src/ui/history/HistoryScreen.ts                 MODIFY compose views
tests/e2e/history-library.spec.ts               NEW/EXTEND
```

## Steps

1. controller接`health/listParticipants/listDrills`，每route只啟動所需request；child route直接reload時先取得breadcrumb所需資料。
2. Participant view用case-insensitive substring filter但保留raw id；顯示drillCount/runCount/latest local time + UTC evidence。
3. 列表每批最多100 DOM items；search結果同樣chunk/page，不一次append 5,000 nodes。
4. Drill view只顯示API回傳exact ids、Assessment runCount、latest時間；registry friendly label可additive，但raw id永遠可見。
5. 對health的invalid/unsupported/excluded-Practice counts顯示non-blocking safe banner，不顯示absolute path。
6. loading保留previous data；error提供scoped retry；empty明確區分「無Participant」「搜尋無結果」「Participant無drill」。
7. E2E temp root建立多Participant、多exact drill、相近prefix ids與legacy Practice file，驗證分組與排除。

## Failure modes

- API offline/503：history shell與breadcrumb仍可用，retry只重送current scope。
- Participant id含HTML／長字串：只用`textContent`，不執行、不破版到無法導航。
- `drill-a`與`drill-a-v2`：兩張卡，不prefix merge。
- legacy Practice JSON：health count可見但Participant/drill清單無entry。

## Definition of Done

- [ ] Participant search、clear、0/1/100+/5,000 summary cases全綠，raw id不被normalize回寫。
- [ ] exact drill grouping、sort、count/latest fields與相近id負向測試全綠。
- [ ] loading/empty/search-empty/error/retry/health-warning component tests全綠。
- [ ] first 100 DOM rows P95 <500ms、long task <50ms，量測方式與fixture寫入progress。
- [ ] Practice在Participant/drill UI與API response fixture中為0entry。
- [ ] navigation E2E、targeted/full Vitest、Playwright、build全綠。

## Commit

```text
feat(history): browse participants and exact drills
```

