export const TEST_FAMILY_IDS = ['hold-click', 'hold-track', 'spider-shot', 'counterstrafe'] as const;

export type TestFamilyId = (typeof TEST_FAMILY_IDS)[number];

function participantOffset(participantId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < participantId.length; index += 1) {
    hash ^= participantId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % TEST_FAMILY_IDS.length;
}

/**
 * Builds a deterministic, position-balanced order for the four assessment families.
 * `sessionIndex` is a non-negative integer and repeats every four sessions.
 */
export function buildFamilyOrder(participantId: string, sessionIndex: number): readonly TestFamilyId[] {
  const rotation = (participantOffset(participantId) + sessionIndex) % TEST_FAMILY_IDS.length;
  return TEST_FAMILY_IDS.map((_, position) => TEST_FAMILY_IDS[(rotation + position) % TEST_FAMILY_IDS.length]);
}
