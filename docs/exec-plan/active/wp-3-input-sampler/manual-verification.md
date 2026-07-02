# WP-3 手動 / e2e 驗證操作手冊（T5 exit-gate）

> 驗證 F1 採集層在**真實瀏覽器**端到端可運作：鍵/滑鼠/開火事件帶高解析度 `event.timeStamp`
> 入固定欄位 ring buffer，並被 sim 依時序消費。搭配 [T5-exit-gate.md](T5-exit-gate.md)。
>
> 觀測管道：`main.ts` 的 **dev-only** 縫 `window.__aimDebug = { state, pointerLock }`
> （僅 `npm run dev`／5173 存在，`import.meta.env.DEV` 守門；production build 剝除）。

---

## A. 自動化 e2e（Playwright + Edge）

涵蓋**不需 Pointer Lock**、可穩定自動化的路徑：鍵盤端到端、時間戳同源、非採集鍵忽略、
未鎖定 fire 被閘門擋、滑鼠 coalesced 次幀入緩衝。

### 如何跑

```bash
# 一次跑 WP-3 這支（webServer 會自動起 dev 5173 + preview 4173）
npx playwright test input-sampler

# 或跑全部 e2e（含 WP-0 isolation/backend）
npm run test:e2e

# 想看瀏覽器實際操作（headed）：
npx playwright test input-sampler --headed

# 失敗時看報告
npx playwright show-report
```

> 前置：系統已安裝 **Edge**（config `channel: 'msedge'`，階段 A 鎖 Chrome/Edge）。
> 首次若報找不到瀏覽器：`npx playwright install msedge`。

### 預期結果

`3 passed`：
1. 鍵盤 A/D（trusted）→ `player.vx` 切 ±250、`player.x` 推進（入緩衝→sim 消費→套用）。
2. 同步探針：KeyQ 不入、KeyD 入且 `peekT()` 與 `performance.now()` 差 < 50ms（同源）、未鎖定 fire 不入。
3. 同步探針：一個 pointermove 的 3 個 coalesced 子樣本各入 ring 一筆。

---

## B. 手動驗（Pointer Lock 閘門下的開火 — e2e 無法穩定自動化）

Pointer Lock 需真實使用者手勢，自動化無法穩定取得。故「**鎖定中**左鍵 mousedown 入緩衝」的
**正向**路徑用手動驗（自動化只驗了未鎖定的負向路徑）。

### 步驟

1. 起 dev server：
   ```bash
   npm run dev
   ```
   開 **Edge/Chrome** 進 `http://localhost:5173/`（需 `crossOriginIsolated`，dev server 已設 COOP/COEP）。

2. 開 DevTools（F12）→ Console。先確認觀測縫在：
   ```js
   __aimDebug.state.input.size()   // → 0（尚無輸入）
   __aimDebug.pointerLock.locked   // → false
   ```

3. **點畫面**取得 Pointer Lock（「點擊以鎖定滑鼠視角」提示消失）。確認：
   ```js
   __aimDebug.pointerLock.locked   // → true
   ```

4. **開火驗證**：鎖定中**按左鍵**開火數次，然後**立刻**在 Console（sim 每幀排空，故要快，或連續按著）觀察計數變化。
   較穩的作法——貼這段**先攔截**再開火，即時列印每個被消費的事件：
   ```js
   // 暫時包一層 handle 觀測 consume 交付（僅供手動驗；重整頁面即還原）
   const ring = __aimDebug.state.input;
   const origSize = ring.size.bind(ring);
   setInterval(() => { const n = origSize(); if (n) console.log('ring size', n, 'headT', ring.peekT()); }, 8);
   ```
   接著在**鎖定中**：按 W/A/S/D、移動滑鼠、按左鍵開火。應看到 `ring size` 短暫 >0（事件入緩衝）
   後迅速歸零（sim 消費排空），`headT` 為高解析度時間戳（≈ `performance.now()` 當下值）。

5. **鍵盤/滑鼠同場驗**（鎖定中）：
   - 按住 **D** → 畫面（camera）應往右平移（佔位 `applyInput` 把 KeyD→vx=+250 推進 `player.x`）；放開 → 停。按 **A** → 往左。
   - 移動滑鼠 → 視角轉動（WP-1 路徑）；同時滑鼠樣本入量測緩衝（WP-3，被 sim 消費）。兩者互不干擾。

6. **Esc 解鎖** → `__aimDebug.pointerLock.locked` 回 `false`；此後左鍵**不**再計為開火（閘門）。

### 通過標準

- 鎖定中左鍵開火時 `ring` 短暫收到事件並被 sim 排空（size 由 >0 迅速歸零）。
- `headT`（`peekT()`）為高解析度時間戳、與 `performance.now()` 同時鐘域（差極小）。
- 按 D/A 使畫面左右平移（證明事件被依時序消費且套用）。
- 解鎖後左鍵不再入緩衝（閘門生效）。

> ⚠️ `event.timeStamp` 與 `performance.now()` 同源**僅 Chromium 成立**（OQ-3.3）；非 Chromium 須重驗。
