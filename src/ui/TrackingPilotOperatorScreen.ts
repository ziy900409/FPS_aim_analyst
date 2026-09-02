import type { TrackingPilotBlockRunRecord, TrackingPilotRunnerPhase } from '../session/TrackingPilotRunner.ts';

/**
 * TrackingPilotOperatorScreen — WP-54 / T5 (task-checklist T5 "操作端顯示 current block/rest/
 * quality abort，不顯示即時能力分數"、NFR-54-8 "操作員可只用鍵盤完成 pilot 控制，品質與狀態不只靠
 * 顏色表達").
 *
 * Pure TS DOM overlay (D1) — same structural convention as `EligibilityGate.ts`/
 * `SessionPlanSetup.ts`: every control is a native `<button>`/`<input>` (naturally keyboard/Tab
 * operable, no custom click-only `<div>`), every status is expressed as `textContent` (colour is
 * decorative only, never the sole signal), `aria-label`s on every input/button. This module owns
 * no `TrackingPilotRunner` — it is presentational, wired to one by its caller exactly like
 * `SessionPlanSetup`'s `onSubmit` is wired to `SessionRunner` in `main.ts` (`onStartManifest`/
 * `onCompleteBlock`/`onRetryBlock`/`onAbortBlock`/`onAdvance` here play the same role as that
 * `onSubmit`/the runner's own `start`/`advance` calls there).
 *
 * `renderPhase()`/`renderRecords()` never render a capability number (RMS epsilon, TOT%, lag,
 * gain, …) — only the closed `TrackingRunEligibility` reason codes (or "eligible") and structural
 * facts (block index, attempt, tick/duration coverage used for the eligibility gate itself, not a
 * performance measure). That is the literal meaning of "不顯示即時能力分數" here.
 */

export interface TrackingPilotOperatorScreenOptions {
  readonly onStartManifest: (participantId: string, sessionIndex: 0 | 1, restSeconds: number) => void;
  readonly onCompleteBlock: () => void;
  readonly onRetryBlock: (reason: string) => void;
  readonly onAbortBlock: (reason: string) => void;
  readonly onAdvance: () => void;
  readonly parent?: HTMLElement;
}

export interface TrackingPilotOperatorScreenHandle {
  open(): void;
  close(): void;
  setStatus(text: string): void;
  renderPhase(phase: TrackingPilotRunnerPhase): void;
  renderRecords(records: readonly TrackingPilotBlockRunRecord[]): void;
  dispose(): void;
}

type ReasonAction = 'retry' | 'abort';

