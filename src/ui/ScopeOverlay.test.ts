import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScopeOverlay } from './ScopeOverlay.ts';

class FakeElement {
  id = '';
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

describe('createScopeOverlay', () => {
  it('creates an inert hidden DOM overlay with a centered scope ring', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);

    createScopeOverlay();

    const root = document.body.children[0];
    const ring = root.children[0];
    expect(root.id).toBe('scope-overlay');
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.cssText).toContain('pointer-events:none');
    expect(root.style.cssText).toContain('opacity:0');
    expect(root.style.cssText).toContain('radial-gradient');
    expect(ring.style.cssText).toContain('left:50%');
    expect(ring.style.cssText).toContain('top:50%');
    expect(ring.style.cssText).toContain('border-radius:50%');
  });

  it('toggles active state with the ADS transition duration and disposes the node', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);

    const overlay = createScopeOverlay();
    const root = document.body.children[0];

    overlay.setActive(true);

    expect(root.attributes.get('aria-hidden')).toBe('false');
    expect(root.style.opacity).toBe('1');
    expect(root.style.visibility).toBe('visible');
    expect(root.style.transition).toContain('120ms');

    overlay.setActive(false);
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.opacity).toBe('0');
    expect(root.style.visibility).toBe('hidden');

    overlay.dispose();
    expect(root.removed).toBe(true);
  });
});
