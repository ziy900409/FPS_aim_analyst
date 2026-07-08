import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSettingsPanel } from './SettingsPanel.ts';
import type { ResolutionMode } from '../display/resolutionMode.ts';

class FakeElement {
  id = '';
  textContent = '';
  value = '';
  valueAsNumber = 0;
  type = '';
  min = '';
  max = '';
  step = '';
  disabled = false;
  readonly style = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Array<() => void>>();

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

class FakeDocument {
  readonly body = new FakeElement();
  readonly selects: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement();
    if (tag === 'select') this.selects.push(element);
    return element;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSettingsPanel', () => {
  it('emits resolution mode changes and supports protocol locking', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const modes: ResolutionMode[] = [];

    const panel = createSettingsPanel({
      onSensitivityChange: () => {},
      onFovChange: () => {},
      onResolutionModeChange: (mode) => modes.push(mode),
    });
    const select = document.selects[0];

    expect(panel.resolutionMode).toBe('native');
    expect(modes).toEqual(['native']);

    select.value = 'qhd-1440';
    select.dispatch('change');
    expect(panel.resolutionMode).toBe('qhd-1440');
    expect(modes).toEqual(['native', 'qhd-1440']);

    panel.lockMode(true);
    select.value = 'fhd-1080';
    select.dispatch('change');
    expect(panel.resolutionMode).toBe('qhd-1440');
    expect(select.disabled).toBe(true);
    expect(modes).toEqual(['native', 'qhd-1440']);
  });
});
