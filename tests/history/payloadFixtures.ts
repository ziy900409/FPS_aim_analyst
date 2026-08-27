import type { ExportPayload } from '../../src/data/export.ts';

/**
 * Pure `ExportPayload` fixture builder — zero `node:*` imports, so it is safe to import from both
 * the `tests/` tree (Node-typed) and `src/history/*.test.ts` (browser-typed, no `types: ["node"]`,
 * WP-48 T1 surprise re: `tsconfig.json`'s `include: ["src"]`). Split out of `testHelpers.ts` for T4
 * so `src/history/*.test.ts` can build fixtures without pulling `node:fs`/`node:os`/`node:path`
 * into the browser tsconfig program.
 */

export interface MakeAssessmentPayloadOptions {
  readonly participantId?: string;
  readonly drillId?: string;
  readonly startedAt?: string;
  readonly suspect?: boolean;
  readonly assessment?: boolean;
}

export function makeAssessmentPayload(options: MakeAssessmentPayloadOptions = {}): ExportPayload {
  const {
    participantId = 'P-001',
    drillId = 'counterstrafe_reversal_v1',
    startedAt = '2026-08-27T14:32:11.321Z',
    suspect = false,
    assessment = true,
  } = options;

  return {
    meta: {
      schemaVersion: 2,
      drillId,
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'chrome',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt,
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 60,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect,
      session: { participantId },
      ...(assessment ? { assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' as const } } : {}),
    },
    ticks: [],
    events: [],
  };
}
