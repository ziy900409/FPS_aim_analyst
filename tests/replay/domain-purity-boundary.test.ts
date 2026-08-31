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
  '../../src/replay/replayRecoil.ts',
  '../../src/replay/replayCompatibility.ts',
  '../../src/replay/ReplayController.ts',
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

describe('WP-50 T2/T6 — replay playback-domain purity boundary', () => {
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

/**
 * WP-50 T-exit — T-exit-gate.md automated gate #5: "replay path 無 SimLoop.pump/InputSampler/
 * Pointer Lock". Scoped to actual call/import syntax (not prose) so it doesn't false-positive on
 * doc comments that legitimately *name* these live-only APIs to explain why the replay path never
 * calls them (e.g. ReplayPresentationSession.ts's own header comment).
 */
const RENDER_REPLAY_MODULES = [
  '../../src/render/replay/replaySceneResolution.ts',
  '../../src/render/replay/ReplaySceneAdapter.ts',
  '../../src/render/replay/ReplayTargetView.ts',
  '../../src/render/replay/ReplayEffectView.ts',
  '../../src/render/replay/ReplayPresentationSession.ts',
  ...DOMAIN_MODULES,
];

const FORBIDDEN_LIVE_ONLY_CALL_PATTERNS: readonly RegExp[] = [
  /\.pump\s*\(/,
  /from ['"].*InputSampler/,
  /requestPointerLock\s*\(/,
  /pointerLock\.request\s*\(/,
];

describe('WP-50 T-exit — replay path never invokes live SimLoop.pump/InputSampler/Pointer Lock', () => {
  for (const relativePath of RENDER_REPLAY_MODULES) {
    it(`${relativePath} has no live-only sim/input call or import`, () => {
      const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
      const source = readFileSync(absolutePath, 'utf-8');
      for (const pattern of FORBIDDEN_LIVE_ONLY_CALL_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

/** T-exit-gate.md gate #5: "Replay UI 無 `node:*`" — the UI layer (`src/ui/replay/*.ts`) must stay
 * importable in a browser bundle with no Node builtin dependency. */
describe('WP-50 T-exit — Replay UI has no node: import', () => {
  const uiModules = ['../../src/ui/replay/ReplayScreen.ts', '../../src/ui/replay/ReplayTransport.ts'];
  for (const relativePath of uiModules) {
    it(`${relativePath} has no node: import`, () => {
      const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
      const source = readFileSync(absolutePath, 'utf-8');
      expect(source).not.toMatch(/from ['"]node:/);
    });
  }
});
