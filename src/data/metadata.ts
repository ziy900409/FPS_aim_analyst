import type { RenderBackend } from '../render/createRenderer.ts';
import { isResolutionMode, type DisplaySelfReport, type DisplayState } from '../display/resolutionMode.ts';
import type { GateReport } from '../display/eligibilityGate.ts';
import { PERF_FLOOR_MS } from '../display/constants.ts';
import type { FrameLogExport } from '../display/frameLog.ts';
import { DEFAULT_MAX_DRILL_SECONDS } from './RingBuffer.ts';
import type { TargetHitboxConfig } from '../drill/DrillConfig.ts';
import { SIM_TO_WORLD } from '../loop/constants.ts';

export const DEFAULT_SIM_HZ = 128;
export const DEFAULT_V_STRAFE = 250;
export const SCHEMA_VERSION = 2;
export const DEFAULT_WEAPON_ID = 'ak47';
export const DEFAULT_WEAPON_SEED = 223;
export const DEFAULT_RNG_SEED = 1;
export const DEFAULT_MOVEMENT_MODEL = 'cs2-source';

export interface SpawnMeta {
  seed: number;
  motion?: unknown;
  spawnArea?: unknown;
  spawnDelayMsRange?: unknown;
  /** timed presentation 呈現時長(ms,WP-18 / T3)——追蹤 drill 重現/追蹤窗口右界所需。 */
  presentationMs?: number;
}

export interface TargetsMeta {
  /** Resolved H1 hitbox snapshot (source units). Additive v2 metadata for offline on-target derivation. */
  hitbox?: TargetHitboxConfig;
}

export interface WeaponMeta {
  id: string;
  ads?: {
    fovDeg: number;
    sensitivityRatio: number;
  };
  bullet?: {
    model: 'projectile';
    speedU: number;
    gravityU: number;
    maxRangeU: number;
  };
  projectileOverflow?: boolean;
}

export interface SceneMeta {
  sceneId: string;
  assetPackVersion: string;
  clutterTier: 'low' | 'mid' | 'high';
  fallback: boolean;
  /**
   * 射線/彈道原點的 world base（KI-004 / S1 T2,FR-S1-14）。三分量皆 finite,
   * **允許 0 與負值**（`br-field` 的 `eyeZ: 0`,KI-002/D1）。由 data 層以
   * `resolveEyeWorldBase(sceneConfig)` 決定性算出 —— **不得**從 render camera 讀
   * （camera 位置經 alpha 內插,讀它會讓匯出依賴 render 幀率,破壞決定性並違反 ADR-2）。
   * 缺席 = pre-S1 匯出;`resolveEyeOrigin`(S1 T4)退 `legacy-default`。TODO(S3): 正規單位敘述對帳。
   */
  eye?: { x: number; y: number; z: number };
}

export interface SessionMeta {
  participantId: string;
  sessionLabel?: string;
}

export interface ProtocolMeta {
  protocolId: string;
  conditionIndex: number;
  conditionLabel: string;
}

export interface Meta {
  schemaVersion: 2;
  drillId: string;
  weaponId: string;
  weaponSeed: number;
  rngSeed: number;
  backend: RenderBackend;
  displayHz: number;
  simHz: number;
  browser: string;
  sensitivity: number;
  sensitivityModel: 'cs2-0.022deg';
  movementModel: 'cs2-source';
  crossOriginIsolated: boolean;
  startedAt: string;
  unit: 'source';
  vStrafe: number;
  maxDrillSeconds: number;
  lateEventCount: number;
  bufferOverflow: boolean;
  recorderOverflow: boolean;
  suspect: boolean;
  /**
   * world unit per source unit —— sim domain 與 world domain 之間的唯一橋樑
   * （KI-004 / S1 T2,FR-S1-13）。缺席 = pre-S1 匯出。
   */
  simToWorld?: number;
  /**
   * runtime validity 觀測拆解（KI-004 / S1 T2,FR-S1-15）。與 `suspect` **不是同一集合**：
   * `suspect` 的 OR 集合逐位不變（本欄位純 additive,不改變 `suspect` 語意）。
   */
  validity?: {
    corridorExceeded: boolean;
    perfFloor: boolean;
    recorderOverflow: boolean;
    bufferOverflow: boolean;
  };
  weapon?: WeaponMeta;
  targets?: TargetsMeta;
  spawn?: SpawnMeta;
  scene?: SceneMeta;
  display?: DisplayState;
  frames?: FrameLogExport;
  session?: SessionMeta;
  protocol?: ProtocolMeta;
}

