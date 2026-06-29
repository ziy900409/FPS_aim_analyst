# T3 — WebGPU backend 偵測 + WebGL2 fallback + metadata seam

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/render/createRenderer.ts`；MODIFY `src/main.ts`（改用 `createRenderer`） |
| **Status** | ⬜ TODO |

## Objective

把 T1 內嵌的 renderer 建立邏輯抽成 `createRenderer(canvas)`，做 async `init()`、偵測實際 render backend（`webgpu` / `webgl2`），console 印出，並把 backend 值以**可程式讀取的 seam** 暴露——WP-7 的匯出 metadata 會消費它（FR-0.3，附錄 A）。`navigator.gpu` 不存在時 `WebGPURenderer` 自動走 WebGL2 路徑，須驗證 fallback 路徑可運作。

## In scope
- `src/render/createRenderer.ts`：回傳 `{ renderer, backend }`（`RenderBackend = 'webgpu' | 'webgl2'`）。
- backend 判定：以 `navigator.gpu` 存在性為主訊號（附錄 A）；若 Three.js 暴露實際 backend 旗標則優先用之並在 progress.md 註記 API。
- `main.ts` 改用 `createRenderer`，console 印 `[render backend] <backend>`。

## Out of scope
- 把 backend 寫進匯出檔（→ WP-7；本 task 只建 seam + log）。
- 場景內容、控制、HUD。

## Design notes

- **seam 設計**：`createRenderer` 的回傳 `backend` 即 seam；WP-7 `DataRecorder` 從 bootstrap 結果拿，不自行偵測，避免雙來源不一致。
- **fallback 驗證**：無法在 Chrome 真關 WebGPU 時，至少寫一條可單元測的純函式 `pickBackend(gpu: unknown): RenderBackend`（`gpu ? 'webgpu' : 'webgl2'`），用 Vitest 兩案覆蓋。
- 不要用 `Date.now()` 或 render frame 推任何時間（ADR-4）；本 task 與計時無關。

```ts
// src/render/createRenderer.ts（附錄 A 對齊）
import * as THREE from 'three/webgpu';
export type RenderBackend = 'webgpu' | 'webgl2';
export function pickBackend(gpu: unknown): RenderBackend { return gpu ? 'webgpu' : 'webgl2'; }
export interface RendererBootstrap { renderer: THREE.WebGPURenderer; backend: RenderBackend; }
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererBootstrap> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  const backend = pickBackend((navigator as any).gpu);
  console.info('[render backend]', backend);
  return { renderer, backend };
}
```

## Steps

- [ ] 建 `src/render/createRenderer.ts`（上方骨架 + `pickBackend` 純函式）。
- [ ] `main.ts` 改 `const { renderer, backend } = await createRenderer(canvas);`，render 一幀。
- [ ] 寫 `src/render/createRenderer.test.ts`（Vitest）：`pickBackend(undefined)==='webgl2'`、`pickBackend({})==='webgpu'`。
- [ ] `npm run dev` console 確認印出 `[render backend] webgpu`（或 webgl2，依機器）。
- [ ] `npx vitest run` 綠燈；`npx tsc --noEmit` 乾淨。

## Definition of Done

- [ ] console 印出實際 backend；`createRenderer` 回傳的 `backend` 可被外部讀取（seam 就緒）。
- [ ] `pickBackend` Vitest 兩案通過（webgpu / webgl2 fallback）。
- [ ] 受測機器的實際 backend 記入 progress.md。

## Commit

`feat(wp-0): WebGPURenderer init + backend 偵測 + WebGL2 fallback seam（FR-0.3）`
