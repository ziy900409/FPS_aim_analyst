import type { ExportPayload } from './export.ts';
import type {
  AssessmentMeta,
  Meta,
  MouseIntegrationMeta,
  ProtocolMeta,
  SceneMeta,
  SessionMeta,
  SpawnMeta,
  TargetsMeta,
  VisibilityMeta,
  WeaponMeta,
} from './metadata.ts';
import type { KeyName, TickRecord } from './RingBuffer.ts';
import type { DrillEvent } from './DataRecorder.ts';
import type { TargetHitboxConfig } from '../drill/DrillConfig.ts';
import type { DisplaySelfReport, DisplayState } from '../display/resolutionMode.ts';
import type { GateReport } from '../display/eligibilityGate.ts';
import type { FrameLogExport } from '../display/frameLog.ts';

export interface ExportPayloadParseError {
  readonly path: string;
  readonly code: 'invalid_type' | 'invalid_value' | 'unsupported_schema' | 'non_finite';
  readonly message: string;
}

export type ExportPayloadParseResult =
  | { readonly ok: true; readonly payload: ExportPayload }
  | { readonly ok: false; readonly errors: readonly ExportPayloadParseError[] };

/**
 * Single strict `unknown → ExportPayload` runtime boundary shared by the browser history loader
 * and (WP-48 T2) the Node history repository. Assessment-vs-Practice archival policy is
 * deliberately NOT enforced here — this parser stays mode-neutral so a legal Practice export
 * still parses (WP-48 README §2.4); callers apply archive-eligibility separately.
 */
export function parseExportPayload(value: unknown): ExportPayloadParseResult {
  const errors: ExportPayloadParseError[] = [];
  const root = parseRecord(value, '$', errors);
  if (root === undefined) return { ok: false, errors };

  const metaRaw = parseRecord(root.meta, 'meta', errors);
  const ticksRaw = parseArray(root.ticks, 'ticks', errors);
  const eventsRaw = parseArray(root.events, 'events', errors);
  if (metaRaw === undefined || ticksRaw === undefined || eventsRaw === undefined) {
    return { ok: false, errors };
  }

  const meta = parseMeta(metaRaw, errors);
  const ticks = parseTicks(ticksRaw, errors);
  const events = parseEvents(eventsRaw, errors);
  if (meta === undefined || ticks === undefined || events === undefined) {
    return { ok: false, errors };
  }

  return { ok: true, payload: { meta, ticks, events } };
}

/**
 * Deterministic content serializer: recursively sorts object keys (whitespace/key-order never
 * affects the bytes) while preserving array element order (tick/event sequencing is semantic).
 * Used by WP-48 T2 identity/idempotency hashing — not the human-facing `serializeJSON` download.
 */
export function canonicalExportJSON(payload: ExportPayload): string {
  return JSON.stringify(canonicalizeValue(payload));
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = canonicalizeValue(record[key]);
    return sorted;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

function fail(
  errors: ExportPayloadParseError[],
  path: string,
  code: ExportPayloadParseError['code'],
  message: string,
): undefined {
  errors.push({ path, code, message });
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return fail(errors, path, 'invalid_type', `${path} must be an object`);
  return value;
}

function parseArray(value: unknown, path: string, errors: ExportPayloadParseError[]): unknown[] | undefined {
  if (!Array.isArray(value)) return fail(errors, path, 'invalid_type', `${path} must be an array`);
  return value;
}

function parseString(value: unknown, path: string, errors: ExportPayloadParseError[]): string | undefined {
  if (typeof value !== 'string') return fail(errors, path, 'invalid_type', `${path} must be a string`);
  return value;
}

function parseNonEmptyString(value: unknown, path: string, errors: ExportPayloadParseError[]): string | undefined {
  const str = parseString(value, path, errors);
  if (str === undefined) return undefined;
  if (str.trim() === '') return fail(errors, path, 'invalid_value', `${path} must be a non-empty string`);
  return str;
}

function parseBoolean(value: unknown, path: string, errors: ExportPayloadParseError[]): boolean | undefined {
  if (typeof value !== 'boolean') return fail(errors, path, 'invalid_type', `${path} must be a boolean`);
  return value;
}

function parseFiniteNumber(value: unknown, path: string, errors: ExportPayloadParseError[]): number | undefined {
  if (typeof value !== 'number') return fail(errors, path, 'invalid_type', `${path} must be a number`);
  if (!Number.isFinite(value)) return fail(errors, path, 'non_finite', `${path} must be a finite number`);
  return value;
}

function parseFiniteNumberOrNull(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): number | null | undefined {
  if (value === null) return null;
  return parseFiniteNumber(value, path, errors);
}

function parsePositiveFiniteNumber(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): number | undefined {
  const n = parseFiniteNumber(value, path, errors);
  if (n === undefined) return undefined;
  if (n <= 0) return fail(errors, path, 'invalid_value', `${path} must be a positive number`);
  return n;
}

function parseNonNegativeFiniteNumber(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): number | undefined {
  const n = parseFiniteNumber(value, path, errors);
  if (n === undefined) return undefined;
  if (n < 0) return fail(errors, path, 'invalid_value', `${path} must be a non-negative number`);
  return n;
}

function parseInteger(value: unknown, path: string, errors: ExportPayloadParseError[]): number | undefined {
  const n = parseFiniteNumber(value, path, errors);
  if (n === undefined) return undefined;
  if (!Number.isInteger(n)) return fail(errors, path, 'invalid_value', `${path} must be an integer`);
  return n;
}

function parseNonNegativeInteger(value: unknown, path: string, errors: ExportPayloadParseError[]): number | undefined {
  const n = parseInteger(value, path, errors);
  if (n === undefined) return undefined;
  if (n < 0) return fail(errors, path, 'invalid_value', `${path} must be a non-negative integer`);
  return n;
}

function parsePositiveInteger(value: unknown, path: string, errors: ExportPayloadParseError[]): number | undefined {
  const n = parseInteger(value, path, errors);
  if (n === undefined) return undefined;
  if (n <= 0) return fail(errors, path, 'invalid_value', `${path} must be a positive integer`);
  return n;
}

function parseLiteral<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  errors: ExportPayloadParseError[],
): T | undefined {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  return fail(errors, path, 'invalid_value', `${path} must be one of: ${allowed.join(', ')}`);
}

