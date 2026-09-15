import type { ExportPayload } from '../data/export.ts';
import { HistoryClientError } from './HistoryClient.ts';
import type { HistoryClient } from './HistoryClient.ts';
import type { HistoryRunSummary } from './contracts.ts';

/**
 * Save/retry state machine wrapping `HistoryClient` (WP-48 T4, README §2.4). Isolates `main.ts`
 * (T5) from HTTP detail: it never sees a fetch promise, only these five states. Practice payloads
 * short-circuit to `excluded` without ever calling the client (D-48.P7 client-side half of the
 * Assessment-only policy); the repository/API remain the second line of defense.
 */

/**
 * WP-69 / T4 — `invalid-attempt` is the **second** line of defense, not the first (README §2.4
 * "Defense in depth"). `main.ts` already refuses to call `save()` for an attempt the
 * `AttemptFinalizationGate` did not mark `savesHistory`. This check exists for the day a sixth
 * caller is added and forgets that: a payload that self-describes `meta.validity.pauseOccurred`
 * must never reach `HistoryClient.saveRun()`, whoever asked (FR-69.8 / FM-2).
 *
 * It reads the **payload**, not app state, for the same reason `showResultAndTrackHistory()` does:
 * the payload is the durable record of what that run actually was, and it is the only thing a
 * mis-wired future caller would still be holding.
 */
export type HistorySaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'excluded'; readonly reason: 'practice' | 'invalid-attempt' }
  | { readonly kind: 'saving'; readonly runKey: string }
  | { readonly kind: 'saved'; readonly run: HistoryRunSummary; readonly disposition: 'created' | 'existing' }
  | { readonly kind: 'failed'; readonly message: string; readonly retryable: boolean };

export interface HistoryPersistence {
  readonly state: HistorySaveState;
  save(payload: ExportPayload): Promise<HistorySaveState>;
  retry(): Promise<HistorySaveState>;
  subscribe(listener: (state: HistorySaveState) => void): () => void;
}

function runKeyFor(payload: ExportPayload): string {
  return `${payload.meta.session?.participantId ?? 'unknown'}/${payload.meta.drillId}/${payload.meta.startedAt}`;
}

export function createHistoryPersistence(client: HistoryClient): HistoryPersistence {
  let state: HistorySaveState = { kind: 'idle' };
  // Bumped on every save() call so a late-resolving older attempt can detect it has been
  // superseded by a newer run and must not overwrite that newer run's state (README §2.4).
  let generation = 0;
  // Only ever the payload from the most recent Assessment save() call — a Practice save() or a
  // newer Assessment save() immediately replaces it, so retry() can't reuse a stale target.
  let lastAssessmentPayload: ExportPayload | undefined;
  const listeners = new Set<(next: HistorySaveState) => void>();

  function setState(next: HistorySaveState): void {
    state = next;
    for (const listener of listeners) listener(next);
  }

  async function performSave(payload: ExportPayload, myGeneration: number): Promise<HistorySaveState> {
    let result: HistorySaveState;
    try {
      const saved = await client.saveRun(payload);
      result =
        saved.disposition === 'conflict'
          ? {
              kind: 'failed',
              message: `a run with the same identity but different content already exists (runId ${saved.runId})`,
              retryable: false,
            }
          : { kind: 'saved', run: saved.run, disposition: saved.disposition };
    } catch (error) {
      result =
        error instanceof HistoryClientError
          ? { kind: 'failed', message: error.message, retryable: error.retryable }
          : { kind: 'failed', message: error instanceof Error ? error.message : 'save failed', retryable: false };
    }
    // A newer save() (or retry()) started while this one was in flight — that call already owns
    // `state`/`lastAssessmentPayload`; this stale result must not clobber it (FM: "run A save
    // resolves later than run B → run A must not overwrite run B's state").
    if (myGeneration === generation) setState(result);
    return result;
  }

  function save(payload: ExportPayload): Promise<HistorySaveState> {
    generation += 1;
    const myGeneration = generation;

    // Checked before the practice short-circuit so the reported reason names the harder rule
    // whenever it applies: "this attempt was paused" outranks "this was practice" as an
    // explanation, and an operator reading the status should see the one that would still hold if
    // the run had been an Assessment.
    if (payload.meta.validity?.pauseOccurred === true) {
      // Cleared as well, so `retry()` cannot resurrect a paused attempt through the back door.
      lastAssessmentPayload = undefined;
      const next: HistorySaveState = { kind: 'excluded', reason: 'invalid-attempt' };
      setState(next);
      return Promise.resolve(next);
    }

    if (payload.meta.assessment === undefined) {
      lastAssessmentPayload = undefined;
      const next: HistorySaveState = { kind: 'excluded', reason: 'practice' };
      setState(next);
      return Promise.resolve(next);
    }

    lastAssessmentPayload = payload;
    setState({ kind: 'saving', runKey: runKeyFor(payload) });
    return performSave(payload, myGeneration);
  }

  function retry(): Promise<HistorySaveState> {
    if (state.kind !== 'failed' || lastAssessmentPayload === undefined) {
      return Promise.resolve(state);
    }
    return save(lastAssessmentPayload);
  }

  function subscribe(listener: (next: HistorySaveState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    get state() {
      return state;
    },
    save,
    retry,
    subscribe,
  };
}
