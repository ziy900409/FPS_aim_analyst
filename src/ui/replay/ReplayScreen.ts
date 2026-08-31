/**
 * ReplayScreen — WP-50 / T5（README §2.8/2.9/FR-50.12/50.15）
 *
 * Full-screen shell for the first-person 3D Replay: top bar (Back / source identity / support
 * badge), a 16:9 viewport host, and a state-dependent body (loading/error/unsupported/ready). Owns
 * no async load, scene, or `ReplayPlayer` — a later caller (T6's entry-point wiring) drives it via
 * `render(state)` with plain data plus a narrow `ReplayTransportControls` port, and pushes per-frame
 * samples via `updateFrame()` (the same sample driving the isolated replay scene render — README
 * "同一 sample 更新", never a second independently-sampled clock in this UI layer).
 *
 * `viewportElement` is an empty, sized host `<div>`: T6 mounts/resizes the shared renderer's canvas
 * into it; this file never touches Three.js/canvas/WebGPU (README §2.1 domain boundary).
 */

import type { ReplayCapability, ReplayPlaybackState, ReplayRecording, ReplaySample, ReplaySupport, ReplaySupportStatus } from '../../replay/contracts.ts';
import { createReplayTransport, type ReplayTransportControls, type ReplayTransportHandle } from './ReplayTransport.ts';

export type { ReplayTransportControls } from './ReplayTransport.ts';

const CAPABILITY_LABELS: Record<ReplayCapability, string> = {
  camera: '相機視角',
  'target-lifecycle': '目標生命週期',
  ads: 'ADS 瞄準狀態',
  'shot-hit-cue': '射擊／命中提示',
  scene: '場景',
};

const REASON_MESSAGES: Record<string, string> = {
  UNKNOWN_EXACT_DRILL: '這個 drill 尚未登記重播設定檔',
  EMPTY_TICKS: '缺少可播放的紀錄資料',
  NON_MONOTONIC_TICKS: '紀錄時間序不連續，無法重建播放時間軸',
  RECORDER_OVERFLOW: '紀錄器於當時溢位，資料可能不完整',
  REPLAY_CONTRACT_MISMATCH: '重播欄位宣告與實際資料不一致',
  LEGACY_REPLAY_FIELDS_MISSING: '這是舊版匯出，缺少重播所需欄位',
  SCENE_METADATA_MISSING: '缺少場景設定資料',
  SCENE_ASSET_VERSION_MISMATCH: '目前場景資產版本與錄製當時不同',
  SCENE_LOAD_FAILED: '場景載入失敗',
};

function reasonMessage(code: string): string {
  return REASON_MESSAGES[code] ?? code;
}

function supportBadgeText(status: ReplaySupportStatus): string {
  switch (status) {
    case 'full':
      return '完整重播';
    case 'partial':
      return '有限重播';
    case 'unsupported':
      return '僅結果';
    case 'invalid':
      return '無效';
  }
}

export type ReplayScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'unsupported'; readonly sourceLabel: string; readonly reasonCodes: readonly string[] }
  | {
      readonly kind: 'ready';
      readonly sourceLabel: string;
      readonly support: ReplaySupport;
      readonly recording: ReplayRecording;
      readonly controls: ReplayTransportControls;
    };

export interface ReplayScreenOptions {
  readonly parent?: HTMLElement;
  readonly onBack: () => void;
  readonly onRetry?: () => void;
  /** Invoked when the user cancels an in-flight load — `onBack()` always fires afterwards so a
   * caller that never wires this up still gets a working "return to source" affordance
   * (README FR-50.15 "load/scene generation切換或dispose後...不得掛入active scene"). */
  readonly onCancelLoad?: () => void;
}

export interface ReplayScreenHandle {
  readonly element: HTMLElement;
  readonly viewportElement: HTMLElement;
  readonly visible: boolean;
  render(state: ReplayScreenState): void;
  /** Forwarded to the active transport (a no-op outside the 'ready' state). */
  updateFrame(sample: ReplaySample, playback: ReplayPlaybackState): void;
  show(): void;
  hide(): void;
  dispose(): void;
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

/** Duck-typed form-control check (no `instanceof HTMLElement` — keeps this module testable against
 * a lightweight fake-DOM harness in Node, not just a real browser/jsdom `Element`). */
function isFormLikeTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const tagName = (target as { tagName?: unknown }).tagName;
  return typeof tagName === 'string' && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName);
}

function makeButton(label: string, action: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.replayAction = action;
  button.style.cssText = buttonCss;
  return button;
}

