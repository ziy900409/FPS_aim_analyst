# KI-010 — Session Plan 休息倒數結束後，rest overlay 卡在畫面上不消失

> 類型：`SessionRunner` 狀態機錯誤處理缺口。
> 狀態：**✅ 已修**（2026-08-25）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-010。

## 1. 症狀

使用者排查 Session Plan（WP-42）測試流程時回報：每個家族之間的休息倒數結束後，「休息中」overlay
（`RestOverlay`）仍留在主畫面上，沒有消失。

## 2. 根因

`SessionRunner.poll()`（[SessionRunner.ts](../../src/session/SessionRunner.ts)）在休息倒數歸零時自動
觸發下一個家族的載入：

```ts
if (remainingMs === 0) {
  void this.advance();   // 修法前：fire-and-forget，無 .catch()
  return;
}
```

`poll()` 由 `main.ts` 的 render loop 每幀呼叫，沒有呼叫方在 await 它，所以 `advance()` 若拒絕
（reject），錯誤被 `void` 靜默丟棄。`advance()` 的 `'rest'` 分支呼叫 `startFamily(index)` →
`await options.loadDrillById(...)`（`main.ts` 的 `loadDrillById`，可能需要 `await
createSceneManagerWithStatus(...)` 切換場景資產）。只要這個呼叫拋出任何錯誤（場景資產載入失敗、
config 驗證錯誤等），`startFamily` 便不會執行到 `setPhase({kind:'family', ...})`，`phase` 永遠停在
`{kind:'rest', ...}`。

`main.ts` 的 `onPhaseChange` 只在 `phase.kind !== 'rest'` 時呼叫 `restOverlay.hide()`：

```ts
onPhaseChange: (nextPhase) => {
  if (nextPhase.kind === 'rest') restOverlay.show(nextPhase.remainingMs);
  else restOverlay.hide();
},
```

`phase` 永遠停在 `'rest'` ⇒ `onPhaseChange` 永遠不會以非 `'rest'` 的 phase 被呼叫 ⇒
`restOverlay.hide()` 永遠不會執行 ⇒ overlay 卡在畫面上，且沒有任何錯誤訊息或狀態提示使用者發生了
什麼事（`runTransition()` 的 `transition` 內部變數會在 `.finally()` 正確重置，導致每一幀 `poll()`
都會重新嘗試相同的失敗載入，形成靜默的無限重試迴圈）。

