import { EXPERIMENT_MAX_CONDITION } from './constants.ts';
import { validateProtocol, type ProtocolConfig } from './ProtocolRunner.ts';

export const RESOLUTION_DETECTION_PROTOCOL_ID = 'resolution_detection_v1';

export const resolutionDetectionProtocol: ProtocolConfig = validateProtocol({
  protocolId: RESOLUTION_DETECTION_PROTOCOL_ID,
  requiredDisplay: EXPERIMENT_MAX_CONDITION,
  conditions: [
    {
      label: 'fhd-1080-field-low-detection',
      mode: 'fhd-1080',
      sceneId: 'field-low',
      drillId: 'detection_popin_v1',
    },
    {
      label: 'qhd-1440-field-low-detection',
      mode: 'qhd-1440',
      sceneId: 'field-low',
      drillId: 'detection_popin_v1',
    },
  ],
});
