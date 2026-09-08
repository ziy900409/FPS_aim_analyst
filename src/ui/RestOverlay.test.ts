import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRestOverlay } from './RestOverlay.ts';

class FakeElement {
  id = '';
  textContent = '';
  readonly style: Record<string, string> & { cssText: string } = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  removed = false;

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement();

  createElement(): FakeElement {
    return new FakeElement();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createRestOverlay', () => {
  it('renders an inert hidden overlay until rest begins', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);

    createRestOverlay();

    const root = document.body.children[0];
    expect(root.id).toBe('rest-overlay');
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.cssText).toContain('pointer-events:none');
    expect(root.style.cssText).toContain('display:none');
  });

  it('formats the remaining time, then hides and disposes', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const overlay = createRestOverlay();
    const root = document.body.children[0];
    const label = root.children[0];

    overlay.show(60_000);
    expect(label.textContent).toBe('休息中\n1:00');
    expect(root.attributes.get('aria-hidden')).toBe('false');
    expect(root.style.display).toBe('grid');

    overlay.show(1);
    expect(label.textContent).toBe('休息中\n0:01');
    overlay.hide();
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.display).toBe('none');

    overlay.dispose();
    expect(root.removed).toBe(true);
  });

  it('names the boundary and the drill on the other side of the rest (WP-58 T4 / OQ-58.3)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const overlay = createRestOverlay();
    const label = document.body.children[0].children[0];

    overlay.show(60_000, { boundary: 'family', nextDrillId: 'spider-shot-v3' });
    expect(label.textContent).toBe('休息中\n1:00\nfamily（換家族） → spider-shot-v3');

    overlay.show(30_000, { boundary: 'rep', nextDrillId: 'hold_click_v1' });
    expect(label.textContent).toBe('休息中\n0:30\nrep（同一 drill 下一輪） → hold_click_v1');

    overlay.show(30_000, { boundary: 'drill', nextDrillId: 'spider-shot-v3' });
    expect(label.textContent).toBe('休息中\n0:30\ndrill（同家族換 drill） → spider-shot-v3');

    // Omitting the detail must keep the pre-WP-58 two-line countdown, not print 'undefined'.
    overlay.show(30_000);
    expect(label.textContent).toBe('休息中\n0:30');
  });
});
