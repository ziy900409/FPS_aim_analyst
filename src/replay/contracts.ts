import type { TargetHitboxConfig } from '../drill/DrillConfig.ts';

/**
 * WP-50 / T1 — replay support/capability contracts (README §2.4).
 *
 * Pure type definitions only; no DOM/Three/fs/wall-clock. `invalid` is reserved for payloads that
 * fail `parseExportPayload` (a schema-level failure) — `classifyReplaySupport` (replayCompatibility.ts)
 * only ever produces `full`/`partial`/`unsupported` for an already-parsed `ExportPayload` (README §2.4
 * classification order: strict parse → timeline structural validation → profile/capability check).
 */
export type ReplaySupportStatus = 'full' | 'partial' | 'unsupported' | 'invalid';

/**
 * Capabilities gate-able for the current official Assessment roster (D-50-P6): recoil/camera punch,
 * ADS, and shot/hit cue are all derivable from existing v2 fields and are therefore always available
 * once the timeline itself is trustworthy — they are still modeled explicitly so `ReplaySupport`
 * stays a complete, future-proof contract (a later drill family could genuinely lack one of them).
 * `projectile-visuals` deliberately excluded from this union (D-50-P6/D-50-P7): no registered exact
 * profile requires it, and none of the 6 official Assessment drills use a projectile weapon.
 */
export type ReplayCapability = 'camera' | 'target-lifecycle' | 'ads' | 'shot-hit-cue' | 'scene';

export interface ReplaySupport {
  readonly status: ReplaySupportStatus;
  readonly available: readonly ReplayCapability[];
  readonly missing: readonly ReplayCapability[];
  /** Stable order (registration order, not discovery order) for a given payload — never re-sorted per call. */
  readonly reasonCodes: readonly string[];
  readonly profileVersion?: string;
}

/**
 * One exact-`drillId` replay profile (README §2.4 — no family/prefix fallback). `sceneId`, when
 * present, is the scene the profile expects; a mismatch against the payload's `meta.scene.sceneId`
 * is a structural profile violation (not merely an asset-version drift, which is D-50-P11's
 * softer "partial + banner" case) and is left to a later task once scene loading (T3) exists.
 */
export interface ReplayProfile {
  readonly drillId: string;
  readonly version: string;
  readonly requiredForFull: readonly ReplayCapability[];
  readonly minimumPlayable: readonly ReplayCapability[];
  readonly sceneId?: string;
}

/**
 * WP-50 / T2 — pure playback-domain contracts (README §2.5/2.6). No DOM/Three/fs/wall-clock/random
 * import anywhere below (README §2.1 replay domain purity rule) — Three.js mapping only happens in
 * a later render adapter (T3/T4), which consumes `ReplaySample` and never this module.
 */

/** Pass-through of `Meta.scene` (README §2.5) — scene *loading* is a later task's concern (T3); T2
 * only carries the descriptor through normalization so nothing needs to re-read the raw payload. */
export interface ReplaySceneDescriptor {
  readonly sceneId?: string;
  readonly assetPackVersion?: string;
  readonly clutterTier?: 'low' | 'mid' | 'high';
  readonly fallback: boolean;
  readonly eye?: { readonly x: number; readonly y: number; readonly z: number };
}

/** One recorded tick, time-normalized to the recording's own origin (README §2.3 — `t` unit is the
 * measurement-clock-domain ms already used by `TickRecord.t`/`tickEndMs`, not a new unit). */
export interface NormalizedReplayTick {
  readonly timeMs: number;
  readonly px: number;
  readonly pz: number;
  readonly vx: number;
  readonly vz: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly keys: readonly ('A' | 'D' | 'W' | 'S')[];
  readonly ads: boolean;
  /** `null` = no active target on this tick (D-50-P6/P8 scalar-target contract, same sentinel as `tx`). */
  readonly targetId: string | null;
  readonly tx: number | null;
  readonly ty: number | null;
  readonly tz: number | null;
}

/** One recorded event, time-normalized and carried verbatim (README §2.5 — events are queried, never
 * reshaped; kind-specific fields stay on `raw`). `sourceIndex` is the original `payload.events` array
 * position, preserved as the stable tiebreak for duplicate `timeMs` (README §2.5 "stable source-order"). */
