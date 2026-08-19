/**
 * Shared assessment event timeline contract (FR-F3).
 *
 * WP-33 freezes field shape only. The visibility calculation for
 * tFirstVisible/tMeasurementOnset/tFullExposure belongs to downstream drill
 * family work, starting with WP-34.
 */
export interface AssessmentTimelinePoint {
  readonly tFirstVisible?: number;
  readonly tMeasurementOnset?: number;
  readonly tFullExposure?: number;
  readonly tStop?: number;
}

/**
 * Per-tick visible fraction series. WP-34 will define the producer module after
 * the visibility spike settles the calculation strategy.
 */
export type VisibleFractionSeries = readonly number[];
