import type { DrillConfig } from '../drill/DrillConfig.ts';
import type { AvailableDrill } from '../drill/drillRegistry.ts';
import {
  buildTrackingCorePrPilotV1Cell,
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import {
  trackingReversalPilotV1High,
  TRACKING_REVERSAL_PILOT_V1_CANDIDATES,
} from '../drill/tracking_reversal_pilot_v1.ts';
import { isWeaponId, type WeaponId } from '../weapon/weapons.ts';
import type { SessionFamilyId } from './sessionSchedule.ts';

/**
 * WP-64 T1 (FR-64.1/FR-64.9) — the one place that answers "which WP-54 tracking-pilot block may a
 * researcher put into a custom Session Plan". Family membership (`drillFamily.ts`), the fixed
 * weapon declaration and the runtime `availableDrills` entry (`main.ts`) are all *derived* from
 * this list, so the three registries cannot drift apart (FM-64.2/FM-64.3): there is no second
 * hand-written id allowlist anywhere.
 *
 * 正規術語:「可排程的研究用 drill」(research-schedulable drill). "Schedulable" means only that a
 * custom Session Plan may compile and load it. It says nothing about research status: every block
 * here stays `mode: 'practice'` and stays out of the exact-id history registry, exactly as it was
 * before it became reachable (FR-64.8, pinned by `trackingPilotHistoryExclusion.test.ts`).
 *
 * A Session Plan run of one of these is an **ad hoc stimulus test, not part of the
 * `tracking-pilot-v2` manifest**. This module therefore imports neither `trackingPilotManifest.ts`
 * nor `TrackingPilotRunner.ts` (FM-64.8): there is no counterbalance, no `sessionIndex`, no
 * alternate seed, no retry/abort log and no eligibility verdict on this path. Reps of the same item
 * replay the *same* primary seed — repeated exposure, never independent samples (OQ-64.4/FM-64.7).
 */
export interface ResearchSchedulableDrill {
  /**
   * The canonical WP-54 config **by reference** (or the exported builder's result). Never a spread
   * clone: cloning is how a "scheduling" change silently becomes a stimulus change (FR-64.2).
   */
  readonly config: DrillConfig;
  readonly family: SessionFamilyId;
  /**
   * Pinned, for the same reason `loadDrillConfigDirect()` pins it: the pilot blocks' clearance
   * envelope is validated against `field-low`, so inheriting whichever scene happened to be loaded
   * could reject a valid block mid-session (FR-64.5/FM-64.5).
   */
  readonly sceneId: 'field-low';
  /**
   * OQ-64.2 (closed 2026-09-10, README default): `'session-plan-only'`. These blocks are reachable
   * by `loadDrillById()` — a Session Plan must be able to load them — but are withheld from the
   * researcher Controls dropdown, so registering them here does not silently open a second entry
   * point with different operating semantics (FM-64.6).
   */
  readonly selectionSurface: 'session-plan-only' | 'session-plan-and-controls';
}

/**
 * Every WP-54 tracking-pilot block, selected or not. The curated list below is validated against
 * this census, so a curated entry can only ever be one of these nine existing configs — it can
 * never be a new drill wearing a pilot-shaped id (FR-64.2).
 */
export const ALL_TRACKING_PILOT_CONFIGS: readonly DrillConfig[] = [
  trackingCorePrPilotV1Practice,
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES,
];

/**
 * The fixed research factor for this family of blocks (FR-64.4). Written as a literal here because
 * it *is* the policy — an ad hoc Session Plan run of a pilot block fires the pilot's own
 * zero-recoil hold weapon, or it is not the same task — and the construction check below proves
 * every curated config actually declares it rather than trusting the comment.
 */
const REQUIRED_WEAPON_ID: WeaponId = 'tracking_pilot_hold';

/**
 * Only the `tracking` family has curated research drills today, and `drillFamily.ts` spreads the
 * ids straight into that one roster row. Enforcing it here means widening the registry to another
 * family fails at construction, instead of quietly producing entries no roster ever picks up.
 */
const REQUIRED_FAMILY: SessionFamilyId = 'tracking';

/**
 * OQ-64.1 (closed 2026-09-10, README default) — one core pseudorandom cell plus one reversal cell.
 * Both are taken from an exported builder / named constant, never by candidate-array index and
 * never by a hand-written drill id (README §1.5): the two configs must be *the* canonical ones.
 *
 * Why these two, recorded so the pair is not later read as an arbitrary pick:
 * - they exercise the two different trajectory generators (`band-limited-2d-v1` steady pursuit vs
 *   `reversal-2d-v1` reactive correction), the minimum informative "one core + one reversal" pair;
 * - the operator dry-run put both inside WP-54's frozen 5-80% TOT difficulty window (53.7% / 39.2%),
 *   unlike `3deg_5dps` at 86.2%, which WP-54's own docs flag as the likeliest Gate B `revise`.
 */
const CURATED_SOURCES: readonly DrillConfig[] = [
  buildTrackingCorePrPilotV1Cell(2, 5),
  trackingReversalPilotV1High,
];

/**
 * Exported so `trackingPilotSchedulableDrills.test.ts` can drive the pollution cases through it
 * directly. Every check fails at module construction rather than at drill activation: a block the
 * picker offered and the compiler accepted must not be able to fail once the scene has already
 * swapped and the operator is mid-session (FM-64.2).
 */
export function buildCuratedRegistry(
  sources: readonly DrillConfig[],
  census: readonly DrillConfig[] = ALL_TRACKING_PILOT_CONFIGS,
): readonly ResearchSchedulableDrill[] {
  // 1-2 entries, by design (NFR-64.2). The failure this bounds is expanding the picker to the whole
  // pilot manifest — practice and both calibration blocks included — which is a different work
  // package with different research semantics (FM-64.4).
  if (sources.length < 1 || sources.length > 2) {
    throw new Error(`Curated tracking-pilot registry must hold 1-2 drills, got ${sources.length}`);
  }
  const censusIds = new Set(census.map((config) => config.drillId));
  const seen = new Set<string>();
  const entries: ResearchSchedulableDrill[] = [];
  for (const config of sources) {
    const { drillId } = config;
    if (seen.has(drillId)) throw new Error(`Curated tracking-pilot registry lists ${drillId} twice`);
    seen.add(drillId);
    if (!censusIds.has(drillId)) {
      throw new Error(`${drillId} is not a WP-54 tracking-pilot block, so it cannot be curated here`);
    }
    // `mode` is what keeps an ad hoc run out of Assessment and out of trend cohorts (FR-64.8).
    // Scheduling reach must never be able to promote a block.
    if (config.mode !== 'practice') {
      throw new Error(`Curated tracking-pilot drill ${drillId} must stay mode:'practice', got ${String(config.mode)}`);
    }
    if (config.weaponId !== REQUIRED_WEAPON_ID || !isWeaponId(config.weaponId)) {
      throw new Error(
        `Curated tracking-pilot drill ${drillId} must declare ${REQUIRED_WEAPON_ID}, got ${String(config.weaponId)}`,
      );
    }
    entries.push({ config, family: REQUIRED_FAMILY, sceneId: 'field-low', selectionSurface: 'session-plan-only' });
  }
  return entries;
}

/** The curated registry itself — the single source `drillFamily.ts` and `main.ts` both derive from. */
export const TRACKING_PILOT_SCHEDULABLE_DRILLS: readonly ResearchSchedulableDrill[] =
  buildCuratedRegistry(CURATED_SOURCES);

/**
 * The curated drill ids, in registry order. `drillFamily.ts` spreads this into the `tracking`
 * family roster; nothing else may restate it.
 */
export const TRACKING_PILOT_SCHEDULABLE_DRILL_IDS: readonly string[] =
  TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => entry.config.drillId);

