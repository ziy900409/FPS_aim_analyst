import { describe, expect, it } from 'vitest';
import {
  buildIdentitySegment,
  buildRunFilename,
  buildRunId,
  buildRunIdentity,
  isLexicallyContained,
  sanitizeSegmentPrefix,
  sha256Hex,
} from '../../server/history/historyPaths.ts';

describe('sanitizeSegmentPrefix', () => {
  it('keeps an already-safe ASCII id unchanged', () => {
    expect(sanitizeSegmentPrefix('counterstrafe_reversal_v1')).toBe('counterstrafe_reversal_v1');
  });

  it('replaces path separators and other unsafe characters', () => {
    expect(sanitizeSegmentPrefix('a/b\\c:d')).toBe('a_b_c_d');
  });

  it('collapses non-ASCII input to the x fallback', () => {
    expect(sanitizeSegmentPrefix('王小明')).toBe('x');
  });

  it('collapses a traversal-looking value ".." to the x fallback', () => {
    expect(sanitizeSegmentPrefix('..')).toBe('x');
  });

  it('collapses a single dot to the x fallback', () => {
    expect(sanitizeSegmentPrefix('.')).toBe('x');
  });

  it('truncates very long ids', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeSegmentPrefix(long).length).toBeLessThanOrEqual(40);
  });

  it('never produces a value that starts or ends with a dot', () => {
    expect(sanitizeSegmentPrefix('.hidden.')).toBe('hidden');
  });
});

describe('buildIdentitySegment', () => {
  it('is deterministic for the same input', () => {
    expect(buildIdentitySegment('P-001')).toBe(buildIdentitySegment('P-001'));
  });

  it('disambiguates two unicode ids that collapse to the same prefix', () => {
    const a = buildIdentitySegment('王小明');
    const b = buildIdentitySegment('陳小華');
    expect(a).not.toBe(b);
    expect(a.startsWith('x--')).toBe(true);
    expect(b.startsWith('x--')).toBe(true);
  });

  it('never equals the literal ".." or "." path component', () => {
    const segment = buildIdentitySegment('..');
    expect(segment).not.toBe('..');
    expect(segment).not.toBe('.');
    expect(segment.includes('/')).toBe(false);
    expect(segment.includes('\\')).toBe(false);
  });

  it('contains a 10-hex-char hash suffix', () => {
    const segment = buildIdentitySegment('P-001');
    const suffix = segment.split('--').pop() ?? '';
    expect(suffix).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('buildRunIdentity / buildRunId', () => {
  it('is deterministic for identical inputs', () => {
    const identityA = buildRunIdentity(2, 'P-001', 'counterstrafe_reversal_v1', '2026-08-27T14:32:11.321Z');
    const identityB = buildRunIdentity(2, 'P-001', 'counterstrafe_reversal_v1', '2026-08-27T14:32:11.321Z');
    expect(buildRunId(identityA)).toBe(buildRunId(identityB));
  });

  it('differs when any identity component changes', () => {
    const base = buildRunId(buildRunIdentity(2, 'P-001', 'drillA', '2026-08-27T14:32:11.321Z'));
    const diffParticipant = buildRunId(buildRunIdentity(2, 'P-002', 'drillA', '2026-08-27T14:32:11.321Z'));
    const diffDrill = buildRunId(buildRunIdentity(2, 'P-001', 'drillB', '2026-08-27T14:32:11.321Z'));
    const diffStartedAt = buildRunId(buildRunIdentity(2, 'P-001', 'drillA', '2026-08-27T14:32:12.321Z'));
    expect(new Set([base, diffParticipant, diffDrill, diffStartedAt]).size).toBe(4);
  });

  it('produces a 64-char hex string', () => {
    const runId = buildRunId(buildRunIdentity(2, 'P-001', 'drillA', '2026-08-27T14:32:11.321Z'));
    expect(runId).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildRunFilename', () => {
  it('matches the README §2.3 example shape', () => {
    const runId = sha256Hex('example');
    const filename = buildRunFilename('2026-08-27T14:32:11.321Z', runId);
    expect(filename).toBe(`2026-08-27T14-32-11.321Z_assessment_${runId.slice(0, 12)}.json`);
  });

  it('is a single safe path component (no separators)', () => {
    const filename = buildRunFilename('2026-08-27T14:32:11.321Z', sha256Hex('example'));
    expect(filename.includes('/')).toBe(false);
    expect(filename.includes('\\')).toBe(false);
  });
});

describe('isLexicallyContained', () => {
  const root = 'C:/data/session-history';

  it('accepts a nested descendant', () => {
    expect(isLexicallyContained(root, `${root}/P-001--abc/drill--def/run.json`)).toBe(true);
  });

  it('rejects the root itself', () => {
    expect(isLexicallyContained(root, root)).toBe(false);
  });

  it('rejects a traversal outside the root', () => {
    expect(isLexicallyContained(root, `${root}/../outside/run.json`)).toBe(false);
  });

  it('rejects a sibling directory that merely shares a prefix', () => {
    expect(isLexicallyContained(root, 'C:/data/session-history-other/run.json')).toBe(false);
  });

  it('rejects an absolute path elsewhere entirely', () => {
    expect(isLexicallyContained(root, 'C:/Windows/System32/run.json')).toBe(false);
  });
});
