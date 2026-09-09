# WP-61 T1 — 標註通道儀器（Annotation Channel）

## Objective

交付一個 **opt-in、預設關閉、對 sim 結構性 inert** 的事件級標註通道（FR-61.1～61.3），讓真人 cohort 的「抬起／落下」「停住／恢復」能被逐次記錄在與 `mouseSamples` 相同的時鐘域裡。**這是 T2 錄製的必要儀器** —— 在它落地之前，repo 裡沒有任何方法產生獨立於空洞的 ground truth。

> 本 task **不做任何判定**。它記錄「標註者在此刻按下了標註鍵」，不宣稱那代表什麼 —— 語意由錄製協定給，構念由 OQ-61.1 給（T0 已拍板）。

## Steps

1. **`KEY_CODE` 擴充**（`src/state/types.ts`）：新增 T0 選定的標註 code（recommended default `KeyL`）。**不動** `CODE_KEY` 的四元素與順序、**不動** `keyMaskFromKeys()` 的四 bit 語意。
2. **`DrillEvent` additive**（`src/data/DataRecorder.ts`）：新增 `annotation` 事件型別（`{ type, code, down, t }`）與 `recordAnnotationEvents?: boolean`（預設 `false`）。旗標讀自 recorder，故 `applyInput`／`simStep` **簽章不變**；停用時完全不配置事件物件（GC 紀律）。
3. **`SimLoop.applyInput` 接線**：在 key 分支加一個 else-if，**只**呼叫 `recorder.recordEvent()`。不讀不寫 `state`、不改 `KeyD`／`KeyA` 兩個既有分支的任何一行、不改事件消費順序。
4. **strict parser**（`src/data/exportPayloadSchema.ts`）：additive parse —— 缺席合法；宣稱有 `annotation` 事件但欄位形狀不符（缺 `code`／`down`／`t`、`t` 非有限、`code` 非字串）時擲**指名欄位**的 typed error。
5. **app 佈線**（`src/main.ts`）：opt-in query flag，比照 `?rawMouse=1` 的 D-60.T2-1 先例（預設關閉、顯式開啟）。**不做**視覺回饋（README §2b「UI = 純 TS + DOM overlay」列的理由：回饋會誘導標註者看畫面，放大 F3）。
6. **錄製協定**（`docs/operational/spider-wide-recording-spec.md`）：新增一節，寫明標註鍵的操作方式、block 設計（T0 凍結的形式）、以及「不得中斷 Pointer Lock」等既有前提對本 cohort 的適用。
7. **決定性證明**：以既有四 FPS parity fixture 各跑「開／關」兩組，`TickRecord` **全欄位** `Object.is` 比對（非 `toEqual` —— 後者不區分 ±0，D-60.T2-2）。
8. **突變驗證**：在旁路裡故意寫 `state.player.x += 1e-12`，確認 step 7 的斷言**抓得到**。還原突變**用 `cp` 備份，禁 `git checkout --`**（WP-60 Surprises 8）。
9. **e2e**：一支 Playwright spec，在真實 Chromium 下按標註鍵並確認事件進匯出、`down`／`up` 成對、時間戳落在 `ticks[].t` 的值域內。跑之前先確認 5173／4173 無他人的 dev server（README §6.8）。

## Invariants

- 關閉時（預設）：`ticks`、既有 `DrillEvent`、`meta` 與整份匯出**逐位相同**；`applyInput` 不進入新分支。
- 開啟時：sim 狀態與關閉時**逐位一致**；標註 code **不出現**在 `TickRecord.keys`、不改 `state.held` 任一欄位。
- 標註事件的 `t` 一律來自 `event.timeStamp`，與 `ticks[].t`／`mouseSamples.t0Ms` 同時鐘域；模組內零 `Date.now`／`performance.now` 新增命中。
- 未 Pointer Lock 時的鍵盤事件行為**不變**（既有 `InputSampler` 對鍵盤不設 lock 閘門 —— 本 task 不改這件事，但 T2 的稽核必須把落在 unlocked 區間的標註**具名列出**，FR-61.11）。
- 新增型別與事件名**不出現** `lift`／`reposition`／`suspicion` 以外由 T0 拍板的構念語彙；命名掃描雙向釘死（F6）。

## Definition of Done（可驗證證據）

- [ ] `npm run typecheck`（兩個 tsconfig）exit 0；全量 `npx vitest run` exit 0，通過數與 T0 baseline 的差額**逐項歸屬**到本 task 新增的案例。
- [ ] `npx vite build` exit 0；既有 chunk-size warning 之外無新 warning。
- [ ] **關閉時逐位相同**：既有 export fixture 的序列化字串比對測試綠（測試檔名 + 案例名記入 `progress.md`）。
- [ ] **決定性**：四 FPS parity fixture ×「開／關」的 `TickRecord` 全欄位 `Object.is` 比對全綠；`toEqual` **未被用於**此斷言（以程式碼引用證明）。
- [ ] **突變驗證**：`state.player.x += 1e-12` 的注入被 ≥ 1 個案例抓到；還原後全綠。突變前後的實際 failed 數記入 `progress.md`。
- [ ] **零額外配置**：`Array.prototype.push` 計數在「開／關」兩組的差額 **等於實際標註次數**（非隨 tick 增長）；實際兩個數字記入 `progress.md`。
- [ ] **parser 矩陣**：缺席合法／`code` 缺／`down` 非布林／`t` 非有限／`t` 缺 五格 fixture，各自斷言「合法」或「擲出**指名該欄位**的錯誤」。
- [ ] **tick 隔離**：標註 code 進 ring 後，`TickRecord.keys` 與 `state.held` 逐位不變的斷言綠（測試檔名 + 案例名）。
- [ ] **命名掃描**：新增模組原始碼對既有構念語彙（`reposition`／`suspicion`）零命中；既有 `spiderShotRepositioning.ts` 對新構念名零命中。指令 + exit code 記入 `progress.md`。
- [ ] **e2e**：`npx playwright test tests/e2e/<annotation spec>` 在真實 Chromium 下綠；跑之前的 port 檢查結果記入 `progress.md`。
- [ ] `docs/operational/spider-wide-recording-spec.md` 已補標註協定一節，且該節可讓一個沒讀過本 WP 的人照著錄。

## Commit

```text
feat(data): add opt-in operator annotation events
```
