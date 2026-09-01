import { peekClickTransferV1, PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG } from '../drill/peek_click_transfer_v1.ts';

/**
 * WP-53 / T2 — formal target condition cell (GD-29 formal freeze, see peek_click_transfer_v1.ts).
 * Every frozen comparison field the WP-53 README's interface contract lists.
 */
export interface PeekClickTransferFormalConditionCell {
  readonly angularSizeDeg: number;
  readonly distanceU: number;
  readonly timeoutMs: number;
  readonly targetCount: number;
  readonly visibilitySampleCount: 9;
  readonly visibilityOnsetThreshold: 0.5;
}

/**
 * Single-source condition cell (GD-7 style): derived directly from the frozen `peekClickTransferV1`
 * config rather than a second hardcoded literal, so a config change forces a condition-cell (and
 * therefore compatibility-key) change alongside it, instead of silently drifting apart.
 */
export function buildPeekClickTransferV1ConditionCell(): string {
  const cell = peekClickTransferV1FormalConditionCell();
  return (
    `peek-click-transfer-v1:angularSize=${cell.angularSizeDeg}deg;distance=${cell.distanceU}u;` +
    `timeout=${cell.timeoutMs}ms;count=${cell.targetCount};` +
    `visSamples=${cell.visibilitySampleCount};visThreshold=${cell.visibilityOnsetThreshold}`
  );
}

function peekClickTransferV1FormalConditionCell(): PeekClickTransferFormalConditionCell {
  const { drill, visibility } = peekClickTransferV1;
  const hitbox = drill.targets.hitbox;
  if (hitbox === undefined) throw new Error('peek_click_transfer_v1 condition cell requires targets.hitbox');
  const timeoutMs = drill.timing.peekTimeoutMs;
  if (timeoutMs === undefined) {
    throw new Error('peek_click_transfer_v1 condition cell requires timing.peekTimeoutMs');
  }
  if (visibility.sampleCount !== 9 || visibility.onsetThreshold !== 0.5) {
    throw new Error('peek_click_transfer_v1 condition cell expects the frozen 9-sample/0.5 visibility contract');
  }

  return {
    angularSizeDeg: PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG,
    distanceU: drill.targets.distance,
    timeoutMs,
    targetCount: drill.targets.count,
    visibilitySampleCount: 9,
    visibilityOnsetThreshold: 0.5,
  };
}
