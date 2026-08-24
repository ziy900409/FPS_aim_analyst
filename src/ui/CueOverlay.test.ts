import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCueOverlay } from './CueOverlay.ts';

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

describe('createCueOverlay', () => {
  it('creates an inert hidden direction overlay', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);

    createCueOverlay();

    const root = document.body.children[0];
    expect(root.id).toBe('cue-overlay');
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.cssText).toContain('pointer-events:none');
    expect(root.style.cssText).toContain('visibility:hidden');
  });

  it('shows A/D direction text, hides, and disposes', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const overlay = createCueOverlay();
    const root = document.body.children[0];
    const label = root.children[0];

    overlay.show('A');
    expect(label.textContent).toBe('← A');
    expect(root.attributes.get('aria-hidden')).toBe('false');
    expect(root.style.visibility).toBe('visible');

    overlay.show('D');
    expect(label.textContent).toBe('D →');
    overlay.hide();
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.visibility).toBe('hidden');

    overlay.dispose();
    expect(root.removed).toBe(true);
  });
});
