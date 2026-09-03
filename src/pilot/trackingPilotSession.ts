import type { DrillConfig } from '../drill/DrillConfig.ts';
import type { ExportPayload } from '../data/export.ts';
import {
  buildTrackingPilotManifest,
  type TrackingPilotManifest,
} from '../session/trackingPilotManifest.ts';
import {
  createTrackingPilotRunner,
  type TrackingPilotRunnerHandle,
  type TrackingPilotRunnerPhase,
} from '../session/TrackingPilotRunner.ts';
import {
  createTrackingPilotOperatorScreen,
  type TrackingPilotOperatorScreenHandle,
} from '../ui/TrackingPilotOperatorScreen.ts';

/**
 * trackingPilotSession — WP-54 / T6 slice 1: the app-level wiring that joins T5's
 * `createTrackingPilotRunner()` (phase state machine) and `createTrackingPilotOperatorScreen()`
 * (DOM overlay) to the *real* `src/main.ts` drill-load/export path, replacing the fake-stub
 * `trackingPilotOperatorHarness.ts` used for T5's keyboard walkthrough (D-54.27 scoped this
 * integration to T6).
 *
 * It exists as its own module rather than inline in `main.ts` because `main.ts` has no test
 * coverage (CodeGraph blast radius: "no covering tests found") while the phase↔screen visibility
 * rule and the drill-ended→`completeCurrentBlock()` handoff below are real logic worth locking
 * down. `main.ts` therefore keeps only thin adapters (same shape as its existing
 * `createAppProtocolRunner()`): a real `loadDrillConfig`, a real `exportBlock`, a real download.
 *
 * Deliberately NOT changed here (T6 slice 1 scope): the manifest/runner/operator-screen contracts
 * and every pilot `DrillConfig` stay byte-for-byte as T5 delivered them.
 */

export interface TrackingPilotSessionDeps {
  /** Loads a resolved pilot `DrillConfig` into the live app (real clearance/TargetManager/SimLoop
   * path). Blocks are addressed by config, not drillId — a session-1 scored block is an
   * alternate-seed clone that no `availableDrills` entry declares (D-54.26). */
  readonly loadDrillConfig: (config: DrillConfig) => Promise<void>;
  /** Assembles the real `ExportPayload` for the block that just ran — `main.ts` passes its
   * existing `buildCurrentExportPayload()` so pilot exports share one assembly path with
   * ProtocolRunner/SessionRunner exports (no second export route). */
  readonly exportBlock: () => Promise<ExportPayload>;
  /** Called once per exported block so the operator ends up with the run's JSON on disk. */
  readonly onBlockExported: (payload: ExportPayload) => void;
  /** Operator-facing status line owned by the app (`main.ts` renders it in `#protocol-status`). */
  readonly onStatus: (text: string) => void;
  /** Fired when a manifest is built and about to start — `main.ts` uses it to route
   * participantId/counterbalance cell into `meta.session` so every block export is traceable to
   * the participant and manifest that produced it. */
  readonly onManifestStart?: (manifest: TrackingPilotManifest) => void;
  readonly parent?: HTMLElement;
}

export interface TrackingPilotSessionHandle {
  /** Shows the operator screen (researcher-mode entry point). */
  open(): void;
  /** Driven from the render loop, exactly like `SessionRunner.poll()` — advances rest countdowns. */
  poll(nowMs: number): void;
  /**
   * Called when the live drill reaches `ended`. Returns `true` when a pilot block owned that run
   * (and its export/quality evaluation has been kicked off), so the caller can skip its own
   * session-plan/protocol completion branches.
   */
  handleDrillEnded(): boolean;
  readonly runner: TrackingPilotRunnerHandle;
  readonly screen: TrackingPilotOperatorScreenHandle;
  dispose(): void;
}

export function createTrackingPilotSession(deps: TrackingPilotSessionDeps): TrackingPilotSessionHandle {
  let opened = false;

  function setStatus(text: string): void {
    screen.setStatus(text);
    deps.onStatus(text);
  }

  function reportFailure(prefix: string, error: unknown): void {
    setStatus(`${prefix}：${error instanceof Error ? error.message : String(error)}`);
  }

  const runner = createTrackingPilotRunner({
    loadDrillConfig: deps.loadDrillConfig,
    exportBlock: deps.exportBlock,
    onStatus: setStatus,
    onPhaseChange: (phase) => {
      screen.renderPhase(phase);
      syncScreenVisibility(phase);
    },
    onBlockRecord: (record) => {
      screen.renderRecords(runner.records);
      // Aborted blocks carry no payload by design (nothing was exported) — only completed ones.
      if (record.payload !== undefined) deps.onBlockExported(record.payload);
    },
  });

  const screen = createTrackingPilotOperatorScreen({
    ...(deps.parent !== undefined ? { parent: deps.parent } : {}),
    onStartManifest: (participantId, sessionIndex, restSeconds) => {
      let manifest: TrackingPilotManifest;
      try {
        manifest = buildTrackingPilotManifest(participantId, sessionIndex, restSeconds);
      } catch (error) {
        reportFailure('Manifest 建立失敗', error);
        return;
      }
      deps.onManifestStart?.(manifest);
      void runner.start(manifest).catch((error: unknown) => reportFailure('Manifest 啟動失敗', error));
    },
    onCompleteBlock: () => {
      void runner.completeCurrentBlock().catch((error: unknown) => reportFailure('Block 匯出失敗', error));
    },
    onRetryBlock: (reason) => {
      void runner.retryCurrentBlock(reason).catch((error: unknown) => reportFailure('Block 重跑失敗', error));
    },
    onAbortBlock: (reason) => {
      void runner.abortCurrentBlock(reason).catch((error: unknown) => reportFailure('Block 中止失敗', error));
    },
    onAdvance: () => {
      void runner.advance().catch((error: unknown) => reportFailure('進入下一個 block 失敗', error));
    },
  });

  /**
   * The operator overlay is a full-viewport scrim (`TrackingPilotOperatorScreen`'s `overlayCss`),
   * so it must step aside while a block is actually being played — otherwise the participant
   * cannot see the target. Same precedent as `main.ts`'s existing `restOverlay`, which
   * `SessionRunner`'s `onPhaseChange` shows during rest and hides during play; here the polarity
   * is simply inverted (the pilot's rest countdown lives *inside* the operator screen).
   */
  function syncScreenVisibility(phase: TrackingPilotRunnerPhase): void {
    if (!opened) return;
    if (phase.kind === 'running') screen.close();
    else screen.open();
  }

  return {
    open(): void {
      opened = true;
      screen.open();
      syncScreenVisibility(runner.phase);
    },
    poll(nowMs): void {
      runner.poll(nowMs);
    },
    handleDrillEnded(): boolean {
      if (runner.phase.kind !== 'running') return false;
      void runner.completeCurrentBlock().catch((error: unknown) => reportFailure('Block 匯出失敗', error));
      return true;
    },
    runner,
    screen,
    dispose(): void {
      opened = false;
      runner.dispose();
      screen.dispose();
    },
  };
}
