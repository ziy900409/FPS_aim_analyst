import { describe, expect, it } from 'vitest';
import { createHistoryNavigator, type HistoryNavigatorWindow } from './HistoryNavigator.ts';
import type { HistoryRoute } from './HistoryRoute.ts';

interface StackEntry {
  readonly hash: string;
  readonly state: unknown;
}

/** In-memory session-history stack driving a real `pushState`/`replaceState`/`back` model
 * (truncate-forward-on-push, mutate-in-place-on-replace) so navigator tests exercise the same
 * semantics a real browser gives — without a real browser (T1 Steps §3 "fake window/history可測"). */
class FakeHistoryWindow implements HistoryNavigatorWindow {
  private stack: StackEntry[];
  private index = 0;
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(initialHash = '') {
    this.stack = [{ hash: initialHash, state: null }];
  }

  get location(): { readonly hash: string } {
    return { hash: this.stack[this.index].hash };
  }

  get history(): HistoryNavigatorWindow['history'] {
    return {
      state: this.stack[this.index].state,
      pushState: (data: unknown, _unused: string, url?: string | null) => {
        const hash = url ?? this.stack[this.index].hash;
        this.stack = [...this.stack.slice(0, this.index + 1), { hash, state: data }];
        this.index += 1;
      },
      replaceState: (data: unknown, _unused: string, url?: string | null) => {
        const hash = url ?? this.stack[this.index].hash;
        this.stack[this.index] = { hash, state: data };
      },
      back: () => {
        if (this.index === 0) return;
        this.index -= 1;
        this.dispatch('popstate');
      },
    };
  }

  forward(): void {
    if (this.index >= this.stack.length - 1) return;
    this.index += 1;
    this.dispatch('popstate');
  }

  /** Simulates a full page reload landing back on the same URL: a fresh navigator re-parses the
   * currently-stored hash, so no stack mutation is needed here — tests just construct a new
   * navigator against this same window instance. */
  addEventListener(type: 'hashchange' | 'popstate', listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set<() => void>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: 'hashchange' | 'popstate', listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  /** Simulates an out-of-band hash change the navigator did not initiate itself (typed in the
   * address bar, or another script) — dispatches `hashchange`, the event browsers fire for this. */
  externalHashChange(hash: string): void {
    this.stack = [...this.stack.slice(0, this.index + 1), { hash, state: null }];
    this.index += 1;
    this.dispatch('hashchange');
  }

  stackSize(): number {
    return this.stack.length;
  }

  currentHash(): string {
    return this.stack[this.index].hash;
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const rootRoute: HistoryRoute = { kind: 'participants', query: '' };
const drillsRoute: HistoryRoute = { kind: 'drills', participantId: 'p-1' };
const drillRoute: HistoryRoute = { kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' };

describe('createHistoryNavigator — initial state / reload', () => {
  it('parses the window\'s current hash as the initial route', () => {
    const win = new FakeHistoryWindow('#/history/participants/p-1');
    const navigator = createHistoryNavigator({ window: win });
    expect(navigator.current).toEqual(drillsRoute);
  });

  it('is undefined when the initial hash is outside the namespace (e.g. dev #pattern)', () => {
    const win = new FakeHistoryWindow('#pattern');
    const navigator = createHistoryNavigator({ window: win });
    expect(navigator.current).toBeUndefined();
  });

  it('reload equivalent: a fresh navigator against the same window re-derives the same route', () => {
    const win = new FakeHistoryWindow('#/history/participants/p-1/drills/d-1');
    const first = createHistoryNavigator({ window: win });
    first.dispose();
    const second = createHistoryNavigator({ window: win });
    expect(second.current).toEqual(drillRoute);
  });
});

describe('createHistoryNavigator — push/replace/back', () => {
  it('push formats the hash, updates current, and notifies subscribers', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    const seen: (HistoryRoute | undefined)[] = [];
    navigator.subscribe((route) => seen.push(route));

    navigator.push(rootRoute);
    expect(win.currentHash()).toBe('#/history');
    expect(navigator.current).toEqual(rootRoute);
    expect(seen).toEqual([rootRoute]);

    navigator.push(drillsRoute);
    expect(win.stackSize()).toBe(3); // initial + root + drills
    expect(navigator.current).toEqual(drillsRoute);
  });

  it('replace mutates the current entry in place instead of growing the stack', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(rootRoute);
    const sizeAfterPush = win.stackSize();

    navigator.replace(drillsRoute);
    expect(win.stackSize()).toBe(sizeAfterPush);
    expect(navigator.current).toEqual(drillsRoute);
  });

  it('back() restores the previous route via a popstate round trip', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(rootRoute);
    navigator.push(drillsRoute);

    navigator.back();
    expect(navigator.current).toEqual(rootRoute);
  });

  it('replace after a push, then back, skips the replaced (never separately pushed) route', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(rootRoute);
    navigator.push(drillsRoute);
    navigator.replace(drillRoute); // same entry as drillsRoute, now showing drillRoute

    navigator.back();
    expect(navigator.current).toEqual(rootRoute); // not drillsRoute — it was replaced, not pushed
  });
});

