import { describe, expect, it } from 'vitest';
import { PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION, peekClickTransferV1 } from './peek_click_transfer_v1.ts';
import { STAGE6_PROTOCOL_VERSION } from './protocolVersion.ts';
import { SPIDER_SHOT_V3_PROTOCOL_VERSION, spiderShotV3 } from './spider_shot_v3.ts';
import { assessmentProtocolVersionForDrill } from './assessmentProtocolVersion.ts';

describe('assessmentProtocolVersionForDrill', () => {
  it('writes a distinct immutable generation for spider-shot-v3', () => {
    expect(assessmentProtocolVersionForDrill(spiderShotV3.drillId)).toBe(
      SPIDER_SHOT_V3_PROTOCOL_VERSION,
    );
  });

  it('preserves existing drill-specific and stage6 protocol generations', () => {
    expect(assessmentProtocolVersionForDrill(peekClickTransferV1.id)).toBe(
      PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION,
    );
    expect(assessmentProtocolVersionForDrill('spider-shot-v2')).toBe(STAGE6_PROTOCOL_VERSION);
  });
});
