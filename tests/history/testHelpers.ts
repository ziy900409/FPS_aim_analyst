import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Shared WP-48 T2 test scaffolding: disposable temp-root helpers. Every filesystem test must use
 * `makeTempRoot()` (never the real `data/session-history/`), per README §6 / NFR-48.6.
 *
 * `makeAssessmentPayload` moved to `./payloadFixtures.ts` (T4): that builder has zero `node:*`
 * imports, so `src/history/*.test.ts` (under `tsconfig.json`'s Node-typeless `src` program) can
 * import it directly. Re-exported here so existing T2/T3 test imports keep working unchanged.
 */
export type { MakeAssessmentPayloadOptions } from './payloadFixtures.ts';
export { makeAssessmentPayload } from './payloadFixtures.ts';

export async function makeTempRoot(prefix = 'fps-history-test-'): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempRoot(root: string): Promise<void> {
  await fs.rm(root, { recursive: true, force: true });
}
