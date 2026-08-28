import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * WP-50 T2 DoD: "replay domain boundary scan 無 DOM/Three/fs/sim/wall-clock/random import"
 * (README §6/execution rules). A static text scan of the domain module sources — cheaper and more
 * durable than trying to catch this indirectly through unit test behavior, and it fails loudly the
 * moment someone adds a forbidden import rather than only when a code path happens to exercise it.
 */
const DOMAIN_MODULES = [
  '../../src/replay/contracts.ts',
  '../../src/replay/normalizeReplayRecording.ts',
  '../../src/replay/sampleReplay.ts',
  '../../src/replay/ReplayPlayer.ts',
];

const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /from ['"]three/,
  /from ['"]node:fs/,
  /from ['"]\.\.\/loop\/SimLoop/,
  /from ['"]\.\.\/sim\//,
  /Date\.now\s*\(/,
  /performance\.now\s*\(/,
  /Math\.random\s*\(/,
  /requestAnimationFrame/,
  /document\./,
  /window\./,
];

describe('WP-50 T2 — replay playback-domain purity boundary', () => {
  for (const relativePath of DOMAIN_MODULES) {
    it(`${relativePath} has no DOM/Three/fs/sim/wall-clock/random import`, () => {
      const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
      const source = readFileSync(absolutePath, 'utf-8');
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});
