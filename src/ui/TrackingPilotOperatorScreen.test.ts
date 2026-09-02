import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackingPilotBlockRunRecord, TrackingPilotRunnerPhase } from '../session/TrackingPilotRunner.ts';
import { createTrackingPilotOperatorScreen } from './TrackingPilotOperatorScreen.ts';

/**
 * Same hand-rolled fake DOM convention as `SessionPlanSetup.test.ts`/`EligibilityGate.test.ts`
 * (project has no jsdom/happy-dom dependency — `vi.stubGlobal('document', ...)` is the
 * established pattern here, not a real DOM).
 */
interface FakeEvent {
  preventDefault(): void;
}

class FakeElement {
  id = '';
  textContent = '';
  title = '';
  type = '';
  name = '';
  value = '';
  checked = false;
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(readonly tag: string) {}

  append(...children: FakeElement[]): void {
    for (const child of children) this.appendChild(child);
  }

  appendChild(child: FakeElement): void {
    const currentIndex = this.children.indexOf(child);
    if (currentIndex >= 0) this.children.splice(currentIndex, 1);
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.get(name);
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: Partial<FakeEvent> = {}): void {
    const resolved = { preventDefault: vi.fn(), ...event };
    for (const listener of this.listeners.get(type) ?? []) listener(resolved);
  }

  click(): void {
    this.dispatch('click');
  }

  focus(): void {}

  remove(): void {}
}

class FakeDocument {
  readonly body = new FakeElement('body');
  readonly created: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    return element;
  }
}

afterEach(() => vi.unstubAllGlobals());

function makeScreen() {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const options = {
    onStartManifest: vi.fn(),
    onCompleteBlock: vi.fn(),
    onRetryBlock: vi.fn(),
    onAbortBlock: vi.fn(),
    onAdvance: vi.fn(),
  };
  const screen = createTrackingPilotOperatorScreen(options);
  screen.open();
  return { screen, options, document };
}

function byId(document: FakeDocument, id: string): FakeElement {
  const element = document.created.find((el) => el.id === id);
  if (element === undefined) throw new Error(`no created element with id ${id}`);
  return element;
}

function buttonByTitlePrefix(document: FakeDocument, prefix: string): FakeElement {
  const element = document.created.find((el) => el.tag === 'button' && el.title.startsWith(prefix));
  if (element === undefined) throw new Error(`no button with title prefix "${prefix}"`);
  return element;
}

const RUNNING_PHASE: TrackingPilotRunnerPhase = {
  kind: 'running',
  block: { drillId: 'tracking_core_pr_pilot_v1_practice', seedFamily: 'primary' },
  blockIndex: 0,
  role: 'practice',
  attempt: 1,
};