function parseIsoDateString(value: unknown, path: string, errors: ExportPayloadParseError[]): string | undefined {
  const str = parseNonEmptyString(value, path, errors);
  if (str === undefined) return undefined;
  if (Number.isNaN(Date.parse(str))) {
    return fail(errors, path, 'invalid_value', `${path} must be an ISO-compatible date string`);
  }
  return str;
}

function parseNumberArray(
  items: readonly unknown[],
  path: string,
  errors: ExportPayloadParseError[],
  parseItem: (value: unknown, itemPath: string, errors: ExportPayloadParseError[]) => number | undefined,
): number[] | undefined {
  const result: number[] = [];
  let failed = false;
  items.forEach((item, i) => {
    const parsed = parseItem(item, `${path}[${i}]`, errors);
    if (parsed === undefined) failed = true;
    else result.push(parsed);
  });
  return failed ? undefined : result;
}

// ---------------------------------------------------------------------------
// Meta and its nested contracts
// ---------------------------------------------------------------------------

function parseMeta(raw: Record<string, unknown>, errors: ExportPayloadParseError[]): Meta | undefined {
  const before = errors.length;

  if (raw.schemaVersion !== 2) {
    fail(errors, 'meta.schemaVersion', 'unsupported_schema', 'meta.schemaVersion must be 2');
  }
  const drillId = parseNonEmptyString(raw.drillId, 'meta.drillId', errors);
  const weaponId = parseNonEmptyString(raw.weaponId, 'meta.weaponId', errors);
  const weaponSeed = parseNonNegativeInteger(raw.weaponSeed, 'meta.weaponSeed', errors);
  const rngSeed = parseFiniteNumber(raw.rngSeed, 'meta.rngSeed', errors);
  const backend = parseLiteral(raw.backend, 'meta.backend', ['webgpu', 'webgl2'] as const, errors);
  const displayHz = parsePositiveFiniteNumber(raw.displayHz, 'meta.displayHz', errors);
  const simHz = parsePositiveFiniteNumber(raw.simHz, 'meta.simHz', errors);
  const browser = parseString(raw.browser, 'meta.browser', errors);
  const sensitivity = parsePositiveFiniteNumber(raw.sensitivity, 'meta.sensitivity', errors);
  const sensitivityModel = parseLiteral(raw.sensitivityModel, 'meta.sensitivityModel', ['cs2-0.022deg'] as const, errors);
  const movementModel = parseLiteral(raw.movementModel, 'meta.movementModel', ['cs2-source'] as const, errors);
  const crossOriginIsolated = parseBoolean(raw.crossOriginIsolated, 'meta.crossOriginIsolated', errors);
  const startedAt = parseIsoDateString(raw.startedAt, 'meta.startedAt', errors);
  const unit = parseLiteral(raw.unit, 'meta.unit', ['source'] as const, errors);
  const vStrafe = parsePositiveFiniteNumber(raw.vStrafe, 'meta.vStrafe', errors);
  const maxDrillSeconds = parsePositiveFiniteNumber(raw.maxDrillSeconds, 'meta.maxDrillSeconds', errors);
  const lateEventCount = parseNonNegativeInteger(raw.lateEventCount, 'meta.lateEventCount', errors);
  const bufferOverflow = parseBoolean(raw.bufferOverflow, 'meta.bufferOverflow', errors);
  const recorderOverflow = parseBoolean(raw.recorderOverflow, 'meta.recorderOverflow', errors);
  const suspect = parseBoolean(raw.suspect, 'meta.suspect', errors);

  const dpi = raw.dpi === undefined ? undefined : parsePositiveFiniteNumber(raw.dpi, 'meta.dpi', errors);
  const sessionPlanPreset =
    raw.sessionPlanPreset === undefined ? undefined : parseNonEmptyString(raw.sessionPlanPreset, 'meta.sessionPlanPreset', errors);
  const sessionPlanRestSeconds =
    raw.sessionPlanRestSeconds === undefined
      ? undefined
      : parseNonNegativeFiniteNumber(raw.sessionPlanRestSeconds, 'meta.sessionPlanRestSeconds', errors);
  const sessionPlanFamilyOrder =
    raw.sessionPlanFamilyOrder === undefined
      ? undefined
      : parseStringArray(raw.sessionPlanFamilyOrder, 'meta.sessionPlanFamilyOrder', errors);
  const fovDeg = raw.fovDeg === undefined ? undefined : parsePositiveFiniteNumber(raw.fovDeg, 'meta.fovDeg', errors);
  const simToWorld = raw.simToWorld === undefined ? undefined : parsePositiveFiniteNumber(raw.simToWorld, 'meta.simToWorld', errors);
  const validity = raw.validity === undefined ? undefined : parseValidity(raw.validity, 'meta.validity', errors);
  const weapon = raw.weapon === undefined ? undefined : parseWeaponMeta(raw.weapon, 'meta.weapon', errors);
  const targets = raw.targets === undefined ? undefined : parseTargetsMeta(raw.targets, 'meta.targets', errors);
  const spawn = raw.spawn === undefined ? undefined : parseSpawnMeta(raw.spawn, 'meta.spawn', errors);
  const scene = raw.scene === undefined ? undefined : parseSceneMeta(raw.scene, 'meta.scene', errors);
  const display = raw.display === undefined ? undefined : parseDisplayState(raw.display, 'meta.display', errors);
  const frames = raw.frames === undefined ? undefined : parseFrameLogExport(raw.frames, 'meta.frames', errors);
  const session = raw.session === undefined ? undefined : parseSessionMeta(raw.session, 'meta.session', errors);
  const protocol = raw.protocol === undefined ? undefined : parseProtocolMeta(raw.protocol, 'meta.protocol', errors);
  const assessment = raw.assessment === undefined ? undefined : parseAssessmentMeta(raw.assessment, 'meta.assessment', errors);
  const visibility = raw.visibility === undefined ? undefined : parseVisibilityMeta(raw.visibility, 'meta.visibility', errors);
  const mouseIntegration =
    raw.mouseIntegration === undefined ? undefined : parseMouseIntegrationMeta(raw.mouseIntegration, 'meta.mouseIntegration', errors);

  if (
    drillId === undefined ||
    weaponId === undefined ||
    weaponSeed === undefined ||
    rngSeed === undefined ||
    backend === undefined ||
    displayHz === undefined ||
    simHz === undefined ||
    browser === undefined ||
    sensitivity === undefined ||
    sensitivityModel === undefined ||
    movementModel === undefined ||
    crossOriginIsolated === undefined ||
    startedAt === undefined ||
    unit === undefined ||
    vStrafe === undefined ||
    maxDrillSeconds === undefined ||
    lateEventCount === undefined ||
    bufferOverflow === undefined ||
    recorderOverflow === undefined ||
    suspect === undefined ||
    errors.length > before
  ) {
    return undefined;
  }

  return {
    schemaVersion: 2,
    drillId,
    weaponId,
    weaponSeed,
    rngSeed,
    backend,
    displayHz,
    simHz,
    browser,
    sensitivity,
    ...(dpi !== undefined ? { dpi } : {}),
    ...(sessionPlanPreset !== undefined ? { sessionPlanPreset } : {}),
    ...(sessionPlanRestSeconds !== undefined ? { sessionPlanRestSeconds } : {}),
    ...(sessionPlanFamilyOrder !== undefined ? { sessionPlanFamilyOrder } : {}),
    sensitivityModel,
    movementModel,
    ...(fovDeg !== undefined ? { fovDeg } : {}),
    crossOriginIsolated,
    startedAt,
    unit,
    vStrafe,
    maxDrillSeconds,
    lateEventCount,
    bufferOverflow,
    recorderOverflow,
    suspect,
    ...(simToWorld !== undefined ? { simToWorld } : {}),
    ...(validity !== undefined ? { validity } : {}),
    ...(weapon !== undefined ? { weapon } : {}),
    ...(targets !== undefined ? { targets } : {}),
    ...(spawn !== undefined ? { spawn } : {}),
    ...(scene !== undefined ? { scene } : {}),
    ...(display !== undefined ? { display } : {}),
    ...(frames !== undefined ? { frames } : {}),
    ...(session !== undefined ? { session } : {}),
    ...(protocol !== undefined ? { protocol } : {}),
    ...(assessment !== undefined ? { assessment } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(mouseIntegration !== undefined ? { mouseIntegration } : {}),
  };
}

function parseStringArray(value: unknown, path: string, errors: ExportPayloadParseError[]): string[] | undefined {
  const arr = parseArray(value, path, errors);
  if (arr === undefined) return undefined;
  const result: string[] = [];
  let failed = false;
  arr.forEach((item, i) => {
    const str = parseString(item, `${path}[${i}]`, errors);
    if (str === undefined) failed = true;
    else result.push(str);
  });
  return failed ? undefined : result;
}

function parseValidity(value: unknown, path: string, errors: ExportPayloadParseError[]): NonNullable<Meta['validity']> | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const corridorExceeded = parseBoolean(record.corridorExceeded, `${path}.corridorExceeded`, errors);
  const perfFloor = parseBoolean(record.perfFloor, `${path}.perfFloor`, errors);
  const recorderOverflow = parseBoolean(record.recorderOverflow, `${path}.recorderOverflow`, errors);
  const bufferOverflow = parseBoolean(record.bufferOverflow, `${path}.bufferOverflow`, errors);
  if (corridorExceeded === undefined || perfFloor === undefined || recorderOverflow === undefined || bufferOverflow === undefined) {
    return undefined;
  }
  return { corridorExceeded, perfFloor, recorderOverflow, bufferOverflow };
}

function parseWeaponMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): WeaponMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const id = parseNonEmptyString(record.id, `${path}.id`, errors);
  const ads = record.ads === undefined ? undefined : parseWeaponAdsMeta(record.ads, `${path}.ads`, errors);
  const bullet = record.bullet === undefined ? undefined : parseWeaponBulletMeta(record.bullet, `${path}.bullet`, errors);
  const projectileOverflow =
    record.projectileOverflow === undefined ? undefined : parseBoolean(record.projectileOverflow, `${path}.projectileOverflow`, errors);
  if (id === undefined || errors.length > before) return undefined;
  return {
    id,
    ...(ads !== undefined ? { ads } : {}),
    ...(bullet !== undefined ? { bullet } : {}),
    ...(projectileOverflow !== undefined ? { projectileOverflow } : {}),
  };
}

function parseWeaponAdsMeta(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): NonNullable<WeaponMeta['ads']> | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const fovDeg = parsePositiveFiniteNumber(record.fovDeg, `${path}.fovDeg`, errors);
  const sensitivityRatio = parsePositiveFiniteNumber(record.sensitivityRatio, `${path}.sensitivityRatio`, errors);
  if (fovDeg === undefined || sensitivityRatio === undefined) return undefined;
  return { fovDeg, sensitivityRatio };
}

