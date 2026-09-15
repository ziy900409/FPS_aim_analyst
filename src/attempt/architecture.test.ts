import { describe, expect, it } from 'vitest';

/**
 * WP-69 / T1 DoD — `src/attempt/` is a pure contract layer. Same mechanism as
 * `src/scene/architecture.test.ts`: scan the raw sources rather than trusting review.
 *
 * Why it matters beyond tidiness: `RunAttemptController` is the single authority deciding whether a
 * run may be adopted (C-D4). The moment it can reach DOM, Three.js, `SharedState` or the sim, that
 * decision stops being reproducible from a snapshot alone, and `finalize()` stops being testable
 * without a browser — which is exactly how a second, implicit definition of "valid attempt" gets
 * born. Test files are excluded: they legitimately import vitest and committed golden fixtures.
 */
const productionSources = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ).filter(([path]) => !path.endsWith('.test.ts')),
);

const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'three', pattern: /\bfrom\s+['"]three(?:\/[^'"]*)?['"]/ },
  { label: 'src/sim', pattern: /\bfrom\s+['"][^'"]*\/sim\/[^'"]*['"]/ },
  { label: 'src/state (SharedState)', pattern: /\bfrom\s+['"][^'"]*\/state\/[^'"]*['"]/ },
  { label: 'src/render', pattern: /\bfrom\s+['"][^'"]*\/render\/[^'"]*['"]/ },
  { label: 'src/scene', pattern: /\bfrom\s+['"][^'"]*\/scene\/[^'"]*['"]/ },
  { label: 'src/ui', pattern: /\bfrom\s+['"][^'"]*\/ui\/[^'"]*['"]/ },
  { label: 'research/', pattern: /\bfrom\s+['"][^'"]*research\/[^'"]*['"]/ },
  { label: 'node:*', pattern: /\bfrom\s+['"]node:[^'"]*['"]/ },
];

/** DOM globals a pure state machine has no business touching. */
const FORBIDDEN_GLOBALS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'document', pattern: /\bdocument\./ },
  { label: 'window', pattern: /\bwindow\./ },
  { label: 'performance.now()', pattern: /\bperformance\.now\s*\(/ },
  // ADR-4 / CLAUDE.md §4 — banned repo-wide, re-asserted here because this module handles times.
  { label: 'Date.now()', pattern: /\bDate\.now\s*\(/ },
  // GD-5 — all randomness must be injected as a seeded RNG.
  { label: 'Math.random()', pattern: /\bMath\.random\s*\(/ },
];

describe('src/attempt boundary — the disposition contract stays pure (T1 DoD)', () => {
  it('scans the production sources it claims to scan', () => {
    expect(Object.keys(productionSources).sort()).toEqual([
      './AttemptFinalizationGate.ts',
      './RunAttemptController.ts',
      './recordingIntegrity.ts',
    ]);
  });

  for (const { label, pattern } of FORBIDDEN) {
    it(`does not import ${label}`, () => {
      const violations = Object.entries(productionSources)
        .filter(([, source]) => pattern.test(source))
        .map(([path]) => path);
      expect(violations).toEqual([]);
    });
  }

  for (const { label, pattern } of FORBIDDEN_GLOBALS) {
    it(`does not reach for ${label}`, () => {
      const violations = Object.entries(productionSources)
        .filter(([, source]) => pattern.test(stripComments(source)))
        .map(([path]) => path);
      expect(violations).toEqual([]);
    });
  }

  it('only imports from within src/attempt', () => {
    const importFrom = /\bfrom\s+['"]([^'"]+)['"]/g;
    const violations: string[] = [];
    for (const [path, source] of Object.entries(productionSources)) {
      for (const match of source.matchAll(importFrom)) {
        const specifier = match[1]!;
        if (!specifier.startsWith('./')) violations.push(`${path} → ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

/** Doc comments discuss `performance.now()`, `Date.now()` and the sim on purpose — only code counts. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