export interface NormalizedReplayEvent {
  readonly timeMs: number;
  readonly sourceIndex: number;
  readonly raw: DrillEventLike;
}

/** Structural alias so this module never imports `DataRecorder.ts` (README §2.1 keeps replay domain
 * files decoupled from the recorder's own module graph); shape matches `DrillEvent` exactly. */
export type DrillEventLike = { readonly type: string; readonly t: number } & Record<string, unknown>;

export interface ReplayRecording {
  readonly runId?: string;
  readonly drillId: string;
  readonly durationMs: number;
  readonly support: ReplaySupport;
  readonly ticks: readonly NormalizedReplayTick[];
  readonly tickTimes: Float64Array;
  readonly events: readonly NormalizedReplayEvent[];
  readonly eventTimes: Float64Array;
  readonly scene?: ReplaySceneDescriptor;
  /** Pass-through of `Meta.weaponId` (always present) — WP-50 / T4 (README §2.7 step 2): the sole
   * input `getWeapon()` needs to resolve the recoil table / ADS optics for camera punch and FOV
   * replay (`replayRecoil.ts`). Meta's own `weapon?: WeaponMeta` (ads/bullet) is intentionally not
   * duplicated here — `getWeapon(weaponId)` already returns the same config the run used. */
  readonly weaponId: string;
  /** Pass-through of `Meta.targets?.hitbox` (single-source geometry, GD-7) — absent on legacy
   * exports; `ReplayTargetView` resolves the same `DEFAULT_TARGET_HITBOX` fallback `resolveTargetHitbox`
   * uses live, so both paths agree without a second hitbox constant (WP-50 / T4). */
  readonly targetHitbox?: TargetHitboxConfig;
  /** Pass-through of `Meta.fovDeg` (hip FOV, KI-005) — absent on pre-KI-005 exports; falls back to
   * the recorded scene's own `fovDeg` (same fallback `SceneManager`'s live camera default uses). */
  readonly hipFovDeg?: number;
}

export interface ReplayCameraState {
  readonly yaw: number;
  readonly pitch: number;
}

export interface ReplayPlayerState {
  readonly px: number;
  readonly pz: number;
  /** `hypot(vx, vz)` at the left (at-or-before) tick — not interpolated (README §2.5: velocity is a
   * discrete per-tick measurement, grouped with keys/ADS, not a continuously-sampled quantity). */
  readonly speed: number;
}

export interface ReplayInputState {
  readonly keys: readonly ('A' | 'D' | 'W' | 'S')[];
  readonly ads: boolean;
}

export interface ReplayTargetState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A short-lived event window that is "active" at the sampled time (README §2.5 "cue/shot/impact 等
 * 短效視覺由 `eventTime <= t < eventTime + fixedDuration` 純查詢"). T2 owns one generic window shared
 * by every event kind; a later view adapter (T4) may layer kind-specific durations on top without
 * touching this pure query. */
export interface ReplayEffectState {
  readonly event: NormalizedReplayEvent;
}

export interface ReplaySample {
  readonly timeMs: number;
  readonly tickBefore: number;
  readonly tickAfter: number;
  readonly alpha: number;
  readonly camera: ReplayCameraState;
  readonly player: ReplayPlayerState;
  readonly input: ReplayInputState;
  readonly targets: readonly ReplayTargetState[];
  readonly effects: readonly ReplayEffectState[];
  /** Index into `recording.events` of the latest event at-or-before `timeMs`; `-1` if none. */
  readonly eventCursor: number;
}

export type ReplayRate = 0.25 | 0.5 | 1 | 2;

export type ReplayPlaybackState =
  | { readonly status: 'paused'; readonly timeMs: number; readonly rate: ReplayRate }
  | { readonly status: 'playing'; readonly timeMs: number; readonly rate: ReplayRate }
  | { readonly status: 'ended'; readonly timeMs: number; readonly rate: ReplayRate };

export interface ReplayPlayer {
  readonly state: ReplayPlaybackState;
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setRate(rate: ReplayRate): void;
  frame(nowMs: number): ReplaySample;
  previousEvent(): void;
  nextEvent(): void;
  dispose(): void;
}
