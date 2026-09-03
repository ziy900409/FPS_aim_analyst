import type { ExportPayload } from '../data/export.ts';
import { DEFAULT_TARGET_HITBOX } from '../drill/DrillConfig.ts';
import { SIM_TO_WORLD } from '../loop/constants.ts';
import { resolveEyeOrigin } from './eyeOrigin.ts';
import {
  deriveTrackingContactSamples,
  TRACKING_CONTACT_ANALYSIS_VERSION,
  type TrackingContactBlockedReason,
  type TrackingContactDerivationOptions,
  type TrackingContactSample,
} from './trackingContact.ts';

export const TRACKING_CONTACT_ARTIFACT_SCHEMA_VERSION = 'tracking-contact-artifact-v1' as const;

export type TrackingContactArtifactHitboxSource = 'meta.targets.hitbox' | 'options.hitbox' | 'default-h1';

export type TrackingContactArtifactEyeOriginSource = 'explicit' | 'meta' | 'legacy-default';

export interface TrackingContactArtifactOptions extends TrackingContactDerivationOptions {
  readonly sourceRunId?: string;
  readonly exportBasename?: string;
}

export interface TrackingContactArtifactHitbox {
  readonly source: TrackingContactArtifactHitboxSource;
  readonly widthU: number;
  readonly heightU: number;
  readonly depthU: number;
  readonly shape: 'box' | 'sphere';
}

export interface TrackingContactArtifactEyeOrigin {
  readonly source: TrackingContactArtifactEyeOriginSource;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly simToWorld: number;
}

export interface TrackingContactArtifactGeometry {
  readonly hitbox: TrackingContactArtifactHitbox | null;
  readonly eyeOrigin: TrackingContactArtifactEyeOrigin | null;
}

interface TrackingContactArtifactBase {
  readonly artifactSchemaVersion: typeof TRACKING_CONTACT_ARTIFACT_SCHEMA_VERSION;
  readonly analysisVersion: typeof TRACKING_CONTACT_ANALYSIS_VERSION;
  readonly generatedFrom: 'export-derived';
  readonly drillId: string;
  readonly schemaVersion: number | null;
  readonly simHz: number | null;
  readonly sourceId?: string;
  readonly sourceIdKind?: 'sourceRunId' | 'exportBasename';
  readonly sourceRunId?: string;
  readonly exportBasename?: string;
  readonly startedAt?: string;
  readonly geometry: TrackingContactArtifactGeometry;
  readonly sampleCount: number;
}

export type TrackingContactArtifact =
  | (TrackingContactArtifactBase & {
      readonly status: 'ok';
      readonly sourceId: string;
      readonly sourceIdKind: 'sourceRunId' | 'exportBasename';
      readonly schemaVersion: number;
      readonly simHz: number;
      readonly samples: readonly TrackingContactSample[];
    })
  | (TrackingContactArtifactBase & {
      readonly status: 'blocked';
      readonly reasons: readonly TrackingContactBlockedReason[];
    });

interface SourceIdentity {
  readonly kind: 'sourceRunId' | 'exportBasename';
  readonly value: string;
  readonly sourceRunId?: string;
  readonly exportBasename?: string;
}

const BLOCKED_REASON_ORDER: readonly TrackingContactBlockedReason[] = [
  'schema-version-unsupported',
  'missing-visible-event',
  'missing-target-telemetry',
  'missing-eye-origin',
  'invalid-hitbox',
  'no-tracking-drill',
  'protocol-incompatible',
];

export function buildTrackingContactArtifact(
  payload: ExportPayload,
  options: TrackingContactArtifactOptions = {},
): TrackingContactArtifact {
  const sourceIdentity = resolveSourceIdentity(payload, options);
  const startedAt = trimmedOrUndefined(payload.meta.startedAt);
  const schemaVersion = finiteOrNull(payload.meta.schemaVersion);
  const simHz = positiveFiniteOrNull(payload.meta.simHz);
  const geometry = {
    hitbox: resolveArtifactHitbox(payload, options),
    eyeOrigin: resolveArtifactEyeOrigin(payload, options),
  };

  const derivation = deriveTrackingContactSamples(payload, options);
  const reasons: TrackingContactBlockedReason[] = [];
  if (sourceIdentity === undefined) reasons.push('protocol-incompatible');
  if (schemaVersion === null) reasons.push('schema-version-unsupported');
  if (simHz === null) reasons.push('protocol-incompatible');
  if (derivation.status === 'blocked') reasons.push(...derivation.reasons);

  const base = {
    artifactSchemaVersion: TRACKING_CONTACT_ARTIFACT_SCHEMA_VERSION,
    analysisVersion: TRACKING_CONTACT_ANALYSIS_VERSION,
    generatedFrom: 'export-derived' as const,
    drillId: payload.meta.drillId,
    schemaVersion,
    simHz,
    ...(sourceIdentity !== undefined
      ? {
          sourceId: sourceIdentity.value,
          sourceIdKind: sourceIdentity.kind,
          ...(sourceIdentity.sourceRunId !== undefined ? { sourceRunId: sourceIdentity.sourceRunId } : {}),
          ...(sourceIdentity.exportBasename !== undefined ? { exportBasename: sourceIdentity.exportBasename } : {}),
        }
      : {}),
    ...(startedAt !== undefined ? { startedAt } : {}),
    geometry,
  };

  if (reasons.length === 0 && derivation.status === 'ok' && sourceIdentity !== undefined && schemaVersion !== null && simHz !== null) {
    return {
      ...base,
      status: 'ok',
      sourceId: sourceIdentity.value,
      sourceIdKind: sourceIdentity.kind,
      schemaVersion,
      simHz,
      sampleCount: derivation.samples.length,
      samples: derivation.samples,
    };
  }

  return {
    ...base,
    status: 'blocked',
    sampleCount: 0,
    reasons: orderedUniqueReasons(reasons),
  };
}