export function createReplayScreen(options: ReplayScreenOptions): ReplayScreenHandle {
  const parent = options.parent ?? document.body;
  let visible = false;
  let currentKind: ReplayScreenState['kind'] | undefined;
  let focusedKind: ReplayScreenState['kind'] | undefined;
  let transport: ReplayTransportHandle | undefined;
  let readyControls: ReplayTransportControls | undefined;

  const root = document.createElement('section');
  root.id = 'replay-screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '3D Replay');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:none',
    'flex-direction:column',
    'box-sizing:border-box',
    'padding:16px',
    'gap:12px',
    'font:500 13px/1.4 system-ui,sans-serif',
    'color:#edf2f7',
    'background:rgba(10,12,14,0.96)',
    'pointer-events:auto',
    'z-index:65', // above History (60) — Replay is reachable from either Result or History
  ].join(';');

  // ---- Top bar --------------------------------------------------------------------------------
  const topBar = document.createElement('header');
  topBar.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex:0 0 auto';

  const backButton = makeButton('返回', 'back');
  backButton.addEventListener('click', () => options.onBack());

  const sourceLabelEl = document.createElement('span');
  sourceLabelEl.dataset.section = 'replay-source-label';
  sourceLabelEl.style.cssText = 'font:700 14px/1.2 system-ui,sans-serif;flex:1 1 auto';

  const supportBadge = document.createElement('span');
  supportBadge.dataset.section = 'replay-support-badge';
  supportBadge.style.cssText = [
    'padding:3px 10px',
    'border-radius:999px',
    'font:750 11px/1.4 system-ui,sans-serif',
    'border:1px solid rgba(255,255,255,0.2)',
    'display:none',
  ].join(';');

  topBar.append(backButton, sourceLabelEl, supportBadge);

  // ---- Main content area (tabIndex host for focus-on-state-change, cf. HistoryScreen) ----------
  const main = document.createElement('main');
  main.tabIndex = -1;
  main.style.cssText = 'flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:12px;outline:none;overflow:auto';

  // ---- Loading panel ----------------------------------------------------------------------------
  const loadingPanel = document.createElement('div');
  loadingPanel.dataset.section = 'replay-loading';
  loadingPanel.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:12px;margin:auto;padding:24px';
  const loadingText = document.createElement('p');
  loadingText.textContent = '載入中…';
  const cancelButton = makeButton('取消並返回', 'cancel-load');
  cancelButton.addEventListener('click', () => {
    options.onCancelLoad?.();
    options.onBack();
  });
  loadingPanel.append(loadingText, cancelButton);

  // ---- Error panel -----------------------------------------------------------------------------
  const errorPanel = document.createElement('div');
  errorPanel.dataset.section = 'replay-error';
  errorPanel.setAttribute('role', 'alert');
  errorPanel.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:12px;margin:auto;padding:24px;text-align:center';
  const errorText = document.createElement('p');
  const errorActions = document.createElement('div');
  errorActions.style.cssText = 'display:flex;gap:8px';
  const retryButton = makeButton('重試', 'retry');
  retryButton.addEventListener('click', () => options.onRetry?.());
  const errorBackButton = makeButton('返回', 'back');
  errorBackButton.addEventListener('click', () => options.onBack());
  errorActions.append(retryButton, errorBackButton);
  errorPanel.append(errorText, errorActions);

  // ---- Unsupported panel -------------------------------------------------------------------------
  const unsupportedPanel = document.createElement('div');
  unsupportedPanel.dataset.section = 'replay-unsupported';
  unsupportedPanel.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:12px;margin:auto;padding:24px;text-align:center;max-width:420px';
  const unsupportedText = document.createElement('p');
  unsupportedText.textContent = '此紀錄只能查看結果。';
  const unsupportedReasons = document.createElement('ul');
  unsupportedReasons.style.cssText = 'list-style:none;margin:0;padding:0;color:#c8d0d8;font:500 12px/1.5 system-ui,sans-serif';
  const unsupportedBackButton = makeButton('返回', 'back');
  unsupportedBackButton.addEventListener('click', () => options.onBack());
  unsupportedPanel.append(unsupportedText, unsupportedReasons, unsupportedBackButton);

  // ---- Ready panel (viewport + partial banner + transport) --------------------------------------
  const readyPanel = document.createElement('div');
  readyPanel.dataset.section = 'replay-ready';
  readyPanel.style.cssText = 'display:none;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0';

  const partialBanner = document.createElement('div');
  partialBanner.dataset.section = 'replay-partial-banner';
  partialBanner.setAttribute('role', 'status');
  partialBanner.style.cssText = [
    'display:none',
    'flex-direction:column',
    'gap:4px',
    'padding:10px 12px',
    'border:1px solid rgba(255,204,85,0.45)',
    'border-radius:6px',
    'background:rgba(255,204,85,0.12)',
    'font:600 12px/1.4 system-ui,sans-serif',
  ].join(';');
  const partialTitle = document.createElement('strong');
  partialTitle.textContent = '⚠ 有限重播 — 部分能力不可用';
  const partialDetails = document.createElement('ul');
  partialDetails.style.cssText = 'list-style:disc;margin:2px 0 0 18px;padding:0;color:#e6e9ec';
  partialBanner.append(partialTitle, partialDetails);

  const viewportHost = document.createElement('div');
  viewportHost.dataset.section = 'replay-viewport';
  viewportHost.style.cssText = [
    'position:relative',
    'width:100%',
    'max-width:1280px',
    'aspect-ratio:16/9',
    'margin:0 auto',
    'background:#000',
    'border-radius:8px',
    'overflow:hidden',
    'flex:0 1 auto',
    'min-height:0',
  ].join(';');

  const transportContainer = document.createElement('div');
  transportContainer.dataset.section = 'replay-transport-container';

  readyPanel.append(partialBanner, viewportHost, transportContainer);

  main.append(loadingPanel, errorPanel, unsupportedPanel, readyPanel);
  root.append(topBar, main);
  parent.appendChild(root);

  function focusTarget(kind: ReplayScreenState['kind']): void {
    if (kind === 'loading') cancelButton.focus();
    else if (kind === 'error') errorBackButton.focus();
    else if (kind === 'unsupported') unsupportedBackButton.focus();
    else main.focus();
  }

  function hideAllPanels(): void {
    loadingPanel.style.display = 'none';
    errorPanel.style.display = 'none';
    unsupportedPanel.style.display = 'none';
    readyPanel.style.display = 'none';
  }

  function teardownTransport(): void {
    transport?.dispose();
    transport = undefined;
    readyControls = undefined;
  }

  function render(state: ReplayScreenState): void {
    hideAllPanels();
    // Always rebuild the transport from scratch on every render() call (state transitions only,
    // never a per-frame call — updateFrame() is the hot path) so re-entering 'ready' (e.g. support
    // upgraded once more data resolves) never leaks the previous transport's DOM/listeners.
    teardownTransport();

    if (state.kind === 'loading') {
      supportBadge.style.display = 'none';
      sourceLabelEl.textContent = '';
      loadingPanel.style.display = 'flex';
    } else if (state.kind === 'error') {
      supportBadge.style.display = 'none';
      sourceLabelEl.textContent = '';
      errorText.textContent = state.message;
      retryButton.style.display = options.onRetry === undefined ? 'none' : '';
      errorPanel.style.display = 'flex';
    } else if (state.kind === 'unsupported') {
      sourceLabelEl.textContent = state.sourceLabel;
      supportBadge.style.display = '';
      supportBadge.textContent = supportBadgeText('unsupported');
      supportBadge.dataset.supportStatus = 'unsupported';
      unsupportedReasons.replaceChildren(
        ...state.reasonCodes.map((code) => {
          const li = document.createElement('li');
          li.textContent = reasonMessage(code);
          return li;
        }),
      );
      unsupportedPanel.style.display = 'flex';
    } else {
      sourceLabelEl.textContent = state.sourceLabel;
      supportBadge.style.display = '';
      supportBadge.textContent = supportBadgeText(state.support.status);
      supportBadge.dataset.supportStatus = state.support.status;

      if (state.support.status === 'partial') {
        partialBanner.style.display = 'flex';
        partialDetails.replaceChildren(
          ...state.support.missing.map((cap) => {
            const li = document.createElement('li');
            li.textContent = `缺少：${CAPABILITY_LABELS[cap]}`;
            return li;
          }),
          ...state.support.reasonCodes.map((code) => {
            const li = document.createElement('li');
            li.textContent = reasonMessage(code);
            return li;
          }),
        );
      } else {
        partialBanner.style.display = 'none';
      }

      readyControls = state.controls;
      transport = createReplayTransport({ recording: state.recording, controls: state.controls });
      viewportHost.appendChild(transport.hudElement);
      transportContainer.replaceChildren(transport.element);
      readyPanel.style.display = 'flex';
    }

    currentKind = state.kind;
    if (visible && state.kind !== focusedKind) {
      focusTarget(state.kind);
      focusedKind = state.kind;
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || transport === undefined) return;
    if (isFormLikeTarget(event.target)) return;
    event.preventDefault();
    transport.togglePlayPause();
  }

  // Tab hidden → auto-pause; visibility/focus regained never auto-resumes playback
  // (README Assumption §1.4).
  function onVisibilityChange(): void {
    if (document.hidden) readyControls?.pause();
  }

  return {
    element: root,
    viewportElement: viewportHost,
    get visible(): boolean {
      return visible;
    },
    render,
    updateFrame(sample: ReplaySample, playback: ReplayPlaybackState): void {
      transport?.update(sample, playback);
    },
    show(): void {
      if (visible) return;
      visible = true;
      root.style.display = 'flex';
      window.addEventListener('keydown', onKeyDown);
      document.addEventListener('visibilitychange', onVisibilityChange);
      // Whatever render() already produced (loading is the typical first state) gets focus now
      // that the screen is actually visible — a render() call while hidden does not steal focus.
      if (currentKind !== undefined && currentKind !== focusedKind) {
        focusTarget(currentKind);
        focusedKind = currentKind;
      }
    },
    hide(): void {
      if (!visible) return;
      visible = false;
      root.style.display = 'none';
      focusedKind = undefined; // next show() always re-focuses, even into the same state kind
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      teardownTransport();
      root.remove();
    },
  };
}
