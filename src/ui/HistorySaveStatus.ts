import type { HistorySaveState } from '../history/HistoryPersistence.ts';

/**
 * WP-48 T5 — presentation-only view of `HistorySaveState` (README §2.4). Owns no payload, client,
 * or persistence instance; `main.ts` drives it via `HistoryPersistence.subscribe(saveStatus.render)`
 * and wires `onRetry` to `HistoryPersistence.retry()`.
 */

export interface HistorySaveStatusHandle {
  readonly element: HTMLElement;
  render(state: HistorySaveState): void;
  dispose(): void;
}

export interface HistorySaveStatusOptions {
  readonly onRetry?: () => void | Promise<void>;
}

export function createHistorySaveStatus(options: HistorySaveStatusOptions = {}): HistorySaveStatusHandle {
  const root = document.createElement('section');
  root.dataset.section = 'history-save-status';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.style.cssText = 'margin-top:12px;display:none;grid-template-columns:1fr auto;align-items:center;gap:10px';

  const message = document.createElement('p');
  message.style.cssText = 'margin:0;color:#c8d0d8;font:600 12px/1.4 system-ui,sans-serif';

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.textContent = 'Retry save';
  retryButton.dataset.historySaveRetry = 'true';
  retryButton.setAttribute('aria-label', 'Retry saving this session to history');
  retryButton.style.cssText = [
    'height:30px',
    'padding:0 12px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
    'display:none',
  ].join(';');

  retryButton.addEventListener('click', () => {
    if (options.onRetry !== undefined) void options.onRetry();
  });

  root.append(message, retryButton);

  function render(state: HistorySaveState): void {
    root.dataset.historySaveStatus = state.kind;
    retryButton.style.display = 'none';

    switch (state.kind) {
      case 'idle':
        root.style.display = 'none';
        message.textContent = '';
        return;
      case 'excluded':
        message.textContent = 'Practice 不納入歷史；可手動匯出 JSON/CSV。';
        break;
      case 'saving':
        message.textContent = 'Saving to history…';
        break;
      case 'saved':
        message.textContent =
          state.disposition === 'existing'
            ? 'Already saved to history (matches an existing run).'
            : 'Saved to history.';
        break;
      case 'failed':
        message.textContent = `Save to history failed: ${state.message}`;
        if (state.retryable) retryButton.style.display = '';
        break;
    }
    root.style.display = 'grid';
  }

  render({ kind: 'idle' });

  return {
    element: root,
    render,
    dispose: () => root.remove(),
  };
}
