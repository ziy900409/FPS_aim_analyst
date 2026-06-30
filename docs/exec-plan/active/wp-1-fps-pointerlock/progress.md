# WP-1 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T5 通過（2026-06-30）— 設定面板就緒，FR-1.1~1.5 全綠，待執行 T6 exit gate

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SceneManager | ✅ 通過（2026-06-30）|
| T2 Pointer Lock | ✅ 通過（2026-06-30）|
| T3 原始輸入 + fallback | ✅ 通過（2026-06-30）|
| T4 yaw/pitch | ✅ 通過（2026-06-30）|
| T5 設定面板 | ✅ 通過（2026-06-30）|
| T6 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-1.1 sensitivity 換算 | ✅ 鎖定（T0, 2026-06-30）| `yaw += dx × sensitivity × k`，`k` = 固定 counts→radians 線性係數；sensitivity 使用者可調，數值校準延到 pilot。Blocks T4/T5。 |
| OQ-1.2 房間/距離 | ✅ 鎖定（T0, 2026-06-30）| 佔位常數 10×10×3 m、目標距離 ~8 m；正式值由 WP-6 drill config 取代（debt，trigger=WP-6 載入器就緒）。Blocks T1。 |
| OQ-1.3 設定面板可見時機 | ✅ 鎖定（T0, 2026-06-30）| 鎖定中隱藏、解除（Esc/失焦）時顯示，避免遊玩中誤觸。Blocks T5。 |

---

## Log

### 2026-06-30 — T5 sensitivity/FOV 設定面板（DOM overlay, FR-1.5）✅ PASS

**交付檔案：**
- `src/ui/SettingsPanel.ts`（NEW）：`createSettingsPanel({ onSensitivityChange, onFovChange }) → { sensitivity, fov, setVisible }`。純 TS + DOM overlay（D1，不引框架）：兩個 `<input type=range>`（sensitivity 0.1–5.0、FOV 60–120°）+ 即時數值標籤；`input` 事件直呼 callback（無「套用」鈕）。`pointer-events:auto` 僅面板區、`z-index:11` 蓋在 lockHint 上。**為這兩個設定的單一真實來源**：建構時即把預設（sensitivity 1.0 / FOV 75）經 callback 推給 controller。`sensitivity`/`fov` getter 供 WP-7 metadata。
- `src/main.ts`（MODIFY）：`createSettingsPanel` 接 `cameraController.setSensitivity/setFov`；`pointerLock.onChange(l => panel.setVisible(!l))`（鎖定中隱藏，OQ-1.3）。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | **TSC_OK**（exit 0）✅ |
| 產線建置 | `npx vite build` | **✓ built**（12 modules）✅ |
| 單元回歸 | `npx vitest run src` | **4 passed**（未受影響）✅ |
| 全鏈即時生效（真實 Edge，合成 slider 事件） | 一次性 Playwright spec：import 真模組組 panel→CameraController→camera（**未提交**） | **1 passed** ✅：①2 sliders、建構推預設（sensCalls=[1]/fovCalls=[75]）、getter 與 `camera.fov` 皆 =預設、標籤 `['1.00','75°']`；②FOV slider→100 → `camera.fov===100`、`panel.fov===100`；③sensitivity slider→2 後 `applyDelta(50,0)` → yaw≈−0.22（2× 係數確實到 controller）；④`setVisible(false/true)` → `display` `none`/`flex` |
| 視覺 spot-check | 一次性截圖（scratchpad，**未提交**） | 面板置左上、可讀、slider 拖曳值更新（Sensitivity 2.00 / FOV 100°），版面正常 ✅ |

> **驗證取向（誠實記錄）**：沿用 T2–T4——以合成 slider `input` 事件驅動真模組，確定性地驗**「設定 UI → controller → camera」整條鏈即時生效**與顯示/隱藏；截圖確認面板實際渲染。**剩餘 spot-check**：真人在非 headless Edge 拖動 slider 時「手感」即時對應（與 OQ-T4.a 視角手感一併）；數值範圍（0.1–5 / 60–120）為佔位，pilot 校準（OQ-1.1）。

