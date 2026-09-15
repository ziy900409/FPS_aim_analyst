import type { AttemptDisposition } from './RunAttemptController.ts';
import type { RecordingIntegrityReason, RecordingSnapshot } from './recordingIntegrity.ts';

/**
 * WP-69 / T4 — the single place that turns an `AttemptDisposition` into *what the app is allowed to
 * do next* (README §2.4, FR-69.7/69.8/69.9/69.12).
 *
 * `RunAttemptController.finalize()` already answers "which of the three states is this attempt in".
 * That is necessary but not sufficient: the failure mode this WP exists to close (FM-2/FM-6/FM-7)
 * is not a mis-classified attempt, it is a **correctly** classified attempt whose consequences are
 * then re-derived, slightly differently, at each of the five places that act on a finished run —
 * payload build, Result/metrics, download, history save, orchestrator advance. Five hand-written
 * `if (suspect)` branches is five chances to forget one. So the consequences live here, as data:
 * one plan object per disposition, and every caller reads a field instead of re-deciding.
 *
 * This is why the plan is a frozen lookup rather than a function with a branch per caller. Adding a
 * sixth consumer means reading a field, not writing a rule. And the three rows are worth reading as
 * a matrix, because the interesting content is the **asymmetries**:
 *
 *   |                    | payload | metrics | download            | history | replay | advance | clears |
 *   |--------------------|---------|---------|---------------------|---------|--------|---------|--------|
 *   | eligible-candidate | yes     | yes     | official            | yes     | yes    | yes     | no     |
 *   | invalid-retained   | yes     | yes     | diagnostic (manual) | **no**  | **no** | **no**  | no     |
 *   | discarded          | **no**  | **no**  | none                | no      | no     | no      | **yes**|
 *
 *  - `invalid-retained` still builds a payload and still shows metrics: its time axis *is* provable,
 *    so the numbers are real — they are simply **not adoptable**. It is an audit artifact, not a
 *    low-quality result (README §1.3). Hence the download is offered but deliberately **manual**
 *    and deliberately renamed (OQ-69.1 / D-69-T0-3): an operator must choose to keep it, and the
 *    file must never be mistakable for a normal export.
 *  - `discarded` refuses at the *payload* line, not at the save line. That ordering is the whole
 *    point of FM-7: once a payload exists its metrics have already reached the Result screen, the
 *    replay entry and every download helper, and "we simply won't save it" is far too late.
 *  - Only `discarded` clears the recording. An `invalid-retained` arena must survive finalization
 *    precisely so the operator can still press the diagnostic download.
 *
 * `eligible-candidate` grants no acceptance of its own: it means the attempt has earned the right to
 * face the existing eligibility / quality / compatibility gates unchanged. This module loosens none
 * of them.
 *
 * Pure, and kept pure by `architecture.test.ts`: no DOM, no payload type, no history client. It
 * names *kinds* of consequence; `main.ts` owns which concrete function each kind maps to.
 */

/** What a download produced from this attempt is allowed to be. */
export type AttemptDownloadKind =
  /** The normal export, under the normal basename, on the normal (auto or manual) paths. */
  | 'official'
  /** Audit-only JSON, manual action only, basename forced to carry `.invalid-paused`. */
  | 'diagnostic-manual'
  /** No file may be produced at all — there is no payload to produce one from. */
  | 'none';

export interface AttemptFinalizationPlan {
  readonly disposition: AttemptDisposition;
  /** May `buildCurrentExportPayload()` (or any serializer) be called at all? */
  readonly buildsPayload: boolean;
  /** May metrics derived from this recording be shown to the operator? */
  readonly showsMetrics: boolean;
  readonly download: AttemptDownloadKind;
  /** May this reach `HistoryPersistence.save()` / history / trend / threshold? */
  readonly savesHistory: boolean;
  readonly offersReplay: boolean;
  /** May Session / Protocol / Tracking-Pilot move off this step? (T5 consumes this.) */
  readonly advancesOrchestrator: boolean;
  /** Must the recorder arena and frame log be cleared in place? */
  readonly clearsRecording: boolean;
}

const ELIGIBLE: Omit<AttemptFinalizationPlan, 'disposition'> = {
  buildsPayload: true,
  showsMetrics: true,
  download: 'official',
  savesHistory: true,
  offersReplay: true,
  advancesOrchestrator: true,
  clearsRecording: false,
};

const INVALID_RETAINED: Omit<AttemptFinalizationPlan, 'disposition'> = {
  buildsPayload: true,
  showsMetrics: true,
  download: 'diagnostic-manual',
  savesHistory: false,
  offersReplay: false,
  advancesOrchestrator: false,
  clearsRecording: false,
};

