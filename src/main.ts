import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { SceneManager } from './render/SceneManager.ts';

// 進入點必須走 'three/webgpu'（見 createRenderer），否則拿不到 WebGPURenderer。

// WP-0 / T2（FR-0.2）— 啟動先驗 cross-origin isolation（計時量測效度前置，ADR-4）。
const isolation = assertIsolation();
console.info('[isolation]', isolation);

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

// WP-0 seam：async bootstrap，取得 renderer + backend（backend 供 WP-7 metadata）。
const { renderer, backend } = await createRenderer(canvas);
void backend;

// WP-1 / T1（FR-1.1）— 封閉房間 + camera 舞台。
const sceneManager = new SceneManager();

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  sceneManager.resize(w, h);
}
resize();
window.addEventListener('resize', resize);

// 暫用 rAF render 靜態場景；WP-2 才換 sim/render 雙迴圈，此處不引入 sim accumulator。
function frame(): void {
  renderer.render(sceneManager.scene, sceneManager.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
