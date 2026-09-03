import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import type { ExportPayload } from '../data/export.ts';
import { trackingCorePrPilotV1Practice } from '../drill/tracking_core_pr_pilot_v1.ts';
import {
  buildTrackingPilotManifest,
  resolveTrackingPilotBlockConfig,
  type TrackingPilotManifest,
} from '../session/trackingPilotManifest.ts';
import { createTrackingPilotSession, type TrackingPilotSessionDeps } from './trackingPilotSession.ts';

/**
 * WP-54 / T6 slice 1 — locks the `main.ts` integration seam: the real T5 runner + real T5
 * operator screen driven through the same callbacks `main.ts` supplies, with only the app-side
 * dependencies (drill load / export / download) faked. `main.ts` itself has no test coverage, so
 * this is where the wiring rules live.
 *
 * Same hand-rolled fake DOM convention as `TrackingPilotOperatorScreen.test.ts`/
 * `SessionPlanSetup.test.ts` (this project has no jsdom/happy-dom dependency).
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

/** Minimal-but-parseable stand-in for a real run's payload — enough for
 * `evaluateTrackingRunEligibility()` (which the runner calls for non-practice blocks) to return a
 * blocked verdict rather than throw. The real payload assembly is `main.ts`'s
 * `buildCurrentExportPayload()`, exercised end-to-end by the Playwright walkthrough. */
const FAKE_PAYLOAD = { meta: { schemaVersion: 2 }, ticks: [], events: [] } as unknown as ExportPayload;

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

function makeSession(overrides: Partial<TrackingPilotSessionDeps> = {}) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const loadedConfigs: DrillConfig[] = [];
  const startedManifests: TrackingPilotManifest[] = [];
  const deps = {
    loadDrillConfig: vi.fn(async (config: DrillConfig) => {
      loadedConfigs.push(config);
    }),
    exportBlock: vi.fn(async () => FAKE_PAYLOAD),
    onBlockExported: vi.fn(),
    onStatus: vi.fn(),
    onManifestStart: vi.fn((manifest: TrackingPilotManifest) => {
      startedManifests.push(manifest);
    }),
    ...overrides,
  } satisfies TrackingPilotSessionDeps;
  const session = createTrackingPilotSession(deps);
  return { session, deps, document, loadedConfigs, startedManifests };
}

function root(document: FakeDocument): FakeElement {
  const element = document.created.find((el) => el.id === 'tracking-pilot-operator');
  if (element === undefined) throw new Error('operator screen root was never created');
  return element;
}

function byId(document: FakeDocument, id: string): FakeElement {
  const element = document.created.find((el) => el.id === id);
  if (element === undefined) throw new Error(`no created element with id ${id}`);
  return element;
}

/** The panel element that owns a given child id — the operator screen's panels have no ids of
 * their own, and `display` on the panel is what actually decides whether the operator can act. */
function panelOwning(document: FakeDocument, childId: string): FakeElement {
  const element = document.created.find((el) => el.children.some((child) => child.id === childId));
  if (element === undefined) throw new Error(`no panel owning #${childId}`);
  return element;
}

/** Matches on the button's visible label — which is also its accessible name (T5 slice 4 removed
 * every `aria-label` here to fix a WCAG 2.5.3 Label-in-Name violation). */
function buttonByLabel(document: FakeDocument, label: string): FakeElement {
  const element = document.created.find((el) => el.tag === 'button' && el.textContent === label);
  if (element === undefined) throw new Error(`no button labelled "${label}"`);
  return element;
}

async function startManifest(
  document: FakeDocument,
  participantId = 'P001',
  sessionIndex = '0',
  restSeconds = '20',
): Promise<void> {
  document.created.find((el) => el.name === 'participantId')!.value = participantId;
  document.created.find((el) => el.name === 'sessionIndex')!.value = sessionIndex;
  document.created.find((el) => el.name === 'restSeconds')!.value = restSeconds;
  document.created.find((el) => el.tag === 'form')!.dispatch('submit');
  await flush();
}

describe('createTrackingPilotSession — manifest start', () => {
  it('loads the first block as a resolved DrillConfig (not a drillId) through the app load path', async () => {
    const { session, document, loadedConfigs, startedManifests } = makeSession();
    session.open();

    await startManifest(document, 'P001', '0', '20');

    expect(startedManifests).toEqual([buildTrackingPilotManifest('P001', 0, 20)]);
    expect(loadedConfigs).toHaveLength(1);
    // The manifest always starts with practice (T5 slice 1) and resolves it via the single-source
    // config registry — this asserts the wiring hands over the real config object, unchanged.
    expect(loadedConfigs[0]).toEqual(trackingCorePrPilotV1Practice);
    expect(session.runner.phase.kind).toBe('running');
  });

  it('resolves a session-1 scored block through resolveTrackingPilotBlockConfig (alternate seed)', async () => {
    const { session, document, loadedConfigs } = makeSession();
    session.open();

    // Session 1 keeps practice/calibration on the primary seed; the resolution rule itself is
    // owned by trackingPilotManifest — this only asserts the wiring calls it per block.
    await startManifest(document, 'P001', '1', '20');

    const manifest = buildTrackingPilotManifest('P001', 1, 20);
    expect(loadedConfigs[0]).toEqual(resolveTrackingPilotBlockConfig(manifest.orderedBlocks[0]));
  });

  it('never builds a manifest from setup values the operator screen already rejected', async () => {
    const { session, document, startedManifests } = makeSession();
    session.open();

    await startManifest(document, 'P001', '0', '-5');

    expect(startedManifests).toEqual([]);
    expect(byId(document, 'tracking-pilot-status').textContent).not.toBe('');
    expect(session.runner.phase.kind).toBe('idle');
  });

  it('reports a failed block load (e.g. clearance rejection) as operator status, not an unhandled rejection', async () => {
    const { session, document } = makeSession({
      loadDrillConfig: vi.fn(async () => {
        throw new Error('DrillConfig 載入失敗: clearance 驗證失敗');
      }),
    });
    session.open();

    await startManifest(document);

    expect(session.runner.phase.kind).toBe('idle');
    expect(byId(document, 'tracking-pilot-status').textContent).toContain('Manifest 啟動失敗');
    expect(byId(document, 'tracking-pilot-status').textContent).toContain('clearance');
    // The overlay must stay reachable so the operator can see why nothing started.
    expect(root(document).style.display).not.toBe('none');
  });
});

