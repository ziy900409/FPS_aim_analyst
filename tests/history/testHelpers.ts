import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ExportPayload } from '../../src/data/export.ts';

/**
 * Shared WP-48 T2 test scaffolding: a minimal-but-valid Assessment `ExportPayload` builder and a
 * disposable temp-root helper. Every filesystem test must use `makeTempRoot()` (never the real
 * `data/session-history/`), per README §6 / NFR-48.6.
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

export async function makeTempRoot(prefix = 'fps-history-test-'): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempRoot(root: string): Promise<void> {
  await fs.rm(root, { recursive: true, force: true });
}