function parseWeaponBulletMeta(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): NonNullable<WeaponMeta['bullet']> | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  if (record.model !== 'projectile') {
    return fail(errors, `${path}.model`, 'invalid_value', `${path}.model must be projectile`);
  }
  const speedU = parsePositiveFiniteNumber(record.speedU, `${path}.speedU`, errors);
  const gravityU = parsePositiveFiniteNumber(record.gravityU, `${path}.gravityU`, errors);
  const maxRangeU = parsePositiveFiniteNumber(record.maxRangeU, `${path}.maxRangeU`, errors);
  if (speedU === undefined || gravityU === undefined || maxRangeU === undefined) return undefined;
  return { model: 'projectile', speedU, gravityU, maxRangeU };
}

function parseTargetsMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): TargetsMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  if (record.hitbox === undefined) return {};
  const hitbox = parseTargetHitboxConfig(record.hitbox, `${path}.hitbox`, errors);
  if (hitbox === undefined) return undefined;
  return { hitbox };
}

function parseTargetHitboxConfig(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): TargetHitboxConfig | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const widthU = parsePositiveFiniteNumber(record.widthU, `${path}.widthU`, errors);
  const heightU = parsePositiveFiniteNumber(record.heightU, `${path}.heightU`, errors);
  const depthU = parsePositiveFiniteNumber(record.depthU, `${path}.depthU`, errors);
  const shape = record.shape === undefined ? undefined : parseLiteral(record.shape, `${path}.shape`, ['box', 'sphere'] as const, errors);
  if (widthU === undefined || heightU === undefined || depthU === undefined || errors.length > before) return undefined;
  return { widthU, heightU, depthU, ...(shape !== undefined ? { shape } : {}) };
}

function parseSpawnMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): SpawnMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const seed = parseFiniteNumber(record.seed, `${path}.seed`, errors);
  const presentationMs =
    record.presentationMs === undefined ? undefined : parseFiniteNumber(record.presentationMs, `${path}.presentationMs`, errors);
  if (seed === undefined || errors.length > before) return undefined;
  // motion / spawnArea / spiderShot / spawnDelayMsRange are opaque `unknown` contracts by design
  // (metadata.ts SpawnMeta) — passed through verbatim, not deep-validated here.
  return {
    seed,
    ...(record.motion !== undefined ? { motion: record.motion } : {}),
    ...(record.spawnArea !== undefined ? { spawnArea: record.spawnArea } : {}),
    ...(record.spiderShot !== undefined ? { spiderShot: record.spiderShot } : {}),
    ...(record.spawnDelayMsRange !== undefined ? { spawnDelayMsRange: record.spawnDelayMsRange } : {}),
    ...(presentationMs !== undefined ? { presentationMs } : {}),
  };
}

function parseSceneMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): SceneMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const sceneId = parseNonEmptyString(record.sceneId, `${path}.sceneId`, errors);
  const assetPackVersion = parseNonEmptyString(record.assetPackVersion, `${path}.assetPackVersion`, errors);
  const clutterTier = parseLiteral(record.clutterTier, `${path}.clutterTier`, ['low', 'mid', 'high'] as const, errors);
  const fallback = parseBoolean(record.fallback, `${path}.fallback`, errors);
  const eye = record.eye === undefined ? undefined : parseEyeWorldBase(record.eye, `${path}.eye`, errors);
  if (sceneId === undefined || assetPackVersion === undefined || clutterTier === undefined || fallback === undefined || errors.length > before) {
    return undefined;
  }
  return { sceneId, assetPackVersion, clutterTier, fallback, ...(eye !== undefined ? { eye } : {}) };
}

function parseEyeWorldBase(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): NonNullable<SceneMeta['eye']> | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const x = parseFiniteNumber(record.x, `${path}.x`, errors);
  const y = parseFiniteNumber(record.y, `${path}.y`, errors);
  const z = parseFiniteNumber(record.z, `${path}.z`, errors);
  if (x === undefined || y === undefined || z === undefined) return undefined;
  return { x, y, z };
}

