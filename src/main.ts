import * as THREE from 'three/webgpu';
import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';

// WP-0 / T1 — async bootstrap：證明 three/webgpu 渲染管線通。
// 進入點必須是 'three/webgpu'（非 'three'），否則拿不到 WebGPURenderer。

// WP-0 / T2（FR-0.2）— 啟動先驗 cross-origin isolation（計時量測效度前置，ADR-4）。
const isolation = assertIsolation();
console.info('[isolation]', isolation);

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

const { renderer, backend } = await createRenderer(canvas);
void backend;
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202428);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 3;

renderer.render(scene, camera);