export function serializeTrackingContactArtifact(
  payload: ExportPayload,
  options: TrackingContactArtifactOptions = {},
): string {
  return `${JSON.stringify(buildTrackingContactArtifact(payload, options), null, 2)}\n`;
}

function resolveSourceIdentity(
  payload: ExportPayload,
  options: TrackingContactArtifactOptions,
): SourceIdentity | undefined {
  const exportBasename = trimmedOrUndefined(options.exportBasename);
  const explicit = trimmedOrUndefined(options.sourceRunId);
  if (explicit !== undefined) {
    return {
      kind: 'sourceRunId',
      value: explicit,
      sourceRunId: explicit,
      ...(exportBasename !== undefined ? { exportBasename } : {}),
    };
  }

  const drillId = trimmedOrUndefined(payload.meta.drillId);
  const startedAt = trimmedOrUndefined(payload.meta.startedAt);
  if (drillId !== undefined && startedAt !== undefined && !Number.isNaN(Date.parse(startedAt))) {
    const sourceRunId = `${drillId}@${startedAt}`;
    return {
      kind: 'sourceRunId',
      value: sourceRunId,
      sourceRunId,
      ...(exportBasename !== undefined ? { exportBasename } : {}),
    };
  }

  if (exportBasename !== undefined) return { kind: 'exportBasename', value: exportBasename, exportBasename };
  return undefined;
}

function resolveArtifactHitbox(
  payload: ExportPayload,
  options: TrackingContactArtifactOptions,
): TrackingContactArtifactHitbox | null {
  const metaHitbox = payload.meta.targets?.hitbox;
  if (metaHitbox !== undefined) {
    const shape = metaHitbox.shape ?? 'box';
    if (
      !positiveFinite(metaHitbox.widthU) ||
      !positiveFinite(metaHitbox.heightU) ||
      !positiveFinite(metaHitbox.depthU) ||
      (shape !== 'box' &&
        (shape !== 'sphere' || metaHitbox.widthU !== metaHitbox.heightU || metaHitbox.heightU !== metaHitbox.depthU))
    ) {
      return null;
    }
    return {
      source: 'meta.targets.hitbox',
      widthU: metaHitbox.widthU,
      heightU: metaHitbox.heightU,
      depthU: metaHitbox.depthU,
      shape,
    };
  }

  if (options.hitbox !== undefined) {
    if (!positiveFinite(options.hitbox.width) || !positiveFinite(options.hitbox.height) || !positiveFinite(options.hitbox.depth)) {
      return null;
    }
    return {
      source: 'options.hitbox',
      widthU: options.hitbox.width,
      heightU: options.hitbox.height,
      depthU: options.hitbox.depth,
      shape: 'box',
    };
  }

  return {
    source: 'default-h1',
    widthU: DEFAULT_TARGET_HITBOX.width,
    heightU: DEFAULT_TARGET_HITBOX.height,
    depthU: DEFAULT_TARGET_HITBOX.depth,
    shape: 'box',
  };
}

function resolveArtifactEyeOrigin(
  payload: ExportPayload,
  options: TrackingContactArtifactOptions,
): TrackingContactArtifactEyeOrigin | null {
  try {
    const eye = resolveEyeOrigin(payload, { strictEyeOrigin: true, ...options });
    return {
      source: eye.source,
      x: eye.base.x,
      y: eye.base.y,
      z: eye.base.z,
      simToWorld: eye.simToWorld,
    };
  } catch {
    if (options.strictEyeOrigin === false) {
      const simToWorld = positiveFiniteOrNull(options.simToWorld ?? SIM_TO_WORLD);
      const eyeHeight = finiteOrNull(options.eyeHeight ?? 1.6);
      if (simToWorld !== null && eyeHeight !== null) {
        return { source: 'legacy-default', x: 0, y: eyeHeight, z: 0, simToWorld };
      }
    }
    return null;
  }
}

function orderedUniqueReasons(reasons: readonly TrackingContactBlockedReason[]): TrackingContactBlockedReason[] {
  const present = new Set(reasons);
  return BLOCKED_REASON_ORDER.filter((reason) => present.has(reason));
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveFiniteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
