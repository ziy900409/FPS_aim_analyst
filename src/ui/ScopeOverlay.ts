/**
 * ScopeOverlay — WP-24 / T3（FR-E6）
 *
 * 純 TS + DOM overlay（D1）：ADS 時顯示圓形鏡框與周邊暗化。只讀視覺元件，不接 input、
 * 不碰 three scene；`pointer-events:none` 確保不影響 Pointer Lock / canvas click。
 */

const TRANSITION_MS = 120;

export interface ScopeOverlayHandle {
  setActive(active: boolean): void;
  dispose(): void;
}

export function createScopeOverlay(parent: HTMLElement = document.body): ScopeOverlayHandle {
  let active = false;

  const root = document.createElement('div');
  root.id = 'scope-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'opacity:0',
    'visibility:hidden',
    `transition:opacity ${TRANSITION_MS}ms linear,visibility 0ms linear ${TRANSITION_MS}ms`,
    'pointer-events:none',
    'user-select:none',
    'z-index:11',
    'background:radial-gradient(circle at center, transparent min(34vmin,260px), rgba(0,0,0,0.72) min(35vmin,268px), rgba(0,0,0,0.9) 100%)',
  ].join(';');

  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:50%',
    'width:min(68vmin,520px)',
    'aspect-ratio:1',
    'transform:translate(-50%,-50%)',
    'border:2px solid rgba(230,238,245,0.62)',
    'border-radius:50%',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.8), inset 0 0 28px rgba(0,0,0,0.55)',
  ].join(';');

  root.appendChild(ring);
  parent.appendChild(root);

  return {
    setActive(next: boolean): void {
      if (next === active) return;
      active = next;
      root.setAttribute('aria-hidden', next ? 'false' : 'true');
      root.style.opacity = next ? '1' : '0';
      root.style.visibility = next ? 'visible' : 'hidden';
      root.style.transition = next
        ? `opacity ${TRANSITION_MS}ms linear,visibility 0ms linear`
        : `opacity ${TRANSITION_MS}ms linear,visibility 0ms linear ${TRANSITION_MS}ms`;
    },
    dispose(): void {
      root.remove();
    },
  };
}
