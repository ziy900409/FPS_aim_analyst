import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResearcherMenu, shouldShowResearcherControls, type AppMode } from './ResearcherMenu.ts';

class FakeElement {
  id = '';
  textContent = '';
  title = '';
  type = '';
  removed = false;
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();

  constructor(readonly tag: string) {}

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement('body');
  readonly created: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    return element;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('createResearcherMenu', () => {
  it('opens, closes, and disposes a three-entry researcher menu', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const callbacks = {
      onSelectDrillControls: vi.fn(),
      onSelectResolutionProtocol: vi.fn(),
      onSelectBrProtocol: vi.fn(),
    };
    const handle = createResearcherMenu(callbacks);
    const root = document.created.find((element) => element.id === 'researcher-menu')!;
    const buttons = document.created.filter((element) => element.tag === 'button');

    expect(root.style.display).toBe('none');
    expect(root.attributes.get('aria-label')).toBe('研究員模式');
    expect(buttons.map((button) => button.textContent)).toEqual([
      '單一 Drill 調整',
      '解析度 protocol',
      'BR protocol',
    ]);

    handle.open();
    expect(root.style.display).toBe('flex');

    buttons[0].dispatch('click');
    buttons[1].dispatch('click');
    buttons[2].dispatch('click');
    expect(callbacks.onSelectDrillControls).toHaveBeenCalledOnce();
    expect(callbacks.onSelectResolutionProtocol).toHaveBeenCalledOnce();
    expect(callbacks.onSelectBrProtocol).toHaveBeenCalledOnce();

    handle.close();
    expect(root.style.display).toBe('none');
    handle.dispose();
    expect(root.removed).toBe(true);
  });
});

describe('shouldShowResearcherControls', () => {
  it.each<[AppMode, boolean, boolean]>([
    ['launch', false, false],
    ['launch', true, false],
    ['researcher', false, false],
    ['researcher', true, true],
  ])('returns %s mode × %s run-state visibility as %s', (appMode, visibleForRunState, expected) => {
    expect(shouldShowResearcherControls(appMode, visibleForRunState)).toBe(expected);
  });
});
