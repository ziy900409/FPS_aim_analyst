# WP-0 — 環境建置與學習爬升

> 執行計畫 / 技術規格。本 WP 進行中工作的 source of truth。
> 索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-0（PLAN §5）— *環境建置與學習爬升* |
| **里程碑** | 通往 **M1**（WP-2 脊椎）；本 WP 自身不構成 milestone gate |
| **相依** | 無（專案起點） |
| **Type** | 基礎建設（greenfield scaffold）：可跑空場景 + cross-origin isolation + render backend 偵測 |
| **Module / 觸及路徑** | repo 根新增 `package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `src/` 骨架 / `public/_headers`；`docs/architecture/` 學習筆記 |
| **必讀** | 規格 §2 ADR-1（WebGPU + fallback）· ADR-4（COOP/COEP + `performance.now()`）· 附錄 A（renderer 骨架）· 附錄 D（fallback 偵測）· [PLAN.md](../../../PLAN.md) D1–D5 · [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 3–5 dev-days（熟 Three.js 可砍 2–3 天） |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

專案為 greenfield。WP-0 建立可重複、可量測的開發地基：一個用 `three/webgpu` 跑得起來的空場景，且**滿足研究效度的硬性前置條件**——cross-origin isolation 生效（把 `performance.now()` 解析度從 100 µs 提升到 5 µs，並解鎖階段 B 的 `SharedArrayBuffer`），以及正確偵測並記錄實際 render backend（WebGPU vs WebGL2 fallback，兩者延遲特性不同）。這層地基若沒打好，後續所有量測資料的可信度都會被污染（見規格附錄 F 風險登記）。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-0.1** | Vite + TypeScript 專案以 `import * as THREE from 'three/webgpu'` 跑起一個可見的空場景；dev server 可啟動、無 console error。 | T1 |
| **FR-0.2** | dev / preview server 回傳 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`，使 `crossOriginIsolated === true`。 | T2 |
| **FR-0.3** | `WebGPURenderer` 經 async `init()` 初始化；偵測實際 backend（`webgpu` / `webgl2`）並 console 印出；`navigator.gpu` 不存在時自動走 WebGL2 路徑。backend 值由一個可被 WP-7 metadata 消費的 seam 暴露。 | T3 |
| **FR-0.4** | 部署 pipeline：產出 host-agnostic `public/_headers`（Netlify / Cloudflare Pages）+ nginx 片段文件，使線上主機也能 `crossOriginIsolated === true`；preview server 同樣帶標頭。 | T4 |
| **FR-0.5** | 研讀 `PointerLockControls` 範例與 three-fps repo，輸出精簡學習筆記以降低 WP-1 風險。 | T5 |

### Non-functional Requirements

- **計時精度是硬門檻**：FR-0.2 的 `crossOriginIsolated === true` 不是 nice-to-have，是後續所有 `performance.now()` 量測的效度前提（ADR-4）。
- **可重現性**：鎖定 Node / 套件版本（lockfile committed），確保不同機器拉同樣的 `three` r 版本（需 ≥ r171 內建 WebGPU + WebGL2 fallback）。
- **後端透明**：backend 偵測結果必須是可程式讀取的值（非僅 console），WP-7 要寫進匯出 metadata。

### Constraints

- **禁用 `Date.now()`**：本 WP 不引入任何 wall-clock 計時；後續一律 `performance.now()`（ADR-4）。
- **`three/webgpu` 進入點**：必須 `import * as THREE from 'three/webgpu'`（非 `'three'`），否則拿不到 `WebGPURenderer`。
- **async init 強制**：`WebGPURenderer` 需 `await renderer.init()` 才能 render（附錄 A）；scaffold 的 bootstrap 必須是 async。
- **階段 A 鎖 Chrome/Edge 桌面版**；WP-0 不做跨瀏覽器 QA。
- **UI = 純 TS + DOM overlay（D1）**：本 WP 不引入 React/Vue/Lit 等框架。

### Out of scope

- 任何 FPS 控制 / Pointer Lock 整合（→ WP-1）、`SharedState` / 雙迴圈（→ WP-2）。
- 實際正式環境部署到特定廠商（D3 = 後定）；T4 只產出 host-agnostic 設定 + 文件，實際 deploy 為條件性步驟。
- 美術、音效、HUD 內容。

### Open Questions

