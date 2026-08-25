/** Presentation-only rest countdown. Scheduling stays with SessionRunner. */
export interface RestOverlayHandle {
  show(remainingMs: number): void;
  hide(): void;
  dispose(): void;
}

function formatRemaining(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createRestOverlay(parent: HTMLElement = document.body): RestOverlayHandle {
  const root = document.createElement('section');
  root.id = 'rest-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:none',
    'place-items:center',
    'pointer-events:none',
    'user-select:none',
    'z-index:20',
    'color:#edf2f7',
    'background:rgba(10,12,14,0.72)',
    'font:500 16px/1.4 system-ui,sans-serif',
  ].join(';');

  const label = document.createElement('div');
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');
  label.style.cssText = [
    'padding:24px 32px',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'background:rgba(24,27,30,0.96)',
    'box-shadow:0 24px 80px rgba(0,0,0,0.42)',
    'text-align:center',
    'white-space:pre-line',
    'font:700 clamp(28px,6vmin,64px)/1.2 system-ui,sans-serif',
  ].join(';');
  root.appendChild(label);
  parent.appendChild(root);

  return {
    show(remainingMs): void {
      label.textContent = `休息中\n${formatRemaining(remainingMs)}`;
      root.setAttribute('aria-hidden', 'false');
      root.style.display = 'grid';
    },
    hide(): void {
      root.setAttribute('aria-hidden', 'true');
      root.style.display = 'none';
    },
    dispose(): void {
      root.remove();
    },
  };
}