export function createTrackingPilotOperatorScreen(
  options: TrackingPilotOperatorScreenOptions,
): TrackingPilotOperatorScreenHandle {
  const parent = options.parent ?? document.body;

  const root = document.createElement('section');
  root.id = 'tracking-pilot-operator';
  root.setAttribute('aria-label', 'Tracking pilot operator screen');
  root.style.cssText = overlayCss;
  root.style.display = 'none';

  const card = document.createElement('div');
  card.style.cssText = cardCss;

  const title = document.createElement('h2');
  title.textContent = 'Tracking Pilot — Researcher Session';
  title.style.cssText = headingCss;

  // --- Setup form (participantId / sessionIndex / restSeconds -> start manifest) ---
  const setupForm = document.createElement('form');
  setupForm.setAttribute('aria-label', 'Start tracking pilot manifest');
  setupForm.style.cssText = 'display:grid;gap:10px';

  const participantLabel = document.createElement('label');
  participantLabel.style.cssText = fieldLabelCss;
  const participantText = document.createElement('span');
  participantText.textContent = 'Participant ID';
  const participantInput = document.createElement('input');
  participantInput.type = 'text';
  participantInput.name = 'participantId';
  participantInput.required = true;
  participantInput.style.cssText = inputCss;
  participantLabel.append(participantText, participantInput);

  const sessionIndexLabel = document.createElement('label');
  sessionIndexLabel.style.cssText = fieldLabelCss;
  const sessionIndexText = document.createElement('span');
  sessionIndexText.textContent = 'Session index';
  const sessionIndexSelect = document.createElement('select');
  sessionIndexSelect.name = 'sessionIndex';
  sessionIndexSelect.style.cssText = inputCss;
  for (const value of [0, 1]) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = value === 0 ? '0 (primary seed)' : '1 (alternate seed)';
    sessionIndexSelect.appendChild(option);
  }
  sessionIndexLabel.append(sessionIndexText, sessionIndexSelect);

  const restSecondsLabel = document.createElement('label');
  restSecondsLabel.style.cssText = fieldLabelCss;
  const restSecondsText = document.createElement('span');
  restSecondsText.textContent = 'Rest seconds between blocks';
  const restSecondsInput = document.createElement('input');
  restSecondsInput.type = 'number';
  restSecondsInput.name = 'restSeconds';
  restSecondsInput.min = '0';
  restSecondsInput.step = 'any';
  restSecondsInput.value = '60';
  restSecondsInput.style.cssText = inputCss;
  restSecondsLabel.append(restSecondsText, restSecondsInput);

  const startButton = makeButton('Start manifest', 'Build and start the tracking pilot manifest', 'submit');
  setupForm.append(participantLabel, sessionIndexLabel, restSecondsLabel, startButton);

  setupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const restSeconds = Number(restSecondsInput.value);
    if (participantInput.value.trim() === '' || !Number.isFinite(restSeconds) || restSeconds < 0) {
      setStatus('請填寫 Participant ID 並提供非負的 rest seconds。');
      return;
    }
    const sessionIndex = sessionIndexSelect.value === '1' ? 1 : 0;
    options.onStartManifest(participantInput.value.trim(), sessionIndex, restSeconds);
  });

  // --- Status line (always visible; text, not colour, per NFR-54-8) ---
  const status = document.createElement('p');
  status.id = 'tracking-pilot-status';
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = statusCss;

  // --- Current block panel ---
  const blockPanel = document.createElement('div');
  blockPanel.style.cssText = panelCss;
  blockPanel.style.display = 'none';
  const blockText = document.createElement('p');
  blockText.id = 'tracking-pilot-block-text';
  blockText.style.cssText = panelTextCss;
  const completeBlockButton = makeButton('Complete block', 'Export the current block and evaluate its eligibility');
  const abortBlockButton = makeButton('Abort block', 'Abort the currently running block without exporting');
  const blockButtonRow = document.createElement('div');
  blockButtonRow.style.cssText = 'display:flex;gap:8px';
  blockButtonRow.append(completeBlockButton, abortBlockButton);
  blockPanel.append(blockText, blockButtonRow);

  // --- Quality / block-outcome panel (closed reason codes only, never a capability number) ---
  const outcomePanel = document.createElement('div');
  outcomePanel.style.cssText = panelCss;
  outcomePanel.style.display = 'none';
  const outcomeText = document.createElement('p');
  outcomeText.id = 'tracking-pilot-outcome-text';
  outcomeText.style.cssText = panelTextCss;
  const qualityBanner = document.createElement('div');
  qualityBanner.id = 'tracking-pilot-quality-banner';
  qualityBanner.setAttribute('role', 'alert');
  qualityBanner.style.cssText = qualityBannerCss;
  qualityBanner.style.display = 'none';
  const retryButton = makeButton('Retry block', 'Re-run this block; the prior attempt stays on record');
  const continueButton = makeButton('Continue', 'Accept this block outcome and move on');
  const outcomeButtonRow = document.createElement('div');
  outcomeButtonRow.style.cssText = 'display:flex;gap:8px';
  outcomeButtonRow.append(retryButton, continueButton);
  outcomePanel.append(outcomeText, qualityBanner, outcomeButtonRow);

  // --- Rest panel ---
  const restPanel = document.createElement('div');
  restPanel.style.cssText = panelCss;
  restPanel.style.display = 'none';
  const restText = document.createElement('p');
  restText.id = 'tracking-pilot-rest-text';
  restText.style.cssText = panelTextCss;
  restPanel.append(restText);

  // --- Done panel ---
  const donePanel = document.createElement('div');
  donePanel.style.cssText = panelCss;
  donePanel.style.display = 'none';
  const doneText = document.createElement('p');
  doneText.id = 'tracking-pilot-done-text';
  doneText.style.cssText = panelTextCss;
  doneText.textContent = 'Manifest 完成：所有 block 已結束。';
  donePanel.append(doneText);

  // --- Reason panel (shared by retry/abort — one text input, contextual confirm/cancel) ---
  const reasonPanel = document.createElement('div');
  reasonPanel.style.cssText = panelCss;
  reasonPanel.style.display = 'none';
  const reasonLabel = document.createElement('label');
  reasonLabel.style.cssText = fieldLabelCss;
  const reasonLabelText = document.createElement('span');
  const reasonInput = document.createElement('input');
  reasonInput.type = 'text';
  reasonInput.name = 'reason';
  reasonInput.style.cssText = inputCss;
  reasonLabel.append(reasonLabelText, reasonInput);
  const confirmReasonButton = makeButton('Confirm', 'Confirm this action with the given reason');
  const cancelReasonButton = makeButton('Cancel', 'Cancel and return to the previous panel');
  const reasonButtonRow = document.createElement('div');
  reasonButtonRow.style.cssText = 'display:flex;gap:8px';
  reasonButtonRow.append(confirmReasonButton, cancelReasonButton);
  reasonPanel.append(reasonLabel, reasonButtonRow);
  let pendingReasonAction: ReasonAction | undefined;

  // --- Records log (audit trail; outcome/attempt text, never a capability number) ---
  const recordsHeading = document.createElement('h3');
  recordsHeading.textContent = 'Block log';
  recordsHeading.style.cssText = 'margin:0;font:700 13px/1.3 system-ui,sans-serif;color:#e6e9ec';
  const recordsList = document.createElement('ul');
  recordsList.id = 'tracking-pilot-records-list';
  recordsList.setAttribute('aria-label', 'Completed and aborted block log');
  recordsList.style.cssText = 'margin:0;padding-left:18px;font:500 12px/1.5 system-ui,sans-serif;color:#c7ccd1;max-height:160px;overflow-y:auto';

  card.append(
    title,
    setupForm,
    status,
    blockPanel,
    outcomePanel,
    restPanel,
    donePanel,
    reasonPanel,
    recordsHeading,
    recordsList,
  );
  root.appendChild(card);
  parent.appendChild(root);

  function setStatus(text: string): void {
    status.textContent = text;
  }

  function showReasonPanel(action: ReasonAction): void {
    pendingReasonAction = action;
    reasonInput.value = '';
    reasonLabelText.textContent = action === 'retry' ? 'Retry reason' : 'Abort reason';
    reasonPanel.style.display = 'grid';
    reasonInput.focus();
  }

  function hideReasonPanel(): void {
    pendingReasonAction = undefined;
    reasonPanel.style.display = 'none';
  }

  abortBlockButton.addEventListener('click', () => showReasonPanel('abort'));
  retryButton.addEventListener('click', () => showReasonPanel('retry'));
  cancelReasonButton.addEventListener('click', hideReasonPanel);
  confirmReasonButton.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    if (reason === '') {
      setStatus('請輸入原因後再送出。');
      return;
    }
    const action = pendingReasonAction;
    hideReasonPanel();
    if (action === 'retry') options.onRetryBlock(reason);
    else if (action === 'abort') options.onAbortBlock(reason);
  });
  completeBlockButton.addEventListener('click', () => options.onCompleteBlock());
  continueButton.addEventListener('click', () => options.onAdvance());

  function renderPhase(phase: TrackingPilotRunnerPhase): void {
    blockPanel.style.display = 'none';
    outcomePanel.style.display = 'none';
    restPanel.style.display = 'none';
    donePanel.style.display = 'none';
    hideReasonPanel();

    if (phase.kind === 'running') {
      blockText.textContent =
        `Block ${phase.blockIndex + 1} — role: ${phase.role} — drillId: ${phase.block.drillId} — ` +
        `attempt ${phase.attempt} — seed family: ${phase.block.seedFamily}`;
      blockPanel.style.display = 'grid';
      return;
    }
    if (phase.kind === 'block-outcome') {
      outcomeText.textContent =
        `Block ${phase.blockIndex + 1} outcome — role: ${phase.role} — drillId: ${phase.block.drillId} — attempt ${phase.attempt}`;
      if (phase.eligibility === undefined) {
        qualityBanner.style.display = 'none';
      } else if (phase.eligibility.status === 'eligible') {
        qualityBanner.style.display = 'block';
        qualityBanner.setAttribute('data-quality', 'eligible');
        qualityBanner.textContent = `Eligible — scored ticks: ${phase.eligibility.validScoredTicks}, duration: ${phase.eligibility.durationMs}ms`;
      } else {
        qualityBanner.style.display = 'block';
        qualityBanner.setAttribute('data-quality', 'blocked');
        qualityBanner.textContent = `Blocked — reasons: ${phase.eligibility.reasons.join(', ')}`;
      }
      outcomePanel.style.display = 'grid';
      return;
    }
    if (phase.kind === 'rest') {
      const remainingSeconds = Math.ceil(phase.remainingMs / 1000);
      restText.textContent = `Rest — next block ${phase.nextBlockIndex + 1} starts in ${remainingSeconds}s`;
      restPanel.style.display = 'grid';
      return;
    }
    if (phase.kind === 'done') {
      donePanel.style.display = 'grid';
    }
  }

  function renderRecords(records: readonly TrackingPilotBlockRunRecord[]): void {
    recordsList.textContent = '';
    for (const record of records) {
      const item = document.createElement('li');
      const qualityText =
        record.outcome === 'aborted'
          ? `aborted (${record.abortReason})`
          : record.eligibility === undefined
            ? 'completed (no quality gate — practice)'
            : `completed (${record.eligibility.status})`;
      item.textContent = `#${record.blockIndex + 1} attempt ${record.attempt} — ${record.drillId} — ${qualityText}`;
      recordsList.appendChild(item);
    }
  }

  function open(): void {
    setStatus('');
    renderPhase({ kind: 'idle' });
    root.style.display = 'flex';
  }

  function close(): void {
    root.style.display = 'none';
  }

  return {
    open,
    close,
    setStatus,
    renderPhase,
    renderRecords,
    dispose(): void {
      root.remove();
    },
  };
}