| ID | Question | 建議解法 | Blocks | Status (T0) |
|----|----------|---------|--------|-------------|
| **OQ-0.1** | 套件管理器與 Node 版本？ | **npm + Node ≥ 20 LTS**（PLAN 寫 `npm create vite`；lockfile = `package-lock.json`）。entry-gate 驗證在場。 | T1 | ✅ Node v25.6.1 / npm 11.9.0 |
| **OQ-0.2** | `three` 版本？ | **最新 stable（≥ r171）**——r171 起內建 WebGPU + 自動 WebGL2 fallback（ADR-1）。鎖進 lockfile。 | T1, T3 | ✅ three 0.185.0（≥ 0.171 = r171） |
| **OQ-0.3** | 靜態主機選哪家？（D3 後定） | **暫不選**；T4 產出通用 `_headers`（Netlify/CF Pages 語法相容）+ nginx 片段；實際 deploy 待 D3 拍板。 | T4 | ⬜ 後定（D3） |
| **OQ-0.4** | TS 嚴格度 / lint？ | **`strict: true` + 最小 ESLint**；本 WP 只立骨架，完整 lint 規則隨程式成長補。 | T1 | ✅ `strict: true` + 最小 ESLint |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
package.json                 ← NEW (deps: three; devDeps: vite, typescript, vitest, @playwright/test)   [FR-0.1]
package-lock.json            ← NEW (鎖版本, OQ-0.1/0.2)                                                   [FR-0.1]
tsconfig.json                ← NEW (strict)                                                               [FR-0.1/0.4]
vite.config.ts               ← NEW (COOP/COEP headers plugin: server + preview)                          [FR-0.2/0.4]
index.html                   ← NEW (canvas mount point)                                                   [FR-0.1]
src/main.ts                  ← NEW (async bootstrap)                                                      [FR-0.1/0.3]
src/render/createRenderer.ts ← NEW (WebGPURenderer init + backend 偵測 seam, 附錄 A)                       [FR-0.3]
src/env/isolation.ts         ← NEW (crossOriginIsolated 執行期斷言 + 解析度量測)                            [FR-0.2]
public/_headers              ← NEW (Netlify / CF Pages COOP/COEP)                                          [FR-0.4]
docs/architecture/notes-fps-controls.md ← NEW (WP-1 預備學習筆記)                                          [FR-0.5]
docs/operational/deploy-headers.md      ← NEW (nginx / host 設定文件)                                      [FR-0.4]
```

In scope: 上表。Out of scope：§1「Out of scope」。

### Data flow（bootstrap 啟動序）

```
index.html (canvas)
  → src/main.ts (async)
      → src/env/isolation.ts: assertIsolation()  → 讀 crossOriginIsolated；量 performance.now() 解析度  [FR-0.2]
      → src/render/createRenderer.ts: createRenderer(canvas)
            await renderer.init()                                                                          [FR-0.3]
            backend = navigator.gpu ? 'webgpu' : 'webgl2'
            console.info('[render backend]', backend)
            return { renderer, backend }   ← backend 為 WP-7 metadata 的來源 seam
      → 建一個空 Scene + Camera，render 一幀（證明管線通）
```

### Interface contracts

```ts
// src/render/createRenderer.ts  (FR-0.3, 附錄 A)
import * as THREE from 'three/webgpu';

export type RenderBackend = 'webgpu' | 'webgl2';