**Decision Log：**
- **D-T5.1：SettingsPanel 透過 callback 通知變更，不直接相依 CameraController / PointerLock；由 main 組裝。** UI 層保持可重用、可測；可見性由外部 `setVisible` 控制（main 接 `onChange`）。
  - *Alternatives considered*：(a) 面板直接持有 CameraController 並呼其方法——較少接線但 UI↔view 耦合、且面板需知道 PointerLock；(b) callback 注入（選用）——層次乾淨，main 為唯一組裝點。
- **D-T5.2：面板為 sensitivity/FOV 的單一真實來源，建構時把預設經 callback 推給 controller。** 避免「滑桿位置」與 CameraController(`DEFAULT_SENSITIVITY`)/SceneManager(`fovDeg`) 各自預設漂移；預設值刻意對齊（1.0 / 75）故推送為冪等。代價：`75`/`1.0` 在三處各有預設常數，但語意各自獨立（面板預設、controller fallback、scene 初值），可接受。
- **D-T5.3：用 `createElement` 程式化建 DOM（非 innerHTML）。** 無使用者輸入故無注入風險，但 createElement 較易維護且型別安全；CSS 走 inline `cssText`（WP-1 最小樣式，無外部 stylesheet）。

**Surprises & Discoveries：**
- 一次性 spec 初版用 `#settings-panel span span` 取數值標籤，誤抓到 name span（每列 head 內含 name+value 兩個 span）→ 斷言失敗。**程式正確、測試選擇器太寬**；改 `> label > span > span:last-child` 後通過。屬測試端問題，非交付碼。
- `graphify-out/*` 仍有非本 task 變更（工具自動再生），依切片紀律不納入 commit。

**Open Questions：**
- **OQ-T5.d（spot-check，→ T6）**：非 headless 拖動 slider 的即時手感；數值範圍/校準屬 pilot（OQ-1.1）。
- 沿用 OQ-T3.a（rawInputEnabled 真值）、OQ-T4.a（視角手感）；OQ-T5.c（unlock 後鍵盤 latch，本 WP 無鍵盤，→ WP-3/5）。
- localStorage 持久化（T5 Out of scope 的 nice-to-have）未做——可留待後續。

**Next**：執行 **T6 / T-exit**（[T6-exit-gate.md](T6-exit-gate.md)）— 驗收 PLAN WP-1 四條（點擊鎖定/Esc 解除、無 OS 加速或記錄、可環顧四周夾角、sensitivity/FOV 即時生效）全綠，彙整真人 spot-check（OQ-T3.a/T4.a/T5.d），交棒 WP-2/4。

### 2026-06-30 — T4 yaw/pitch 視角 + pitch 夾角（FR-1.4）✅ PASS

**交付檔案：**
- `src/view/CameraController.ts`（NEW）：`CameraController(camera)`，`applyDelta(dx,dy)` 累積 `yaw -= dx·sens·k`、`pitch = clamp(pitch - dy·sens·k, ±MAX_PITCH)`，組 `quaternion = qYaw(world Y) · qPitch(local X)` 套到 camera（無 roll）。`setSensitivity()` / `setFov()` 為 T5 預留並已可用。常數：`RAD_PER_COUNT=0.0022`（counts→radians 佔位，OQ-1.1）、`DEFAULT_SENSITIVITY=1.0`、`MAX_PITCH=π/2−0.01`（±89°，明確專案級夾角，R2）。
- `src/main.ts`（MODIFY）：建 `CameraController(sceneManager.camera)`，`pointerLock.onMove((dx,dy)=>applyDelta(dx,dy))`。視角走輸入/render 事件路徑，不入 sim。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | **TSC_OK**（exit 0）✅ |
| 產線建置 | `npx vite build` | **✓ built**（11 modules）✅ |
| 單元回歸 | `npx vitest run src` | **4 passed**（createRenderer，未受影響）✅ |
| yaw/pitch 數學（真實 Edge，合成 delta） | 一次性 Playwright spec：import 真模組、讀回 `camera.quaternion`、Node 端以四元數旋轉 forward/right 斷言（**未提交**） | **1 passed** ✅：①base→forward≈(0,0,−1)；②dx>0→forward.x>0（向右看）、forward.y≈0、單位向量；③極端下看 forward.y≈−sin(89°)、\|y\|<1（未翻轉）、right.y≈0（無 roll）；④極端上看對稱夾角 + 無 roll；⑤sens=2 的 yaw 角=sens=1 的 2 倍；⑥`setFov(90)`→`camera.fov===90` |