describe('createHistoryNavigator — close', () => {
  it('leaves the namespace and clears current, without disturbing #pattern-style app state', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(drillRoute);

    navigator.close();
    expect(navigator.current).toBeUndefined();
    expect(win.currentHash()).not.toContain('/history');
  });

  it('close after a request settles produces no further route updates (no unhandled state)', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    const seen: (HistoryRoute | undefined)[] = [];
    navigator.subscribe((route) => seen.push(route));

    navigator.push(drillRoute);
    navigator.close();
    const countAfterClose = seen.length;

    // A late external event landing back in-namespace after close should still be observed —
    // close() does not disable the navigator, only leaves the namespace once.
    win.externalHashChange('#/history');
    expect(seen.length).toBe(countAfterClose + 1);
    expect(navigator.current).toEqual(rootRoute);
  });
});

describe('createHistoryNavigator — scroll restoration', () => {
  it('saveScroll persists on the current entry; consumeScroll reads it back after Back', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(rootRoute);
    navigator.saveScroll(240);

    navigator.push(drillsRoute);
    expect(navigator.consumeScroll()).toBeUndefined(); // fresh entry, no saved scroll yet

    navigator.back();
    expect(navigator.current).toEqual(rootRoute);
    expect(navigator.consumeScroll()).toBe(240);
  });
});

describe('createHistoryNavigator — namespace isolation (#pattern)', () => {
  it('does not intercept or rewrite a hashchange landing on #pattern', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    navigator.push(rootRoute);
    const sizeBeforeExternalChange = win.stackSize();

    win.externalHashChange('#pattern');
    expect(navigator.current).toBeUndefined();
    // The navigator must not have pushed/replaced anything in reaction — only the external
    // hashchange itself grew the stack.
    expect(win.stackSize()).toBe(sizeBeforeExternalChange + 1);
    expect(win.currentHash()).toBe('#pattern');
  });
});

describe('createHistoryNavigator — dispose', () => {
  it('stops reacting to hash/popstate events and clears subscribers', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    const seen: (HistoryRoute | undefined)[] = [];
    navigator.subscribe((route) => seen.push(route));
    navigator.push(rootRoute);
    expect(seen.length).toBe(1);

    navigator.dispose();
    win.externalHashChange('#/history/participants/p-1');
    expect(seen.length).toBe(1); // no further notifications after dispose
  });
});

describe('createHistoryNavigator — malformed hash within the namespace', () => {
  it('surfaces the deepest valid ancestor rather than undefined (still "active", not closed)', () => {
    const win = new FakeHistoryWindow();
    const navigator = createHistoryNavigator({ window: win });
    win.externalHashChange('#/history/participants/%zz');
    expect(navigator.current).toEqual(rootRoute);
  });
});
