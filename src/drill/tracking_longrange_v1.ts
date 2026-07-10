import type { DrillConfig } from './DrillConfig.ts';

const DEG_TO_RAD = Math.PI / 180;
const TARGET_ANGULAR_HEIGHT_DEG = 0.5;
const TARGET_ANGULAR_SPEED_DEG_PER_S = 5;
const TARGET_HEIGHT_U = 1;
const PRESENTATION_MS = 2000;

function distanceForAngularHeight(heightU: number, angularHeightDeg: number): number {
  return heightU / (2 * Math.tan((angularHeightDeg * DEG_TO_RAD) / 2));
}

function speedForAngularRate(distanceU: number, angularSpeedDegPerS: number): number {
  return distanceU * angularSpeedDegPerS * DEG_TO_RAD;
}

const DISTANCE_U = distanceForAngularHeight(TARGET_HEIGHT_U, TARGET_ANGULAR_HEIGHT_DEG);
const SPEED_U_PER_S = speedForAngularRate(DISTANCE_U, TARGET_ANGULAR_SPEED_DEG_PER_S);
const RANGE_U = (SPEED_U_PER_S * (PRESENTATION_MS / 1000)) / 4;

/**
 * WP-23 / T2 long-range small-target tracking drill.
 *
 * Angular design matrix from T0 OQ-S5-4, using H1 small target `{0.5,1,0.5}`:
 *
 * | Angular height | Angular speed | distanceU | speedU/s | 2s pingpong rangeU |
 * | --- | --- | ---: | ---: | ---: |
 * | 0.5 deg | 5 deg/s  | 114.5908 | 9.9999  | 5.0000  |
 * | 0.5 deg | 20 deg/s | 114.5908 | 39.9997 | 19.9999 |
 * | 2.0 deg | 5 deg/s  | 28.6450  | 2.4997  | 1.2499  |
 * | 2.0 deg | 20 deg/s | 28.6450  | 9.9990  | 4.9995  |
 *
 * The shipped v1 profile is the canonical floor condition, 0.5 deg x 5 deg/s. `range`
 * is derived so a 2000ms presentation traverses one full pingpong cycle
 * (0 -> +range -> -range -> 0), matching the timed-presentation semantics of
 * `tracking_v1`.
 *
 * Field-low v1 has backdrop props around z=-8, so a forward 114.59u sightline fails
 * clearance. Until WP-26 provides a front-facing BR field, this drill fixes spawnArea
 * to the clear right-rear long lane (`yaw=110 deg`) while preserving the radial
 * angular-size/velocity contract. This keeps T2 config-only and records the scene
 * limitation in the WP-23 progress log.
 */
export const trackingLongrangeV1 = {
  id: 'tracking_longrange_v1',
  sceneId: 'field-low',
  drill: {
    drillId: 'tracking_longrange_v1',
    targets: {
      count: 10,
      distance: DISTANCE_U,
      hitbox: { widthU: 0.5, heightU: TARGET_HEIGHT_U, depthU: 0.5 },
      spawnArea: { yawDegRange: [110, 110], distanceURange: [DISTANCE_U, DISTANCE_U] },
      motion: { type: 'pingpong', axis: 'horizontal', range: RANGE_U, speed: SPEED_U_PER_S },
    },
    sequence: {
      alternation: 'LR',
      seed: 23002,
    },
    timing: {
      countdownMs: 3000,
      presentationMs: PRESENTATION_MS,
      timeLimitMs: 120000,
    },
    endCondition: { type: 'targetCount', value: 10 },
  } satisfies DrillConfig,
} as const;
