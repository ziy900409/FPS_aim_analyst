import type { ExportPayload } from '../data/export.ts';
import type { ReplayCapability, ReplayProfile, ReplaySupport, ReplaySupportStatus } from './contracts.ts';

/**
 * WP-50 / T1 — exact-`drillId` replay profile registry (README §2.4/D-50-P7). No family/prefix
 * fallback (FR-50.1): an unregistered `drillId` is always `unsupported`, never inferred from a
 * near-miss name. All 6 official Assessment exact IDs currently need the identical capability set
 * for `full` — D-50-P6 excluded per-tick camera/recoil capture and projectile visuals from scope
 * for every one of them — but the registry stays keyed per drillId (not a single shared constant)
 * so a future drill with different requirements (e.g. a projectile weapon) can register its own
 * profile without disturbing this one (README §3.2 conscious debt #1).
 */
const OFFICIAL_REPLAY_PROFILES: readonly ReplayProfile[] = [
  'hold_click_v1',
  'hold_track_v1',
  'spider-shot-v1',
  'spider-shot-v2',
  'counterstrafe-cued-v1',
  'counterstrafe-reversal-v1',
].map((drillId) => ({
  drillId,
  version: '1',
  requiredForFull: ['camera', 'target-lifecycle', 'ads', 'shot-hit-cue', 'scene'],
  // D-50-P10: only the absence of a trustworthy camera/player timeline makes a run unsupported —
  // everything else (missing target-lifecycle capture, missing/mismatched scene metadata) degrades
  // to a limited "partial" replay with a persistent capability-gap banner, never a hard block.
  minimumPlayable: ['camera'],
}));

const PROFILE_BY_DRILL_ID: ReadonlyMap<string, ReplayProfile> = new Map(
  OFFICIAL_REPLAY_PROFILES.map((profile) => [profile.drillId, profile]),
);

export function replayProfileForExactDrill(drillId: string): ReplayProfile | undefined {
  return PROFILE_BY_DRILL_ID.get(drillId);
}

/**
 * Fixed registration order for `ReplaySupport.reasonCodes` (README §2.4: "相同 payload 輸出相同
 * stable reason order"). Codes are filtered from this list, never re-sorted per payload.
 */
const REASON_ORDER = [
  'UNKNOWN_EXACT_DRILL',
  'EMPTY_TICKS',
  'NON_MONOTONIC_TICKS',
  'RECORDER_OVERFLOW',
  'REPLAY_CONTRACT_MISMATCH',
  'LEGACY_REPLAY_FIELDS_MISSING',
  'SCENE_METADATA_MISSING',
] as const;

function isMonotonicTimeline(ticks: ExportPayload['ticks']): boolean {
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i].t < ticks[i - 1].t) return false;
  }
  return true;
}

/**
 * WP-50 / T1 — pure `full`/`partial`/`unsupported` classifier for an already-parsed `ExportPayload`
 * (README §2.4 classification order: strict parse → timeline structural validation → exact profile
 * lookup → advertised/observed capabilities → overflow check). `invalid` (schema-level failure) is
 * the caller's concern via `parseExportPayload`'s own result, not this function's.
 *
 * No DOM/Three/fs/wall-clock; the same payload always yields the same `ReplaySupport` (stable
 * reason order, no randomness, no ambient state).
 */
export function classifyReplaySupport(payload: ExportPayload): ReplaySupport {
  const reasons = new Set<string>();

  const hasTicks = payload.ticks.length > 0;
  if (!hasTicks) reasons.add('EMPTY_TICKS');
  else if (!isMonotonicTimeline(payload.ticks)) reasons.add('NON_MONOTONIC_TICKS');
  const hasTrustworthyCamera = hasTicks && !reasons.has('NON_MONOTONIC_TICKS');

  const profile = replayProfileForExactDrill(payload.meta.drillId);
  if (profile === undefined) reasons.add('UNKNOWN_EXACT_DRILL');

  if (payload.meta.recorderOverflow) reasons.add('RECORDER_OVERFLOW');

  // target-lifecycle: advertised-but-missing data is a contract mismatch, never `full`
  // (README §2.3 backward-compat rule) — distinct from a plain pre-replay legacy export.
  const declaresReplay = payload.meta.replay?.replaySchemaVersion === 1;
  let hasTargetLifecycle = false;
  if (!hasTicks) {
    if (!declaresReplay) reasons.add('LEGACY_REPLAY_FIELDS_MISSING');
  } else if (declaresReplay) {
    const contractHonored = payload.ticks.every((tick) => tick.tx === null || typeof tick.replayTargetId === 'string');
    if (contractHonored) hasTargetLifecycle = true;
    else reasons.add('REPLAY_CONTRACT_MISMATCH');
  } else {
    reasons.add('LEGACY_REPLAY_FIELDS_MISSING');
  }

  const hasScene = payload.meta.scene !== undefined;
  if (!hasScene) reasons.add('SCENE_METADATA_MISSING');

  const available: ReplayCapability[] = [];
  const missing: ReplayCapability[] = [];
  (hasTrustworthyCamera ? available : missing).push('camera');
  // ads/shot-hit-cue are core v2 fields (ticks[].ads, DrillEvent fire/hit) — always structurally
  // present once the payload has passed parseExportPayload, so they never gate any of these profiles.
  available.push('ads', 'shot-hit-cue');
  (hasTargetLifecycle ? available : missing).push('target-lifecycle');
  (hasScene ? available : missing).push('scene');

  const status = classifyStatus(profile, hasTrustworthyCamera, missing, payload.meta.recorderOverflow);

  return {
    status,
    available,
    missing,
    reasonCodes: REASON_ORDER.filter((code) => reasons.has(code)),
    ...(profile !== undefined ? { profileVersion: profile.version } : {}),
  };
}

function classifyStatus(
  profile: ReplayProfile | undefined,
  hasTrustworthyCamera: boolean,
  missing: readonly ReplayCapability[],
  recorderOverflow: boolean,
): ReplaySupportStatus {
  if (!hasTrustworthyCamera || profile === undefined) return 'unsupported';

  const missingForMinimum = profile.minimumPlayable.some((cap) => missing.includes(cap));
  if (missingForMinimum) return 'unsupported';

  const missingForFull = profile.requiredForFull.some((cap) => missing.includes(cap));
  if (missingForFull || recorderOverflow) return 'partial';

  return 'full';
}