> **驗證取向（誠實記錄）**：沿用 T2/T3——以合成 delta 驅動真模組，確定性地驗**旋轉數學與夾角不變式**（方向 / clamp / 無 roll / sensitivity 線性 / FOV）。**剩餘 spot-check**：真人在非 headless Edge 鎖定後「手感」是否平順、實際游標移動對應視角方向符合直覺（數值校準另待 pilot，OQ-1.1）。

**Decision Log：**
- **D-T4.1：pitch 用明確 `MAX_PITCH=π/2−0.01`（±89°）對稱夾角，不沿用 three.js `PointerLockControls` 的 minPolarAngle/maxPolarAngle 預設。** 回應 notes R2：訓練工具的視角行為不應隨上游預設變動而漂移。
  - *Alternatives considered*：(a) 直接用 `PointerLockControls`——但其 `moveForward/moveRight` 直接改 camera position，違反 SharedState 唯一通訊路徑（notes §SharedState boundary），且夾角為極座標語意較隱晦；(b) 不夾角——會翻轉。選自管 yaw/pitch + 明確夾角。
- **D-T4.2：旋轉組合 `qYaw · qPitch`（yaw 繞 world Y、pitch 繞 local X），camera 朝向由本類別獨佔。** 先 pitch 後 yaw 的組合天然無 roll；建構子即套基準（yaw=pitch=0 → 朝 −Z，與 SceneManager `lookAt` 一致），避免「render 視角」與未來 sim aim 兩套發散狀態的入口（notes R5；WP-1 視角僅走 render 路徑，sim aim 屬 WP-2+）。
- **D-T4.3：`applyDelta` 重用實例 scratch quaternion（`#qYaw`/`#qPitch`），不每次 `new`。** mousemove 為高頻路徑；對齊 CLAUDE.md §4「物件重用、避免 GC 卡頓」精神（雖該條原指 buffer/arena，視角熱路徑同理）。
- **D-T4.4：`sensitivity × RAD_PER_COUNT` 為 counts→radians 線性換算（OQ-1.1）。** `RAD_PER_COUNT=0.0022` 佔位、sensitivity 預設 1.0 可調（T5）；數值校準延到 pilot。

**Surprises & Discoveries：**
- `npx vitest run`（無 scope）會把 `tests/e2e/*.spec.ts`（Playwright 規格）一併收集而報 3 個檔案 collection 失敗（它們 import `@playwright/test`，非 vitest runner）——**既有設定問題**（backend/isolation spec 同樣會被收），非 T4 引入。`npx vitest run src` 乾淨 4 passed。屬 scope 外，未動其 config。
- `git status` 另含 `graphify-out/*` 變更（GRAPH_REPORT/graph.html/json/manifest），**非本 task 產出**（疑似工具自動再生）；依切片紀律**不納入** T4 commit，保留未暫存。

