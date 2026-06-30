# WP-0 — Progress Log

> Running log。最新在上。每個打勾的 checklist box 都附指令輸出 / 檔案路徑作為證據。
> 同伴：[README.md](README.md)（tech spec）· [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T3 WebGPU backend seam 通過，待開 T4

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 Scaffold | ✅ 通過（2026-06-30）|
| T2 Cross-origin isolation | ✅ 通過（2026-06-30）|
| T3 WebGPU backend 偵測 | ✅ 通過（2026-06-30）|
| T4 Deploy headers | ⬜ 待執行 |
| T5 Reference notes | ⬜ 待執行 |
| T6 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-0.1 套件管理器 / Node 版本 | ✅ 解決 | npm + Node ≥ 20 LTS。T0 實測：Node **v25.6.1** / npm **11.9.0** |
| OQ-0.2 `three` 版本 | ✅ 解決 | T0 實測 `npm view three version` = **0.185.0**（≥ 0.171 = r171，內建 WebGPU + WebGL2 fallback）；T1 鎖 lockfile |
| OQ-0.3 靜態主機 | ⬜ 後定（D3） | 暫不選；T4 產 host-agnostic `_headers` + nginx 文件 |
| OQ-0.4 TS 嚴格度 / lint | ✅ 解決 | `strict: true` + 最小 ESLint；完整規則隨程式成長補 |

---

## Log

### 2026-06-30 — T3 修正：backend 雙重判定（FR-0.3 缺口補正）✅ PASS

**背景：** 驗收 T3（commit `338fd37`）時發現 backend 偵測只用 `navigator.gpu` 存在性（`pickBackend(navigator.gpu)`），**未讀 renderer 實際 backend**，違反 FR-0.3「偵測**實際** backend」與風險表「`navigator.gpu` 存在性 + renderer 實際 backend **雙重判定**」。`WebGPURenderer` 在 gpu 可用但 adapter/device 取得失敗時會內部 fallback 成 WebGL2 → 原實作會誤報 `'webgpu'`，污染 WP-7 metadata（風險表評 High impact）。使用者裁示：先補雙重判定再進 T4。

**交付檔案：**
- `src/render/createRenderer.ts`（MODIFY）：`pickBackend()` → `resolveBackend(gpuAvailable, rendererBackend)`。權威來源 = `renderer.backend.isWebGPUBackend === true`（three 自身即用此判定，見 `three.webgpu.js:9030`）；`navigator.gpu` 僅交叉檢查，可用卻 fallback → `console.warn`。`createRenderer` init 後讀 `renderer.backend`（typed cast，因 `backend` 不在公開 .d.ts）。
- `src/render/createRenderer.test.ts`（MODIFY）：改測 `resolveBackend`，新增**風險情境**「gpu 存在但 renderer fallback → webgl2 並 warn」（原測試達不到的分歧）+ 防禦性 backend 缺失。
- `tests/e2e/backend.spec.ts`（NEW）：真實瀏覽器攔截 `[render backend]` console，斷言實際 backend 讀取路徑端到端通且值合法（受測機 = `webgpu`）。對齊 T2 把驗證固化成可回歸 spec 的做法（原 T3 僅 ad-hoc 檢查）。

**驗證（證據）：**

| 檢查 | 指令 | 結果 |
|------|------|------|
| 型別檢查 | `npx tsc --noEmit` | exit 0 ✅ |
| 單元（含分歧情境） | `npx vitest run src/render/createRenderer.test.ts` | **4 passed**（webgpu / 正常 fallback 無 warn / gpu 存在但 fallback→warn / backend 缺失）✅ |
| 產線建置 | `npx vite build` | ✓ built ✅ |
| E2E（真實瀏覽器，無回歸） | `npx playwright test`（Edge/msedge） | **3 passed**：isolation dev+preview + backend（實際 = `webgpu`）✅ |

**Decision Log：**
- **D-T3.2：renderer 實際 backend 為權威來源，`navigator.gpu` 降為交叉檢查。** 「雙重判定」語意上以「真的在跑什麼」為準；`navigator.gpu` 可用性只用來偵測「可用卻 fallback」的 init 失敗並 warn，不參與最終值。
  - *Alternatives considered*：(a) 兩者 AND（都為真才 webgpu）——等價但語意較弱，且 backend 缺失時行為不直觀；(b) 以實際 backend 為準 + 分歧 warn。選 (b)。
- **D-T3.3：分歧情境靠單元測試涵蓋，e2e 只證讀取路徑。** 「gpu 存在但 renderer fallback」無法在真實瀏覽器穩定重現，故由 `resolveBackend` 單元測試（mock backend）涵蓋；e2e 負責證明 `renderer.backend.isWebGPUBackend` 是正確 API 路徑、端到端不丟例外。

**Surprises & Discoveries：**
- three 公開 .d.ts 未型別化 `Renderer.backend`，但執行期確實存在（`Renderer` 建構式 `this.backend = backend`）。以 `as unknown as { backend?: ... }` cast 取用，與既有 `navigator.gpu` cast 同模式。

**Next**：T3 缺口補正完成，FR-0.3 雙重判定到位。續 **T4**（[T4-deploy-headers.md](T4-deploy-headers.md)）— `public/_headers` + nginx 文件 + preview 帶標頭；依賴的 preview isolation 已於 T2 綠燈。

### 2026-06-30 — T3 WebGPU backend 偵測 + WebGL2 fallback seam ✅ PASS

**交付檔案：** `src/render/createRenderer.ts`（NEW：`createRenderer(canvas)` async init、`RenderBackend` / `RendererBootstrap` seam、`pickBackend(gpu)`）、`src/render/createRenderer.test.ts`（NEW：`pickBackend` webgpu/webgl2 兩案）、`src/main.ts`（MODIFY：改由 `createRenderer(canvas)` 建 renderer，保留一幀空場景 render）。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| 影響分析 | GitNexus `impact main` / `impact src/main.ts` | target not found；`impactedCount: 0`、processes: 0、risk `UNKNOWN`（無 HIGH/CRITICAL）|
| 型別檢查 | `npx.cmd tsc --noEmit`（PowerShell `npx.ps1` 被 execution policy 擋下，等價於 `npx tsc --noEmit`） | exit 0 ✅ |
| 產線建置 | `npx.cmd vite build` | ✓ built in 1.69s（chunk>500KB warning＝three 體積，資訊性）✅ |
| fallback 純函式 | `npx.cmd vitest run src/render/createRenderer.test.ts` | 1 file / 2 tests passed：`undefined → webgl2`、`{} → webgpu` ✅ |
| Edge 真實 backend | Playwright `chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-webgpu'] })` 載入 Vite dev server | `ACTUAL_BACKEND=webgpu; HAS_GPU=true; CONSOLE=[render backend] webgpu` ✅ |
| Edge fallback 路徑 | Playwright init script 覆寫 `Navigator.prototype.gpu` 為 `undefined` 後載入同頁 | `FALLBACK_BACKEND=webgl2; HAS_GPU=false; CONSOLE=[render backend] webgl2` ✅ |

**Decision Log：**
- **D-T3.1：`createRenderer` 回傳 `{ renderer, backend }` 作為唯一 metadata seam。** WP-7 後續從 bootstrap 結果取 backend，不重新偵測，避免雙來源漂移。
- **D-T3.2：backend 判定維持附錄 A 的 `navigator.gpu` 存在性。** Three.js 0.185.0 本次未採用額外公開 backend 旗標；實測以 Edge console 與 `pickBackend` seam 交叉驗證。
- **D-T3.3：不在本切片調整 Vitest/Vite 測試設定。** `npx vitest run` 預設會誤收既有 Playwright e2e spec；T3 只以目標檔驗證新增 Vitest 兩案，設定收斂留待後續測試基礎建設切片。

**Surprises & Discoveries：**
- PowerShell 直接執行 `npx` 會命中 `npx.ps1` execution policy；本機驗證改用 `npx.cmd`，語意等價且已通過。
- `npx.cmd vitest run` 會收進 `tests/e2e/isolation.spec.ts`，Playwright 的 `test()` 在 Vitest runner 下報錯；這是 runner 邊界問題，不是 `pickBackend` 測試失敗。T3 目標檔 `src/render/createRenderer.test.ts` 已 2/2 passed。
- Headless Edge + `--enable-unsafe-webgpu` 實測實際 backend 為 **webgpu**；在同一瀏覽器用 init script 讓 `navigator.gpu` 不存在時，程式可讀 seam 轉為 **webgl2**。

**Open Questions（待使用者確認）：**
- **OQ-T3.a：是否要在後續測試基礎建設切片加 Vitest include/exclude。** 現況 `npx vitest run` 會收 Playwright e2e spec；可在後續新增 Vitest config，只收 `src/**/*.test.ts`，避免兩種 runner 互踩。T3 為守切片範圍暫不改設定。

**Next**：T3 完成。停在此處，不自動續 T4；下一個可執行切片為 **T4**（[T4-deploy-headers.md](T4-deploy-headers.md)）。

### 2026-06-30 — T2 Cross-origin isolation ✅ PASS

**交付檔案：** `vite.config.ts`（MODIFY：加 `coopCoep()` plugin — `configureServer` + `configurePreviewServer` 各注入 `COOP: same-origin` / `COEP: require-corp`；並加 `server.port/strictPort` + `preview.port/strictPort` 固定埠號）、`src/env/isolation.ts`（NEW：`assertIsolation()` → `{ crossOriginIsolated, timerResolutionUs }`，false → `console.warn`）、`src/main.ts`（MODIFY：bootstrap 最前呼叫 `assertIsolation()` + `console.info('[isolation]', …)`）、`playwright.config.ts`（NEW：dev+preview 雙 webServer，channel `msedge`）、`tests/e2e/isolation.spec.ts`（NEW：斷言標頭 + `crossOriginIsolated===true`）。

**驗證（證據）：**

| 檢查 | 指令 / 方法 | 結果 |
|------|------|------|
| dev 標頭生效 | `curl -D - http://localhost:5173/` | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` ✅ |
| 型別檢查 | `npx tsc --noEmit` | exit 0 ✅ |
| 產線建置 | `npx vite build` | ✓ built（chunk>500KB warning＝three 體積，資訊性）✅ |
| E2E 斷言（真實瀏覽器） | `npx playwright test isolation`（Edge/msedge） | **2 passed**：dev + preview 皆 `crossOriginIsolated===true` ✅ |
| 計時解析度（DoD） | main.ts `console.info('[isolation]', …)`（Edge 實測） | `{crossOriginIsolated: true, timerResolutionUs: 4.999998956918716}` → **≈ 5.0 µs**，符合 ADR-4 isolated 預期 ✅ |

**Decision Log：**
- **D-T2.1：E2E 同時覆蓋 dev 與 preview（兩個 webServer），而非只驗 dev + 手動驗 preview。** T2 設計註記明言「只設 dev 會讓 `vite preview`（T4 部署前驗證）失去 isolation」——preview isolation 是 T4 的真實前置風險。
  - *Alternatives considered*：(a) 只在 spec 驗 dev、preview 手動 curl 記錄（task 允許「手動或 spec 覆蓋」）——但手動驗證無法防回歸，且 T4 直接依賴 preview isolation；(b) 兩 webServer。
  - *選擇*：(b)。`preview` webServer 命令用 `npm run build && npm run preview`，使測試自足且可重複；代價是每次 `playwright test` 會跑一次 prod build（~數秒，可接受）。
- **D-T2.2：Playwright 用 `channel: 'msedge'`（系統 Edge）而非內建 chromium。** 內建 chromium 首跑要求 `chromium_headless_shell-1228`（環境只快取 1161/1208），會觸發 `npx playwright install` 下載。
  - *Alternatives considered*：(a) `npx playwright install chromium` 下載 ~150 MB 二進位；(b) 用系統 Edge channel。
  - *選擇*：(b)。與 T1 一致（T1 亦用 msedge channel），且契合「階段 A 鎖 Chrome/Edge 桌面版」約束，免下載。
- **D-T2.3：`strictPort: true` 固定 dev 5173 / preview 4173。** Playwright `webServer.url` 與 spec 內 baseURL 寫死埠號；埠被占用時 vite 預設會漂移到 5174…，導致 Playwright 等不到 url。strictPort 改為 fail-fast，使測試假設可靠。

**Surprises & Discoveries：**
- 實測 `timerResolutionUs ≈ 4.9999990 µs`——isolated 後 `performance.now()` 恰好夾到 5 µs 量化網格，與 ADR-4「isolated ~5 µs / 非 isolated ~100 µs」吻合，為計時效度提供直接證據。
- Playwright 1.61.1 預期的內建瀏覽器版本（headless_shell 1228）與環境快取（1161/1208）不一致，首跑報「Executable doesn't exist」。已改用 msedge channel 規避（見 D-T2.2）。
- `tsconfig` `include: ["src"]` 不涵蓋 `vite.config.ts` / `tests/`：前者由 Vite 載入時經 esbuild 型別檢查、後者由 Playwright 自帶 ts runtime 編譯，故 `tsc --noEmit` 綠燈不代表已型別檢查這兩處（皆已在實跑中驗證通過）。

**Open Questions（待使用者確認）：**
- **OQ-T2.a：preview webServer 每次 `playwright test` 觸發 prod build。** 換得自足、可回歸的 preview isolation 驗證，但 E2E 變慢（~數秒 build）。若日後 E2E 數量成長想加速，可改為「先 build 一次→preview 直接服務既有 `dist/`」並依賴 reuseExistingServer。現階段（WP-0，單一 spec）不優化。

**Next**：T2 完成。建議續 **T3**（[T3-webgpu-backend-detection.md](T3-webgpu-backend-detection.md)）— `createRenderer` async init + backend 偵測（`webgpu`/`webgl2`）+ WebGL2 fallback + WP-7 metadata seam。T2 不阻塞 T3；T4（deploy headers）依賴 T2 已綠燈的 preview isolation。

### 2026-06-30 — T1 Scaffold ✅ PASS

**交付檔案（NEW）：** `package.json`、`package-lock.json`（84.8 KB，鎖 `three@0.185.0`）、`tsconfig.json`（`strict: true` + `moduleResolution: bundler`）、`index.html`（full-viewport `<canvas id="app">`）、`src/main.ts`（async bootstrap：`WebGPURenderer` → `await init()` → 空 Scene + PerspectiveCamera → render 一幀）、`vite.config.ts`、`.gitignore`。

**驗證（證據）：**

| 檢查 | 指令 | 結果 |
|------|------|------|
| 鎖定版本 | `npm ls three` | `three@0.185.0`（≥ r171 ✅）|
| 型別檢查 | `npx tsc --noEmit` | exit 0 ✅ |
| 產線建置 | `npx vite build` | ✓ built（6 modules；warning：chunk > 500 KB＝three 體積，資訊性非錯誤）|
| Dev 渲染 + console | Playwright（channel `msedge`, `--enable-unsafe-webgpu`）載入 dev server | CANVAS `{w:1280,h:720,hasGpu:true}`；**CONSOLE_ISSUES = 0** ✅ |

**Decision Log：**
- **D-T1.1：提前引入 `vite.config.ts`（build/esbuild target = `esnext`）。** `src/main.ts` 依 ADR-1/附錄 A 使用 top-level `await renderer.init()`,而 Vite 預設 build target（es2020）不支援 TLA,`vite build` 失敗。
  - *Alternatives considered*：(a) 只驗 `npm run dev`（dev 用 ESM 原生支援 TLA,可繞過）——但會留下壞掉的 `vite build`,違反「keep it compilable」;(b) 把 `init()` 包進 async IIFE 避免 TLA——增加無謂巢狀,且仍與規格骨架不符。
  - *選擇*：建最小 `vite.config.ts` 僅設 `target: 'esnext'`（階段 A 鎖 Chrome/Edge 桌面版,esnext 合理）。**COOP/COEP plugin 不在此 task 加入,留給 T2**（FR-0.2/0.4）。
- **D-T1.2：以手寫骨架取代 `npm create vite` 互動式 scaffold。** repo 根已有 `docs/`、`CLAUDE.md` 等檔,非空目錄會觸發 Vite 互動提示;手寫等價最小檔案更可控且非互動。產出版本與 vanilla-ts 範本一致。
- **D-T1.3：`index.html` 加 `<link rel="icon" href="data:,">`** 抑制預設 `/favicon.ico` 404（原為唯一 console error),達成 DoD「console 無 error」。

**Surprises & Discoveries：**
- Vite 預設 build target 不支援 top-level await（見 D-T1.1）——TLA 在 dev（ESM）可跑但 build 會炸,易誤判。已以 esnext target 解決,證據：上表 build ✓。
- `npm install` 報 5 項 audit 漏洞（3 moderate / 1 high / 1 critical），來源為 dev 工具鏈（vite/esbuild 等）傳遞相依,非 runtime。階段 A 不阻塞;待 WP-9 / CI 階段以 `npm audit` 處理。

**Open Questions（待使用者確認）：**
- **OQ-T1.a：ESLint。** T1「Touches」列出「最小 ESLint 設定」,但 T1 DoD 未含 lint 檢查,OQ-0.4 亦註明「完整 lint 規則隨程式成長補」。為守住切片範圍,**本 task 未引入 ESLint**（避免額外相依與設定膨脹）。建議於程式量成長或 WP-2 引入決定性測試時補上。如需現在就加最小 flat config,請示知。

**Next**：T1 不阻塞 T2/T3（兩者並行）。建議續 **T2**（[T2-coop-coep-isolation.md](T2-coop-coep-isolation.md)）— 於既有 `vite.config.ts` 加 COOP/COEP plugin + `assertIsolation()` + Playwright 斷言 `crossOriginIsolated===true`。

### 2026-06-30 — T0 Entry gate ✅ PASS

**驗證指令與輸出（證據）：**

| 檢查 | 指令 | 結果 |
|------|------|------|
| Node 版本 | `node -v` | `v25.6.1`（≥ 20 LTS ✅）|
| npm 版本 | `npm -v` | `11.9.0` ✅ |
| `three` 可取得版本 | `npm view three version` | `0.185.0`（≥ 0.171 = r171 ✅）|
| repo 乾淨 / 無既有骨架 | `git status --short` | 僅 `M CLAUDE.md` + `?? AGENTS.md`（與本 WP 無關）；根目錄無 `package.json` / `src/` ✅ |
| 瀏覽器 WebGPU | Edge `--headless=new --enable-unsafe-webgpu` 探測 `!!navigator.gpu` | `true` → **受測後端 = webgpu** ✅ |

**PASS 條件全成立**：Node ≥ 20 · three ≥ r171 可取得 · repo 無既有前端骨架 · WebGPU 探測已記錄（true）。

**Decisions / OQ 解決：**
- OQ-0.1 → npm + Node v25.6.1 / npm 11.9.0。
- OQ-0.2 → `three` 0.185.0（T1 將以 lockfile 鎖定此版本）。
- OQ-0.4 → `tsconfig` `strict: true` + 最小 ESLint。
- OQ-0.3 維持後定（D3）。

**Surprises：**
- Node 為 **v25.6.1**（非 20 LTS）——遠超門檻，無阻；惟 v25 非 LTS 線，T1 若遇 Vite/套件相容性問題需留意。已記於此供後續參考。
- WebGPU 探測以 Edge headless 完成（環境無互動式瀏覽器步驟）；`navigator.gpu === true` 確認。實際 runtime backend 仍由 T3 `createRenderer` 雙重判定為準。

**Next**：執行 **T1**（[T1-scaffold.md](T1-scaffold.md)）— Vite+TS+`three/webgpu` 空場景 scaffold + lockfile 鎖版本。

### （規劃）— WP-0 計畫產出
- 依 [PLAN.md](../../../PLAN.md) WP-0 與規格 §2 ADR-1/ADR-4 + 附錄 A/D，將 WP-0 展開為 7 個自足 task 檔（T0 entry-gate → T6 exit-gate），格式參照 `performance_analysis` repo 的 `issue-26` exec-plan。
- 確立 WP-0 三件地基：(1) `three/webgpu` 空場景、(2) `crossOriginIsolated===true`、(3) render backend 偵測（為 WP-7 metadata 預備 seam）。
- 記錄 OQ-0.1~0.4 建議解（npm + Node 20、three ≥ r171、host 後定、strict TS + 最小 ESLint），待 T0 在真實環境驗證後翻 ✅。
- **Next**：執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）— read-only 環境驗證，解 OQ-0.1/0.2/0.4，commit 文件。