export interface CollectMetaArgs {
  drillId: string;
  weaponId?: string;
  weaponSeed?: number;
  rngSeed?: number;
  backend: RenderBackend;
  displayHz: number;
  simHz?: number;
  browser?: string;
  sensitivity: number;
  crossOriginIsolated: boolean;
  startedAt?: string | Date;
  vStrafe?: number;
  maxDrillSeconds?: number;
  lateEventCount?: number;
  bufferOverflow?: boolean | number;
  recorderOverflow?: boolean;
  suspect?: boolean;
  simToWorld?: number;
  validity?: {
    corridorExceeded: boolean;
    perfFloor: boolean;
    recorderOverflow: boolean;
    bufferOverflow: boolean;
  };
  weapon?: WeaponMeta;
  targets?: TargetsMeta;
  spawn?: SpawnMeta;
  scene?: SceneMeta;
  display?: DisplayState;
  frames?: FrameLogExport;
  session?: SessionMeta;
  protocol?: ProtocolMeta;
}

export interface MeasureDisplayHzOptions {
  samples?: number;
  warmupSamples?: number;
  requestAnimationFrame?: ((callback: FrameRequestCallback) => number) | null;
}

export interface DisplayRefreshEstimate {
  refreshEstimateHz: number;
  medianDeltaMs: number;
}

export function collectMeta(args: CollectMetaArgs): Meta {
  const drillId = requireNonEmptyString(args.drillId, 'drillId');
  const weaponId = requireNonEmptyString(args.weaponId ?? DEFAULT_WEAPON_ID, 'weaponId');
  const weaponSeed = requireNonNegativeInteger(args.weaponSeed ?? DEFAULT_WEAPON_SEED, 'weaponSeed');
  const rngSeed = requireFiniteNumber(args.rngSeed ?? DEFAULT_RNG_SEED, 'rngSeed');
  const backend = requireBackend(args.backend);
  const displayHz = requirePositiveFiniteNumber(args.displayHz, 'displayHz');
  const simHz = requirePositiveFiniteNumber(args.simHz ?? DEFAULT_SIM_HZ, 'simHz');
  const browser = args.browser ?? globalThis.navigator?.userAgent ?? 'unknown';
  const sensitivity = requirePositiveFiniteNumber(args.sensitivity, 'sensitivity');
  const crossOriginIsolated = requireBoolean(args.crossOriginIsolated, 'crossOriginIsolated');
  const startedAt = normalizeStartedAt(args.startedAt);
  const vStrafe = requirePositiveFiniteNumber(args.vStrafe ?? DEFAULT_V_STRAFE, 'vStrafe');
  const maxDrillSeconds = requirePositiveFiniteNumber(
    args.maxDrillSeconds ?? DEFAULT_MAX_DRILL_SECONDS,
    'maxDrillSeconds',
  );
  const lateEventCount = requireNonNegativeInteger(args.lateEventCount ?? 0, 'lateEventCount');
  const bufferOverflow = normalizeOverflow(args.bufferOverflow ?? false, 'bufferOverflow');
  const recorderOverflow = requireBoolean(args.recorderOverflow ?? false, 'recorderOverflow');
  const explicitSuspect = requireBoolean(args.suspect ?? false, 'suspect');
  const simToWorld = requirePositiveFiniteNumber(args.simToWorld ?? SIM_TO_WORLD, 'simToWorld');
  const validity = args.validity === undefined ? undefined : requireValidity(args.validity);
  const scene = args.scene === undefined ? undefined : requireSceneMeta(args.scene);
  const display = args.display === undefined ? undefined : requireDisplayState(args.display);
  const frames = args.frames === undefined ? undefined : requireFrameLogExport(args.frames);
  const session = args.session === undefined ? undefined : requireSessionMeta(args.session);
  const protocol = args.protocol === undefined ? undefined : requireProtocolMeta(args.protocol);
  const weapon = args.weapon === undefined ? undefined : requireWeaponMeta(args.weapon);
  const targets = args.targets === undefined ? undefined : requireTargetsMeta(args.targets);
  const frameFloorSuspect = frames !== undefined && frames.summary.p95 > PERF_FLOOR_MS;

  return {
    schemaVersion: SCHEMA_VERSION,
    drillId,
    weaponId,
    weaponSeed,
    rngSeed,
    backend,
    displayHz,
    simHz,
    browser,
    sensitivity,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: DEFAULT_MOVEMENT_MODEL,
    crossOriginIsolated,
    startedAt,
    unit: 'source',
    vStrafe,
    maxDrillSeconds,
    lateEventCount,
    bufferOverflow,
    recorderOverflow,
    suspect: explicitSuspect || bufferOverflow || recorderOverflow || frameFloorSuspect,
    simToWorld,
    ...(validity !== undefined ? { validity } : {}),
    ...(weapon !== undefined ? { weapon } : {}),
    ...(targets !== undefined ? { targets } : {}),
    ...(args.spawn !== undefined ? { spawn: args.spawn } : {}),
    ...(scene !== undefined ? { scene } : {}),
    ...(display !== undefined ? { display } : {}),
    ...(frames !== undefined ? { frames } : {}),
    ...(session !== undefined ? { session } : {}),
    ...(protocol !== undefined ? { protocol } : {}),
  };
}