function parseDisplayState(value: unknown, path: string, errors: ExportPayloadParseError[]): DisplayState | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const mode = parseLiteral(record.mode, `${path}.mode`, ['native', 'fhd-1080', 'qhd-1440'] as const, errors);
  const bufferW = parsePositiveInteger(record.bufferW, `${path}.bufferW`, errors);
  const bufferH = parsePositiveInteger(record.bufferH, `${path}.bufferH`, errors);
  const cssW = parsePositiveInteger(record.cssW, `${path}.cssW`, errors);
  const cssH = parsePositiveInteger(record.cssH, `${path}.cssH`, errors);
  const dpr = parsePositiveFiniteNumber(record.dpr, `${path}.dpr`, errors);
  const screenW = parsePositiveInteger(record.screenW, `${path}.screenW`, errors);
  const screenH = parsePositiveInteger(record.screenH, `${path}.screenH`, errors);
  const fullscreen = parseBoolean(record.fullscreen, `${path}.fullscreen`, errors);
  const refreshEstimateHz = parseNonNegativeInteger(record.refreshEstimateHz, `${path}.refreshEstimateHz`, errors);
  const refreshMedianDeltaMs =
    record.refreshMedianDeltaMs === undefined
      ? undefined
      : parsePositiveFiniteNumber(record.refreshMedianDeltaMs, `${path}.refreshMedianDeltaMs`, errors);
  const gate = record.gate === undefined ? undefined : parseGateReport(record.gate, `${path}.gate`, errors);
  const selfReport = parseDisplaySelfReport(record, path, errors);

  if (
    mode === undefined ||
    bufferW === undefined ||
    bufferH === undefined ||
    cssW === undefined ||
    cssH === undefined ||
    dpr === undefined ||
    screenW === undefined ||
    screenH === undefined ||
    fullscreen === undefined ||
    refreshEstimateHz === undefined ||
    errors.length > before
  ) {
    return undefined;
  }

  return {
    mode,
    bufferW,
    bufferH,
    cssW,
    cssH,
    dpr,
    screenW,
    screenH,
    fullscreen,
    refreshEstimateHz,
    ...(refreshMedianDeltaMs !== undefined ? { refreshMedianDeltaMs } : {}),
    ...(gate !== undefined ? { gate } : {}),
    ...selfReport,
  };
}

function parseDisplaySelfReport(
  record: Record<string, unknown>,
  path: string,
  errors: ExportPayloadParseError[],
): DisplaySelfReport {
  const result: DisplaySelfReport = {};
  if (record.monitorModel !== undefined) {
    const monitorModel = parseNonEmptyString(record.monitorModel, `${path}.monitorModel`, errors);
    if (monitorModel !== undefined) result.monitorModel = monitorModel;
  }
  if (record.nativeW !== undefined) {
    const nativeW = parsePositiveInteger(record.nativeW, `${path}.nativeW`, errors);
    if (nativeW !== undefined) result.nativeW = nativeW;
  }
  if (record.nativeH !== undefined) {
    const nativeH = parsePositiveInteger(record.nativeH, `${path}.nativeH`, errors);
    if (nativeH !== undefined) result.nativeH = nativeH;
  }
  if (record.panelInches !== undefined) {
    const panelInches = parsePositiveFiniteNumber(record.panelInches, `${path}.panelInches`, errors);
    if (panelInches !== undefined) result.panelInches = panelInches;
  }
  if (record.viewingDistanceCm !== undefined) {
    const viewingDistanceCm = parsePositiveFiniteNumber(record.viewingDistanceCm, `${path}.viewingDistanceCm`, errors);
    if (viewingDistanceCm !== undefined) result.viewingDistanceCm = viewingDistanceCm;
  }
  if (record.selfReportUncertain !== undefined) {
    const selfReportUncertain = parseBoolean(record.selfReportUncertain, `${path}.selfReportUncertain`, errors);
    if (selfReportUncertain !== undefined) result.selfReportUncertain = selfReportUncertain;
  }
  if (record.nativeMismatch !== undefined) {
    const nativeMismatch = parseBoolean(record.nativeMismatch, `${path}.nativeMismatch`, errors);
    if (nativeMismatch !== undefined) result.nativeMismatch = nativeMismatch;
  }
  return result;
}

function parseGateReport(value: unknown, path: string, errors: ExportPayloadParseError[]): GateReport | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const pass = parseBoolean(record.pass, `${path}.pass`, errors);
  const native = parseBoolean(record.native, `${path}.native`, errors);
  const fullscreen = parseBoolean(record.fullscreen, `${path}.fullscreen`, errors);
  const perf = parseBoolean(record.perf, `${path}.perf`, errors);
  const details = parseNonEmptyString(record.details, `${path}.details`, errors);
  if (pass === undefined || native === undefined || fullscreen === undefined || perf === undefined || details === undefined) {
    return undefined;
  }
  return { pass, native, fullscreen, perf, details };
}