**Open Questions：**
- **OQ-T4.a（spot-check，→ T6 / 上線前）**：非 headless Edge 真鎖定下視角「手感」與方向直覺；數值（sensitivity/k）校準屬 pilot（OQ-1.1）。
- 沿用 OQ-T3.a（rawInputEnabled 真值 spot-check）；OQ-T5.c（unlock 後鍵盤 latch，本 WP 無鍵盤，→ WP-3/5）。
- OQ-T5.a（pitch clamp 明確界）已於 D-T4.1 結案（±89°）。

**Next**：執行 **T5**（[T5-settings-panel.md](T5-settings-panel.md)）— sensitivity/FOV DOM overlay（D1），slider 即時 `setSensitivity()`/`setFov()`；面板鎖定中隱藏、解除時顯示（OQ-1.3）。

### 2026-06-30 — T3 原始輸入（unadjustedMovement）+ NotSupportedError fallback（FR-1.3）✅ PASS

**交付檔案：**
- `src/input/PointerLock.ts`（MODIFY）：`request()` 改為先試 `requestPointerLock({ unadjustedMovement: true })`（關 OS 加速 → 原始輸入），catch `NotSupportedError` 才 fallback 一般 `requestPointerLock()`；其餘錯誤（缺手勢 `SecurityError` 等）不吞、rethrow 給 caller。新增 `rawInputEnabled: boolean`（介面 + getter）：成功啟用 unadjusted 為 `true`、走 fallback 為 `false`，供 WP-7 metadata 記錄可重現性。
- `src/main.ts`（MODIFY）：`onChange` 鎖定時 `console.info('[pointerlock] rawInputEnabled =', …)`，供真人 spot-check 觀測實際是否啟用原始輸入。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | **TSC_OK**（exit 0）✅ |
| 產線建置 | `npx vite build` | **✓ built**（10 modules；three 體積 warning，資訊性）✅ |
| 分支邏輯（真實 Edge，合成回傳） | 一次性 Playwright spec：瀏覽器內 import 真模組、`Object.defineProperty(canvas,'requestPointerLock',…)` stub 控制三分支（**未提交**） | **1 passed** ✅：①unadjusted resolve → `rawInputEnabled===true`、以 `{unadjustedMovement:true}` 呼叫、無 throw；②options 呼叫 reject `NotSupportedError` → 第二次無參數 fallback 呼叫、`rawInputEnabled===false`、無 throw；③`SecurityError` → rethrow（name=SecurityError）、不做 fallback、`rawInputEnabled===false` |

> **驗證取向（誠實記錄）**：沿用 T2——headless 無法穩定取得真 OS pointer lock，且 `unadjustedMovement` 是否生效取決於真實瀏覽器/OS，故**不**用「真的鎖定」當斷言。改以 stub 控制 `requestPointerLock` 回傳，確定性地驗 `request()` 的**三分支控制流**（成功旗標 / NotSupportedError fallback / 其餘 rethrow）。**剩餘未驗（spot-check 項）**：受測 Edge 真實取鎖時 `rawInputEnabled` 的**實際值**（預期 `true`，但需非 headless + 真人手勢確認）；上線前一併在非 headless Edge 觀測 console `[pointerlock] rawInputEnabled =` 並回填本檔。

**Decision Log：**
- **D-T3.1：偵測「是否支援原始輸入」唯一可靠途徑 = `requestPointerLock(options)` 回傳的 Promise 是否 reject `NotSupportedError`。** 無 feature-detect API 可預先查；故必須實際呼叫並 catch。對齊附錄 B 骨架。
- **D-T3.2：只對 `NotSupportedError` 降級；其餘錯誤 rethrow（不再像 T2 一律吞）。** 回應 OQ-T2.b：`SecurityError`（缺手勢）等屬呼叫端問題，吞掉會掩蓋 bug；UI 復原仍由 `pointerlockerror` 事件驅動（與吞 rejection 不衝突，main.ts 的 click handler 仍 `.catch(()=>{})` 防 unhandled rejection）。
  - *Alternatives considered*：(a) 沿用 T2「吞所有 rejection」——簡單但掩蓋非預期錯誤、違反 fail-loud；(b) 連 `NotSupportedError` 都 rethrow——則 fallback 失去意義。選「只降級 NotSupportedError」。