function requireWeaponMeta(value: unknown): WeaponMeta {
  const weapon = requireRecord(value, 'weapon');
  return {
    id: requireNonEmptyString(weapon.id, 'weapon.id'),
    ...(weapon.ads !== undefined ? { ads: requireWeaponAdsMeta(weapon.ads) } : {}),
    ...(weapon.bullet !== undefined ? { bullet: requireWeaponBulletMeta(weapon.bullet) } : {}),
    ...(weapon.projectileOverflow !== undefined
      ? { projectileOverflow: requireBoolean(weapon.projectileOverflow, 'weapon.projectileOverflow') }
      : {}),
  };
}

function requireWeaponAdsMeta(value: unknown): NonNullable<WeaponMeta['ads']> {
  const ads = requireRecord(value, 'weapon.ads');
  return {
    fovDeg: requirePositiveFiniteNumber(ads.fovDeg, 'weapon.ads.fovDeg'),
    sensitivityRatio: requirePositiveFiniteNumber(ads.sensitivityRatio, 'weapon.ads.sensitivityRatio'),
  };
}

function requireWeaponBulletMeta(value: unknown): NonNullable<WeaponMeta['bullet']> {
  const bullet = requireRecord(value, 'weapon.bullet');
  if (bullet.model !== 'projectile') throw new Error('weapon.bullet.model must be projectile');
  return {
    model: 'projectile',
    speedU: requirePositiveFiniteNumber(bullet.speedU, 'weapon.bullet.speedU'),
    gravityU: requirePositiveFiniteNumber(bullet.gravityU, 'weapon.bullet.gravityU'),
    maxRangeU: requirePositiveFiniteNumber(bullet.maxRangeU, 'weapon.bullet.maxRangeU'),
  };
}

function requireTargetsMeta(value: unknown): TargetsMeta {
  const targets = requireRecord(value, 'targets');
  return {
    ...(targets.hitbox !== undefined ? { hitbox: requireTargetHitboxConfig(targets.hitbox, 'targets.hitbox') } : {}),
  };
}

function requireTargetHitboxConfig(value: unknown, name: string): TargetHitboxConfig {
  const hitbox = requireRecord(value, name);
  return {
    widthU: requirePositiveFiniteNumber(hitbox.widthU, `${name}.widthU`),
    heightU: requirePositiveFiniteNumber(hitbox.heightU, `${name}.heightU`),
    depthU: requirePositiveFiniteNumber(hitbox.depthU, `${name}.depthU`),
  };
}

function requireDisplayState(value: DisplayState): DisplayState {
  const display = requireRecord(value, 'display');
  const mode = display.mode;
  if (!isResolutionMode(mode)) throw new Error('display.mode must be native, fhd-1080, or qhd-1440');
  return {
    mode,
    bufferW: requirePositiveInteger(display.bufferW, 'display.bufferW'),
    bufferH: requirePositiveInteger(display.bufferH, 'display.bufferH'),
    cssW: requirePositiveInteger(display.cssW, 'display.cssW'),
    cssH: requirePositiveInteger(display.cssH, 'display.cssH'),
    dpr: requirePositiveFiniteNumber(display.dpr, 'display.dpr'),
    screenW: requirePositiveInteger(display.screenW, 'display.screenW'),
    screenH: requirePositiveInteger(display.screenH, 'display.screenH'),
    fullscreen: requireBoolean(display.fullscreen, 'display.fullscreen'),
    refreshEstimateHz: requireNonNegativeInteger(display.refreshEstimateHz, 'display.refreshEstimateHz'),
    ...(display.refreshMedianDeltaMs !== undefined
      ? { refreshMedianDeltaMs: requirePositiveFiniteNumber(display.refreshMedianDeltaMs, 'display.refreshMedianDeltaMs') }
      : {}),
    ...(display.gate !== undefined ? { gate: requireGateReport(display.gate) } : {}),
    ...requireDisplaySelfReport(display),
  };
}

