import * as THREE from 'three/webgpu';

export type RenderBackend = 'webgpu' | 'webgl2';

export interface RendererBootstrap {
  renderer: THREE.WebGPURenderer;
  backend: RenderBackend;
}

/** three 的 backend 實例在 WebGPU 模式下會帶 `isWebGPUBackend === true`（見 three.webgpu.js）。 */
interface RendererBackendInfo {
  isWebGPUBackend?: boolean;
}

/**
 * 雙重判定（FR-0.3 + 風險表「WebGL2 fallback 被當成 WebGPU 記錄」）。
 *
 * 權威來源是 **renderer 實際 backend**（init 後的 `renderer.backend.isWebGPUBackend`）：
 * `WebGPURenderer` 在 `navigator.gpu` 存在、但 adapter/device 取得失敗時會內部 fallback 成
 * WebGL2。此時不能只憑 `navigator.gpu` 存在性回報 `'webgpu'`，否則 WP-7 metadata 會誤報、
 * 污染研究資料。`navigator.gpu` 僅作交叉檢查：可用卻 fallback → warn（init 失敗的徵兆）。
 */
export function resolveBackend(
  gpuAvailable: unknown,
  rendererBackend: RendererBackendInfo | null | undefined,
): RenderBackend {
  const actual: RenderBackend =
    rendererBackend?.isWebGPUBackend === true ? 'webgpu' : 'webgl2';

  if (gpuAvailable && actual === 'webgl2') {
    console.warn(
      '[render backend] navigator.gpu 存在但 renderer 實際 fallback 成 WebGL2（WebGPU init 失敗）；以實際 backend 為準。',
    );
  }

  return actual;
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
): Promise<RendererBootstrap> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();

  const gpuAvailable = (navigator as Navigator & { gpu?: unknown }).gpu;
  const rendererBackend = (
    renderer as unknown as { backend?: RendererBackendInfo | null }
  ).backend;
  const backend = resolveBackend(gpuAvailable, rendererBackend);
  console.info('[render backend]', backend);

  return { renderer, backend };
}