- **D-T3.3：保留 T2 的 `as unknown` + `instanceof Promise` 守則（D-T2.1），不假設一定回 Promise。** unadjusted 偵測本就需要 Promise；但舊版 Chromium 可能回 void，此時無從判定支援與否 → 保守 `rawInputEnabled=false`（非 false positive）。與既有模組寫法一致，非為非目標瀏覽器過度設計。
- **D-T3.4：`rawInputEnabled` 取「最近一次取鎖結果」語意，取鎖前初始 `false`。** 旗標本質是「此環境是否支援原始輸入」，跨重取穩定；保留最後值即可，不隨解鎖清零。

**Surprises & Discoveries：**
- 本 session 起始 `node_modules` 不存在（`git status` 乾淨但無安裝）；T1/T2 驗證所需的 `tsc`/`vite`/`playwright` 需先 `npm ci`（exit 0，從 `package-lock.json`）。屬環境重建，非程式問題。
- TS 5.7 lib.dom 已是現代簽章 `requestPointerLock(options?: PointerLockOptions): Promise<void>` + `interface PointerLockOptions { unadjustedMovement?: boolean }`，故帶 options 的呼叫型別乾淨、無需額外 cast 也能編譯（仍保留 `as unknown` 走 runtime Promise 守則，見 D-T3.3）。

**Open Questions：**
- **OQ-T3.a（spot-check，→ 上線前 / T6 exit gate）**：受測 Edge 真實取鎖時 `rawInputEnabled` 實際值（預期 `true`）。需非 headless + 真人手勢；若為 `false` 須記錄環境並由 WP-7 metadata 反映降級。
- OQ-T2.b 已於 D-T3.2 結案（非 NotSupportedError 一律 rethrow）。
- 沿用 OQ-T5.a（pitch clamp，→ T4）；OQ-T5.c（unlock 後鍵盤 latch，本 WP 無鍵盤輸入，→ WP-3/5）。

**Next**：執行 **T4**（[T4-yaw-pitch.md](T4-yaw-pitch.md)）— yaw/pitch 視角累積 + pitch 夾角（FR-1.4）；訂閱 `pointerLock.onMove(dx,dy)` 套到 camera，pitch clamp ±~89°。

### 2026-06-30 — T2 Pointer Lock 整合（手勢/Esc/失焦重取, FR-1.2）✅ PASS

**交付檔案：**
- `src/input/PointerLock.ts`（NEW）：`createPointerLock(canvas) → PointerLockHandle`（`request()` / `locked` / `onChange()` / `onMove()`）。生命週期以 document 級 `pointerlockchange` / `pointerlockerror` 為權威；`blur` 防禦性解除；`onMove` 僅 locked 時轉發 `movementX/Y`（解鎖不轉發殘留 delta）。本 task 用一般 `requestPointerLock()`。
- `src/main.ts`（MODIFY）：canvas click → `request()`（吞 rejection，UI 由事件驅動）；「點擊以鎖定」DOM overlay 提示（pointer-events:none 穿透點擊），`onChange` 切換顯示/隱藏（OQ-1.3）。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | **exit 0** ✅ |
| 產線建置 | `npx vite build` | **✓ built**（10 modules；three 體積 warning）✅ |
| 狀態機（真實 Edge，合成事件） | 一次性 Playwright spec：在瀏覽器內 import 真模組、stub `pointerLockElement` + 派發 `pointerlockchange`/`mousemove`/`blur`/`pointerlockerror`（**未提交**） | 全綠 ✅：`request()` 呼叫 `requestPointerLock`；`onChange` 翻轉序列 `[t,f,t,f,t,f]`；`onMove` 鎖定中轉發 `[5,-3]`、解鎖後不再轉發（停在 1 筆）；blur / error 皆解除；console error = 0 |
| 提示 overlay | 一次性 Playwright 截圖（**未提交**） | `#lock-hint` 解鎖時可見、置中、房間仍可見於半透明底；text =「點擊以鎖定滑鼠視角（Esc 解除）」✅ |

