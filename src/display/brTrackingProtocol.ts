import { EXPERIMENT_MAX_CONDITION } from './constants.ts';
import { validateProtocol, type ProtocolConfig } from './ProtocolRunner.ts';
import { trackingBrVariants } from '../drill/tracking_br_v1.ts';

export const BR_TRACKING_PROTOCOL_ID = 'br_tracking_v1';

export const brTrackingProtocol: ProtocolConfig = validateProtocol({
  protocolId: BR_TRACKING_PROTOCOL_ID,
  requiredDisplay: EXPERIMENT_MAX_CONDITION,
  conditions: trackingBrVariants.map((variant) => ({
    label: `br-${variant.axes.ads}-${variant.axes.ballistic}-${variant.axes.angularHeight}`,
    mode: 'native',
    sceneId: variant.sceneId,
    drillId: variant.id,
  })),
});
