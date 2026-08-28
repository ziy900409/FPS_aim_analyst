/**
 * WP-49 T1/T2/T3 — full-screen History shell (README §2.9). Owns the breadcrumb and composes the
 * per-route-kind body: `ParticipantBrowser` for `participants`, `DrillBrowser` for `drills` (T2),
 * `DrillOverview` for `drill` (T3 run-list; trend arrives T4/T5), and `HistoricalRunDetail` for
 * `run` (T3). This file owns no fetch calls and no Pointer Lock/game-input logic — visibility is a
 * pure function of `navigator.current` so `main.ts` can gate Pointer Lock off `historyScreen.visible`
 * alone.
 */

import type { HistoryLibraryController } from '../../history/HistoryLibraryController.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import { historyRouteAncestors, type HistoryRoute } from '../../history/navigation/HistoryRoute.ts';
import type { DrillMetricRegistry } from '../../history/DrillMetricRegistry.ts';
import { createParticipantBrowser } from './ParticipantBrowser.ts';
import { createDrillBrowser } from './DrillBrowser.ts';
import { createDrillOverview } from './DrillOverview.ts';
import { createHistoricalRunDetail } from './HistoricalRunDetail.ts';

export interface HistoryScreenOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
  /** WP-49 T5 — client-side metric descriptor lookup for the drill trend section (README §2.5).
   * Pure and network-free; safe to share the same instance the server-side analysis service uses. */
  readonly registry: DrillMetricRegistry;
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
  const { navigator, controller, registry } = options;
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
  const drillOverview = createDrillOverview({ navigator, controller, registry });
  const historicalRunDetail = createHistoricalRunDetail({
    onBack(): void {
      const route = navigator.current;
      if (route?.kind !== 'run') return;
      navigator.push({ kind: 'drill', participantId: route.participantId, drillId: route.drillId, runFilter: 'all' });
    },
    onRetry(): void {
      controller.retry('run-detail');
    },
    // WP-50 will supply a real handler (README §5 handoff); T3 renders no replay button while
    // this stays undefined (FR-49.13 — no dead/inert affordance).
  });
  participantBrowser.element.style.display = 'none';
  drillBrowser.element.style.display = 'none';
  drillOverview.element.style.display = 'none';
  historicalRunDetail.element.style.display = 'none';

  main.append(participantBrowser.element, drillBrowser.element, drillOverview.element, historicalRunDetail.element, status);

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

  function hideAll(): void {
    participantBrowser.element.style.display = 'none';
    drillBrowser.element.style.display = 'none';
    drillOverview.element.style.display = 'none';
    historicalRunDetail.element.style.display = 'none';
    status.style.display = 'none';
  }

  function render(): void {
    const route = navigator.current;
    renderBreadcrumb(route);
    hideAll();

    if (route?.kind === 'participants') {
      participantBrowser.element.style.display = '';
      participantBrowser.render({ participants: controller.state.participants, query: route.query, health: controller.state.health });
    } else if (route?.kind === 'drills') {
      drillBrowser.element.style.display = '';
      drillBrowser.render({ drills: controller.state.drills, participantId: route.participantId });
    } else if (route?.kind === 'drill') {
      drillOverview.element.style.display = '';
      drillOverview.render({
        runs: controller.state.runs,
        observations: controller.state.observations,
        participantId: route.participantId,
        drillId: route.drillId,
        runFilter: route.runFilter,
        metricId: route.metricId,
        cohortId: route.cohortId,
      });
    } else if (route?.kind === 'run') {
      historicalRunDetail.element.style.display = '';
      historicalRunDetail.render({ runDetail: controller.state.runDetail, runId: route.runId });
    } else {
      status.style.display = '';
      renderNotFound();
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
      drillOverview.dispose();
      historicalRunDetail.dispose();
      root.remove();
    },
  };
  return handle;
}
