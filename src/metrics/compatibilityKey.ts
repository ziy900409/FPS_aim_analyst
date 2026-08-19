import type { Meta } from '../data/metadata.ts';

export interface CompatibilityKey {
  readonly participantId: string;
  readonly taskId: string;
  readonly protocolVersion: string;
  readonly gameMovementProfile: string;
  readonly weaponId: string;
  readonly weaponMode: string;
  readonly sensitivityFovKey: string;
  readonly targetConditionCell: string;
  readonly assessmentFeedbackPolicy: string;
  readonly qualityGateStatus: string;
}

export type QualityGateStatus = 'ok' | 'insufficient-n' | 'incompatible-protocol' | 'suspect-run';

export function deriveSessionId(meta: Meta): string {
  const participantId = requireTrimmedNonEmptyString(meta.session?.participantId, 'meta.session.participantId');
  const startedAt = requireTrimmedNonEmptyString(meta.startedAt, 'meta.startedAt');
  return `${participantId}:${startedAt}`;
}

export function buildCompatibilityKey(
  meta: Meta,
  taskId: string,
  targetConditionCell: string,
  qualityGateStatus: QualityGateStatus,
): CompatibilityKey {
  const participantId = requireTrimmedNonEmptyString(meta.session?.participantId, 'meta.session.participantId');
  const assessment = meta.assessment;
  if (assessment === undefined) throw new Error('meta.assessment is required for compatibility keys');

  const weaponId = requireTrimmedNonEmptyString(meta.weaponId, 'meta.weaponId');

  return {
    participantId,
    taskId: requireTrimmedNonEmptyString(taskId, 'taskId'),
    protocolVersion: requireTrimmedNonEmptyString(assessment.protocolVersion, 'meta.assessment.protocolVersion'),
    gameMovementProfile: requireTrimmedNonEmptyString(meta.movementModel, 'meta.movementModel'),
    weaponId,
    // TODO(WP-33/OQ-S6-10): split this when Assessment adds an independent weapon-mode field.
    weaponMode: weaponId,
    sensitivityFovKey: buildSensitivityFovKey(meta),
    targetConditionCell: requireTrimmedNonEmptyString(targetConditionCell, 'targetConditionCell'),
    assessmentFeedbackPolicy: requireTrimmedNonEmptyString(
      assessment.assessmentFeedbackPolicy,
      'meta.assessment.assessmentFeedbackPolicy',
    ),
    qualityGateStatus: requireQualityGateStatus(qualityGateStatus),
  };
}

export function checkCompatibility(a: CompatibilityKey, b: CompatibilityKey): boolean {
  return (
    a.participantId === b.participantId &&
    a.taskId === b.taskId &&
    a.protocolVersion === b.protocolVersion &&
    a.gameMovementProfile === b.gameMovementProfile &&
    a.weaponId === b.weaponId &&
    a.weaponMode === b.weaponMode &&
    a.sensitivityFovKey === b.sensitivityFovKey &&
    a.targetConditionCell === b.targetConditionCell &&
    a.assessmentFeedbackPolicy === b.assessmentFeedbackPolicy &&
    a.qualityGateStatus === b.qualityGateStatus
  );
}

export function checkQualityGate(args: {
  n: number;
  minN: number;
  suspect: boolean;
  compatible: boolean;
}): QualityGateStatus {
  const n = requireNonNegativeInteger(args.n, 'n');
  const minN = requireNonNegativeInteger(args.minN, 'minN');
  const suspect = requireBoolean(args.suspect, 'suspect');
  const compatible = requireBoolean(args.compatible, 'compatible');

  if (n < minN) return 'insufficient-n';
  if (!compatible) return 'incompatible-protocol';
  if (suspect) return 'suspect-run';
  return 'ok';
}

function buildSensitivityFovKey(meta: Meta): string {
  const sensitivity = requirePositiveFiniteNumber(meta.sensitivity, 'meta.sensitivity');
  const fovDeg = requirePositiveFiniteNumber(meta.fovDeg, 'meta.fovDeg');
  return `sensitivity=${sensitivity};fovDeg=${fovDeg}`;
}

function requireQualityGateStatus(value: unknown): QualityGateStatus {
  if (
    value === 'ok' ||
    value === 'insufficient-n' ||
    value === 'incompatible-protocol' ||
    value === 'suspect-run'
  ) {
    return value;
  }
  throw new Error('qualityGateStatus must be ok, insufficient-n, incompatible-protocol, or suspect-run');
}

function requireTrimmedNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a non-empty string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${name} must be a non-empty string`);
  return trimmed;
}

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}
