import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedReplayEvent, ReplayPlaybackState, ReplayRecording, ReplaySample } from '../../replay/contracts.ts';
import { createReplayTransport, type ReplayTransportControls } from './ReplayTransport.ts';

class FakeElement {
  tag: string;
  id = '';
  title = '';
  textContent = '';
  type = '';
  value = '';
  min = '';
  max = '';
  step = '';
  disabled = false;
  removed = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '', display: '', opacity: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(tag = 'div') {
    this.tag = tag;
  }

  get tagName(): string {
    return this.tag.toUpperCase();
  }

  get valueAsNumber(): number {
    return Number(this.value);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.get(name);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  focus(): void {}

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  activeElement: FakeElement | undefined;

  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
}

function flatten(node: FakeElement): FakeElement[] {
  return [node, ...node.children.flatMap(flatten)];
}

function findAll(node: FakeElement, predicate: (n: FakeElement) => boolean): FakeElement[] {
  return flatten(node).filter(predicate);
}

function findByAction(node: FakeElement, action: string): FakeElement[] {
  return findAll(node, (n) => n.dataset.replayAction === action);
}

function makeEvent(overrides: Partial<NormalizedReplayEvent> & { raw: NormalizedReplayEvent['raw'] }): NormalizedReplayEvent {
  return { timeMs: overrides.raw.t, sourceIndex: 0, ...overrides };
}

function makeRecording(events: NormalizedReplayEvent[], durationMs = 4000): ReplayRecording {
  return {
    drillId: 'hold_click_v1',
    durationMs,
    support: { status: 'full', available: [], missing: [], reasonCodes: [] },
    ticks: [],
    tickTimes: new Float64Array(0),
    events,
    eventTimes: new Float64Array(events.map((e) => e.timeMs)),
    weaponId: 'ak47',
  };
}

function makeSample(overrides: Partial<ReplaySample> = {}): ReplaySample {
  return {
    timeMs: 0,
    tickBefore: 0,
    tickAfter: 0,
    alpha: 0,
    camera: { yaw: 0, pitch: 0 },
    player: { px: 0, pz: 0, speed: 0 },
    input: { keys: [], ads: false },
    targets: [],
    effects: [],
    eventCursor: -1,
    ...overrides,
  };
}

function makePlayback(overrides: Partial<ReplayPlaybackState> = {}): ReplayPlaybackState {
  return { status: 'paused', timeMs: 0, rate: 1, ...overrides } as ReplayPlaybackState;
}

function makeControls(): ReplayTransportControls & Record<string, ReturnType<typeof vi.fn>> {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setRate: vi.fn(),
    previousEvent: vi.fn(),
    nextEvent: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createReplayTransport — timeline filtering (FR-50.8)', () => {
  it('only surfaces cue/visible/counter/fire/hit as markers and list entries, never ads/target_stop/key', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const events = [
      makeEvent({ raw: { type: 'cue', t: 0, direction: 'A' } }),
      makeEvent({ raw: { type: 'ads', t: 100, down: true } }),
      makeEvent({ raw: { type: 'visible', t: 200, targetId: 't0', side: 'L' } }),
      makeEvent({ raw: { type: 'key', t: 300, code: 'A', down: true } }),
      makeEvent({ raw: { type: 'counter', t: 400, key: 'D' } }),
      makeEvent({ raw: { type: 'target_stop', t: 500, targetId: 't0' } }),
      makeEvent({ raw: { type: 'fire', t: 600, hit: true } }),
      makeEvent({ raw: { type: 'hit', t: 700, part: 'head' } }),
    ];
    const transport = createReplayTransport({ recording: makeRecording(events), controls: makeControls() });

    const markers = findAll(transport.element as unknown as FakeElement, (n) => n.dataset.eventKind !== undefined && n.tag === 'div');
    expect(markers.map((m) => m.dataset.eventKind).sort()).toEqual(['counter', 'cue', 'fire', 'hit', 'visible']);

    const listItems = findByAction(transport.element as unknown as FakeElement, 'seek-to-event');
    expect(listItems).toHaveLength(5);
    expect(listItems.map((b) => b.dataset.eventKind)).toEqual(['cue', 'visible', 'counter', 'fire', 'hit']);
  });

  it('formats event labels from raw fields', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const events = [
      makeEvent({ raw: { type: 'fire', t: 0, hit: true } }),
      makeEvent({ raw: { type: 'hit', t: 10, part: 'head' } }),
      makeEvent({ raw: { type: 'counter', t: 20, key: 'D' } }),
    ];
    const transport = createReplayTransport({ recording: makeRecording(events), controls: makeControls() });
    const listItems = findByAction(transport.element as unknown as FakeElement, 'seek-to-event');
    expect(listItems[0].textContent).toContain('射擊（命中）');
    expect(listItems[1].textContent).toContain('命中 head');
    expect(listItems[2].textContent).toContain('反向鍵 D');
  });
});

