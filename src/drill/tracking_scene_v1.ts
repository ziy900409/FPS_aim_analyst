import type { DrillConfig } from './DrillConfig.ts';
import { trackingV1 } from './tracking_v1.ts';

export interface SceneDrillConfig {
  id: string;
  sceneId: string;
  drill: DrillConfig;
}

export const trackingSceneV1: SceneDrillConfig = {
  id: 'tracking_scene_v1',
  sceneId: 'field-low',
  drill: {
    ...trackingV1,
    drillId: 'tracking_scene_v1',
    targets: {
      ...trackingV1.targets,
      ...(trackingV1.targets.motion !== undefined
        ? { motion: { ...trackingV1.targets.motion, range: 0.25 } }
        : {}),
      ...(trackingV1.targets.spawnArea !== undefined ? { spawnArea: { ...trackingV1.targets.spawnArea } } : {}),
    },
    sequence: {
      ...trackingV1.sequence,
      ...(trackingV1.sequence.spawnDelayMsRange !== undefined
        ? { spawnDelayMsRange: [...trackingV1.sequence.spawnDelayMsRange] }
        : {}),
    },
    timing: { ...trackingV1.timing },
    endCondition: { ...trackingV1.endCondition },
  },
};
