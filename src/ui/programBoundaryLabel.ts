import type { ProgramBoundary } from '../session/sessionProgram.ts';

/**
 * WP-58 T4 — the operator-facing name of each rest boundary, in exactly one place.
 *
 * Two surfaces show this vocabulary to the same operator during the same session: the pre-flight
 * preview table (FR-58.13) and the rest overlay that appears while the rest actually runs
 * (OQ-58.3). If the two drifted, the preview would be lying about what the operator is about to
 * see — and the whole point of the preview is to make R-58.8 visible *before* the session starts
 * ("these two adjacent counterstrafe drills only get 30 s, not 60 s").
 *
 * The labels are UI copy, so they deliberately do not live in `sessionProgram.ts`: that module is
 * the pure compiler and stays free of presentation concerns (NFR-58.1).
 */
export const PROGRAM_BOUNDARY_LABEL: Readonly<Record<ProgramBoundary, string>> = {
  rep: '同一 drill 下一輪',
  drill: '同家族換 drill',
  family: '換家族',
};

/** `'family（換家族）'` — the boundary token plus its plain-language gloss, used by both surfaces. */
export function describeBoundary(boundary: ProgramBoundary): string {
  return `${boundary}（${PROGRAM_BOUNDARY_LABEL[boundary]}）`;
}
