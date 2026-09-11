import { describe, expect, it } from 'vitest';
import {
  drillSourceFor,
  researcherControlsDrills,
  resolveAvailableDrill,
  type AvailableDrill,
} from './drillRegistry.ts';

/**
 * WP-64 T2 (OQ-64.5) — the `AvailableDrill` seam T0 §2 found to have *zero* coverage.
 *
 * These are the two projections `main.ts` runs over `availableDrills`: the lookup behind
 * `loadDrillById()` and the filter behind the researcher Controls dropdown. They are tested here on
 * synthetic entries, which is the point — the rules below must hold for any registry, so that the
 * WP-64 suite can then assert the *curated* entries and get loadability and exposure as
 * consequences rather than as two more restatements.
 */

const PLAIN: AvailableDrill = { id: 'plain_v1', label: 'plain_v1', source: { drillId: 'plain_v1' } };
const SCENE_PINNED: AvailableDrill = {
  id: 'pinned_v1',
  label: 'pinned_v1',
  source: { drillId: 'pinned_v1' },
  sceneId: 'field-low',
};
const HIDDEN: AvailableDrill = {
  id: 'hidden_v1',
  label: 'hidden_v1',
  source: { drillId: 'hidden_v1' },
  showInResearcherControls: false,
};
const SHOWN: AvailableDrill = {
  id: 'shown_v1',
  label: 'shown_v1',
  source: { drillId: 'shown_v1' },
  showInResearcherControls: true,
};
const REGISTRY: readonly AvailableDrill[] = [PLAIN, SCENE_PINNED, HIDDEN, SHOWN];

describe('resolveAvailableDrill — runtime loadability (FR-64.5/FM-64.2)', () => {
  it('returns the registry entry itself, so activation reads the declared scene and options', () => {
    // Identity, not a copy: `loadDrillById()` hands `option.sceneId` / `option.loadOptions` straight
    // to `activateDrill()`, so a lookup that rebuilt the entry could silently drop either.
    expect(resolveAvailableDrill(REGISTRY, 'pinned_v1')).toBe(SCENE_PINNED);
    expect(resolveAvailableDrill(REGISTRY, 'pinned_v1').sceneId).toBe('field-low');
  });

  it('resolves an entry that the Controls dropdown withholds', () => {
    // The whole surface split (OQ-64.2): hidden from the dropdown, still loadable by id. If this
    // ever became a filtered search, every Session Plan step naming a curated block would die on
    // `Unknown drill` after the scene had already swapped.
    expect(resolveAvailableDrill(REGISTRY, 'hidden_v1')).toBe(HIDDEN);
  });

  it('throws the loud pre-WP-64 message for an id the roster never registered', () => {
    expect(() => resolveAvailableDrill(REGISTRY, 'never_registered_v1')).toThrow(
      'Unknown drill: never_registered_v1',
    );
    // Prototype keys are not registry entries — `find` over an array cannot be fooled the way a
    // plain-object lookup can, and this pins that choice.
    expect(() => resolveAvailableDrill(REGISTRY, 'toString')).toThrow(/Unknown drill/);
  });

  it('fails fast rather than returning undefined for the caller to ignore', () => {
    // `activateDrill()` begins a scene generation and resets the weapon override; a silent
    // `undefined` would reach it as `source: undefined` and fail much later, mid-transaction.
    expect(() => resolveAvailableDrill([], 'plain_v1')).toThrow(/Unknown drill/);
  });
});

describe('researcherControlsDrills — UI exposure (OQ-64.2/FM-64.6)', () => {
  it('offers every entry that does not opt out, in registry order', () => {
    expect(researcherControlsDrills(REGISTRY)).toEqual([
      { id: 'plain_v1', label: 'plain_v1' },
      { id: 'pinned_v1', label: 'pinned_v1' },
      { id: 'shown_v1', label: 'shown_v1' },
    ]);
  });

  it('treats an absent flag as visible, so pre-WP-64 entries are unchanged bit-for-bit', () => {
    // The compatibility claim the optional field rests on (NFR-64.4): a roster with no flags at all
    // projects to exactly itself.
    const legacy = [PLAIN, SCENE_PINNED];
    expect(researcherControlsDrills(legacy)).toEqual(legacy.map(({ id, label }) => ({ id, label })));
    expect(researcherControlsDrills(legacy)).toHaveLength(legacy.length);
  });

  it('withholds only `false`, and carries no other field into the dropdown', () => {
    const projected = researcherControlsDrills(REGISTRY);
    expect(projected.map(({ id }) => id)).not.toContain('hidden_v1');
    // `source` / `sceneId` / `loadOptions` must not leak into the UI option objects: the dropdown's
    // contract is `{ id, label }`, and widening it is how a UI starts owning runtime state.
    for (const option of projected) expect(Object.keys(option).sort()).toEqual(['id', 'label']);
  });
});

describe('drillSourceFor — the two source flavours (FR-57.3)', () => {
  it('returns the module-load config by reference', () => {
    expect(drillSourceFor(PLAIN)).toBe(PLAIN.source);
  });

  it('invokes an arm-time resolver instead, once per call', () => {
    let calls = 0;
    const resolved = { drillId: 'lazy_v1' };
    const lazy: AvailableDrill = {
      id: 'lazy_v1',
      label: 'lazy_v1',
      resolveSource: () => {
        calls += 1;
        return resolved;
      },
    };
    expect(drillSourceFor(lazy)).toBe(resolved);
    expect(calls).toBe(1);
  });
});
