import * as THREE from 'three/webgpu';

export type RenderBackend = 'webgpu' | 'webgl2';

export interface RendererBootstrap {
  renderer: THREE.WebGPURenderer;
  backend: RenderBackend;
}

export function pickBackend(gpu: unknown): RenderBackend {
  return gpu ? 'webgpu' : 'webgl2';
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
): Promise<RendererBootstrap> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();

  const backend = pickBackend((navigator as Navigator & { gpu?: unknown }).gpu);
  console.info('[render backend]', backend);

  return { renderer, backend };
}