function makeButton(label: string, title: string, type: 'button' | 'submit' = 'button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = type;
  button.textContent = label;
  button.title = title;
  button.style.cssText =
    'height:38px;padding:0 16px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;font:750 13px/1 system-ui,sans-serif;color:#e6e9ec;background:rgba(15,18,21,0.96);cursor:pointer';
  return button;
}

const overlayCss = [
  'position:fixed',
  'inset:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'background:rgba(10,12,14,0.82)',
  'pointer-events:auto',
  'z-index:60',
].join(';');

const cardCss = [
  'display:flex',
  'flex-direction:column',
  'gap:12px',
  'max-width:min(92vw,560px)',
  'max-height:88vh',
  'overflow-y:auto',
  'padding:20px',
  'background:rgba(24,27,30,0.98)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:10px',
  'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
  'color:#edf2f7',
].join(';');

const headingCss = 'margin:0;font:750 18px/1.3 system-ui,sans-serif';
const fieldLabelCss = 'display:grid;gap:6px;font:700 13px/1.4 system-ui,sans-serif';
const inputCss =
  'height:36px;padding:0 8px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:#171a1e;color:#edf2f7;font:600 13px/1 system-ui,sans-serif';
const statusCss = 'margin:0;min-height:18px;font:650 13px/1.4 system-ui,sans-serif;color:#f0c674';
const panelCss =
  'display:grid;gap:10px;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.03)';
const panelTextCss = 'margin:0;font:600 13px/1.5 system-ui,sans-serif;color:#e6e9ec';
const qualityBannerCss =
  'padding:8px 10px;border-radius:6px;font:700 12px/1.4 system-ui,sans-serif;background:#3a3220;color:#f0c674;border:1px solid rgba(240,198,116,0.4)';
