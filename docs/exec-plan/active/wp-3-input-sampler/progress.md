# WP-3 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: ✅ WP-3 完成（2026-07-01）— F1 採集層全綠：採集三類 + sim 依時序消費 + 排空 + 固定欄位 ring buffer + 溢位 `bufferOverflow`；交棒 WP-5

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ DONE (2026-07-01) |
| T1 鍵盤採集 | ✅ DONE (2026-07-01) |
| T2 滑鼠 coalesced | ✅ DONE (2026-07-01) |
| T3 開火事件 | ✅ DONE (2026-07-01) |
| T4 sim 消費 + 排空 | ✅ DONE (2026-07-01)（plain array 佔位；ring/溢位 → T4b） |
| T4b ring buffer + 溢位 | ✅ DONE (2026-07-01)（固定欄位真 ring、槽位繞圈重用、寫入端保序、`bufferOverflow` 拒新不丟舊） |
| T5 Exit gate | ✅ DONE (2026-07-01)（F1 驗收 map + 頂層索引 ✅ + 交棒 WP-5；真實 Edge e2e 3 passed；鎖定中 fire 正向路徑手動驗 ✅ PASS 2026-07-02） |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-3.1 反向鍵定義 | ✅ locked T0 | 採集層只記原始鍵碼；反向語意在 WP-5 處理 |
| OQ-3.2 緩衝結構 | ✅ grill | 固定欄位 **ring buffer**（真環狀、靜態容量、不動態 resize）；溢位 `bufferOverflow` |
| OQ-3.3 時間戳對齊 | ✅ grill | 同 `performance.now()` time origin（僅 Chromium，須重驗）|

---

## Log

### 2026-07-02 — §B 鎖定中 fire 正向路徑手動驗 ✅ PASS（交棒單「唯一未做的驗證」清除）+ push/PR

在真實 Edge 依 [manual-verification.md](manual-verification.md) §B 手動跑完 T5-exit-gate 唯一延後項（Pointer Lock 需真實手勢、e2e 無法穩定自動化的正向路徑）。透過 `main.ts` 的 dev-only 觀測縫 `window.__aimDebug`（`state`/`pointerLock`）在 DevTools Console 觀測。

**§B 四項通過標準逐項綠燈：**

| 標準 | 證據（Console 探針，取樣 0.5s／行） |
|---|---|
| 事件入緩衝後被 sim 排空 | 有輸入時 `peak` 短暫跳 1~15，`live` 幾乎皆於下一取樣回 0（進得去、排得空） |
| `headT` 高解析度、與 `performance.now()` 同時鐘域 | 如 `peak=14 headT=21473.7 now=21518.6`；headT 為幾千 ms 等級、緊貼同行 `now`（非 `Date.now()` epoch）→ 同源（Chromium，OQ-3.3 復驗） |
| 無溢位/遲到、sim 正常消費 | 全程 `overflow=0 late=0`；`crossOriginIsolated:true`、`timerResolutionUs≈5µs`、`[render backend] webgpu` |
| 解鎖後開火不入緩衝（閘門） | Esc 後約 12 秒 `peak` 恆 0（期間按左鍵無效） |
| 事件依時序消費並套用（consume→applyInput） | 鎖定中按 D/A 畫面左右平移、移動滑鼠視角轉動（人眼確認） |