const BLOCKED_OUTCOME_PHASE: TrackingPilotRunnerPhase = {
  kind: 'block-outcome',
  block: { drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps', seedFamily: 'primary' },
  blockIndex: 1,
  role: 'scored',
  attempt: 1,
  eligibility: { status: 'blocked', reasons: ['insufficient-scored-coverage', 'non-monotonic-timestamps'] },
};

const ELIGIBLE_OUTCOME_PHASE: TrackingPilotRunnerPhase = {
  kind: 'block-outcome',
  block: { drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps', seedFamily: 'primary' },
  blockIndex: 1,
  role: 'scored',
  attempt: 1,
  eligibility: { status: 'eligible', validScoredTicks: 3200, durationMs: 25000 },
};

describe('TrackingPilotOperatorScreen', () => {
  it('submits the setup form with the parsed participantId/sessionIndex/restSeconds', () => {
    const { options, document } = makeScreen();
    const participantInput = document.created.find((el) => el.name === 'participantId')!;
    const sessionIndexSelect = document.created.find((el) => el.name === 'sessionIndex')!;
    const restSecondsInput = document.created.find((el) => el.name === 'restSeconds')!;
    const form = document.created.find((el) => el.tag === 'form')!;

    participantInput.value = 'P007';
    sessionIndexSelect.value = '1';
    restSecondsInput.value = '45';
    form.dispatch('submit');

    expect(options.onStartManifest).toHaveBeenCalledWith('P007', 1, 45);
  });

  it('rejects a blank participantId without calling onStartManifest', () => {
    const { options, document } = makeScreen();
    const form = document.created.find((el) => el.tag === 'form')!;
    form.dispatch('submit');
    expect(options.onStartManifest).not.toHaveBeenCalled();
    expect(byId(document, 'tracking-pilot-status').textContent).not.toBe('');
  });

  it('renders the running phase as text, never a capability number', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase(RUNNING_PHASE);
    const blockText = byId(document, 'tracking-pilot-block-text');
    expect(blockText.textContent).toContain('Block 1');
    expect(blockText.textContent).toContain('tracking_core_pr_pilot_v1_practice');
    expect(blockText.textContent).toContain('attempt 1');
  });

  it('renders a blocked outcome with its closed reason codes as text, not a colour-only signal', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase(BLOCKED_OUTCOME_PHASE);
    const banner = byId(document, 'tracking-pilot-quality-banner');
    expect(banner.style.display).not.toBe('none');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('insufficient-scored-coverage');
    expect(banner.textContent).toContain('non-monotonic-timestamps');
    expect(banner.getAttribute('data-quality')).toBe('blocked');
  });

  it('renders an eligible outcome with coverage facts, never a performance/capability score', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase(ELIGIBLE_OUTCOME_PHASE);
    const banner = byId(document, 'tracking-pilot-quality-banner');
    expect(banner.textContent).toContain('3200');
    expect(banner.textContent).toContain('25000');
    expect(banner.textContent).not.toMatch(/rms|epsilon|lag|gain/i);
    expect(banner.getAttribute('data-quality')).toBe('eligible');
  });

  it('hides the quality banner for a practice block outcome (no quality gate)', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase({ ...BLOCKED_OUTCOME_PHASE, role: 'practice', eligibility: undefined });
    expect(byId(document, 'tracking-pilot-quality-banner').style.display).toBe('none');
  });

  it('renders the rest countdown as text', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase({ kind: 'rest', nextBlockIndex: 2, remainingMs: 12_400 });
    const restText = byId(document, 'tracking-pilot-rest-text');
    expect(restText.textContent).toContain('next block 3');
    expect(restText.textContent).toMatch(/1[23]s/);
  });

  it('completeBlock/advance buttons call their callbacks directly (no reason required)', () => {
    const { screen, options, document } = makeScreen();
    screen.renderPhase(RUNNING_PHASE);
    buttonByTitlePrefix(document, 'Export the current block').click();
    expect(options.onCompleteBlock).toHaveBeenCalledOnce();

    screen.renderPhase(ELIGIBLE_OUTCOME_PHASE);
    buttonByTitlePrefix(document, 'Accept this block outcome').click();
    expect(options.onAdvance).toHaveBeenCalledOnce();
  });

  it('abort requires a non-empty reason typed into the shared reason panel before confirming', () => {
    const { screen, options, document } = makeScreen();
    screen.renderPhase(RUNNING_PHASE);
    buttonByTitlePrefix(document, 'Abort the currently running block').click();
    const confirm = buttonByTitlePrefix(document, 'Confirm this action');
    confirm.click();
    expect(options.onAbortBlock).not.toHaveBeenCalled();

    const reasonInput = document.created.find((el) => el.name === 'reason')!;
    reasonInput.value = 'participant requested a break';
    confirm.click();
    expect(options.onAbortBlock).toHaveBeenCalledWith('participant requested a break');
  });

  it('retry requires a non-empty reason and does not invoke the abort callback', () => {
    const { screen, options, document } = makeScreen();
    screen.renderPhase(BLOCKED_OUTCOME_PHASE);
    buttonByTitlePrefix(document, 'Re-run this block').click();
    const reasonInput = document.created.find((el) => el.name === 'reason')!;
    reasonInput.value = 'target visibility looked wrong, technical fault';
    buttonByTitlePrefix(document, 'Confirm this action').click();
    expect(options.onRetryBlock).toHaveBeenCalledWith('target visibility looked wrong, technical fault');
    expect(options.onAbortBlock).not.toHaveBeenCalled();
  });

  it('cancel closes the reason panel without invoking either callback', () => {
    const { screen, options, document } = makeScreen();
    screen.renderPhase(RUNNING_PHASE);
    buttonByTitlePrefix(document, 'Abort the currently running block').click();
    buttonByTitlePrefix(document, 'Cancel and return').click();
    expect(options.onAbortBlock).not.toHaveBeenCalled();
    expect(options.onRetryBlock).not.toHaveBeenCalled();
  });

  it('renders the done phase as text', () => {
    const { screen, document } = makeScreen();
    screen.renderPhase({ kind: 'done' });
    expect(byId(document, 'tracking-pilot-done-text').textContent).toContain('完成');
  });

  it('renderRecords lists completed/aborted attempts without a capability number', () => {
    const { screen, document } = makeScreen();
    const records: readonly TrackingPilotBlockRunRecord[] = [
      {
        drillId: 'tracking_core_pr_pilot_v1_practice',
        blockIndex: 0,
        role: 'practice',
        seedFamily: 'primary',
        attempt: 1,
        outcome: 'completed',
        eligibility: undefined,
        payload: undefined,
        abortReason: undefined,
      },
      {
        drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps',
        blockIndex: 1,
        role: 'scored',
        seedFamily: 'primary',
        attempt: 1,
        outcome: 'aborted',
        eligibility: undefined,
        payload: undefined,
        abortReason: 'technical fault',
      },
    ];
    screen.renderRecords(records);
    const items = document.created.filter((el) => el.tag === 'li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('completed (no quality gate — practice)');
    expect(items[1].textContent).toContain('aborted (technical fault)');
  });

  it('every interactive control is a native button/input/select — no click-only div', () => {
    const { document } = makeScreen();
    const interactiveTags = new Set(['button', 'input', 'select']);
    const hasListeners = document.created.filter((el) => el.listeners.size > 0);
    for (const el of hasListeners) {
      expect(interactiveTags.has(el.tag) || el.tag === 'form').toBe(true);
    }
  });

  it('never gives a button/input a mismatched aria-label (WCAG 2.5.3 Label in Name)', () => {
    // Every labelled input in this screen relies on its wrapping <label> (matching
    // EligibilityGate.ts/SessionPlanSetup.ts's convention) — buttons rely on their own
    // textContent, with `title` as a supplementary tooltip only. A button/input carrying an
    // aria-label that differs from its visible text would make its accessible name diverge from
    // what a sighted keyboard user reads on screen.
    const { document } = makeScreen();
    for (const el of document.created) {
      if (el.tag === 'button' || el.tag === 'input' || el.tag === 'select') {
        expect(el.getAttribute('aria-label')).toBeUndefined();
      }
    }
  });
});