function requireDisplaySelfReport(display: Record<string, unknown>): DisplaySelfReport {
  return {
    ...(display.monitorModel !== undefined
      ? { monitorModel: requireTrimmedNonEmptyString(display.monitorModel, 'display.monitorModel') }
      : {}),
    ...(display.nativeW !== undefined ? { nativeW: requirePositiveInteger(display.nativeW, 'display.nativeW') } : {}),
    ...(display.nativeH !== undefined ? { nativeH: requirePositiveInteger(display.nativeH, 'display.nativeH') } : {}),
    ...(display.panelInches !== undefined
      ? { panelInches: requirePositiveFiniteNumber(display.panelInches, 'display.panelInches') }
      : {}),
    ...(display.viewingDistanceCm !== undefined
      ? { viewingDistanceCm: requirePositiveFiniteNumber(display.viewingDistanceCm, 'display.viewingDistanceCm') }
      : {}),
    ...(display.selfReportUncertain !== undefined
      ? { selfReportUncertain: requireBoolean(display.selfReportUncertain, 'display.selfReportUncertain') }
      : {}),
    ...(display.nativeMismatch !== undefined
      ? { nativeMismatch: requireBoolean(display.nativeMismatch, 'display.nativeMismatch') }
      : {}),
  };
}

function requireGateReport(value: unknown): GateReport {
  const gate = requireRecord(value, 'display.gate');
  return {
    pass: requireBoolean(gate.pass, 'display.gate.pass'),
    native: requireBoolean(gate.native, 'display.gate.native'),
    fullscreen: requireBoolean(gate.fullscreen, 'display.gate.fullscreen'),
    perf: requireBoolean(gate.perf, 'display.gate.perf'),
    details: requireNonEmptyString(gate.details, 'display.gate.details'),
  };
}

function requireFrameLogExport(value: unknown): FrameLogExport {
  const frames = requireRecord(value, 'frames');
  const rawSeries = frames.series;
  if (!Array.isArray(rawSeries)) throw new Error('frames.series must be an array');
  const series = rawSeries.map((delta, index) => requireNonNegativeFiniteNumber(delta, `frames.series[${index}]`));
  const summaryRecord = requireRecord(frames.summary, 'frames.summary');
  const summary = {
    count: requireNonNegativeInteger(summaryRecord.count, 'frames.summary.count'),
    p50: requireNonNegativeFiniteNumber(summaryRecord.p50, 'frames.summary.p50'),
    p95: requireNonNegativeFiniteNumber(summaryRecord.p95, 'frames.summary.p95'),
    p99: requireNonNegativeFiniteNumber(summaryRecord.p99, 'frames.summary.p99'),
    overBudgetWindows: requireNonNegativeInteger(
      summaryRecord.overBudgetWindows,
      'frames.summary.overBudgetWindows',
    ),
    overflow: requireBoolean(summaryRecord.overflow, 'frames.summary.overflow'),
  };
  if (summary.count !== series.length) throw new Error('frames.summary.count must match frames.series length');
  return { series, summary };
}

function requireSceneMeta(value: SceneMeta): SceneMeta {
  const scene = requireRecord(value, 'scene');
  return {
    sceneId: requireNonEmptyString(scene.sceneId, 'scene.sceneId'),
    assetPackVersion: requireNonEmptyString(scene.assetPackVersion, 'scene.assetPackVersion'),
    clutterTier: requireClutterTier(scene.clutterTier, 'scene.clutterTier'),
    fallback: requireBoolean(scene.fallback, 'scene.fallback'),
    ...(scene.eye !== undefined ? { eye: requireEyeWorldBase(scene.eye) } : {}),
  };
}

function requireEyeWorldBase(value: unknown): NonNullable<SceneMeta['eye']> {
  const eye = requireRecord(value, 'scene.eye');
  return {
    x: requireFiniteNumber(eye.x, 'scene.eye.x'),
    y: requireFiniteNumber(eye.y, 'scene.eye.y'),
    z: requireFiniteNumber(eye.z, 'scene.eye.z'),
  };
}

