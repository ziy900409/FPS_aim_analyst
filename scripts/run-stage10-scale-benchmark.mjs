// run-stage10-scale-benchmark.mjs — WP-51 / T4
//
// Thin CLI entry for `npm run test:stage10:scale` — the opt-in, real-browser scale/performance
// benchmark (RUN_STAGE10_SCALE_BENCHMARK=1 gates the actual work; see tests/stage10/stage10-scale.perf.ts
// for why). Mirrors scripts/run-stage10-acceptance.mjs: runs the TypeScript entry through `vite-node`
// (already a transitive Vitest dependency) and forwards its exit code.
//
// 執行:RUN_STAGE10_SCALE_BENCHMARK=1 npm run test:stage10:scale
//   (PowerShell: $env:RUN_STAGE10_SCALE_BENCHMARK=1; npm run test:stage10:scale)

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const entry = resolve(repoRoot, 'tests/stage10/stage10-scale.perf.ts');

const result = spawnSync('npx', ['vite-node', entry], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
