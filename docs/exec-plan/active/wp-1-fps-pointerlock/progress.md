# WP-1 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T1 通過（2026-06-30）— 封閉房間 + camera 舞台就緒，待執行 T2

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SceneManager | ✅ 通過（2026-06-30）|
| T2 Pointer Lock | ⬜ 待執行 |
| T3 原始輸入 + fallback | ⬜ 待執行 |
| T4 yaw/pitch | ⬜ 待執行 |
| T5 設定面板 | ⬜ 待執行 |
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
