// run-stage10-acceptance.mjs — WP-51 / T1
//
// Thin CLI entry for `npm run test:stage10`. All domain logic (root allocation, fixtures, process
// lifecycle, evidence) lives in tests/stage10/*.ts, unit-testable under Vitest; this wrapper only
// runs that TypeScript entry through `vite-node` (already a transitive Vitest dependency, so no new
// devDependency is needed) and forwards its exit code.
//
// 執行:npm run test:stage10

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const cliEntry = resolve(repoRoot, 'tests/stage10/cli.ts');

const result = spawnSync('npx', ['vite-node', cliEntry], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