> **驗證取向（誠實記錄）**：headless 自動化無法穩定取得 OS 級 pointer lock（需手勢且常需非 headless），故**不**用「真的鎖定」當斷言。改在真實瀏覽器內以**合成的 document 事件**驅動真模組——這些事件正是真實 click/Esc/alt-tab 會觸發的瀏覽器事件，故已驗證的是「狀態機對這些事件的反應正確」+「監聽掛在正確的 document/window 上」。剩下「瀏覽器是否真的在 click/Esc 時派發這些事件」屬瀏覽器保證行為，非本專案程式碼。**建議**：上線前由真人在非 headless Edge 做一次 UX spot-check（游標真的消失、Esc 真的解除、alt-tab 解除後再 click 重取）。

**Decision Log：**
- **D-T2.1：lock 狀態以 `document.pointerLockElement === canvas`（事件驅動）為唯一權威，不靠 `requestPointerLock()` 回傳。** MDN 記 Promise 形狀非跨瀏覽器一致（notes §lifecycle）；`request()` 對 Promise / void 兩種回傳都安全（`instanceof Promise` 才 await），最終狀態一律由 `pointerlockchange` 決定。
- **D-T2.2：滑鼠來源用 `mousemove`（WP-1 baseline），掛在 `canvas.ownerDocument` 上。** pointer lock 中事件派發到 document（與 three.js `PointerLockControls` 一致）。`pointermove` + `getCoalescedEvents()` 是 WP-3 升級路徑（notes R3 / OQ-T5.b），T2 不引入。
- **D-T2.3：`onMove` 僅在 `locked===true` 時轉發；狀態翻轉用 `setLocked()` 守 transition（相同值不重複通知、不重複掛/卸 mousemove）。** 直接滿足失敗模式表「失焦未解鎖殘留 delta」——解鎖即卸載 mousemove 監聽且 guard 雙保險。
- **D-T2.4：模組從 `canvas.ownerDocument` / `defaultView` 取 document/window，不直接抓全域。** 使真實瀏覽器內可對任意 document 注入測試（本次驗證即靠此），同時語意更明確；非為測試而過度設計，是自然寫法。
- **D-T2.5：「點擊以鎖定」提示用 `pointer-events:none` 全屏 overlay。** 點擊穿透到 canvas（click handler 在 canvas 上），提示純視覺；T5 才接完整 SettingsPanel。OQ-1.3「鎖定中隱藏、解除時顯示」由 `onChange` 達成。

**Surprises & Discoveries：**
- 真實瀏覽器內以 `await import('/src/input/PointerLock.ts')`（Vite dev server 即時轉譯 TS ESM）可直接測試單一模組，配合 `Object.defineProperty(document,'pointerLockElement',…)` stub + `new MouseEvent('mousemove',{movementX,movementY})`，得到比 headless「真鎖定」更穩定、可觀測的狀態機驗證。
- `requestPointerLock()` 在現代 Chromium 回 `Promise<void>`；舊行為回 `void`。以 `as unknown` + `instanceof Promise` 兼容兩者，避免 lib.dom 型別差異。

**Open Questions：**
- **OQ-T2.b（→ T3）**：`request()` 目前吞所有 rejection；T3 需改為 try `unadjustedMovement:true` → catch `NotSupportedError` 才 fallback 一般 lock，其餘錯誤的處理政策一併在 T3 定。
- 沿用 OQ-T5.a（pitch clamp，→ T4）；OQ-T5.c（unlock 後鍵盤 latch，本 WP 無鍵盤輸入故不阻塞，→ WP-3/5）。