/**
 * WP-64 T2 (FR-64.5/FR-64.9) — the curated blocks as runtime roster entries, spread into
 * `main.ts`'s `availableDrills` so "compilable" and "loadable" are the same list (FM-64.2).
 *
 * Built here rather than inline in `main.ts` for one reason: `main.ts` cannot be executed by a test,
 * and three of the claims this projection makes are behavioural, not textual — the entry's `source`
 * is the canonical config *by reference* (no clone, FR-64.2), the scene is the descriptor's pinned
 * `field-low` (FM-64.5), and `showInResearcherControls` is `false` for a `'session-plan-only'`
 * surface (OQ-64.2/FM-64.6). `trackingPilotSchedulableDrills.test.ts` asserts all three against
 * these objects; `main.ts` only spreads them.
 *
 * Neither `loadOptions` nor `resolveSource` is set: a curated block takes the identical activation
 * path as every other module-constant roster entry, so WP-62's pinned weapon precedence ordering
 * inside `activateDrill()` applies to it unchanged (T2 step 9).
 */
export const TRACKING_PILOT_RUNTIME_DRILLS: readonly AvailableDrill[] =
  TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => ({
    id: entry.config.drillId,
    label: entry.config.drillId,
    source: entry.config,
    sceneId: entry.sceneId,
    showInResearcherControls: entry.selectionSurface === 'session-plan-and-controls',
  }));