**Surprise（量測方法學，非產品缺陷）：** 首版觀測探針 `setInterval(…,8ms)` 在 `size` 恆 >0 時**每 8ms 無條件 `console.log`**，DevTools 開啟下大量 log + console DOM 重繪吃光主執行緒 → 餓死 rAF → `simLoop.pump` 停 → `consume` 不推進 `untilT` → 緩衝只進不出（`headT` 凍住、`size` 狂漲、A/D 卡）。這是**量測假象**：sim 在單一 rAF 超級迴圈內 pump（[main.ts:122-134](../../../../src/main.ts#L122-L134)），rAF 被餓死即連帶停 sim。改用「快取樣只讀 `size()`、每 0.5s 才印摘要」的非洗版探針後,size 穩定回落、A/D 恢復流暢,確認 F1 無缺陷。**教訓**：驗這種單執行緒 rAF-pump 架構時,觀測工具本身的 log 頻率會反噬被觀測系統,探針須低頻或旁路。

**push / PR：** branch `wp-3-input-sampler` 已在 `origin`（remote SHA == HEAD）；開 PR #1 → `main`（https://github.com/ziy900409/FPS_aim_analyst/pull/1）。開 PR 前復驗 `tsc --noEmit` exit 0 · `vitest run` 54 passed。

**Next**：WP-3 收尾完成（§B 亦綠）；可將 `active/wp-3-input-sampler/` 移入 `completed/`。開 WP-5 前先驗 WP-4 exit-gate。

### 2026-07-01 — T5 補強：WP-3 真實瀏覽器 e2e（Playwright + Edge）+ 手動驗手冊 ✅ PASS

補上 T5 原缺的「瀏覽器端到端」驗證（原僅單元 + 延後手動）。新增 dev-only 觀測縫 + Playwright spec + 手動手冊，把 F1 採集→ring→sim 消費整條路徑在**真實 Edge** 端到端釘住。

**交付：**
- MODIFY [`src/main.ts`](../../../../src/main.ts)：dev-only 觀測縫 `if (import.meta.env.DEV) window.__aimDebug = { state, pointerLock }`（唯讀暴露量測單例；production build 由 `import.meta.env.DEV` 剝除，e2e build 已驗不入 bundle）。NEW [`src/vite-env.d.ts`](../../../../src/vite-env.d.ts)（`vite/client` 型別，使 `import.meta.env` 通過 tsc）。
- NEW [`tests/e2e/input-sampler.spec.ts`](../../../../tests/e2e/input-sampler.spec.ts)（3 tests，Edge）：① 鍵盤 trusted A/D → 入緩衝 → sim 消費 → `vx` ±250 + `x` 推進（FR-3.1/3.4）；② 同步探針（單一 evaluate 內 dispatch+讀，避 rAF 排空競態）驗帶同源 `timeStamp` 入 ring + 非採集鍵 KeyQ 忽略 + 未鎖定 fire 被閘門擋（FR-3.1/3.3/OQ-3.3）；③ pointermove `getCoalescedEvents` 3 子樣本各入 ring（FR-3.2）。
- NEW [manual-verification.md](manual-verification.md)：§A e2e 操作（`npx playwright test input-sampler`）+ §B **鎖定中 fire** 手動步驟（DevTools `__aimDebug` 觀測；Pointer Lock 需真實手勢、e2e 無法穩定自動化，故正向路徑手動）。

**驗證：** `npx tsc --noEmit` → **exit 0**（含新 vite-env 型別）；`npx vitest run src` → **54 passed**（無回歸）；`npx playwright test input-sampler` → **3 passed**（真實 Edge，9.2s）；`npm run build`（preview webServer）→ **✓ built**（觀測縫已剝除）。

**Decision Log：**
- **D-T5.1｜觀測用 dev-only `window.__aimDebug` 縫，非在 e2e 直接 new InputSampler。** *理由*：要驗的是**生產** main.ts 的 wiring（真 sampler + 真 SimLoop rAF pump），須觀測生產單例 `sharedState`；以 `import.meta.env.DEV` 守門唯讀暴露，production 剝除、零 runtime 成本、不違 ADR-2（只讀不寫、不新增迴圈間呼叫）。*Alternatives*：(a) 生產無條件暴露 → prod 洩內部狀態，否決；(b) 純行為觀測（camera 位移）→ camera 位置未暴露且 mouse/fire 無佔位行為，覆蓋不足，否決。
- **D-T5.2｜同步 `page.evaluate` 內 dispatch+讀，繞過 sim 每幀排空競態。** *理由*：sim 在 rAF 每幀 `consume` 排空 ring；跨 `await` 讀 `size()` 會競態。單一同步 evaluate 內 JS 不被 rAF 搶佔 → dispatch 後 ring 尚未排空，可原地斷言入緩衝。鍵盤**行為**測試則反之用 trusted 事件 + `expect.poll` 等 sim 消費後的持久 `vx`（無競態）。
- **D-T5.3｜fire 正向（鎖定中）留手動。** Pointer Lock 需真實使用者手勢，自動化無法穩定取得；e2e 驗負向（未鎖定→擋），正向入緩衝由 manual-verification.md §B 手動。誠實揭露於 T5 DoD 例外。

**Surprises：**
- 合成 `PointerEvent.getCoalescedEvents()` 對 untrusted 事件多回 `[]`（sampler `?? [e]` 不觸發、將 push 0）；故 e2e 以 `Object.defineProperty` 注入子樣本回傳，忠實驗 sampler 的 coalesced 迴圈 wiring（與單元測試同構）。
- `tests/` 不在 `tsconfig` `include`（僅 `src`）→ e2e spec 不受 `tsc --noEmit` 檢查（Playwright 自行轉譯），與既有 `backend/isolation.spec.ts` 一致；但 `main.ts` 的 `import.meta.env` 在 `src` 內，故需 `vite-env.d.ts` 補型別。

**Next**：WP-3 全綠（含真實瀏覽器 e2e）→ 開 WP-5。

### 2026-07-01 — T5 Exit gate ✅ PASS（F1 採集層驗收 map + 交棒 WP-5；docs only）

WP-3（F1 InputSampler）整體綠燈驗收。四項 PLAN 驗收皆有單元證據、頂層索引 §2 翻 ✅、交棒 note 指向 WP-5。

**驗收證據（AC → test）：**

| AC（PLAN WP-3 / F1） | Task | 證據 |
|---|---|---|
| 鍵盤事件帶時間戳入緩衝 | T1 | `InputSampler.test.ts`：keydown/keyup 蓋 `event.timeStamp`、A/D/W/S 過濾、`repeat` 不重入、時間戳原樣保留 |
| 滑鼠 coalesced 次幀樣本無遺漏 | T2 | `InputSampler.test.ts`：多子事件 pointermove 全數入緩衝（樣本數=子事件數>1）、`getCoalescedEvents` 缺席 fallback 單筆 |
| 開火事件帶時間戳 | T3 | `InputSampler.test.ts`：鎖定中左鍵入緩衝+時間戳、未鎖定不採、非左鍵不採 |
| sim 依時序、無遺漏消費並排空 | T4+T4b | `consume.test.ts`（亂序→升冪、跨 tick 分批、邊界嚴格 `<`、排空、遲到）+ `InputRing.test.ts`（真 ring 繞圈/滿拒收不丟舊/保序）+ `determinism.test.ts` 9 無回歸 |

**紅綠燈（本機）：** `npx tsc --noEmit` → **exit 0**;`npx vitest run` → **8 files / 54 passed**;`npx vite build` → **✓ built**。（`tests/e2e/` 現僅 WP-0 isolation/backend。）

**Outcomes & Retrospective：**
- **時間戳基準確認（OQ-3.3）**：三類事件一律用 `event.timeStamp`（與 `performance.now()` 同 time origin，ADR-4/7），全程無 `Date.now()`。⚠️ 同源可減**僅 Chromium 成立**（階段 A 鎖 Chrome/Edge）；支援非 Chromium 須重驗。
- **coalesced 樣本率**：`getCoalescedEvents()` 逐子樣本各記一筆、無合併遺失（T2 以合成多樣本驗；真實 1000Hz 滑鼠取樣率待 WP-9 瀏覽器實測）。
- **GC 紀律最終達標**：輸入緩衝為固定欄位真 ring（槽位繞圈重用）、寫入 primitive、消費解碼進單一重用 view、寫入端 bounded insertion 消除每-tick sort scratch；審查補強後 sim 熱路徑亦零 arrow 配置。
- **決定性守恆**：換 ring + 保序寫入 + handler hoist 後，WP-2 決定性 9 tests 逐 tick bit-exact 全綠，M1 性質未漂移。
- **限制/待辦**：初版本 session 非互動、無瀏覽器 e2e，後補真實 Edge e2e（見下方 e2e 補強 Log）；剩「鎖定中 fire 正向路徑」因 Pointer Lock 需真實手勢仍手動驗。drill 生命週期 gating（量測期才採集）屬 WP-6，採集端目前無條件 `attach(window)`。

**交棒 WP-5**：`applyInput`（佔位只 A/D 切 vx）→ 真 `MovementController`（friction/accel + 簡化急停，OQ-3.1）；fire 於 simStep 內就地 raycast（`HitDetector`，H1）；mouse 樣本驅動準心供 raycast。`lateEventCount`/`bufferOverflow` metadata 待 WP-7 匯出。詳見 [T5-exit-gate.md](T5-exit-gate.md) Handoff。

**Next**：WP-3 完成 → 開 WP-5（`HitDetector` + 橫移 + 簡化急停，M2；相依 WP-3 ✅ + WP-4）。

### 2026-07-01 — T4b 審查補強：兌現 simStep 熱路徑零配置 + ring dequeue 空防呆 ✅ PASS

對 T4b 做 `/code-review-and-quality` 五軸審查(整體 **Approve**),補強兩處審查發現。純品質補強、無行為變更、無決定性回歸。

| Finding | 修正 |
|---|---|
| **F1｜simStep 每-tick arrow 配置與註解矛盾** | T4 遺留註解宣稱「零配置版併入 T4b」但 T4b 未動 `SimLoop.ts`,實際仍每 tick 配置 `(ev)=>applyInput(state,ev)` closure。*修*：`createSimLoop` 綁定一次 `handleInput` 傳入 `simStep`(新增**選用**第 4 參數 `handle`,預設閉包供測試直呼);熱路徑零配置,簽章向後相容。移除過時註解。真正兌現 T4b DoD「熱路徑不配置物件」。 |
| **F2｜`dequeueInto` 無空防呆** | 空 ring 誤呼會讀殘值 / 推進 head / 使 `count` 變負(靜默腐化)。*修*：加 `if (count === 0) return;`(呼叫端仍應先 `isEmpty()`);interface doc 標注「空時 no-op」。 |

**驗證**：`npx tsc --noEmit` → **exit 0**;`npx vitest run src` → **54 passed**(原 53 + 新增 dequeueInto 空防呆回歸 1;決定性 9 / consume 5 / SimLoop 6 全數無回歸 → 證 handler hoist 行為等價);`npx vite build` → **✓ built**。觸及 4 檔 +30/−6(`SimLoop.ts` / `SharedState.ts` / `types.ts` / `InputRing.test.ts`)。

**Next**：T5 Exit gate。

### 2026-07-01 — T4b 輸入緩衝換固定欄位 ring buffer + 溢位 `bufferOverflow` ✅ PASS（OQ-3.2 / GD-2）

**交付：** MODIFY [`src/state/types.ts`](../../../../src/state/types.ts)（`InputRing`/`InputEventView` 介面、`RING_CAPACITY`/`EV_*`/`KEY_CODE`/`CODE_KEY` 編碼常數、`InputMeta.bufferOverflow`）、[`src/state/SharedState.ts`](../../../../src/state/SharedState.ts)（`createInputRing` 工廠、`input: InputRing`、`resetState` 原地 `clear()`）、[`src/input/consume.ts`](../../../../src/input/consume.ts)（ring 游標排空 + 重用 view，移除 `due`/`sort`）、[`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（4 寫入點 → typed push + 溢位政策）。NEW [`src/state/inputRingTestUtil.ts`](../../../../src/state/inputRingTestUtil.ts)（`pushEvent`/`drainToArray`/`snapshot` 測試設施）、[`src/state/InputRing.test.ts`](../../../../src/state/InputRing.test.ts)（7 ring 契約 tests）。遷移 writer：`consume.test.ts` / `InputSampler.test.ts` / `SimLoop.test.ts` / `determinism.test.ts` / `SharedState.test.ts`。

| 項目 | 內容 |
|------|------|
| 表示法 | packed 並行 typed-array 槽位 `type,t,a,b`（`Uint8Array type` + `Float64Array t/a/b`）；key→a=code enum、b=down(0/1)；mouse→a=dx、b=dy；fire 無 payload。`head`/`count` 游標、`RING_CAPACITY=512`（2 的冪，`& MASK` 繞圈）。`InputEvent` union 維持為**邏輯視圖**。 |
| code 編碼 | `KEY_CODE = {KeyA:0,KeyD:1,KeyW:2,KeyS:3}` + 反向 `CODE_KEY`；SAMPLED_KEYS 封閉集併入 `KEY_CODE` 鍵（`KEY_CODE[code]===undefined` 即非採集鍵，取代舊 `Set`）。 |
| 溢位政策 | 容量滿 → `push*` 回 `false`、`InputSampler` 升 `inputMeta.bufferOverflow`、**拒收新事件、不覆寫尚未消費的最舊槽**（GD-2「不靜默丟最舊」）。研究 metadata、WP-7 匯出。 |
| 保序 / 消費 | 寫入端 **bounded insertion**（append 後若 `t` < 前槽就地往 head 前移，直到升冪或抵 head；`timeStamp` 近單調 → 近 O(1)）→ `consume` 從 head `peekT()<untilT` 沿序排空，**移除 T4 的 `due` 收集 + `due.sort` scratch**（GC 紀律達標）。半開窗嚴格 `<`（GD-3）、`lateEventCount` 低水位語意不變。 |
| view 契約 | `consume` 用**單一模組層級重用 view** 解碼 packed 槽（`dequeueInto`），cast 成 `InputEvent` 交付；handle 須同步讀取、**不得保留參考**。測試收集端就地 `snapshot` 複製欄位。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **53 passed**（+7 InputRing +1 溢位 wiring；含 WP-2 決定性 9 tests、T4 consume 5 tests 遷移後無回歸）；`npx vite build` → **✓ built**。`graphify update .` 已刷新圖。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T4b.1｜ring 表示法 = 並行 typed-array packed 槽位 `type,t,a,b` + `head`/`count` 游標。** *理由*：對齊 CONTEXT「ring buffer」（packed 數值欄位、不 push 物件、當下擋 GC、未來 SAB-portable）；`Float64Array` 對 `t`（量測時鐘域，float 精確）與 dx/dy/code 皆足。用 `count`（非獨立 tail）省一游標、tail = `(head+count)&MASK` 導出。*Alternatives*：(a) 單一 struct-of-arrays 之外的 array-of-packed-objects → 仍配置物件，否決；(b) `head`+`tail`+滿旗標 → 多一狀態、易錯，否決。
- **D-T4b.2｜`code` 編碼小整數 enum（`KEY_CODE`/`CODE_KEY`），SAMPLED_KEYS 併入。** *理由*：packed 槽存整數不存字串（GC/SAB 友善）；`SAMPLED_KEYS` 本就是封閉集，`KEY_CODE` 的鍵即該集合，`KEY_CODE[code]===undefined` 一次達成「編碼 + 成員判定」，消一份重複真相源。反向 `CODE_KEY` 供 `dequeueInto` 解碼回 `InputEvent.code`。回填 CONTEXT「ring buffer」對照表。
- **D-T4b.3｜溢位政策「滿則拒新、不丟最舊」（GD-2）。** *理由*：覆寫最舊未消費槽 = 靜默丟資料，破壞研究效度；改為 `push*` 回 `false` + `bufferOverflow++`（該 drill 標 suspect）。`bufferOverflow` 落 `inputMeta`（與 `lateEventCount` 同為 GD-2 匯出 metadata），寫入端（InputSampler）維護、`resetState` 歸零。*Alternatives*：drop-oldest（環狀常見）→ 違 GD-2，否決。
- **D-T4b.4｜寫入端 bounded insertion 取代 consume 排序 scratch（落實 D-3b 最終形態）。** *理由*：T4 的 `due.sort` 每 tick 配置 scratch，違 CLAUDE.md §4；`event.timeStamp` 近單調故 append 後就地小範圍前移（近 O(1)）即保序，consume 遂只需沿 head 排空、零每-tick 配置。相等 `t` 用嚴格 `<` 不換 → stable、保到達順序（延續 T4 語意）。bounded 的上界為 head（遲到事件前移至 head 端恰使其夾進當前最舊 tick，與 `lateEventCount` 語意自洽）。
- **D-T4b.5｜消費交付用單一重用 view 物件（`InputEventView`）。** *理由*：packed 槽解碼若每事件配置 InputEvent 物件則違 GC 紀律；改為模組層級單一 view 就地覆寫、cast 交付。契約：handle 同步讀取、不保留參考（於型別/consume 註解言明；WP-5 `applyInput` 同步讀取相容）。

**Surprises & Discoveries：**
- **測試設施遷移面最廣**：換型別牽動 5 個直接 `state.input.push({...})` 的測試檔（consume/InputSampler/SimLoop/determinism/SharedState）。以共用 `inputRingTestUtil`（`pushEvent` 編碼 + `drainToArray`/`snapshot` 快照）統一遷移，避免各檔重造 helper。**收集端不得保留重用 view 參考** → collector 改就地快照（否則 `delivered` 全指向同一被覆寫物件）；此即 view 契約在測試面的體現。
- 殘留內容斷言（consume.test「邊界事件留待下一 tick」）由「讀殘留陣列」改為**行為式鏈式 consume**（續 consume 更大 `untilT` 驗遞延），因 ring 不提供非破壞性殘留讀取（且不宜為測試加生產 API）。
- 決定性無回歸：合成輸入已升冪 → 寫入端零 bubble、consume 沿 head 排空，逐 tick 狀態與 T4 一致（9 tests bit-exact 全綠）。

**Next**：T5 Exit gate（F1 採集整體驗收 map + 翻頂層索引 §2 WP-3 ✅ + 交棒 WP-5）。

### 2026-07-01 — T4 sim 依時序消費輸入緩衝 + 排空 ✅ PASS（FR-3.4）

**交付：** NEW [`src/input/consume.ts`](../../../../src/input/consume.ts)、[`consume.test.ts`](../../../../src/input/consume.test.ts)（5 tests）；MODIFY [`src/loop/SimLoop.ts`](../../../../src/loop/SimLoop.ts)（`consumeInput` → `consume(state, tickEndMs, handle)` + `applyInput` handle）、[`src/state/SharedState.ts`](../../../../src/state/SharedState.ts) + [`src/state/types.ts`](../../../../src/state/types.ts)（最小 `inputMeta`）。

| 項目 | 內容 |
|------|------|
| API | `consume(state, untilT, handle)`：一趟掃描收集 `t < untilT`（半開窗、**嚴格 `<`**，GD-3）到期子集、局部窗排序（升冪）、逐一 `handle`、殘留就地壓實排空（同一陣列參考、不 realloc）。遲到（`t < inputMeta.lastConsumedT`）夾進當前 tick 消費並計 `lateEventCount`（不丟棄）。 |
| SimLoop | `simStep` 開頭改呼叫 `consume(state, tickEndMs, (ev) => applyInput(state, ev))`；`applyInput` 暫只 A/D 切 vx（沿用佔位），mouse/fire 忽略（→ WP-5）。accumulator / `simTimeMs` 邏輯時鐘不改。 |
| metadata | `SharedState.inputMeta = { lateEventCount, lastConsumedT }`（`types.ts` 加 `InputMeta`）；`resetState` 原地歸零（重用物件，GC 紀律）。`lastConsumedT` 初始 `-Infinity`（首 tick 不誤判遲到）。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **45 passed**（+5 consume；含 WP-2 決定性 9 tests 無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（+5） | 亂序 push → 升冪交付 · 跨 tick 分批 + 邊界 `t == untilT` 落下一 tick（嚴格 `<`）· 緩衝排空（殘留皆 `t >= untilT`）· 遲到夾進 + `lateEventCount` 遞增 · `resetState` 歸零 inputMeta（重用物件）。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T4.1｜範圍拆分：T4 只在 WP-2 佔位 plain array 上做排序消費 + 排空 + `lateEventCount` + 決定性回歸；固定欄位 ring buffer（OQ-3.2）+ `bufferOverflow`（GD-2）拆為 [T4b](T4b-ring-buffer-overflow.md)。** *理由*：符合 T4 Touches（`consume.ts` + `SimLoop.ts`，本切片僅多動最小 `inputMeta`）、Med/Med 風險、Rule 0 簡單優先，且**不回頭改動剛提交的 T1/T2/T3 採集端**（ring 化需改三個 handler 的 `push` → 槽位寫入 + 寫入端 bounded insertion，屬正交、獨立成本切片降回歸面）。*Alternatives*：(a) 一次做完 ring + overflow + 保序寫入 → 觸及 T1/T2/T3，超出 T4 Touches、回歸面大，否決；(b) 完全不加 metadata → `lateEventCount` 無處存放、GD-2 行為缺失，否決（故加**最小** `inputMeta`，不含 ring/overflow 欄位）。
- **D-T4.2｜局部窗排序 vs D-3b。** D-3b 定「排序責任在採集端（保序寫入），consume 只游標排空」。*現況*：T1–T3 仍為到達順序 plain `push`（未實作寫入端 bounded insertion，見 D-T1.3/D-T2.2）。*決議*：本切片於 consume **僅對本 tick 到期子集**做局部排序（`due.sort`，小範圍、非整 buffer）補齊「亂序 → 升冪」，滿足 T4 DoD；**不**違背 D-3b 的最終形態——寫入端保序 + 消除 consume 排序 scratch 是 [T4b](T4b-ring-buffer-overflow.md) 的職責（ring packed 槽就地排序困難 + 每 tick sort scratch 違反 CLAUDE.md §4，故留到 ring 化一併處理）。
- **D-T4.3｜`lateEventCount` 存放於 `SharedState.inputMeta`（+ 內部游標 `lastConsumedT`）。** *理由*：consume 為 `consume(state, untilT, handle)` 純函式，偵測遲到需跨 tick 持久化「上次已關閉窗邊界」，SharedState 是其唯一持久面。`lateEventCount` 為 GD-2 研究 metadata（WP-7 匯出）；`lastConsumedT` 標記為 consume 內部游標、非匯出語意。初始 `-Infinity` 使首 tick 不誤判。**未加** ring/overflow 欄位（→ T4b）。*Alternatives*：把游標放 SimLoop closure → consume 需多一參數、破壞既定簽章，否決。
- **D-T4.4｜邊界維持嚴格 `<`（GD-3）。** consume 用 `ev.t < untilT`，與 WP-2 佔位 `consumeInput`（`buf[consumed].t < tickEndMs`）一致；決定性回歸 9 tests 全綠，確認未漂移成 `<=`。

**Surprises & Discoveries：**
- 無意外。`simStep` 每 tick 傳入 `(ev) => applyInput(state, ev)` arrow 為極小配置；GC-strict 零配置版（handle 提升為穩定參考、消除 `due` scratch）與 ring buffer 一併移交 T4b。已於 SimLoop 就地註記。
- **決定性邊界重申**：逐 tick exact 全等只涵蓋預排序合成事件路徑；遲到（`lateEventCount`）路徑本質 wall-clock 相依、非決定性，故 `consume.test.ts` 以獨立單元測試驗遲到，不納入決定性 exact 斷言。

**Next**：T4b（固定欄位 ring buffer + `bufferOverflow` + T1/T2/T3 push → 槽位重用 / 寫入端保序）→ 之後 T5 Exit gate。

### 2026-07-01 — T2 滑鼠 coalesced 採集 ✅ PASS（pointermove + getCoalescedEvents 次幀採樣，FR-3.2）

**交付：** MODIFY [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（`onPointerMove` + attach/detach 掛載）、[`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（+3 coalesced tests + pointermove 合成 helper）。

| 項目 | 內容 |
|------|------|
| API | `pointermove` → `(e.getCoalescedEvents?.() ?? [e])` 逐一 `state.input.push({type:'mouse', dx:ev.movementX, dy:ev.movementY, t:ev.timeStamp})`；每個 coalesced 子事件各一筆（保留次幀解析度）。attach/detach 掛/移 `pointermove`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **40 passed**（13 InputSampler[6 鍵盤 + 4 開火 + 3 滑鼠] + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（+3） | 多子事件 pointermove → 全部樣本入緩衝、dx/dy 對應、timeStamp 遞增、無遺漏（樣本數 = 子事件數 > 1）· `getCoalescedEvents` 缺席 fallback 到 `[e]` 單筆 · detach 移除 pointermove 監聽。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T2.1｜合成 pointermove 的頂層 `movementX/Y/timeStamp` 取「最後一筆 coalesced 子樣本」的值。** *理由*：貼近瀏覽器行為（外層 pointermove 為該幀最終彙總值，coalesced 為其次幀展開）；本 task 僅消費 `getCoalescedEvents()`，故頂層值只在 fallback 路徑（舊瀏覽器單筆）被讀，取最後一筆語意一致。*Alternatives*：頂層留空 → fallback 測試會拿到 undefined，語意模糊，否決。
- **D-T2.2｜`state.input` 仍用 WP-2 佔位 array `push`（不引入 ring buffer / 排序）。** *理由*：延續 D-T1.3 / D-3b——`push` 依到達順序 append，coalesced 子事件本就按 `timeStamp` 升冪回傳，保序前提成立（GD-3/D-3b）。ring buffer（OQ-3.2）屬後續切片，Rule 0 簡單優先。
- **D-T2.3｜與 WP-1 視角互不干擾：本 task 只入緩衝、不套用視角。** WP-1 走 `pointerLock.onMove` 即時驅動 camera；量測用的 coalesced 樣本獨立入 `state.input`，兩條路徑不共用、不互相呼叫（ADR-2 三迴圈只透過 SharedState 溝通）。滑鼠不受 T3 的 `isLocked` 閘門（該閘門僅套用於 fire）。

**Surprises & Discoveries：**
- 無意外。唯一測試設施擴充：`makeFakeTarget.dispatch` 參數型別由 `Partial<KeyboardEvent & MouseEvent>` 拓為含 `PointerEvent`（納入 `getCoalescedEvents`/`movementX/Y`），非破壞性、既有 13 測試無回歸。
- **Scope note**：coalesced 樣本無條件入緩衝（未依 drill 生命週期閘門）——量測期 gating 屬 WP-6，同 T1/T3。

**Next**：T4（sim 依 `event.timeStamp` 時序消費 + ring buffer 排空，GD-3/D-3b）——T1–T3 齊備，前置解除。

### 2026-07-01 — T3 開火事件 ✅ PASS（mousedown 左鍵 + event.timeStamp，僅鎖定中，FR-3.3）

**交付：** MODIFY [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（`onMouseDown` + lock 閘門）、[`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（+4 fire tests）、[`src/main.ts`](../../../../src/main.ts)（注入 `() => pointerLock.locked`）。

| 項目 | 內容 |
|------|------|
| API | `createInputSampler(state, isLocked = () => true)`；`mousedown`（button 0 且 `isLocked()`）→ `state.input.push({type:'fire', t:event.timeStamp})`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **37 passed**（10 InputSampler[6 鍵盤 + 4 開火] + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（+4） | 鎖定中左鍵入緩衝 + 時間戳 · 未鎖定不入 · 非左鍵（右/中鍵）不入 · detach 移除 mousedown 監聽。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T3.1｜lock 閘門用注入的 `isLocked: () => boolean`（第二參數，預設 `() => true`），非在 sampler 內直讀 `document.pointerLockElement`。** *理由*：(1) 守本專案 DI 可測慣例（D-T1.1；node 測試無 `document`，注入假旗標即可驗鎖定/未鎖定兩路徑）；(2) lock 權威狀態已由 [`PointerLock.ts`](../../../../src/input/PointerLock.ts) 以 `document.pointerLockElement === canvas` 事件驅動維護（D-T2.1），sampler 直讀 global 會複製該權威、且無法引用 canvas。main 傳 `() => pointerLock.locked`。*Alternatives*：(a) sampler 直讀 `document.pointerLockElement` → 破 DI、與 PointerLock 權威重複，否決；(b) 必填參數 → 破壞既有 `createInputSampler(state)`（鍵盤測試 + 語意上鍵盤不受閘門），否決。*預設 `() => true`*：sampler 單獨/鍵盤路徑不閘門（與 T1 鍵盤無條件採集一致）；閘門僅套用於 fire。
- **D-T3.2｜開火 mousedown 掛在 `window`（沿用 T1 `attach(window)`），非 canvas。** *理由*：Pointer Lock 鎖定中滑鼠事件冒泡至 window；且與鍵盤同 target 便於單一 attach/detach 生命週期。「點擊 canvas 取鎖」的 mousedown 在鎖定完成前 `pointerLock.locked` 仍為 false（lock 為 async、由 `pointerlockchange` 確立），故取鎖點擊自然被閘門濾除，不誤判為開火。

**Surprises & Discoveries：**
- 無意外。fire 為最小切片（Low/Low）；lock 閘門的 async 時序（取鎖 mousedown 早於 locked=true）恰好使「未鎖定不採計」同時擋掉取鎖點擊，與 T3 design note 目的一致。
- **Scope note**：與 T1 同——sampler 仍無條件 `attach(window)`，drill 生命週期 gating 屬 WP-6；fire 的 lock 閘門只擋 UI/取鎖點擊，非量測期閘門。

**Next**：T2（滑鼠 `pointermove` + `getCoalescedEvents()` 次幀採樣，FR-3.2）——本 WP 唯一 Med/Med 風險項；完成後 T1–T3 齊備即可進 T4（sim 消費）。

### 2026-07-01 — T1 鍵盤採集 ✅ PASS（keydown/keyup + event.timeStamp，FR-3.1）

**交付：** NEW [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（鍵盤部分）+ [`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（6 tests）；MODIFY [`src/main.ts`](../../../../src/main.ts)（建 sampler + `attach(window)`）。

| 項目 | 內容 |
|------|------|
| API | `createInputSampler(state) → { attach(target), detach() }`；keydown（非 repeat）/keyup 過濾 A/D/W/S → `state.input.push({type:'key',code,down,t:event.timeStamp})`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **33 passed**（6 新 InputSampler + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（6） | 時間戳寫入 · A/D/W/S 過濾（無關鍵不入緩衝）· `event.repeat` 不重複 · 時間戳原樣保留 · detach 移除監聽 · attach 冪等。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T1.1｜`attach` 參數型別 `HTMLElement` → `EventTarget`（偏離 README 原契約）。** *理由*：鍵盤事件實務落在 `window`/`document`，非某 HTMLElement；`EventTarget` 為 `Window`/`Document`/`HTMLElement` 共同上界，且 node 測試可注入假 target（守本專案「注入假物件」測試慣例，如 `clock.ts`）。*Alternatives*：(a) 維持 `HTMLElement` + main.ts 傳 canvas → canvas 需 focus 才收鍵盤，脆弱，否決；(b) 硬編 `window` 不收 target → 失去 DI 可測性，否決。**已同步回寫 README §2 interface contract。**
- **D-T1.2｜採集端過濾 A/D/W/S（`KeyboardEvent.code`）。** *理由*：只有移動鍵是量測所需；過濾避免打字/快捷鍵污染緩衝、守 GC 紀律（不 push 無關事件）。用 `code` 非 `key`（避 layout 差異，設計註記）。反向語意不在此處（OQ-3.1 → WP-5）。
- **D-T1.3｜`state.input` 維持 WP-2 佔位 plain array 的 `push`（本切片不換 ring buffer）。** *理由*：T1 touches 不含 `SharedState.ts`；`push` 依到達順序 append，`event.timeStamp` 近單調 ⇒ 近有序，滿足 D-3b 保序前提。ring buffer（OQ-3.2）與 D-3b 的 bounded-insertion 屬後續切片，不在 T1 過度實作（Rule 0 簡單優先）。

**Surprises & Discoveries：**
- **⚠️ 分支事故（已復原）**：實作 T1 期間工作區被切到 `wp-4-target-tvisible` 分支（疑似並行 WP-4 session 的 `git checkout`）。未提交的 T1 變更一度落在 wp-4 上。**復原**：restore 兩個 doc 檔（改動小、可重做）→ `git checkout wp-3-input-sampler`（main.ts 兩分支相同、untracked 檔隨遷移，皆乾淨）→ 於 wp-3 重驗 tsc/vitest（33 綠）+ 重貼 doc 編輯。wp-3 兩個 docs commit（T0 `ef52e66`、review `2e6df3f`）確認完好。**教訓**：並行 WP session 共用同一 worktree 會互相切換分支；跨 session 應各自 worktree（`git worktree`）隔離。
- **Scope note**：sampler 目前 `attach(window)` 無條件採集（未依 drill/pointerLock 閘門）；量測期間才採集的 gating 屬 WP-6 drill 生命週期，本切片不做（記此以免誤判為遺漏）。

**Next**：T2（滑鼠 `pointermove` + `getCoalescedEvents()`）∥ T3（開火 mousedown）——皆 append 進同一 sampler。

### 2026-07-01 — 審查驅動的文件補強（T0 後、T1 前；docs only）

對 T0 記錄的交棒發現（「WP-2 佔位用 `splice` + 假設已排序；consume 需排序 + T4 覆蓋亂序」）做一次 review，補強三處 spec 缺口。**皆為文件層決策，尚無生產碼。**

**Decision Log（本次非平凡選擇）：**

- **D-3a｜tick 邊界統一嚴格 `<`（半開窗），非 `<=`。** 原 WP-3 契約（README §2 / T4）寫「取 `t <= untilT`」與 WP-2 佔位 `consumeInput`（[SimLoop.ts:32](../../../../src/loop/SimLoop.ts#L32) `t < tickEndMs`）矛盾。*決議*：向 WP-2 對齊用 `<`。*理由*：WP-2 決定性已鎖、M1 綠燈（2026-07-01），`t == tickEndMs` 事件在 `<=` 下會早一 tick 消費 → 破壞 T4「重跑 WP-2 決定性回歸仍綠」。*Alternatives*：(a) 改 WP-2 為 `<=` → 破壞已證 M1 性質，否決；(b) consume 收 `nextTickStart` 配 `<=` → 語意繞路、易再漂移，否決。已升 **[DECISIONS.md](../../DECISIONS.md) GD-3**（跨 WP-2/WP-3）並回寫 README §2 + T4 全文。

- **D-3b｜排序責任移到採集端（保序寫入），非 consume 端每 tick 全排序。** 原 Failure modes 寫「consume 端排序」。*決議*：InputSampler 寫入時保序（`event.timeStamp` 近單調 → append 近有序；罕見亂序 bounded insertion）；consume 只游標排空。*理由*：OQ-3.2 鎖定 ring buffer 為 packed 數值槽（`type,t,a,b`），consume 端每 tick 全排序需配置 sort scratch → 違反 CLAUDE.md §4「無 GC 卡頓」，且環狀 packed 就地排序困難。深度更足。已回寫 README §2 Failure modes。

- **D-3c｜T4 scope 補「遲到事件 + `lateEventCount` + `bufferOverflow`」。** 原 T4 只提「亂序」，漏了與亂序正交的兩件事：遲到（事件晚於已關閉 tick）與溢位。二者已是 GD-2 專案級 metadata，但 T4 scope 未捕捉行為。*決議*：T4 In scope / Steps / DoD 補上；並明記**逐 tick exact 決定性只涵蓋預排序合成事件路徑**，遲到事件本質 wall-clock 相依、非決定性（不納 exact 斷言）。已回寫 [T4-sim-consume.md](T4-sim-consume.md)。

**影響面**：T1（採集端保序）、T4（consume 契約 + 遲到/溢位測試 + 邊界回歸）。無碼改動、無回歸風險（純 spec）。

**Next**：T1（鍵盤採集，須落實 D-3b 保序寫入雛形）。

### 2026-07-01 — T0 Entry gate ✅（docs only, no production code）
- **PASS**：M1 已達成——[WP-2 exit-gate](../wp-2-dual-loop-skeleton/T5-exit-gate.md) ✅（DONE 2026-07-01，決定性 9 tests 綠、tsc 0、vitest 27/27、e2e 3/3），[頂層索引](../../README.md) §3 標 **M1 達成（2026-07-01）**。
- 緩衝/消費掛點就緒：`SharedState.input`（[SharedState.ts:15](../../../../src/state/SharedState.ts#L15)，`InputEvent[]` 佔位陣列，WP-3 換 ring buffer）；`SimLoop` consume 掛點（[SimLoop.ts:29](../../../../src/loop/SimLoop.ts#L29) `consumeInput`，`simStep` line 56 呼叫，已依 timeStamp 分桶消費 + `splice` 排空——佔位機制待 T4 換 ring buffer 槽位重用）。`InputEvent` union（key/mouse/fire）已與 README §2 interface 契約一致（[types.ts:18](../../../../src/state/types.ts#L18)）。
- **鎖 OQ**：OQ-3.1（只記原始鍵碼、反向語意延 WP-5）、OQ-3.2（固定欄位真環狀 ring buffer、靜態容量不動態 resize、溢位 `bufferOverflow`）、OQ-3.3（`event.timeStamp` 同 `performance.now()` time origin，僅 Chromium）——三者翻 ✅（README §1 + 上方 ledger）。
- **Surprise / note**：WP-2 佔位消費用陣列前端 `splice`（[SimLoop.ts:42](../../../../src/loop/SimLoop.ts#L42)）——WP-3 的 `consume.ts` 需改為 ring buffer 游標推進、且加入「桶內按 t 升冪排序」（現佔位假設輸入已排序，T4 需覆蓋亂序）。
- **Next**：T1（鍵盤採集）∥ T2（滑鼠 coalesced）∥ T3（開火）→ T4（sim 消費 + 排空）。
