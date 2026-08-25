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
});
