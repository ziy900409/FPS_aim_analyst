# T1 — Scaffold（Vite + TS + three/webgpu 空場景）

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `package.json`、`package-lock.json`、`tsconfig.json`、`index.html`、`src/main.ts`；最小 ESLint 設定 |
| **Status** | ⬜ TODO |

## Objective

立起可跑的 Vite + TypeScript 專案，用 `import * as THREE from 'three/webgpu'` render 一個可見的空場景（地板色背景即可），dev server 無 console error，版本鎖進 lockfile（FR-0.1）。

## In scope
- `npm create vite@latest`（vanilla-ts）→ 安裝 `three`、devDeps（`vite`、`typescript`、`vitest`、`@playwright/test`）。
- `tsconfig.json` `strict: true`（OQ-0.4）。
- `index.html` 一個 full-viewport `<canvas>`。
- `src/main.ts` async bootstrap：建 `WebGPURenderer`、`await renderer.init()`、空 `Scene` + `PerspectiveCamera`、render 一幀。

## Out of scope
- COOP/COEP 標頭（→ T2）、backend 偵測 seam（→ T3）、部署（→ T4）。
- 任何遊戲邏輯 / 控制 / HUD。

## Design notes

- **進入點必須 `'three/webgpu'`**：`import * as THREE from 'three'` 拿不到 `WebGPURenderer`（Constraint）。
- **async bootstrap**：`renderer.init()` 是 async；`main.ts` 用 top-level `await` 或 async IIFE。
- backend 偵測本 task 先不做精細處理（T3 補 seam）；T1 只要畫面通。

```ts
// src/main.ts（骨架）
import * as THREE from 'three/webgpu';
const canvas = document.querySelector<HTMLCanvasElement>('#app')!;
const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
await renderer.init();
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202428);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 3;
renderer.render(scene, camera);
```

## Steps

- [ ] `npm create vite@latest` → 選 vanilla-ts；確認 `package-lock.json` 生成（鎖 OQ-0.1/0.2 版本）。
- [ ] `npm i three`；devDeps 補 `vitest`、`@playwright/test`（先裝不配置，T2/T3/WP-9 用）。
- [ ] `tsconfig.json` 設 `strict: true`、`moduleResolution: bundler`。
- [ ] `index.html` 放 full-viewport `<canvas id="app">`，去除 Vite 範本多餘 DOM。
- [ ] 寫 `src/main.ts`（上方骨架）：async init + 空場景 render 一幀。
- [ ] `npm run dev` 啟動，瀏覽器開 → 可見背景色畫面、**console 無 error**。
- [ ] `npx tsc --noEmit` 乾淨。

## Definition of Done

- [ ] `npm run dev` 跑起來，空場景可見，console 無 error / 無 warning（WebGPU 相關）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] `package-lock.json` committed，`three` ≥ r171。

## Commit

`feat(wp-0): scaffold Vite + TS + three/webgpu 空場景（FR-0.1）`
