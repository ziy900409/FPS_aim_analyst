import { afterEach, describe, expect, it, vi } from 'vitest';
import { createControls } from './Controls.ts';

class FakeElement {
  id = '';
  title = '';
  textContent = '';
  value = '';
  type = '';
  checked = false;
  disabled = false;
  readonly style = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Array<() => void>>();

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  remove(): void {}

  setAttribute(): void {}

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
  readonly inputs: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement();
    if (tag === 'input') this.inputs.push(element);
    return element;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createControls', () => {
  it('emits tracer toggle changes and supports handle-driven updates', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const values: boolean[] = [];

    const controls = createControls({
      drills: [{ id: 'd1', label: 'd1' }],
      scenes: [{ id: 's1', label: 's1' }],
      selectedDrillId: 'd1',
      selectedSceneId: 's1',
      onRestart: () => {},
      onLoadDrill: () => {},
      onLoadScene: () => {},
      initialTracerEnabled: true,
      onTracerEnabledChange: (enabled) => values.push(enabled),
    });

    const toggle = document.inputs[0];
    expect(toggle.type).toBe('checkbox');
    expect(toggle.checked).toBe(true);

    toggle.checked = false;
    toggle.dispatch('change');
    expect(values).toEqual([false]);

    controls.setTracerEnabled(true);
    expect(toggle.checked).toBe(true);
  });
});