function requireValidity(value: unknown): NonNullable<Meta['validity']> {
  const validity = requireRecord(value, 'validity');
  return {
    corridorExceeded: requireBoolean(validity.corridorExceeded, 'validity.corridorExceeded'),
    perfFloor: requireBoolean(validity.perfFloor, 'validity.perfFloor'),
    recorderOverflow: requireBoolean(validity.recorderOverflow, 'validity.recorderOverflow'),
    bufferOverflow: requireBoolean(validity.bufferOverflow, 'validity.bufferOverflow'),
  };
}

function requireSessionMeta(value: unknown): SessionMeta {
  const session = requireRecord(value, 'session');
  return {
    participantId: requireTrimmedNonEmptyString(session.participantId, 'session.participantId'),
    ...(session.sessionLabel !== undefined
      ? { sessionLabel: requireTrimmedNonEmptyString(session.sessionLabel, 'session.sessionLabel') }
      : {}),
  };
}

function requireProtocolMeta(value: unknown): ProtocolMeta {
  const protocol = requireRecord(value, 'protocol');
  return {
    protocolId: requireTrimmedNonEmptyString(protocol.protocolId, 'protocol.protocolId'),
    conditionIndex: requireNonNegativeInteger(protocol.conditionIndex, 'protocol.conditionIndex'),
    conditionLabel: requireTrimmedNonEmptyString(protocol.conditionLabel, 'protocol.conditionLabel'),
  };
}

export async function measureDisplayHz(options: MeasureDisplayHzOptions = {}): Promise<number> {
  return (await measureDisplayRefresh(options)).refreshEstimateHz;
}

export async function measureDisplayRefresh(options: MeasureDisplayHzOptions = {}): Promise<DisplayRefreshEstimate> {
  const samples = requireNonNegativeInteger(options.samples ?? 120, 'samples');
  const warmupSamples = requireNonNegativeInteger(options.warmupSamples ?? 30, 'warmupSamples');
  if (samples < 2) throw new Error('samples must be at least 2');

  const requestAnimationFrame =
    options.requestAnimationFrame === undefined
      ? globalThis.requestAnimationFrame?.bind(globalThis)
      : options.requestAnimationFrame;
  if (!requestAnimationFrame) throw new Error('requestAnimationFrame is not available');

  const timestamps: number[] = [];
  while (timestamps.length < warmupSamples + samples + 1) {
    timestamps.push(await nextAnimationFrame(requestAnimationFrame));
  }

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const delta = timestamps[i] - timestamps[i - 1];
    if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
  }
  const measured = intervals.slice(warmupSamples, warmupSamples + samples);
  if (measured.length === 0) throw new Error('displayHz could not be measured');

  measured.sort((a, b) => a - b);
  const mid = Math.floor(measured.length / 2);
  const medianMs =
    measured.length % 2 === 0 ? (measured[mid - 1] + measured[mid]) / 2 : measured[mid];
  return {
    refreshEstimateHz: Math.round(1000 / medianMs),
    medianDeltaMs: medianMs,
  };
}

function nextAnimationFrame(
  requestAnimationFrame: (callback: FrameRequestCallback) => number,
): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((time) => resolve(time));
  });
}

function requireBackend(value: RenderBackend): RenderBackend {
  if (value !== 'webgpu' && value !== 'webgl2') throw new Error('backend must be webgpu or webgl2');
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value;
}

function requireTrimmedNonEmptyString(value: unknown, name: string): string {
  return requireNonEmptyString(value, name).trim();
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireClutterTier(value: unknown, name: string): SceneMeta['clutterTier'] {
  if (value !== 'low' && value !== 'mid' && value !== 'high') {
    throw new Error(`${name} must be low, mid, or high`);
  }
  return value;
}

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function requireNonNegativeFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function normalizeOverflow(value: boolean | number, name: string): boolean {
  if (typeof value === 'boolean') return value;
  return requireNonNegativeInteger(value, name) > 0;
}

function normalizeStartedAt(value: string | Date | undefined): string {
  if (value === undefined) return new Date().toISOString();
  const iso = value instanceof Date ? value.toISOString() : value;
  if (typeof iso !== 'string' || Number.isNaN(Date.parse(iso))) {
    throw new Error('startedAt must be an ISO-compatible date string');
  }
  return iso;
}
