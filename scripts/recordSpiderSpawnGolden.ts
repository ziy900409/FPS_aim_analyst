import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recordSpiderSpawns,
  spiderShotV1GoldenConfig,
  spiderShotV2GoldenConfig,
  type SpiderSpawnSample,
} from '../tests/regression/spiderSpawnGoldenFixture.ts';

/**
 * WP-57 / T2（NFR-57.2）：重新產生 `spider-shot-v1` / `v2` 的 spawn golden。
 *
 * ```bash
 * npx vite-node scripts/recordSpiderSpawnGolden.ts
 * ```
 *
 * ⚠️ 這支腳本**只在刻意重錄 baseline 時才該跑**（例如兩支 drill 的參數被有意識地改動，且該改動
 * 已入 DECISIONS 帳本）。日常跑它會把回歸洗成「預期」，NFR-57.2 的閘就失效了。
 */

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/golden/spider-shot');

function writeGolden(fileName: string, samples: readonly SpiderSpawnSample[]): void {
  const lines = samples.map((s) => `  ${JSON.stringify(s)}`).join(',\n');
  writeFileSync(resolve(OUT_DIR, fileName), `[\n${lines}\n]\n`, 'utf8');
  console.log(`${fileName}: ${samples.length} spawns`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeGolden('spider-shot-v1-spawns.json', recordSpiderSpawns(spiderShotV1GoldenConfig));
writeGolden('spider-shot-v2-spawns.json', recordSpiderSpawns(spiderShotV2GoldenConfig));
