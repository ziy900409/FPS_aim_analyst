# WP-0 — Progress Log

> Running log。最新在上。每個打勾的 checklist box 都附指令輸出 / 檔案路徑作為證據。
> 同伴：[README.md](README.md)（tech spec）· [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T1 scaffold 通過，待開 T2 / T3

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 Scaffold | ✅ 通過（2026-06-30）|
| T2 Cross-origin isolation | ⬜ 待執行 |
| T3 WebGPU backend 偵測 | ⬜ 待執行 |
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
