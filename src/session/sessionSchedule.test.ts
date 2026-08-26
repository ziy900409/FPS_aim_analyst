import { describe, expect, it } from 'vitest';
import { buildFamilyOrder, buildFamilyOrderForRoster, TEST_FAMILY_IDS, TRANSFER_PILOT_FAMILY_IDS } from './sessionSchedule.ts';

describe('buildFamilyOrder', () => {
  it('returns the same order for the same participant and session', () => {
    expect(buildFamilyOrder('participant-1', 2)).toEqual(buildFamilyOrder('participant-1', 2));
  });

  it('uses four distinct rotations that position-balance every family', () => {
    const orders = [0, 1, 2, 3].map((sessionIndex) => buildFamilyOrder('participant-1', sessionIndex));

    expect(new Set(orders.map((order) => order.join(','))).size).toBe(4);
    for (let position = 0; position < TEST_FAMILY_IDS.length; position += 1) {
      expect(new Set(orders.map((order) => order[position]))).toEqual(new Set(TEST_FAMILY_IDS));
    }
  });

  it('repeats the rotation every four sessions', () => {
    for (let sessionIndex = 0; sessionIndex < 4; sessionIndex += 1) {
      expect(buildFamilyOrder('participant-1', sessionIndex + 4)).toEqual(
        buildFamilyOrder('participant-1', sessionIndex),
      );
    }
  });

  it('uses different start positions for distinct participant fixtures', () => {
    expect(buildFamilyOrder('participant-1', 0)).not.toEqual(buildFamilyOrder('participant-2', 0));
  });

  it('always returns a complete permutation of the test families', () => {
    for (const participantId of ['participant-1', 'participant-2', 'another-participant']) {
      const order = buildFamilyOrder(participantId, 100);
      expect(order).toHaveLength(TEST_FAMILY_IDS.length);
      expect(new Set(order)).toEqual(new Set(TEST_FAMILY_IDS));
    }
  });
});

describe('buildFamilyOrderForRoster', () => {
  it('is the general form buildFamilyOrder specializes to — same output for the frozen four-family roster', () => {
    for (let sessionIndex = 0; sessionIndex < 4; sessionIndex += 1) {
      expect(buildFamilyOrderForRoster('participant-1', sessionIndex, TEST_FAMILY_IDS)).toEqual(
        buildFamilyOrder('participant-1', sessionIndex),
      );
    }
  });

  it('position-balances the transfer-pilot roster across three consecutive sessions', () => {
    const orders = [0, 1, 2].map((sessionIndex) =>
      buildFamilyOrderForRoster('participant-1', sessionIndex, TRANSFER_PILOT_FAMILY_IDS),
    );

    expect(new Set(orders.map((order) => order.join(','))).size).toBe(3);
    for (let position = 0; position < TRANSFER_PILOT_FAMILY_IDS.length; position += 1) {
      expect(new Set(orders.map((order) => order[position]))).toEqual(new Set(TRANSFER_PILOT_FAMILY_IDS));
    }
  });

  it('is deterministic for the same participant/session and reproducible with a different offset per participant', () => {
    expect(buildFamilyOrderForRoster('participant-1', 1, TRANSFER_PILOT_FAMILY_IDS)).toEqual(
      buildFamilyOrderForRoster('participant-1', 1, TRANSFER_PILOT_FAMILY_IDS),
    );
    expect(buildFamilyOrderForRoster('participant-1', 0, TRANSFER_PILOT_FAMILY_IDS)).not.toEqual(
      buildFamilyOrderForRoster('participant-3', 0, TRANSFER_PILOT_FAMILY_IDS),
    );
  });

  it.each([
    { roster: [] as readonly string[], sessionIndex: 0, message: 'roster must include at least one family' },
    {
      roster: ['a', 'a'] as readonly string[],
      sessionIndex: 0,
      message: 'roster must not contain duplicate family ids',
    },
    {
      roster: ['a', 'b'] as readonly string[],
      sessionIndex: -1,
      message: 'sessionIndex must be a non-negative integer',
    },
    {
      roster: ['a', 'b'] as readonly string[],
      sessionIndex: 1.5,
      message: 'sessionIndex must be a non-negative integer',
    },
  ])('rejects invalid input: $message', ({ roster, sessionIndex, message }) => {
    expect(() => buildFamilyOrderForRoster('participant-1', sessionIndex, roster)).toThrow(message);
  });
});