**Next**：執行 **T3**（[T3-raw-input-fallback.md](T3-raw-input-fallback.md)）— 把 `request()` 包成 `unadjustedMovement:true` → `NotSupportedError` fallback（FR-1.3），原始輸入可重現。

### 2026-06-30 — T1 SceneManager（封閉房間 + camera, FR-1.1）✅ PASS

**交付檔案：**
- `src/render/SceneManager.ts`（NEW）：`SceneManager` 建 `Scene` + 地板 + 四牆（FrontSide 法線朝內）+ 環境光/方向光 + `PerspectiveCamera`；介面 `{ scene, camera, resize(w,h) }` 與 `SceneManagerOptions { roomSize?, eyeHeight?, fovDeg? }` 對齊 T1 設計骨架。
- `src/main.ts`（MODIFY）：移除 inline scene/camera，改串 `createRenderer`（WP-0 seam）+ `SceneManager`；加 `setPixelRatio`、`resize()`（window resize → `renderer.setSize` + `sceneManager.resize`）、rAF render 靜態場景。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | **exit 0** ✅ |
| 產線建置（keep compilable） | `npx vite build` | **✓ built**（9 modules；唯一 warning = index chunk 762 kB＝three 體積，資訊性）✅ |
| 渲染 + console（真實 Edge） | 一次性 Playwright spec（dev server，截圖至 scratchpad，**未提交**） | `T1_CONSOLE_ERRORS=[]`；截圖見封閉房間：lit 地板 + 西牆（亮）/ 北牆（中）/ 東牆（暗），地板與牆以色階＋明暗可分辨 ✅ |

**Decision Log：**
- **D-T1.1：房間/眼高為 render 端佔位常數（THREE world unit），不流入 sim/資料。** OQ-1.2 鎖 10×10×3、眼高 ~1.6；CONTEXT.md §C 規定 sim/資料一律 canonical CS unit (u/s)、render 可另套 display scale。正式幾何由 WP-6 drill config 取代（technical debt，trigger=WP-6 載入器）。在 `SceneManager.ts` 檔頭與 `roomSize` 註解標明此邊界。
- **D-T1.2：四牆用 `PlaneGeometry` + `rotation.y` 把預設 +Z 法線轉向房間內側（FrontSide），不用 inverted Box。** 理由：四面分別命名/可參數化，便於 WP-4 在牆面佈目標推理；FrontSide 內向法線同時保證室內可見與正確打光。
  - *Alternatives considered*：(a) `BoxGeometry` + `side: BackSide` 一個 mesh 出 4 牆＋天花板＋地板——更少行但地板無法單獨配色、且帶非必要天花板會擋方向光；(b) DoubleSide planes——可省法線推算但語意較鬆。選 (a 之外) 顯式內向 FrontSide。
- **D-T1.3：不加天花板。** 任務明列「地板 + 四牆」；天花板會擋住由上方打的 directional light 並使房間偏暗。代價：牆高 3 < camera 垂直視野，牆頂上方露出背景色（截圖可見上方暗區），屬可接受的佔位外觀。
- **D-T1.4：暫用 rAF render 靜態場景，不引入 sim accumulator。** 守雙迴圈邊界（WP-2）；camera 控制（yaw/pitch）留 T4，此處 `lookAt(-Z)` 僅為 yaw=pitch=0 基準朝向。

**Surprises & Discoveries：**
- 牆高 3（佔位）低於 camera（眼高 1.6、FOV 75）的垂直視野，故北牆頂上方會露出背景色一大塊——非 bug，是「四牆無天花板 + 佔位牆高」的必然外觀。WP-6 正式房間尺寸可一併調整。
- `git status`：本 session 稍早的無關變更（CLAUDE.md / graphify-out / AGENTS.md 等）已由使用者於 commit `1ed19f2`（tooling）收束；T1 工作樹乾淨，只含 `src/main.ts` + `src/render/SceneManager.ts`。

