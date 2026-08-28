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