function parseFrameLogExport(value: unknown, path: string, errors: ExportPayloadParseError[]): FrameLogExport | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;

  const seriesRaw = parseArray(record.series, `${path}.series`, errors);
  const series = seriesRaw === undefined ? undefined : parseNumberArray(seriesRaw, `${path}.series`, errors, parseNonNegativeFiniteNumber);

  const summaryRecord = parseRecord(record.summary, `${path}.summary`, errors);
  let summary: FrameLogExport['summary'] | undefined;
  if (summaryRecord !== undefined) {
    const count = parseNonNegativeInteger(summaryRecord.count, `${path}.summary.count`, errors);
    const p50 = parseNonNegativeFiniteNumber(summaryRecord.p50, `${path}.summary.p50`, errors);
    const p95 = parseNonNegativeFiniteNumber(summaryRecord.p95, `${path}.summary.p95`, errors);
    const p99 = parseNonNegativeFiniteNumber(summaryRecord.p99, `${path}.summary.p99`, errors);
    const overBudgetWindows = parseNonNegativeInteger(summaryRecord.overBudgetWindows, `${path}.summary.overBudgetWindows`, errors);
    const overflow = parseBoolean(summaryRecord.overflow, `${path}.summary.overflow`, errors);
    if (
      count !== undefined &&
      p50 !== undefined &&
      p95 !== undefined &&
      p99 !== undefined &&
      overBudgetWindows !== undefined &&
      overflow !== undefined
    ) {
      summary = { count, p50, p95, p99, overBudgetWindows, overflow };
    }
  }

  if (series === undefined || summary === undefined || errors.length > before) return undefined;
  if (summary.count !== series.length) {
    fail(errors, `${path}.summary.count`, 'invalid_value', `${path}.summary.count must match ${path}.series length`);
    return undefined;
  }
  return { series, summary };
}

function parseSessionMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): SessionMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const participantId = parseNonEmptyString(record.participantId, `${path}.participantId`, errors);
  const sessionLabel =
    record.sessionLabel === undefined ? undefined : parseNonEmptyString(record.sessionLabel, `${path}.sessionLabel`, errors);
  if (participantId === undefined || errors.length > before) return undefined;
  return {
    participantId: participantId.trim(),
    ...(sessionLabel !== undefined ? { sessionLabel: sessionLabel.trim() } : {}),
  };
}

function parseProtocolMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): ProtocolMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const protocolId = parseNonEmptyString(record.protocolId, `${path}.protocolId`, errors);
  const conditionIndex = parseNonNegativeInteger(record.conditionIndex, `${path}.conditionIndex`, errors);
  const conditionLabel = parseNonEmptyString(record.conditionLabel, `${path}.conditionLabel`, errors);
  if (protocolId === undefined || conditionIndex === undefined || conditionLabel === undefined || errors.length > before) {
    return undefined;
  }
  return { protocolId: protocolId.trim(), conditionIndex, conditionLabel: conditionLabel.trim() };
}

function parseAssessmentMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): AssessmentMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const protocolVersion = parseNonEmptyString(record.protocolVersion, `${path}.protocolVersion`, errors);
  const assessmentFeedbackPolicy = parseLiteral(
    record.assessmentFeedbackPolicy,
    `${path}.assessmentFeedbackPolicy`,
    ['minimal-end-of-block', 'unrestricted'] as const,
    errors,
  );
  if (protocolVersion === undefined || assessmentFeedbackPolicy === undefined || errors.length > before) return undefined;
  return { protocolVersion: protocolVersion.trim(), assessmentFeedbackPolicy };
}

function parseVisibilityMeta(value: unknown, path: string, errors: ExportPayloadParseError[]): VisibilityMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  const sampleCount =
    record.sampleCount === 1 || record.sampleCount === 9
      ? record.sampleCount
      : fail(errors, `${path}.sampleCount`, 'invalid_value', `${path}.sampleCount must be 1 or 9`);
  const onsetThreshold = parseFiniteNumber(record.onsetThreshold, `${path}.onsetThreshold`, errors);
  if (sampleCount === undefined || onsetThreshold === undefined || errors.length > before) return undefined;
  if (onsetThreshold < 0 || onsetThreshold > 1) {
    fail(errors, `${path}.onsetThreshold`, 'invalid_value', `${path}.onsetThreshold must be between 0 and 1`);
    return undefined;
  }
  return { sampleCount, onsetThreshold };
}

function parseMouseIntegrationMeta(
  value: unknown,
  path: string,
  errors: ExportPayloadParseError[],
): MouseIntegrationMeta | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;
  if (record.model !== 'tick-window-integral') {
    fail(errors, `${path}.model`, 'invalid_value', `${path}.model must be tick-window-integral`);
  }
  const radPerCount = parsePositiveFiniteNumber(record.radPerCount, `${path}.radPerCount`, errors);
  const hipStep = parsePositiveFiniteNumber(record.hipStep, `${path}.hipStep`, errors);
  const adsStep = parsePositiveFiniteNumber(record.adsStep, `${path}.adsStep`, errors);
  if (radPerCount === undefined || hipStep === undefined || adsStep === undefined || errors.length > before) return undefined;
  return { model: 'tick-window-integral', radPerCount, hipStep, adsStep };
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

function parseTicks(items: readonly unknown[], errors: ExportPayloadParseError[]): TickRecord[] | undefined {
  const result: TickRecord[] = [];
  let failed = false;
  items.forEach((item, i) => {
    const tick = parseTickRecord(item, `ticks[${i}]`, errors);
    if (tick === undefined) failed = true;
    else result.push(tick);
  });
  return failed ? undefined : result;
}

