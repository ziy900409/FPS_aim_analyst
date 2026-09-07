import { PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION, peekClickTransferV1 } from './peek_click_transfer_v1.ts';
import { STAGE6_PROTOCOL_VERSION } from './protocolVersion.ts';
import { SPIDER_SHOT_V3_PROTOCOL_VERSION, spiderShotV3 } from './spider_shot_v3.ts';

const ASSESSMENT_PROTOCOL_VERSION_BY_DRILL_ID = new Map<string, string>([
  [peekClickTransferV1.id, PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION],
  [spiderShotV3.drillId, SPIDER_SHOT_V3_PROTOCOL_VERSION],
]);

/** Single source for the protocol generation persisted in assessment export metadata. */
export function assessmentProtocolVersionForDrill(drillId: string): string {
  return ASSESSMENT_PROTOCOL_VERSION_BY_DRILL_ID.get(drillId) ?? STAGE6_PROTOCOL_VERSION;
}
