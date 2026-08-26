# KI-013 — 過早點擊「研究員模式」→「單一 Drill 調整」丟出 TDZ ReferenceError

> 類型:模組頂層初始化順序(top-level await 期間 UI 已可互動,但依賴的變數還沒賦值)。
> 狀態:**✅ 已修**(2026-08-26)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-013。

## 1. 症狀

在瀏覽器 console 看到未捕捉的例外(頁面本身不一定明顯異常,`controls` 面板事後仍可能正常顯示,
因為後續有一次無條件的 `syncControlsVisibility()` 補救——見 §2 為何肉眼不易察覺):

```
ReferenceError: Cannot access 'controls' before initialization
    at syncControlsVisibility (main.ts:902:3)
    at setAppMode (main.ts:314:3)
    at HTMLButtonElement.<anonymous> (main.ts:335:54)

ReferenceError: Cannot access 'controls' before initialization
    at syncControlsVisibility (main.ts:902:3)
    at HTMLButtonElement.onSelectDrillControls (main.ts:349:5)
```

於 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) 診斷過程中,用
Playwright 驅動真實瀏覽器重現使用者操作流程時意外發現,與 KI-012 本身的根因無關,順手記錄修復。

## 2. 根因

`main.ts` 頂層依序:

1. `setAppMode()`(定義於 ~L394)與傳給 `createResearcherMenu()` 的 `onSelectDrillControls` callback
   (定義於 ~L437)皆呼叫 `syncControlsVisibility()`;兩者定義時就已把對應按鈕的 click handler
   掛上(按鈕在同一批同步程式碼中建立並 `appendChild` 進 DOM,故此時按鈕**已存在且可點擊**)。
2. `syncControlsVisibility()` 讀取 `controls.setVisible(...)`,而 `const controls = createControls(...)`
   要到檔案尾端(~L1119)才執行——中間隔著兩個 top-level `await`(`measureDisplayRefresh()`、
   `measureDisplayHz()`,各自要跑數個 `requestAnimationFrame` 取樣,耗時可觀)。
3. `const` 綁定在其初始化陳述式執行前處於 **temporal dead zone(TDZ)**;此期間**任何**存取方式
   (包含 `typeof`)都會丟 `ReferenceError`,不像存取未宣告的全域變數那樣安全回傳 `undefined`。
4. 若使用者(或自動化測試)在上述任一個 `await` 懸置期間點擊「研究員模式」或「單一 Drill 調整」,
   對應 click handler 觸發 → `syncControlsVisibility()` → 存取仍在 TDZ 的 `controls` → 拋出
   未捕捉的 `ReferenceError`。

**為何肉眼不易察覺 UI 異常**:`setAppMode()`/`onSelectDrillControls` 呼叫 `syncControlsVisibility()`
**之前**已經先完成了它們真正該做的事(`appMode = next`、`researcherMenu.open()/close()`)——例外只
發生在函式的**最後一步**,且是在事件 handler 內被拋出(不會中斷模組其餘頂層程式碼的執行)。等模組
執行終於跑到 `controls = createControls(...)` 那行,緊接著又有一次**無條件**的
`syncControlsVisibility()` 呼叫,會用當下(已經被使用者點擊改變過的)`appMode` 正確地把可見性套用
一次——表面上看起來「功能正常」,例外訊息只安靜地留在 console。

## 3. 修復決策

把 `controls` 從 `const`(TDZ 期間不可安全存取)改成提早宣告的 `let controls: ControlsHandle
| undefined`(比照本檔已有的 `researcherMenu`/`markProtocolFullscreenExit` 慣例),並在
`syncControlsVisibility()` 開頭加 `if (controls === undefined) return;` guard——`controls` 尚未
建好時本來就沒有面板可同步,安全略過即可;`controls = createControls(...)` 執行完後緊接的無條件
`syncControlsVisibility()` 呼叫,會正確補上當時累積的 `appMode`/pointer-lock 狀態(見 §2 最後一段,
這個補救路徑修復前後都存在且維持不變)。另外兩處 `controls.setSelectedScene(...)`/
`controls.setSelectedDrill(...)`(在 `loadDrillById`/`loadSceneById` 內,同樣定義在 `controls` 賦值
點之前)一併改成 `controls?.setSelectedScene(...)`/`controls?.setSelectedDrill(...)`——這兩個函式
實際只會在 `controls` 已建好後才被呼叫(它們本身就是傳給 `createControls()` 的 callback,或由已
存在的 `controls` 觸發的其他流程呼叫),`?.` 只是型別層級的防禦,不改變執行期行為。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/main.ts` | `controls` 宣告由 `const`(檔案尾端)改為提早宣告的 `let controls: ControlsHandle \| undefined`;`syncControlsVisibility()` 補 `undefined` guard;`loadDrillById`/`loadSceneById` 內兩處 `controls.` 改 `controls?.`;import 補 `type ControlsHandle` |
| `tests/e2e/overlay-layering.spec.ts` | 新增回歸測試:模擬「研究員模式」→「單一 Drill 調整」快速連續點擊,斷言無 `pageerror` |

## 5. 驗證證據

1. **重現**:Playwright 連續點擊兩個按鈕,`page.on('pageerror', ...)` 捕捉到上述 `ReferenceError`
   堆疊,逐字重現。
2. **修復後驗證**:同一操作序列以 `--repeat-each=5` 跑 5 次全數無 `pageerror`。
3. 新增的 e2e 回歸測試(`overlay-layering.spec.ts`)以 `--repeat-each=3` 跑 9 個測試(3 個既有 +
   新增各 3 次)全數通過。
4. `npx tsc --noEmit`:exit 0(`controls?.` 寫法通過嚴格 null 檢查)。
5. 完整 `npm run test:ci`:見本次 commit 附帶的執行紀錄。

## 6. 遺留 Open Questions

- **OQ-KI13-1**:同一類「頂層 `const` 依賴,中間隔 `await`,UI 卻已可互動」的結構性風險,原則上
  可能出現在其他晚宣告的頂層 `const`(本檔非常長,~1300 行單一模組作用域)。本次只處理實際重現
  到的 `controls` 一處,未做全檔案掃描式稽核;若日後要系統性排除同類風險,建議的方向是把
  「會被早期 UI 觸發的 callback」與「它們依賴的晚建立的物件」在依賴圖上梳理一次,或考慮把
  互動式按鈕的 `appendChild`/事件掛載延後到所有依賴就緒之後,屬更大範圍的重構,不在本次修復範圍。

## 7. 影響範圍

**受影響**:`src/main.ts` 的 `controls` 變數宣告形式與三個既有存取點的寫法。**不受影響**:
`syncControlsVisibility()`/`loadDrillById()`/`loadSceneById()` 在正常(非競態)路徑下的行為(`controls`
建好後的所有既有呼叫序列逐位不變)、`Controls.ts`/`ResearcherMenu.ts` 元件本身、其他任何 drill/sim/
export 邏輯。
