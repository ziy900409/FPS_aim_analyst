/**
 * Counter-strafe direction cue. This is a presentation-only DOM component;
 * protocol event wiring remains at the application boundary.
 */
export interface CueOverlayHandle {
  show(direction: 'A' | 'D'): void;
  hide(): void;
  dispose(): void;
}

export function createCueOverlay(parent: HTMLElement = document.body): CueOverlayHandle {
  const root = document.createElement('div');
  root.id = 'cue-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:grid',
    'place-items:center',
    'pointer-events:none',
    'user-select:none',
    'z-index:12',
    'visibility:hidden',
  ].join(';');

  const label = document.createElement('div');
  label.setAttribute('aria-label', 'Counter-strafe direction cue');
  label.style.cssText = [
    'font:700 clamp(48px,12vmin,144px)/1 system-ui,sans-serif',
    'color:#f6d365',
    'text-shadow:0 3px 14px rgba(0,0,0,0.85)',
  ].join(';');
  root.appendChild(label);
  parent.appendChild(root);

  return {
    show(direction): void {
      label.textContent = direction === 'A' ? '← A' : 'D →';
      root.setAttribute('aria-hidden', 'false');
      root.style.visibility = 'visible';
    },
    hide(): void {
      root.setAttribute('aria-hidden', 'true');
      root.style.visibility = 'hidden';
    },
    dispose(): void {
      root.remove();
    },
  };
}