**Open Questions：**
- 無新增。沿用 OQ-T5.a（pitch clamp，→ T4）/ OQ-T5.b（mouse event source，→ T2/T3）。

**Next**：執行 **T2**（[T2-pointerlock.md](T2-pointerlock.md)）— 手勢 click 鎖定 + Esc/失焦解除/重取（FR-1.2）；在 T1 的場景/canvas 上接 Pointer Lock lifecycle。

### 2026-06-30 — T0 Entry gate（確認 WP-0 地基 + 鎖 OQ-1.1/1.2/1.3）✅ PASS

**職責：** read-only 驗證 + docs。確認 WP-0 exit 綠燈、WP-1 bootstrap 所需 seam 存在、鎖定三個 OQ。**未碰任何 `src/` 程式。**

**PASS 條件逐項證據：**

| 檢查 | 方法 | 結果 |
|------|------|------|
| WP-0 exit 綠燈 | [WP-0/T6-exit-gate](../wp-0-environment-setup/T6-exit-gate.md) 狀態 | ✅ DONE（2026-06-30）；4/4 附錄 E 驗收勾選並有證據（WP-0 progress.md）|
| `createRenderer` seam 存在 | [src/render/createRenderer.ts](../../../../src/render/createRenderer.ts) | 存在；`createRenderer(canvas) → { renderer, backend }`，已被 [src/main.ts](../../../../src/main.ts) bootstrap 消費（L14）✅ |
| 空場景可跑 + console backend | WP-0/T6 e2e（真實 Edge） | `npx playwright test` **3 passed**：dev/preview `crossOriginIsolated===true` + 實際 backend=**webgpu** ✅ |
| 地基仍可編譯（本 session 重驗） | `npx tsc --noEmit` | **exit 0** ✅ |
| `src/` 自 WP-0 exit 未變動 | `git status --short` | 無 `src/` 條目（僅 docs/graphify-out）；綠燈狀態保持 ✅ |

**PASS 條件全成立**：WP-0 場景可跑 + `createRenderer` seam 存在 → 不需 STOP 回 WP-0，WP-1 可進入 T1。

**OQ 鎖定（見上方 ledger）：**
- **OQ-1.1**：sensitivity = `yaw += dx × sensitivity × k`，`k` 固定 counts→radians 係數，sensitivity 可調，數值待 pilot 校準。
- **OQ-1.2**：房間 10×10×3 m、目標距離 ~8 m（佔位常數，WP-6 drill config 取代 — 列為 technical debt）。
- **OQ-1.3**：設定面板鎖定中隱藏、解除時顯示。

**承接 WP-0 帶入的 WP-1 待決（OQ-T5.a/b/c，於後續 task 拍板，非 T0 範圍）：**
- OQ-T5.a pitch clamp 明確上下界（→ T4）；OQ-T5.b mouse event source（`mousemove` vs `pointermove`+coalesced，建議 app-owned adapter 隔離，→ T2/T3）；OQ-T5.c unlock 後鍵盤 latch 清除政策（→ T2，本 WP 滑鼠只驅動視角故影響小）。

**Next**：執行 **T1**（[T1-scene.md](T1-scene.md)）— `SceneManager` room/floor/walls/light/camera 可見封閉房間（FR-1.1），沿用 `createRenderer` bootstrap。

### （規劃）— WP-1 計畫產出
- 依 PLAN WP-1（1.1–1.5）+ 規格 ADR-5 + 附錄 B 展開為 T0–T6。
- 邊界釐清：視角走輸入/render 路徑，**不入 sim**（sim 屬 WP-2）；高頻採樣入緩衝屬 WP-3，本 WP 滑鼠只驅動視角。
- **Next**：WP-0 exit 綠燈後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
