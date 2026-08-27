/**
 * WP-49 T1/T2 — full-screen History shell (README §2.9). Owns the breadcrumb and composes the
 * per-route-kind body: `ParticipantBrowser` for `participants`, `DrillBrowser` for `drills` (both
 * T2), and a generic loading/empty/error/not-found/ready-count fallback for `drill`/`run` (their
 * dedicated `DrillOverview`/`HistoricalRunDetail` views arrive in T3/T5). This file owns no fetch
 * calls and no Pointer Lock/game-input logic — visibility is a pure function of `navigator.current`
 * so `main.ts` can gate Pointer Lock off `historyScreen.visible` alone.
 */

import type { AsyncState, HistoryLibraryController, HistoryLibraryScope, HistoryLibraryState } from '../../history/HistoryLibraryController.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import { historyRouteAncestors, type HistoryRoute } from '../../history/navigation/HistoryRoute.ts';
import { createParticipantBrowser } from './ParticipantBrowser.ts';
import { createDrillBrowser } from './DrillBrowser.ts';

export interface HistoryScreenOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
  readonly parent?: HTMLElement;
}

export interface HistoryScreenHandle {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** Enters the namespace at the participants root if not already inside it; otherwise a no-op
   * (the shell is already visible and reacting to whatever route is current). */
  open(): void;
  close(): void;
  dispose(): void;
}

function crumbLabel(route: HistoryRoute): string {
  switch (route.kind) {
    case 'participants':
      return '歷史紀錄';
    case 'drills':
      return route.participantId;
    case 'drill':
      return route.drillId;
    case 'run':
      return route.runId;
  }
}

function scopeForRoute(route: HistoryRoute): HistoryLibraryScope {
  switch (route.kind) {
    case 'participants':
      return 'participants';
    case 'drills':
      return 'drills';
    case 'drill':
      return 'runs';
    case 'run':
      return 'run-detail';
  }
}

function asyncStateForRoute(route: HistoryRoute, state: HistoryLibraryState): AsyncState<unknown> {
  switch (route.kind) {
    case 'participants':
      return state.participants;
    case 'drills':
      return state.drills;
    case 'drill':
      return state.runs;
    case 'run':
      return state.runDetail;
  }
}

const buttonCss = [
  'height:30px',
  'padding:0 12px',
  'border:1px solid rgba(255,255,255,0.18)',
  'border-radius:6px',
  'font:650 12px/1 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(24,27,30,0.96)',
  'cursor:pointer',
].join(';');

function makeButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = buttonCss;
  return button;
}

