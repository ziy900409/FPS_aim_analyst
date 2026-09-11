import type { DrillLoadOptions } from './DrillLoader.ts';

/**
 * WP-64 T2 (OQ-64.5) — the runtime drill registry's *shape and two projections*, lifted out of
 * `main.ts` so they can be executed by a test instead of only scanned as source.
 *
 * `main.ts` is a WebGPU + DOM top-level-await script Vitest cannot import, so before this module
 * existed the only evidence that a curated Session Plan drill was actually loadable was a substring
 * scan of the roster literal (T1 §7). The scan proves the roster is *derived* from the curated
 * registry; it cannot prove that `loadDrillById()` resolves the ids, nor that the Controls dropdown
 * withholds them. Those two claims are the whole point of the surface split (FM-64.2 / FM-64.6), so
 * the lookup and the projection live here — pure functions over a registry passed in — and `main.ts`
 * calls exactly these, with `availableDrills` as the argument.
 *
 * This is deliberately *not* a second runtime: the roster literal itself stays in `main.ts` next to
 * the drill-module imports it is built from (README §3.1 records when that should change).
 */
export interface AvailableDrill {
  id: string;
  label: string;
  /** Module-load-time config source. Exactly one of `source` / `resolveSource` per entry. */
  source?: unknown;
  /**
   * WP-57 / T6 (FR-57.3) — arm-time source factory. `spider-shot-wide-v1`'s peripheral yaw window
   * is a function of the display state (vertical FOV x camera aspect), so unlike every other roster
   * entry its config cannot be a module-load constant: resolving at import time would freeze the
   * aspect at the wrong moment and quietly bypass the whole NFR-57.5 argument (D-57.T3-3).
   * Called exactly once per arm — never per tick, never from the render callback.
   */
  resolveSource?: () => unknown;
  sceneId?: string;
  loadOptions?: DrillLoadOptions;
  /**
   * WP-64 T1 (OQ-64.2) — whether this entry is also offered in the researcher Controls drill
   * dropdown. **Absent means `true`**, so every pre-WP-64 entry keeps its exposure bit-for-bit.
   *
   * This separates the two jobs the roster has been doing at once: it is the runtime registry
   * `loadDrillById()` searches (always complete — an entry hidden here is still loadable), and it is
   * the source the Controls dropdown projects from (filtered). Without the split, making a drill
   * schedulable would silently open a second operator entry point with different semantics
   * (FM-64.6). See README §3.1 for when this optional field should become a real registry split.
   */
  showInResearcherControls?: boolean;
}

/** What the Controls dropdown consumes — `DrillControlOption` from the UI side, structurally. */
export interface DrillControlsOption {
  readonly id: string;
  readonly label: string;
}

/**
 * The one place the two source flavours converge. Arm-time resolution runs here rather than inside
 * `activateDrill` so a typed resolver failure (FR-57.14) throws before any activation state is
 * touched, and surfaces through the researcher controls' existing failure path (`runControl`
 * alert + console.error) instead of crashing or silently falling back to another drill.
 */
export function drillSourceFor(option: AvailableDrill): unknown {
  return option.resolveSource !== undefined ? option.resolveSource() : option.source;
}

/**
 * Runtime loadability: searches the **whole** registry, visibility bit included or not. A hidden
 * entry is still an entry — that is precisely what "Session Plan-only" means (OQ-64.2).
 *
 * Throws rather than returning `undefined` so an id the compiler accepted but the roster never
 * registered fails loudly, before `activateDrill()` touches the scene or the runner (FM-64.2). The
 * message is the pre-WP-64 `Unknown drill: <id>` verbatim: the E2E and the operator manual both
 * read it.
 */
export function resolveAvailableDrill(
  registry: readonly AvailableDrill[],
  drillId: string,
): AvailableDrill {
  const option = registry.find((candidate) => candidate.id === drillId);
  if (option === undefined) throw new Error(`Unknown drill: ${drillId}`);
  return option;
}

/**
 * UI exposure: the researcher Controls dropdown is a *projection* of the runtime registry, never the
 * registry itself. `showInResearcherControls === false` is the only thing that withholds an entry,
 * so an absent field keeps a pre-WP-64 entry exactly as visible as it was.
 */
export function researcherControlsDrills(
  registry: readonly AvailableDrill[],
): DrillControlsOption[] {
  return registry
    .filter(({ showInResearcherControls }) => showInResearcherControls !== false)
    .map(({ id, label }) => ({ id, label }));
}
