export const TEST_FAMILY_IDS = ['hold-click', 'hold-track', 'spider-shot', 'counterstrafe'] as const;

export type TestFamilyId = (typeof TEST_FAMILY_IDS)[number];

/**
 * WP-45 T5 (FR-P45-8) — additive roster for the peek-click-transfer pilot session. Reuses two
 * existing frozen family ids plus the new pilot family; does not alter `TEST_FAMILY_IDS`'s
 * four-element order.
 */
export const TRANSFER_PILOT_FAMILY_IDS = ['hold-click', 'counterstrafe', 'peek-click-transfer'] as const;

export type TransferPilotFamilyId = (typeof TRANSFER_PILOT_FAMILY_IDS)[number];

export type SessionFamilyId = TestFamilyId | TransferPilotFamilyId;

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