export function createHistoryScreen(options: HistoryScreenOptions): HistoryScreenHandle {
  const { navigator, controller } = options;
  const parent = options.parent ?? document.body;

  const root = document.createElement('section');
  root.id = 'history-screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '歷史紀錄');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:none',
    'flex-direction:column',
    'box-sizing:border-box',
    'padding:20px',
    'font:500 13px/1.4 system-ui,sans-serif',
    'color:#edf2f7',
    'background:rgba(10,12,14,0.96)',
    'pointer-events:auto',
    // Above every existing overlay (ResultScreen z-index:30, researcher-menu z-index:41) —
    // History is its own full-screen application surface (README §2.9), not a dialog stacked
    // among gameplay overlays.
    'z-index:60',
  ].join(';');

  const header = document.createElement('header');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap';

  const title = document.createElement('h2');
  title.textContent = '歷史紀錄';
  title.style.cssText = 'margin:0;font:750 16px/1.2 system-ui,sans-serif';

  const breadcrumb = document.createElement('nav');
  breadcrumb.setAttribute('aria-label', '歷史紀錄路徑');
  breadcrumb.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1 1 auto;flex-wrap:wrap';

  const backButton = makeButton('上一頁');
  backButton.addEventListener('click', () => navigator.back());

  const closeButton = makeButton('關閉');
  closeButton.setAttribute('aria-label', '關閉歷史紀錄');
  closeButton.addEventListener('click', () => handle.close());

  header.append(title, breadcrumb, backButton, closeButton);

  const main = document.createElement('main');
  main.tabIndex = -1;
  main.style.cssText = 'margin-top:16px;flex:1 1 auto;overflow:auto;outline:none';

  const status = document.createElement('div');
  status.dataset.section = 'history-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const participantBrowser = createParticipantBrowser({ navigator, controller });
  const drillBrowser = createDrillBrowser({ navigator, controller });
  participantBrowser.element.style.display = 'none';
  drillBrowser.element.style.display = 'none';

  main.append(participantBrowser.element, drillBrowser.element, status);

  root.append(header, main);
  parent.appendChild(root);

  let visible = false;
  let lastRoute: HistoryRoute | undefined;

  function renderBreadcrumb(route: HistoryRoute | undefined): void {
    if (route === undefined) {
      breadcrumb.replaceChildren();
      return;
    }
    const ancestors = historyRouteAncestors(route);
    const crumbs = ancestors.map((ancestor, index) => {
      const isCurrent = index === ancestors.length - 1;
      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.textContent = crumbLabel(ancestor);
      crumb.dataset.historyCrumb = ancestor.kind;
      crumb.disabled = isCurrent;
      crumb.setAttribute('aria-current', isCurrent ? 'page' : 'false');
      crumb.style.cssText = isCurrent ? `${buttonCss};opacity:0.6;cursor:default` : buttonCss;
      if (!isCurrent) crumb.addEventListener('click', () => navigator.push(ancestor));
      return crumb;
    });
    breadcrumb.replaceChildren(...crumbs);
  }

  function renderNotFound(): void {
    status.dataset.historyStatus = 'not-found';
    const message = document.createElement('p');
    message.textContent = '找不到這個歷史頁面。';
    const backHome = makeButton('回到歷史首頁');
    backHome.addEventListener('click', () => navigator.push({ kind: 'participants', query: '' }));
    status.replaceChildren(message, backHome);
  }

  function renderStatus(route: HistoryRoute | undefined, state: HistoryLibraryState): void {
    if (route === undefined) {
      renderNotFound();
      return;
    }

    const asyncState = asyncStateForRoute(route, state);
    status.dataset.historyStatus = asyncState.status;

    if (asyncState.status === 'idle' || asyncState.status === 'loading') {
      const message = document.createElement('p');
      message.textContent = '載入中…';
      status.replaceChildren(message);
      return;
    }
    if (asyncState.status === 'empty') {
      const message = document.createElement('p');
      message.textContent = '沒有資料。';
      status.replaceChildren(message);
      return;
    }
    if (asyncState.status === 'error') {
      const message = document.createElement('p');
      message.textContent = `讀取失敗：${asyncState.message}`;
      const children: HTMLElement[] = [message];
      if (asyncState.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => controller.retry(scopeForRoute(route)));
        children.push(retryButton);
      }
      status.replaceChildren(...children);
      return;
    }
    // 'ready' — generic item-count summary; T2/T3/T5 replace this with the real list/detail UI.
    const value = asyncState.value;
    const count = Array.isArray(value) ? value.length : 1;
    const message = document.createElement('p');
    message.textContent = `共 ${count} 筆。`;
    status.replaceChildren(message);
  }

  function render(): void {
    const route = navigator.current;
    renderBreadcrumb(route);

    if (route?.kind === 'participants') {
      status.style.display = 'none';
      drillBrowser.element.style.display = 'none';
      participantBrowser.element.style.display = '';
      participantBrowser.render({ participants: controller.state.participants, query: route.query, health: controller.state.health });
    } else if (route?.kind === 'drills') {
      status.style.display = 'none';
      participantBrowser.element.style.display = 'none';
      drillBrowser.element.style.display = '';
      drillBrowser.render({ drills: controller.state.drills, participantId: route.participantId });
    } else {
      participantBrowser.element.style.display = 'none';
      drillBrowser.element.style.display = 'none';
      status.style.display = '';
      renderStatus(route, controller.state);
    }

    visible = route !== undefined;
    root.style.display = visible ? 'flex' : 'none';
    // Move focus into the shell only when the route itself changed (not on every data-state
    // tick) — `navigator.current` is a stable reference between navigations (T1 Steps §5
    // "focus-on-navigation").
    if (visible && route !== lastRoute) {
      main.focus();
    }
    lastRoute = route;
  }

  const unsubscribeNavigator = navigator.subscribe(() => render());
  const unsubscribeController = controller.subscribe(() => render());
  render();

  const handle: HistoryScreenHandle = {
    element: root,
    get visible(): boolean {
      return visible;
    },
    open(): void {
      if (navigator.current === undefined) navigator.push({ kind: 'participants', query: '' });
    },
    close(): void {
      navigator.close();
    },
    dispose(): void {
      unsubscribeNavigator();
      unsubscribeController();
      participantBrowser.dispose();
      drillBrowser.dispose();
      root.remove();
    },
  };
  return handle;
}