describe('createReplayTransport — controls wiring', () => {
  it('previous/next event buttons call the corresponding control', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const controls = makeControls();
    const transport = createReplayTransport({ recording: makeRecording([]), controls });

    findByAction(transport.element as unknown as FakeElement, 'previous-event')[0].dispatch('click');
    findByAction(transport.element as unknown as FakeElement, 'next-event')[0].dispatch('click');

    expect(controls.previousEvent).toHaveBeenCalledOnce();
    expect(controls.nextEvent).toHaveBeenCalledOnce();
  });

  it('seeking the slider calls controls.seek with the numeric value', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const controls = makeControls();
    const transport = createReplayTransport({ recording: makeRecording([]), controls });
    const slider = findByAction(transport.element as unknown as FakeElement, 'seek')[0];

    slider.value = '1234';
    slider.dispatch('input');

    expect(controls.seek).toHaveBeenCalledWith(1234);
  });

  it('rate buttons call controls.setRate with their own rate', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const controls = makeControls();
    const transport = createReplayTransport({ recording: makeRecording([]), controls });

    const halfSpeed = findAll(transport.element as unknown as FakeElement, (n) => n.dataset.rate === '0.5')[0];
    halfSpeed.dispatch('click');

    expect(controls.setRate).toHaveBeenCalledWith(0.5);
  });

  it('togglePlayPause calls play() when paused/ended and pause() when playing, based on the last update() status', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const controls = makeControls();
    const transport = createReplayTransport({ recording: makeRecording([]), controls });

    transport.togglePlayPause(); // no update() yet — defaults to paused
    expect(controls.play).toHaveBeenCalledOnce();

    transport.update(makeSample(), makePlayback({ status: 'playing' }));
    transport.togglePlayPause();
    expect(controls.pause).toHaveBeenCalledOnce();

    transport.update(makeSample(), makePlayback({ status: 'ended' }));
    transport.togglePlayPause();
    expect(controls.play).toHaveBeenCalledTimes(2);
  });

  it('the play/pause button click routes through the same toggle logic', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const controls = makeControls();
    const transport = createReplayTransport({ recording: makeRecording([]), controls });
    const playButton = findByAction(transport.element as unknown as FakeElement, 'play-pause')[0];

    playButton.dispatch('click');
    expect(controls.play).toHaveBeenCalledOnce();
  });
});

describe('createReplayTransport — update() rendering (same-sample contract)', () => {
  it('renders time text, aria-valuetext, and rate aria-pressed from the pushed sample/playback', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const transport = createReplayTransport({ recording: makeRecording([], 5000), controls: makeControls() });

    transport.update(makeSample({ timeMs: 1000 }), makePlayback({ timeMs: 1000, rate: 2 }));

    const slider = findByAction(transport.element as unknown as FakeElement, 'seek')[0];
    expect(slider.value).toBe('1000');
    expect(slider.getAttribute('aria-valuetext')).toBe('00:01.0 / 00:05.0');

    const doubleSpeed = findAll(transport.element as unknown as FakeElement, (n) => n.dataset.rate === '2')[0];
    expect(doubleSpeed.getAttribute('aria-pressed')).toBe('true');
    const normalSpeed = findAll(transport.element as unknown as FakeElement, (n) => n.dataset.rate === '1')[0];
    expect(normalSpeed.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not fight an actively-focused slider by overwriting its value', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const transport = createReplayTransport({ recording: makeRecording([], 5000), controls: makeControls() });
    const slider = findByAction(transport.element as unknown as FakeElement, 'seek')[0];
    document.activeElement = slider;
    slider.value = '4321'; // simulates the user actively dragging

    transport.update(makeSample({ timeMs: 1000 }), makePlayback({ timeMs: 1000 }));

    expect(slider.value).toBe('4321');
  });

  it('disables previous/next event at the timeline boundaries and marks the current event', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const events = [
      makeEvent({ raw: { type: 'cue', t: 0, direction: 'A' } }),
      makeEvent({ raw: { type: 'fire', t: 500, hit: false } }),
      makeEvent({ raw: { type: 'hit', t: 1000, part: 'body' } }),
    ];
    const transport = createReplayTransport({ recording: makeRecording(events, 2000), controls: makeControls() });
    const listItems = findByAction(transport.element as unknown as FakeElement, 'seek-to-event');
    const prevBtn = findByAction(transport.element as unknown as FakeElement, 'previous-event')[0];
    const nextBtn = findByAction(transport.element as unknown as FakeElement, 'next-event')[0];

    transport.update(makeSample({ timeMs: 0 }), makePlayback({ timeMs: 0 }));
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(listItems[0].getAttribute('aria-current')).toBe('true');
    expect(listItems[1].getAttribute('aria-current')).toBe('false');

    transport.update(makeSample({ timeMs: 700 }), makePlayback({ timeMs: 700 }));
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
    expect(listItems[1].getAttribute('aria-current')).toBe('true');

    transport.update(makeSample({ timeMs: 1000 }), makePlayback({ timeMs: 1000 }));
    expect(nextBtn.disabled).toBe(true);
    expect(listItems[2].getAttribute('aria-current')).toBe('true');
  });

  it('reflects keys/ADS/speed on the HUD element from the same sample', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const transport = createReplayTransport({ recording: makeRecording([]), controls: makeControls() });

    transport.update(
      makeSample({ input: { keys: ['W', 'A'], ads: true }, player: { px: 0, pz: 0, speed: 250.4 } }),
      makePlayback(),
    );

    const speedNode = findAll(transport.hudElement as unknown as FakeElement, (n) => n.textContent.endsWith('u/s'))[0];
    expect(speedNode.textContent).toBe('250 u/s');
  });
});

describe('createReplayTransport — dispose', () => {
  it('removes both the transport element and the HUD element', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const transport = createReplayTransport({ recording: makeRecording([]), controls: makeControls() });

    transport.dispose();

    expect((transport.element as unknown as FakeElement).removed).toBe(true);
    expect((transport.hudElement as unknown as FakeElement).removed).toBe(true);
  });
});