export interface RendererBootstrap {
  renderer: THREE.WebGPURenderer;
  backend: RenderBackend;   // 供 WP-7 寫入匯出 metadata
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererBootstrap>;

// src/env/isolation.ts  (FR-0.2)
export interface IsolationStatus {
  crossOriginIsolated: boolean;
  timerResolutionUs: number;   // 量測到的 performance.now() 解析度（µs）
}
export function assertIsolation(): IsolationStatus;  // crossOriginIsolated===false 時 console.warn
```

```ts
// vite.config.ts  (FR-0.2/0.4) — dev + preview 都要帶標頭
const coopCoep = {
  name: 'coop-coep',
  configureServer(server) { server.middlewares.use((_, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  }); },
  configurePreviewServer(server) { /* 同上 */ },
};
```

```
# public/_headers  (FR-0.4, Netlify / Cloudflare Pages)
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| `WebGPURenderer` undefined | 誤 `import from 'three'` 而非 `'three/webgpu'` | T1 驗證 import 路徑；type error 即擋下 |
| `crossOriginIsolated === false` | 標頭沒生效 / 載入跨源資源無 CORP | `assertIsolation()` console.warn + T2 以 Playwright 斷言為 true |
| `await renderer.init()` 漏掉 | 同步呼叫 render | 黑畫面 / 例外；bootstrap 強制 async，T1 DoD 含「render 一幀無錯」 |
| 版本漂移（`three` < r171） | 未鎖版本 | lockfile committed；T3 驗證 `WebGPURenderer` 存在 |
| host 不支援自訂標頭 | D3 選錯主機 | T4 文件列出各 host 設標頭方式；deploy 為條件性 |

### Concurrency model

無。WP-0 為單執行緒 bootstrap，無 worker / 無共享可變狀態。雙迴圈與 worker 屬 WP-2 / 階段 B。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **cross-origin isolation 沒真的生效**（標頭設了但 `crossOriginIsolated` 仍 false） | Med | High | T2 用 Playwright 在真實瀏覽器斷言 `crossOriginIsolated===true`，不靠肉眼；dev+preview 都設標頭 |
| **`three/webgpu` 版本/API 漂移** | Med | Med | 鎖 lockfile（≥ r171）；T3 驗證 `WebGPURenderer` + `init()` 簽章 |
| **backend 偵測誤判**（WebGL2 fallback 被當成 WebGPU 記錄） | Low | High | T3 以 `navigator.gpu` 存在性 + renderer 實際 backend 雙重判定；值可程式讀取供 WP-7 |
| **學習爬升吃掉時程**（不熟 3D） | Med | Med | FR-0.5 學習筆記前置；估時已含爬升；T5 非阻塞 |
| **host 標頭不可控**（免費方案限制） | Low | Med | T4 host-agnostic `_headers` + nginx 片段；D3 後定不鎖死 |

### Technical debt（自覺取捨）

- **最小 ESLint**（OQ-0.4）：本 WP 只立骨架，完整 lint/CI 規則延後。*Trigger to revisit*：程式量成長或 WP-2 引入決定性測試時補上。
- **未實際部署到正式 host**（D3 後定）：T4 只交付設定 + 文件。*Trigger*：D3 拍板 host 後補實際 deploy + 線上 `crossOriginIsolated` 驗證。

---

## 4. 任務拆解 (Task Breakdown)

每個 task 是**自足檔案**，執行 agent 只載入該 task（+ 指名的原始檔），context 用量遠低於 40%。
master checklist：[task-checklist.md](task-checklist.md)。

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 驗證 Node/npm/瀏覽器 WebGPU 在場、repo 乾淨無既有 src、確認 D1–D5、解 OQ-0.1/0.2/0.4。read-only + 文件。 | — | Low | Low |
| **T1** Scaffold | [T1-scaffold.md](T1-scaffold.md) | Vite+TS+`three/webgpu` 空場景跑起來（FR-0.1）；lockfile 鎖版本。 | T0 | Low | Low |
| **T2** Cross-origin isolation | [T2-coop-coep-isolation.md](T2-coop-coep-isolation.md) | `vite.config` COOP/COEP plugin + `assertIsolation()`；Playwright 斷言 `crossOriginIsolated===true`（FR-0.2）。 | T1 | Med | Low |
| **T3** WebGPU backend 偵測 | [T3-webgpu-backend-detection.md](T3-webgpu-backend-detection.md) | `createRenderer` async init + backend 偵測 + WebGL2 fallback + metadata seam（FR-0.3）。 | T1 | Med | Med |
| **T4** Deploy headers | [T4-deploy-headers.md](T4-deploy-headers.md) | `public/_headers` + nginx 文件 + preview 帶標頭（FR-0.4）；實際 deploy 條件性。 | T2 | Low | Low |
| **T5** Reference notes | [T5-reference-notes.md](T5-reference-notes.md) | `PointerLockControls` / three-fps 學習筆記降 WP-1 風險（FR-0.5）。非阻塞。 | — | Low | Low |
| **T6 / T-exit** Exit gate | [T6-exit-gate.md](T6-exit-gate.md) | WP-0 驗收清單全綠、map 規格附錄 E 相關項、更新索引狀態、交棒 WP-1、commit/PR。 | T1–T5 | Low | Low |

### Acceptance criteria（規格附錄 E 相關項）→ task map

> 全項於 T6 exit gate 最終綠燈（證據見 [progress.md](progress.md) 2026-06-30 T6 entry）。
- [x] `crossOriginIsolated === true`，`performance.now()` 達 5 µs 解析度 → **T2**（Playwright dev+preview 3 passed + 實測 `timerResolutionUs ≈ 5.0 µs`）
- [x] 渲染後端（WebGPU/WebGL2）正確偵測（為 WP-7 寫入 metadata 預備 seam）→ **T3**（`backend.spec.ts` e2e=webgpu + `resolveBackend` 4 tests + `{renderer,backend}` seam）
- [x] 空場景可跑、dev server 無 error、版本鎖定 → **T1**（`tsc` exit 0 + `vite build` ✓ + lockfile 鎖 `three@0.185.0`）
- [x] 線上主機標頭設定就緒（host-agnostic）→ **T4**（`public/_headers` == `dist/_headers` + `deploy-headers.md`；實際 deploy 視 D3）

---

## Assumptions

- **A1**：開發機具 Chrome/Edge 桌面版且支援 WebGPU（`navigator.gpu` 存在）；無則走 WebGL2 fallback 並如實記錄。T0 驗證。
- **A2**：`three` ≥ r171 內建 `WebGPURenderer` + 自動 WebGL2 fallback（ADR-1）。
- **A3**：npm + Node ≥ 20 LTS（OQ-0.1）；lockfile committed。
- **A4**：靜態主機後定（D3）；T4 交付 host-agnostic 設定即視為達成 FR-0.4 的可交付部分。
- **A5**：本 WP 不寫任何遊戲邏輯 / 計時量測；只證明渲染管線 + isolation + backend 偵測三件地基。