describe('createTrackingPilotSession — operator overlay visibility', () => {
  it('hides the full-viewport overlay while a block is running and restores it afterwards', async () => {
    const { session, document } = makeSession();
    session.open();
    expect(root(document).style.display).not.toBe('none');

    await startManifest(document);
    // The participant must be able to see the target — the operator screen is a full-viewport
    // scrim, so it steps aside for the duration of the block.
    expect(root(document).style.display).toBe('none');

    session.handleDrillEnded();
    await flush();
    expect(session.runner.phase.kind).toBe('block-outcome');
    expect(root(document).style.display).not.toBe('none');
  });

  it('leaves the overlay hidden until the operator opens it (no auto-open from phase changes)', async () => {
    const { document } = makeSession();
    // No session.open() — the researcher-mode entry point has not been used yet.
    await startManifest(document);
    expect(root(document).style.display).toBe('none');
  });
});

describe('createTrackingPilotSession — drill-ended handoff', () => {
  it('exports the block, hands the payload to the app downloader, and logs the attempt', async () => {
    const { session, deps, document } = makeSession();
    session.open();
    await startManifest(document);

    expect(session.handleDrillEnded()).toBe(true);
    await flush();

    expect(deps.exportBlock).toHaveBeenCalledOnce();
    expect(deps.onBlockExported).toHaveBeenCalledWith(FAKE_PAYLOAD);
    expect(session.runner.records).toHaveLength(1);
    expect(session.runner.records[0]).toMatchObject({
      drillId: 'tracking_core_pr_pilot_v1_practice',
      role: 'practice',
      attempt: 1,
      outcome: 'completed',
    });
    // Practice is never quality-gated (no scored_start event to evaluate).
    expect(session.runner.records[0].eligibility).toBeUndefined();
    expect(byId(document, 'tracking-pilot-records-list').children).toHaveLength(1);
  });

  it('leaves the outcome panel actually rendered after the overlay comes back', async () => {
    // Regression (found by tracking-pilot-live.spec.ts): the screen's `open()` re-renders the idle
    // phase, so restoring the overlay *after* rendering the outcome wiped the panel — the operator
    // saw an empty screen with no Retry/Continue buttons and the run could not proceed.
    const { session, document } = makeSession();
    session.open();
    await startManifest(document);

    session.handleDrillEnded();
    await flush();

    const outcomeText = byId(document, 'tracking-pilot-outcome-text');
    expect(outcomeText.textContent).toContain('tracking_core_pr_pilot_v1_practice');
    expect(panelOwning(document, 'tracking-pilot-outcome-text').style.display).toBe('grid');
    // …and the operator's status context is not blanked by the overlay restore.
    expect(byId(document, 'tracking-pilot-status').textContent).toContain('Block 1');
  });

  it('returns false when no pilot block owns the finished run (app keeps its own branches)', async () => {
    const { session, deps } = makeSession();
    session.open();

    expect(session.handleDrillEnded()).toBe(false);
    await flush();
    expect(deps.exportBlock).not.toHaveBeenCalled();
  });

  it('reports an export failure as operator status and keeps no phantom record', async () => {
    const { session, deps, document } = makeSession({
      exportBlock: vi.fn(async () => {
        throw new Error('recorder snapshot unavailable');
      }),
    });
    session.open();
    await startManifest(document);

    expect(session.handleDrillEnded()).toBe(true);
    await flush();

    expect(session.runner.records).toHaveLength(0);
    expect(byId(document, 'tracking-pilot-status').textContent).toContain('Block 匯出失敗');
    expect(deps.onBlockExported).not.toHaveBeenCalled();
  });

  it('does not download anything for an aborted block (no export was taken)', async () => {
    const { session, deps, document } = makeSession();
    session.open();
    await startManifest(document);

    buttonByLabel(document, 'Abort block').click();
    document.created.find((el) => el.name === 'reason')!.value = 'participant sneezed';
    buttonByLabel(document, 'Confirm').click();
    await flush();

    expect(deps.onBlockExported).not.toHaveBeenCalled();
    expect(session.runner.records[0]).toMatchObject({ outcome: 'aborted', abortReason: 'participant sneezed' });
  });
});

describe('createTrackingPilotSession — rest countdown', () => {
  it('forwards poll() so the rest countdown advances into the next block', async () => {
    const { session, document, loadedConfigs } = makeSession();
    session.open();
    await startManifest(document, 'P001', '0', '1');

    session.handleDrillEnded();
    await flush();
    buttonByLabel(document, 'Continue').click();
    await flush();
    expect(session.runner.phase.kind).toBe('rest');
    expect(root(document).style.display).not.toBe('none');

    session.poll(0);
    session.poll(1_000);
    await flush();

    expect(session.runner.phase.kind).toBe('running');
    expect(loadedConfigs).toHaveLength(2);
    expect(loadedConfigs[1].drillId).toBe('tracking_core_pr_pilot_v1_calibration_horizontal');
    expect(root(document).style.display).toBe('none');
  });
});