由 [acceptance-stage-g.md §1.1](../../docs/operational/acceptance-stage-g.md#11-g-2-的證據組成與範圍限定誠實記錄非阻塞)
可查證：WP-42 T-exit 從未有真人在真實硬體上、以真實 pointer lock/滑鼠完整走過一次含休息倒數的
Session Plan 全場——`SessionRunnerPoll.test.ts` 原本唯一的 poll 測試只覆蓋 `loadDrillById` 恆成功的
情境，因此這個錯誤路徑此前沒有任何自動化測試或人工驗收覆蓋到。

`runTransition()`（同檔）本身也有一個獨立、但同源的漏洞：`void next.finally(() => {...})` 的
`.finally()` 會回傳一個**新的**、同樣會 reject 的 promise，若不接 `.catch()`，即使 `next` 本身已被
呼叫方妥善處理，這條衍生鏈仍會被 runtime 標記為獨立的「unhandled rejection」。

## 3. 修復決策

**F-1**：`poll()` 的自動 advance 呼叫加上 `.catch()`：載入失敗時透過 `onStatus` 回報錯誤訊息，並把
`phase` 強制轉為 `{kind:'done'}`（安全終止狀態，非 sim 相關，不違反 GD-6/D-42.5 的「orchestration 層
純 DOM，不驅動 sim」邊界）。`setPhase({kind:'done'})` 會觸發 `onPhaseChange`，`main.ts` 因此會呼叫
`restOverlay.hide()`，overlay 不再卡住；使用者也會在 `protocolStatus` 看到明確的失敗訊息，而不是一個
無聲卡住的畫面。

不採「重試」（可能反覆撞上同一個永久性錯誤，例如缺少的場景資產，形成使用者看不到、但持續執行的
無限迴圈）；不採「把 phase 退回 `'family'` 重跑當前家族」（`startFamily` 失敗前已可能執行到一半的
`drillRunner.restart()` 等副作用，狀態不再可信，安全的作法是承認 session 已無法可靠續跑並中止）。

**F-2**：`runTransition()` 的 `.finally()` 鏈補上 `.catch(() => {})`——僅止於避免這條純粹用於內部
簿記（重置 `transition` 變數）的衍生 promise 被 runtime 標記為 unhandled rejection；真正的錯誤仍完整
經由 `next`（`advance()`/`start()` 的回傳值）傳遞給呼叫方處理，本次修法不改變任何一方原本能觀察到
的錯誤資訊。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/session/SessionRunner.ts` | `poll()` 的 `void this.advance()` 加上 `.catch()`：`onStatus` 回報失敗訊息 + `setPhase({kind:'done'})`。`runTransition()` 的 `.finally()` 鏈補 `.catch(() => {})`，避免內部簿記鏈產生獨立的 unhandled rejection。 |
| `src/session/SessionRunnerPoll.test.ts` | 新增案：`loadDrillById` 在自動 advance 途中失敗時，`phase` 必須離開 `'rest'`（進而讓 `onPhaseChange` 觸發 `restOverlay.hide()`），且 `onStatus` 收到失敗訊息（RED→GREEN，先確認舊版卡在 `'rest'` 永不消失，再驗證修法後正確恢復）。`settleTransitions()` 由固定 4 個 microtask 改為單次 macrotask flush，因失敗路徑多一層 `.catch()` promise chaining，原本的固定 tick 數不足以讓拒絕完整傳播。 |

## 5. TDD 與驗證證據

1. **RED**：加入失敗情境的 poll 測試，修法前斷言 `phase.kind !== 'rest'` 失敗（實際仍為 `'rest'`），
   證實 overlay 會永久卡住。
2. **GREEN**：`poll()` 加上 `.catch()` 恢復邏輯後，同一測試轉綠；`phase` 轉為 `'done'`，
   `onPhaseChange`/`onStatus` 皆如預期被呼叫。
3. 加上 `runTransition()` 的 `.catch(() => {})` 前，測試執行雖然通過，但 vitest 額外回報一個獨立的
   `Unhandled Rejection` 錯誤（同一個 `Error('scene load failed')`，源頭是 `.finally()` 衍生鏈）；補上
   後該警告消失，`src/session/` 全部測試（3 files / 12 tests）乾淨通過、零殘留錯誤。
4. `npx tsc --noEmit`：exit 0。
5. `npx vitest run`：130 files / 968 tests 全綠。

## 6. 遺留 Open Questions

- **OQ-KI10-1**：目前失敗即整場 Session Plan 中止（`{kind:'done'}`），不嘗試略過該家族繼續下一個。
  若研究者/教練實務上偏好「跳過失敗家族、繼續其餘家族」，屬產品行為決策而非 bug 修復範圍，需另開
  task 討論（例如把 `families` 陣列中失敗的家族標記略過再 `startFamily(index+1)`）。
- **OQ-KI10-2**：本次未實測「哪一種具體錯誤會在真實硬體上觸發 `loadDrillById` 失敗」（場景資產
  404/GPU 資源競爭等）——診斷聚焦於「無論何種原因失敗，狀態機都不該卡死且靜默」這個更上層的健壯性
  缺口；若日後需要診斷特定觸發原因，另開新的 KI。

## 7. 影響範圍

只影響 Session Plan 自動休息倒數的錯誤恢復路徑；正常（成功）路徑的狀態轉移、`RestOverlay`
show/hide 時機、`buildFamilyOrder` 排程邏輯（WP-41/D-42.6）皆不變。不觸及 sim、輸入、命中判定或匯出
資料語意。