const DISCARDED: Omit<AttemptFinalizationPlan, 'disposition'> = {
  buildsPayload: false,
  showsMetrics: false,
  download: 'none',
  savesHistory: false,
  offersReplay: false,
  advancesOrchestrator: false,
  clearsRecording: true,
};

/** Pure `disposition → consequences`. Exported on its own so the matrix is testable without a rig. */
export function planFinalization(disposition: AttemptDisposition): AttemptFinalizationPlan {
  switch (disposition.kind) {
    case 'eligible-candidate':
      return { disposition, ...ELIGIBLE };
    case 'invalid-retained':
      return { disposition, ...INVALID_RETAINED };
    case 'discarded':
      return { disposition, ...DISCARDED };
  }
}

/**
 * The marker every diagnostic export carries. It sits in the *basename*, before the extension the
 * download helper appends, so the file reads `<drill>-<startedAt>.invalid-paused.json`.
 */
export const INVALID_ATTEMPT_BASENAME_MARKER = '.invalid-paused';

/**
 * Idempotent: re-marking an already-marked basename returns it unchanged, so a caller that routes a
 * diagnostic basename through this twice cannot produce `.invalid-paused.invalid-paused`.
 */
export function invalidAttemptBasename(basename: string): string {
  return basename.endsWith(INVALID_ATTEMPT_BASENAME_MARKER)
    ? basename
    : `${basename}${INVALID_ATTEMPT_BASENAME_MARKER}`;
}

/** Operator-facing explanation per frozen reason. Audit text, not a diagnosis of the root cause. */
const DISCARD_REASON_TEXT: Readonly<Record<RecordingIntegrityReason, string>> = {
  'tick-non-finite': 'sim tick 時間戳出現非有限值',
  'tick-regression': 'sim tick 時間戳倒退',
  'tick-step-off-grid': 'sim tick 間隔偏離固定步長',
  'event-non-finite': '事件時間戳出現非有限值',
  'event-out-of-window': '事件時間戳落在本場 tick 範圍之外',
  'event-backward-step-exceeds-tick': '事件時間戳倒退超過一個 tick',
  'pause-fence-unclosed': '暫停區間未閉合（在暫停中結束，或暫停期間時間軸仍前進）',
  'pause-attempt-overflow': '暫停過的這一場發生緩衝區溢位',
};

export function describeDiscardReason(reason: RecordingIntegrityReason): string {
  return DISCARD_REASON_TEXT[reason];
}

/**
 * WP-69 / T5 (FR-69.10) — the one sentence every orchestrator shows when an attempt is **held**.
 *
 * Session, Protocol and Tracking Pilot each have their own status channel, and before this there
 * was nothing stopping the three from explaining the same situation three different ways — or, far
 * worse, from each deciding for itself *whether* this is that situation (the `meta.suspect` failure
 * mode again, C-D4). So the text is derived here, from the same plan its consequences come from:
 * a runner that wants to say something says this, or says nothing.
 *
 * `null` means the attempt advances, i.e. there is nothing to hold and nothing to announce — the
 * clean path's existing status lines stay byte-for-byte as they were (T5 DoD, NFR-69.1).
 *
 * Both held dispositions end in the same instruction because the operator's next action is the
 * same one: only a full restart produces a new eligible candidate (FR-69.6). They differ in what
 * survives, and only there — `invalid-retained` still has an audit file to download from Result,
 * `discarded` has nothing at all, which is why its reason is named.
 */
export function describeAttemptHold(plan: AttemptFinalizationPlan): string | null {
  if (plan.advancesOrchestrator) return null;
  const cause =
    plan.disposition.kind === 'discarded'
      ? `本次紀錄已作廢（${describeDiscardReason(plan.disposition.reason)}）`
      : '本次曾暫停，已失去實驗效力';
  return `${cause}：測試進度停在原處，未計入本項。請按「重新測試」重跑本項。`;
}

/** Only the one method this gate needs from the controller — keeps the rig and the tests honest. */
export interface AttemptFinalizationSource {
  finalize(snapshot: RecordingSnapshot): AttemptDisposition;
}

export interface AttemptFinalizationGate {
  /**
   * The **only** entry point every completion and navigation path may use. Deliberately returns the
   * plan rather than the bare disposition: a caller that receives a plan has nothing left to decide,
   * and therefore nothing left to decide *differently* from its neighbours (C-D4).
   */
  decide(snapshot: RecordingSnapshot): AttemptFinalizationPlan;
}

export function createAttemptFinalizationGate(
  attempt: AttemptFinalizationSource,
): AttemptFinalizationGate {
  return {
    decide(snapshot: RecordingSnapshot): AttemptFinalizationPlan {
      return planFinalization(attempt.finalize(snapshot));
    },
  };
}
