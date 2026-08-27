# WP-49 T1 — History Navigation and Controller Shell

## Objective

建立namespaced history route、Browser Back/Forward adapter、scroll/filter restoration與單一async controller owner，並交付不觸發gameplay input的full-screen History shell；尚不呈現真實Participant資料。

## Planned files

```text
src/history/navigation/HistoryRoute.ts             NEW
src/history/navigation/HistoryRoute.test.ts        NEW
src/history/navigation/HistoryNavigator.ts         NEW
src/history/navigation/HistoryNavigator.test.ts    NEW
src/history/HistoryLibraryController.ts            NEW
src/history/HistoryLibraryController.test.ts       NEW
src/ui/history/HistoryScreen.ts                    NEW
src/ui/history/HistoryScreen.test.ts               NEW
src/main.ts                                        MODIFY minimal composition/historyActive gate
tests/e2e/history-navigation.spec.ts               NEW
```

## Interfaces

逐位實作[README.md](README.md) §2.3～2.4 `HistoryRoute`、`HistoryNavigator`、`AsyncState`、`HistoryLibraryController`。T1 controller以fake client完成；真實list接線留T2。

## Steps

1. 先寫route table tests：4層route、Unicode/space/slash/hash/percent ids、query/filter、unknown/malformed、安全canonical format。
2. 實作hash navigator；只接管`#/history` namespace，`#pattern`與其他hash不被重寫。
3. 實作push/replace/back/close、subscription、route-local scroll state、listener cleanup；fake window/history可測。
4. 先寫controller race tests，再實作generation + AbortController；route data reducer只接受current generation。
5. 建HistoryScreen shell：full-screen、breadcrumb、main landmark、loading/empty/error/not-found slots、focus-on-navigation。
6. 在`main.ts`建立可進入shell的最小launch History入口／`historyActive` visibility seam；canvas click與pointer-lock request在active時被gate。真實資料與saved Result入口分別由T2／T5接入。
7. Playwright驗證launch→history→Back/Forward/reload/close與背景canvas不取得Pointer Lock。

## High-risk failure modes

| Trigger | Required assertion |
|---|---|
| malformed `%`或encoded slash | no throw；not-found；返回入口可用 |
| route A晚於route B完成 | state保持B；A generation被丟棄 |
| close後request settle | no DOM/state update、no unhandled rejection |
| history overlay click | pointer lock request count=0、game input不採樣 |
| `#pattern` | 原dev feature不被history parser攔截 |

## Definition of Done

- [x] route parse/format round-trip與invalid matrix全綠；logical ids逐segment encode。（2026-08-27，`HistoryRoute.test.ts` 30 tests）
- [x] Back/Forward/reload/replace/close/scroll restoration tests全綠。（2026-08-27，`HistoryNavigator.test.ts` 13 tests，含 fake window/history stack）
- [x] abort在fake clock 100ms門檻內；stale generation不commit。（2026-08-27，`HistoryLibraryController.test.ts` race-safety group：generation-token 同步 abort，非 timer-based——見下方 Decision Log 偏離說明）
- [x] shell所有controls有accessible name、keyboard focus順序與typed state rendering tests。（2026-08-27，`HistoryScreen.test.ts` 20 tests）
- [x] History active時Pointer Lock／game input不啟動；關閉後既有launch狀態恢復。（2026-08-27，`tests/e2e/history-navigation.spec.ts` FM-49.10 + Close 案例）
- [x] current Result、sim、WP-48 persistence無行為diff；targeted/full Vitest、Playwright、build全綠。（2026-08-27，`npm run test:ci`：151 test files / 1297 tests passed + 2 skipped，41 Playwright e2e passed，build 乾淨）

## Commit

```text
feat(history): add navigable history screen shell
```
