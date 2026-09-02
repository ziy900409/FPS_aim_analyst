import type { ExportPayload } from '../data/export.ts';
import { buildTrackingPilotManifest } from '../session/trackingPilotManifest.ts';
import { createTrackingPilotRunner } from '../session/TrackingPilotRunner.ts';
import type { TrackingRunEligibility } from './trackingRunEligibility.ts';
import { createTrackingPilotOperatorScreen } from '../ui/TrackingPilotOperatorScreen.ts';

/**
 * Dev-only harness for WP-54 T5's operator screen — served at `/tracking-pilot-harness.html`,
 * never imported by `src/main.ts` / the production bundle. Wires the real
 * `createTrackingPilotRunner()`/`createTrackingPilotOperatorScreen()` modules (slices 2/3)
 * together with a fake `loadDrillConfig`/`exportBlock` (no 3-loop sim runtime here) so the
 * screen's keyboard-only/status-text flow can be driven in a real browser — see
 * `tests/e2e/tracking-pilot-operator.spec.ts`. Wiring the real runner + screen into the live app
 * (real `DrillConfig` loading through `main.ts`, a real `ExportPayload` from an actual drill run)
 * is T6 "Instrumentation pilot" scope (README §4 T6 — real testers running real blocks), not
 * duplicated here; this harness exists only to prove the operator UI mechanism itself.
 */

let exportCount = 0;
const FAKE_PAYLOAD = {} as ExportPayload;

// Alternates eligible/blocked so a keyboard walkthrough can exercise both the "Continue" and the
// "Retry block" paths without needing a real ExportPayload.
function fakeEvaluateEligibility(): TrackingRunEligibility {
  exportCount += 1;
  return exportCount % 2 === 0
    ? { status: 'blocked', reasons: ['insufficient-scored-coverage'] }
    : { status: 'eligible', validScoredTicks: 3200, durationMs: 25000 };
}

const runner = createTrackingPilotRunner({
  loadDrillConfig: async () => {},
  exportBlock: async () => FAKE_PAYLOAD,
  evaluateEligibility: fakeEvaluateEligibility,
  onStatus: (text) => screen.setStatus(text),
  onPhaseChange: (phase) => screen.renderPhase(phase),
  onBlockRecord: () => screen.renderRecords(runner.records),
});

const screen = createTrackingPilotOperatorScreen({
  onStartManifest: (participantId, sessionIndex, restSeconds) => {
    const manifest = buildTrackingPilotManifest(participantId, sessionIndex, restSeconds);
    void runner.start(manifest);
  },
  onCompleteBlock: () => void runner.completeCurrentBlock(),
  onRetryBlock: (reason) => void runner.retryCurrentBlock(reason),
  onAbortBlock: (reason) => void runner.abortCurrentBlock(reason),
  onAdvance: () => void runner.advance(),
});
screen.open();

// Real main.ts drives SessionRunner.poll() from its render loop; this harness has no render
// loop, so a small interval stands in for it — the rest countdown otherwise never advances.
setInterval(() => runner.poll(performance.now()), 100);

declare global {
  interface Window {
    __trackingPilotHarnessReady?: boolean;
  }
}
window.__trackingPilotHarnessReady = true;
