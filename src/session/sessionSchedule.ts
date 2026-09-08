export const TEST_FAMILY_IDS = ['hold-click', 'hold-track', 'spider-shot', 'counterstrafe'] as const;

export type TestFamilyId = (typeof TEST_FAMILY_IDS)[number];

/**
 * WP-45 T5 (FR-P45-8) — additive roster for the peek-click-transfer pilot session. Reuses two
 * existing frozen family ids plus the new pilot family; does not alter `TEST_FAMILY_IDS`'s
 * four-element order.
 */
export const TRANSFER_PILOT_FAMILY_IDS = ['hold-click', 'counterstrafe', 'peek-click-transfer'] as const;

export type TransferPilotFamilyId = (typeof TRANSFER_PILOT_FAMILY_IDS)[number];

/**
 * WP-53 T4 (GD-29 formal freeze) — additive roster for the formal `peek_click_transfer_v1`
 * Assessment. A distinct family id from the pilot's `'peek-click-transfer'` (§TRANSFER_PILOT_FAMILY_IDS)
 * — the two must never resolve to the same drill (FR-53-6/D-53.1) — and does not alter
 * `TEST_FAMILY_IDS`'s four-element order.
 */
export const TRANSFER_FORMAL_FAMILY_IDS = ['peek-click-transfer-v1'] as const;

export type TransferFormalFamilyId = (typeof TRANSFER_FORMAL_FAMILY_IDS)[number];

/**
 * WP-58 T1 (FR-58.2) — additive family ids for the drill construct groups that had no family of
 * their own before the session program scheduler. Purely additive: `TEST_FAMILY_IDS`'s four-element
 * content and order (and therefore every `buildFamilyOrder()` rotation) are untouched.
 *
 * `spider-shot-wide` is deliberately its own family rather than a member of `spider-shot`
 * (D-58-T0-1): the wide-flick drill is a *sibling construct* (~40-70 deg eye-frame displacement vs
 * ~10-25 deg), so a program that runs the two back to back must cross a family boundary and take
 * the family rest, not the shorter drill rest.
 *
 * Membership in this roster grants scheduling reach only. It does NOT grant Assessment eligibility:
 * that is decided by two gates orthogonal to family — `DrillConfig.mode === 'assessment'` (which
 * governs whether `meta.assessment` is written at all) and `DrillMetricRegistry`'s exact-id
 * registrations (no prefix/family fallback). See FR-58.3 / GD-35 and `drillFamily.test.ts`.
 */
export const SCHEDULABLE_FAMILY_IDS = ['tracking', 'detection', 'micro-flick', 'spider-shot-wide'] as const;

export type SchedulableFamilyId = (typeof SCHEDULABLE_FAMILY_IDS)[number];

export type SessionFamilyId =
  | TestFamilyId
  | TransferPilotFamilyId
  | TransferFormalFamilyId
  | SchedulableFamilyId;

/**
 * KI-016 — single-source allowlist of every family id a session plan may draw from (the frozen
 * four-family assessment roster, the additive pilot and formal transfer rosters, and WP-58's
 * schedulable construct groups). `SessionRunner.ts` and `src/data/metadata.ts`'s
 * `requireSessionPlanFamilyOrder` both validate against this constant so the allowlists cannot drift
 * apart again — WP-58 keeps that rule: `drillFamily.ts` maps drills onto these ids rather than
 * restating them.
 */
export const KNOWN_SESSION_FAMILY_IDS: ReadonlySet<SessionFamilyId> = new Set([
  ...TEST_FAMILY_IDS,
  ...TRANSFER_PILOT_FAMILY_IDS,
  ...TRANSFER_FORMAL_FAMILY_IDS,
  ...SCHEDULABLE_FAMILY_IDS,
]);

function participantOffset(participantId: string, rosterLength: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < participantId.length; index += 1) {
    hash ^= participantId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % rosterLength;
}

/**
 * Builds a deterministic, position-balanced order for an arbitrary roster of family ids.
 * `sessionIndex` is a non-negative integer and repeats every `roster.length` sessions.
 * `buildFamilyOrder()` below is the frozen four-family specialization; its output is unchanged by
 * this generalization because it delegates here with the same participant-hash/modulo arithmetic.
 */
export function buildFamilyOrderForRoster<T extends string>(
  participantId: string,
  sessionIndex: number,
  roster: readonly T[],
): readonly T[] {
  if (roster.length === 0) throw new Error('roster must include at least one family');
  const seen = new Set<T>();
  for (const id of roster) {
    if (seen.has(id)) throw new Error('roster must not contain duplicate family ids');
    seen.add(id);
  }
  if (!Number.isInteger(sessionIndex) || sessionIndex < 0) {
    throw new Error('sessionIndex must be a non-negative integer');
  }
  const rotation = (participantOffset(participantId, roster.length) + sessionIndex) % roster.length;
  return roster.map((_, position) => roster[(rotation + position) % roster.length]);
}

/**
 * Builds a deterministic, position-balanced order for the four assessment families.
 * `sessionIndex` is a non-negative integer and repeats every four sessions.
 */
export function buildFamilyOrder(participantId: string, sessionIndex: number): readonly TestFamilyId[] {
  return buildFamilyOrderForRoster(participantId, sessionIndex, TEST_FAMILY_IDS);
}
