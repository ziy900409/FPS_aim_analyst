/**
 * WP-49 T1 — hash-based Back/Forward adapter over `HistoryRoute` (README §2.3). Owns exactly the
 * `#/history` namespace: a `hashchange`/`popstate` landing outside it (e.g. the existing dev-only
 * `#pattern`) is left untouched (`current` becomes `undefined`, nothing is rewritten) so the
 * navigator never fights another feature for the URL bar (FM table row "`#pattern`").
 *
 * Depends on an injected window-like object (`HistoryNavigatorWindow`) rather than the global
 * `window`, so tests can drive push/replace/back/popstate with a synchronous in-memory stack
 * instead of a real browser history (T1 Steps §3 "fake window/history可測").
 */

import { formatHistoryHash, isHistoryHash, parseHistoryHash, type HistoryRoute } from './HistoryRoute.ts';

interface HistoryEntryState {
  readonly scrollY?: number;
}

export interface HistoryNavigatorWindow {
  readonly location: { readonly hash: string };
  readonly history: {
    readonly state: unknown;
    pushState(data: unknown, unused: string, url?: string | null): void;
    replaceState(data: unknown, unused: string, url?: string | null): void;
    back(): void;
  };
  addEventListener(type: 'hashchange' | 'popstate', listener: () => void): void;
  removeEventListener(type: 'hashchange' | 'popstate', listener: () => void): void;
}

export interface HistoryNavigator {
  readonly current: HistoryRoute | undefined;
  push(route: HistoryRoute): void;
  replace(route: HistoryRoute): void;
  back(): void;
  close(): void;
  subscribe(listener: (route: HistoryRoute | undefined) => void): () => void;
  dispose(): void;
  /** Persists the scroll offset of the *current* entry in place (no new history entry), so it can
   * be restored by `consumeScroll()` when Back/Forward lands on this entry again. Not part of the
   * README §2.3 interface literally — added because T1 Steps §3 requires "route-local scroll
   * state" and the formal `HistoryRoute` union has no room to carry it. */
  saveScroll(scrollY: number): void;
  /** Reads back the scroll offset saved for the entry we just navigated to, if any. */
  consumeScroll(): number | undefined;
}

export interface HistoryNavigatorOptions {
  readonly window?: HistoryNavigatorWindow;
}

function defaultWindow(): HistoryNavigatorWindow {
  return window as unknown as HistoryNavigatorWindow;
}

export function createHistoryNavigator(options: HistoryNavigatorOptions = {}): HistoryNavigator {
  const win = options.window ?? defaultWindow();
  const listeners = new Set<(route: HistoryRoute | undefined) => void>();
  let current: HistoryRoute | undefined = parseHistoryHash(win.location.hash);

  function notify(): void {
    for (const listener of listeners) listener(current);
  }

  function onHashOrPopState(): void {
    const hash = win.location.hash;
    current = isHistoryHash(hash) ? parseHistoryHash(hash) : undefined;
    notify();
  }

  win.addEventListener('hashchange', onHashOrPopState);
  win.addEventListener('popstate', onHashOrPopState);

  function push(route: HistoryRoute): void {
    win.history.pushState(null, '', formatHistoryHash(route));
    current = route;
    notify();
  }

  function replace(route: HistoryRoute): void {
    win.history.replaceState(win.history.state, '', formatHistoryHash(route));
    current = route;
    notify();
  }

  function back(): void {
    win.history.back();
  }

  function close(): void {
    // Unconditionally leaves the `#/history` namespace. main.ts does not use the hash for any
    // other app state, so clearing it is always safe (FR-49.1 "回到原本的 launch 或 current
    // Result context" — that context lives in `main.ts`'s own JS state, not the URL).
    win.history.pushState(null, '', '#');
    current = undefined;
    notify();
  }

  return {
    get current() {
      return current;
    },
    push,
    replace,
    back,
    close,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      win.removeEventListener('hashchange', onHashOrPopState);
      win.removeEventListener('popstate', onHashOrPopState);
      listeners.clear();
    },
    saveScroll(scrollY: number): void {
      const state: HistoryEntryState = { ...(win.history.state as HistoryEntryState | null), scrollY };
      win.history.replaceState(state, '', win.location.hash);
    },
    consumeScroll(): number | undefined {
      const state = win.history.state as HistoryEntryState | null;
      return typeof state?.scrollY === 'number' ? state.scrollY : undefined;
    },
  };
}
