# WP-66 T2 — `TargetView` 逐 mesh material 與命中態衰減

> FR-66.4 / FR-66.5 / FR-66.6 / FR-66.7 · NFR-66.3 / 66.5 · FM-1 / FM-2 / FM-4 / FM-6 · D-66-2

## Objective

讓 `TargetView` 能**逐目標**呈現命中態，並消費 T1 的環形格。兩個容易寫錯的地方由本 task 的測試直接釘死：**命中態必須跟身分走而不是跟 pool 槽位走**（FM-2），以及 **render 不得回寫 state**（FM-4）。

本 task **不接 `main.ts`、不接 config**——`sync()` 的新參數是 optional，既有呼叫端零修改即維持原行為。

## Steps

1. **逐 mesh material**（[TargetView.ts:31](../../../../../src/render/TargetView.ts#L31) / [:100](../../../../../src/render/TargetView.ts#L100)）：
   - 保留 `#material` 作為**模板**（建構參數逐字不變：`{ color: TARGET_COLOR, roughness: 0.6 }`）。
   - `#acquire(i)` 建立新 mesh 時改為 `new THREE.Mesh(this.#geometry, this.#material.clone())`——clone 與模板**型別與 defines 完全相同** ⇒ 同一 WebGPU pipeline，執行期只改 uniform（FM-6）。
   - `dispose()` 改為逐 mesh `material.dispose()` + 模板 `#material.dispose()`。
   - ⚠️ **pool 大小 = 歷史上單幀最多顯示的目標數**（tracking = 1、v8 = 3）⇒ clone 至多數份，於 acquire 一次性建立，熱路徑零配置（NFR-66.3）。
2. **命中態常數**：
   ```ts
   /** 命中態維持時長（ms，render-only；OQ-66.2）。命中即重新起算。 */
   export const HIT_FEEDBACK_HOLD_MS = 120;
   /** 命中態自體發光色；未命中態為 0x000000（= MeshStandardMaterial 預設，故未啟用時逐位不變）。 */
   const HIT_EMISSIVE = 0xff8a3d;
   ```
   實際數值以 T0 收斂的 OQ-66.2／66.3 為準；若 T0 改判，**先改 README §1.4 再改這裡**。
3. **`setHitFeedback(enabled: boolean)`**：只設私有旗標。`false` 時 `sync()` 不讀 ring、不碰任何材質。
4. **`sync(targets, alpha = 1, hits?, nowMs?)`**：
   - **早退分支（FM-1）**：`hits === undefined || nowMs === undefined || !this.#hitFeedback` ⇒ 走**與本 WP 前逐字相同**的既有路徑，不進入任何新程式碼。
   - **增量掃描**：比照 [`ImpactView`](../../../../../src/render/ImpactView.ts) 的既有慣例——維護私有 `#syncedTotal`；`hits.total === this.#syncedTotal` 即早退。否則只掃 `seq > #syncedSeq` 的槽，對每個新命中 `this.#flashUntil.set(hits.id[i], nowMs + HIT_FEEDBACK_HOLD_MS)`（**已存在的 key 直接覆寫 ⇒ 再次命中重新起算**，FR-66.5），掃完更新 `#syncedTotal` / `#syncedSeq`。
   - **上色**：既有的 `for (const t of targets)` 迴圈內，取得 mesh 後 `const until = this.#flashUntil.get(t.id); const lit = until !== undefined && nowMs < until;` ⇒ `mesh.material.emissive.setHex(lit ? HIT_EMISSIVE : 0x000000)`。**以 `t.id` 為鍵，不以 `used` 索引為鍵**（FR-66.6 / FM-2）。
   - **過期清理**：同一迴圈內 `if (until !== undefined && nowMs >= until) this.#flashUntil.delete(t.id);`——Map 大小恆 ≤ 同時顯示的目標數，暖機後零配置。
   - **隱藏的 pool mesh**：既有的 `for (let i = used; ...)` 迴圈除了 `visible = false` 外，**必須**把 `emissive` 歸零——否則該 mesh 下次被另一個目標取用時會帶著上一個目標的亮起狀態（FM-2 的第二條洩漏路徑）。
5. **絕不回寫（FM-4）**：`sync()` 內**不得**寫 `hits.total`／`hits.cursor`／`hits.seq`／`hits.id` 任一欄位。高水位只存在 `TargetView` 私有欄位。
6. **測試**（`src/render/TargetView.test.ts` 擴充；既有做法直接建構 `THREE.Scene` 並檢查 `scene.children`，材質可直接斷言）：
   - **FM-1 反證（最重要的一條）**：`sync(targets)`（不帶 `hits`/`nowMs`）後，mesh 的 `material.emissive.getHex() === 0x000000`、`material.color.getHex() === TARGET_COLOR`、`roughness === 0.6` ⇒ 與本 WP 前逐位相同。
   - `setHitFeedback(false)` 時即使帶 `hits` 且有命中，`emissive` 仍為 `0x000000`。
   - 命中 → `emissive === HIT_EMISSIVE`；`nowMs` 推進到 `HIT_FEEDBACK_HOLD_MS` 之後 → 回 `0x000000`。
   - **重新起算**：在 `HOLD_MS` 內再命中一次，於原到期時間之後仍為亮態。
   - **FM-2 專測（槽位洩漏）**：目標 A（`id: 'a'`）命中並亮起 → A 撤除、目標 B（`id: 'b'`）成為本幀第 0 個顯示目標（**佔用同一 pool 槽位**）→ 斷言 B 的 mesh `emissive === 0x000000`。
   - **同幀多目標獨立**：A 命中、B 未命中，同幀顯示 ⇒ A 亮、B 不亮。
   - **FM-4 專測**：呼叫 `sync()` 前後對 `hits` 的 `total`／`cursor`／`seq`（逐槽）／`id`（逐槽）做 `Object.is` 比對，全數不變。
   - `poolSize` 在啟用命中回饋前後不變（不因 clone 而多建 mesh）。
7. **draw call 記錄（NFR-66.5）**：在 `progress.md` 記下啟用前後 `renderer.info.render.drawcalls`（可於 T5 的實機 A/B 一併取得；本 task 先記單元層的 `poolSize` 不變）。
8. **CONTEXT.md**：在 tracer 家族段落（§210-213 附近）新增兩個術語——**`targetHits`（環形格）** 與 **命中回饋（hit feedback）**，逐字寫明 render-only、不進 export、不得被指標讀取。命名須與 `shotRays` / `TracerView` 條目同風格。

## Invariants

- `sync()` 在 `hits === undefined` 時的控制流與本 WP 前**逐位相同**。
- `#material` 模板的建構參數逐字不變。
- `TargetView` 對 `SharedState` 的任何欄位**零寫入**。
- `setShape()`／`poolSize`／`dispose()` 的既有簽名不變；`sync()` 的前兩個參數簽名不變。
- `ReplayTargetView` **零修改**。
- `src/main.ts`、`src/drill/`、`src/data/`、`src/loop/` **本切片零修改**。

## Definition of Done

- [ ] `HIT_FEEDBACK_HOLD_MS` 已匯出；`setHitFeedback()` 存在且 `sync()` 的第 3/4 參數為 optional
- [ ] FM-1 反證測試存在且綠：不帶 `hits` 時 `emissive`/`color`/`roughness` 三項逐位等於本 WP 前
- [ ] 亮起／衰減／重新起算三條斷言全綠，且到期邊界（`nowMs === until`）有明確期望值
- [ ] **FM-2 槽位洩漏專測存在且綠**（A 命中 → B 佔用同槽 → B 不亮）
- [ ] 同幀多目標獨立呈現斷言存在且綠
- [ ] **FM-4 專測存在且綠**：`sync()` 前後 ring 全欄位（含逐槽）`Object.is` 不變
- [ ] 隱藏 pool mesh 的 `emissive` 歸零有斷言覆蓋
- [ ] `poolSize` 在啟用前後不變
- [ ] `git diff --stat` 顯示 `src/main.ts`、`src/drill/`、`src/data/`、`src/loop/`、`src/render/replay/`、`research/` 六者零改動
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0 且 passed 數 ≥ T1 後基線
- [ ] `npx vitest run tests/regression` exit 0，passed 數與 T0 基線一致且 fixture 零修改
- [ ] `CONTEXT.md` 已新增 `targetHits` 與命中回饋兩個術語條目
- [ ] `progress.md §T2` 記錄：material clone 數上界（= pool 大小）+ 為何 clone 不會造成 pipeline 重編的理由

## Commit

```text
feat(render): light up targets when a shot lands
```