function parseTickRecord(value: unknown, path: string, errors: ExportPayloadParseError[]): TickRecord | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const before = errors.length;

  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const vx = parseFiniteNumber(record.vx, `${path}.vx`, errors);
  const vz = parseFiniteNumber(record.vz, `${path}.vz`, errors);
  const px = parseFiniteNumber(record.px, `${path}.px`, errors);
  const pz = parseFiniteNumber(record.pz, `${path}.pz`, errors);
  const tx = parseFiniteNumberOrNull(record.tx, `${path}.tx`, errors);
  const ty = parseFiniteNumberOrNull(record.ty, `${path}.ty`, errors);
  const tz = parseFiniteNumberOrNull(record.tz, `${path}.tz`, errors);
  const aim = parseAim(record.aim, `${path}.aim`, errors);
  const keys = parseKeyArray(record.keys, `${path}.keys`, errors);
  const ads = parseBoolean(record.ads, `${path}.ads`, errors);
  const dYaw = record.dYaw === undefined ? undefined : parseFiniteNumber(record.dYaw, `${path}.dYaw`, errors);
  const dPitch = record.dPitch === undefined ? undefined : parseFiniteNumber(record.dPitch, `${path}.dPitch`, errors);

  if (
    t === undefined ||
    vx === undefined ||
    vz === undefined ||
    px === undefined ||
    pz === undefined ||
    tx === undefined ||
    ty === undefined ||
    tz === undefined ||
    aim === undefined ||
    keys === undefined ||
    ads === undefined ||
    errors.length > before
  ) {
    return undefined;
  }

  return {
    t,
    vx,
    vz,
    px,
    pz,
    tx,
    ty,
    tz,
    aim,
    keys,
    ads,
    ...(dYaw !== undefined ? { dYaw } : {}),
    ...(dPitch !== undefined ? { dPitch } : {}),
  };
}

function parseAim(value: unknown, path: string, errors: ExportPayloadParseError[]): { yaw: number; pitch: number } | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  const yaw = parseFiniteNumber(record.yaw, `${path}.yaw`, errors);
  const pitch = parseFiniteNumber(record.pitch, `${path}.pitch`, errors);
  if (yaw === undefined || pitch === undefined) return undefined;
  return { yaw, pitch };
}

function parseKeyArray(value: unknown, path: string, errors: ExportPayloadParseError[]): KeyName[] | undefined {
  const arr = parseArray(value, path, errors);
  if (arr === undefined) return undefined;
  const result: KeyName[] = [];
  let failed = false;
  arr.forEach((item, i) => {
    const key = parseLiteral(item, `${path}[${i}]`, ['A', 'D', 'W', 'S'] as const, errors);
    if (key === undefined) failed = true;
    else result.push(key);
  });
  return failed ? undefined : result;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function parseEvents(items: readonly unknown[], errors: ExportPayloadParseError[]): DrillEvent[] | undefined {
  const result: DrillEvent[] = [];
  let failed = false;
  items.forEach((item, i) => {
    const event = parseDrillEvent(item, `events[${i}]`, errors);
    if (event === undefined) failed = true;
    else result.push(event);
  });
  return failed ? undefined : result;
}

function parseDrillEvent(value: unknown, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const record = parseRecord(value, path, errors);
  if (record === undefined) return undefined;
  switch (record.type) {
    case 'visible':
      return parseVisibleEvent(record, path, errors);
    case 'cue':
      return parseCueEvent(record, path, errors);
    case 'counter':
      return parseCounterEvent(record, path, errors);
    case 'ads':
      return parseAdsEvent(record, path, errors);
    case 'target_stop':
      return parseTargetStopEvent(record, path, errors);
    case 'key':
      return parseKeyEvent(record, path, errors);
    case 'fire':
      return parseFireEvent(record, path, errors);
    case 'hit':
      return parseHitEvent(record, path, errors);
    default:
      return fail(errors, `${path}.type`, 'invalid_value', `${path}.type is not a supported event discriminant`);
  }
}

function parseVisibleEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const targetId = parseNonEmptyString(record.targetId, `${path}.targetId`, errors);
  const side = parseLiteral(record.side, `${path}.side`, ['L', 'R'] as const, errors);
  const zone = record.zone === undefined ? undefined : parseLiteral(record.zone, `${path}.zone`, ['center', 'peripheral'] as const, errors);
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const targetX = record.targetX === undefined ? undefined : parseFiniteNumber(record.targetX, `${path}.targetX`, errors);
  const targetY = record.targetY === undefined ? undefined : parseFiniteNumber(record.targetY, `${path}.targetY`, errors);
  const targetZ = record.targetZ === undefined ? undefined : parseFiniteNumber(record.targetZ, `${path}.targetZ`, errors);
  if (targetId === undefined || side === undefined || t === undefined || errors.length > before) return undefined;
  return {
    type: 'visible',
    targetId,
    side,
    t,
    ...(zone !== undefined ? { zone } : {}),
    ...(targetX !== undefined ? { targetX } : {}),
    ...(targetY !== undefined ? { targetY } : {}),
    ...(targetZ !== undefined ? { targetZ } : {}),
  };
}

function parseCueEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const direction = parseLiteral(record.direction, `${path}.direction`, ['A', 'D'] as const, errors);
  if (t === undefined || direction === undefined || errors.length > before) return undefined;
  return { type: 'cue', t, direction };
}

function parseCounterEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const key = parseNonEmptyString(record.key, `${path}.key`, errors);
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  if (key === undefined || t === undefined || errors.length > before) return undefined;
  return { type: 'counter', key, t };
}

function parseAdsEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const down = parseBoolean(record.down, `${path}.down`, errors);
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  if (down === undefined || t === undefined || errors.length > before) return undefined;
  return { type: 'ads', down, t };
}

function parseTargetStopEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const targetId = parseNonEmptyString(record.targetId, `${path}.targetId`, errors);
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const targetX = parseFiniteNumber(record.targetX, `${path}.targetX`, errors);
  const targetY = parseFiniteNumber(record.targetY, `${path}.targetY`, errors);
  const targetZ = parseFiniteNumber(record.targetZ, `${path}.targetZ`, errors);
  if (
    targetId === undefined ||
    t === undefined ||
    targetX === undefined ||
    targetY === undefined ||
    targetZ === undefined ||
    errors.length > before
  ) {
    return undefined;
  }
  return { type: 'target_stop', targetId, t, targetX, targetY, targetZ };
}

function parseKeyEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const code = parseNonEmptyString(record.code, `${path}.code`, errors);
  const down = parseBoolean(record.down, `${path}.down`, errors);
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  if (code === undefined || down === undefined || t === undefined || errors.length > before) return undefined;
  return { type: 'key', code, down, t };
}

function parseFireEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const hit = parseBoolean(record.hit, `${path}.hit`, errors);
  const firstShot = parseBoolean(record.firstShot, `${path}.firstShot`, errors);
  const residualSpeed = parseFiniteNumber(record.residualSpeed, `${path}.residualSpeed`, errors);
  const shotSeq = record.shotSeq === undefined ? undefined : parseFiniteNumber(record.shotSeq, `${path}.shotSeq`, errors);
  const viewYaw = record.viewYaw === undefined ? undefined : parseFiniteNumber(record.viewYaw, `${path}.viewYaw`, errors);
  const viewPitch = record.viewPitch === undefined ? undefined : parseFiniteNumber(record.viewPitch, `${path}.viewPitch`, errors);
  const aimPunchPitch =
    record.aimPunchPitch === undefined ? undefined : parseFiniteNumber(record.aimPunchPitch, `${path}.aimPunchPitch`, errors);
  const aimPunchYaw = record.aimPunchYaw === undefined ? undefined : parseFiniteNumber(record.aimPunchYaw, `${path}.aimPunchYaw`, errors);
  const spreadX = record.spreadX === undefined ? undefined : parseFiniteNumber(record.spreadX, `${path}.spreadX`, errors);
  const spreadY = record.spreadY === undefined ? undefined : parseFiniteNumber(record.spreadY, `${path}.spreadY`, errors);
  const recoilIndex = record.recoilIndex === undefined ? undefined : parseFiniteNumber(record.recoilIndex, `${path}.recoilIndex`, errors);
  const ammo = record.ammo === undefined ? undefined : parseFiniteNumber(record.ammo, `${path}.ammo`, errors);
  const targetId = record.targetId === undefined ? undefined : parseNonEmptyString(record.targetId, `${path}.targetId`, errors);
  const offsetDeg = record.offsetDeg === undefined ? undefined : parseFiniteNumber(record.offsetDeg, `${path}.offsetDeg`, errors);
  const part = record.part === undefined ? undefined : parseLiteral(record.part, `${path}.part`, ['head', 'body'] as const, errors);

  if (t === undefined || hit === undefined || firstShot === undefined || residualSpeed === undefined || errors.length > before) {
    return undefined;
  }
  return {
    type: 'fire',
    t,
    hit,
    firstShot,
    residualSpeed,
    ...(shotSeq !== undefined ? { shotSeq } : {}),
    ...(viewYaw !== undefined ? { viewYaw } : {}),
    ...(viewPitch !== undefined ? { viewPitch } : {}),
    ...(aimPunchPitch !== undefined ? { aimPunchPitch } : {}),
    ...(aimPunchYaw !== undefined ? { aimPunchYaw } : {}),
    ...(spreadX !== undefined ? { spreadX } : {}),
    ...(spreadY !== undefined ? { spreadY } : {}),
    ...(recoilIndex !== undefined ? { recoilIndex } : {}),
    ...(ammo !== undefined ? { ammo } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(offsetDeg !== undefined ? { offsetDeg } : {}),
    ...(part !== undefined ? { part } : {}),
  };
}

function parseHitEvent(record: Record<string, unknown>, path: string, errors: ExportPayloadParseError[]): DrillEvent | undefined {
  const before = errors.length;
  const t = parseFiniteNumber(record.t, `${path}.t`, errors);
  const timeOfFlightMs = parseFiniteNumber(record.timeOfFlightMs, `${path}.timeOfFlightMs`, errors);
  const shotSeq = parseFiniteNumber(record.shotSeq, `${path}.shotSeq`, errors);
  const targetId = record.targetId === undefined ? undefined : parseNonEmptyString(record.targetId, `${path}.targetId`, errors);
  const part = record.part === undefined ? undefined : parseLiteral(record.part, `${path}.part`, ['head', 'body'] as const, errors);
  if (t === undefined || timeOfFlightMs === undefined || shotSeq === undefined || errors.length > before) return undefined;
  return {
    type: 'hit',
    t,
    timeOfFlightMs,
    shotSeq,
    ...(targetId !== undefined ? { targetId } : {}),
    ...(part !== undefined ? { part } : {}),
  };
}
