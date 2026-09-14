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
  /** 依建立順序：makeRow('Sensitivity') 先、makeRow('FOV') 後。 */
  readonly inputs: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement();
    if (tag === 'select') this.selects.push(element);
    if (tag === 'input') this.inputs.push(element);
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

  // KI-035 / BD-039 (b)（WP-63 T2）：錄製中鎖住感度與 FOV，讓一次 run 只有一組 mouse gain。
  it('lockAim() 停用兩個滑桿並吃掉變更，解鎖後恢復', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const sensitivities: number[] = [];
    const fovs: number[] = [];

    const panel = createSettingsPanel({
      onSensitivityChange: (value) => sensitivities.push(value),
      onFovChange: (value) => fovs.push(value),
    });
    const [sensInput, fovInput] = document.inputs;
    expect(sensitivities).toEqual([1]); // 建構時的預設推送
    expect(fovs).toEqual([75]);

    panel.lockAim(true);
    expect(sensInput.disabled).toBe(true);
    expect(fovInput.disabled).toBe(true);

    // `disabled` 只擋操作員；程式化 dispatch 仍會叫到 listener，故 handler guard 是必要的第二道。
    sensInput.valueAsNumber = 4.2;
    sensInput.dispatch('input');
    fovInput.valueAsNumber = 110;
    fovInput.dispatch('input');
    expect(panel.sensitivity).toBe(1);
    expect(panel.fov).toBe(75);
    expect(sensitivities).toEqual([1]);
    expect(fovs).toEqual([75]);

    panel.lockAim(false);
    expect(sensInput.disabled).toBe(false);
    sensInput.valueAsNumber = 4.2;
    sensInput.dispatch('input');
    expect(panel.sensitivity).toBe(4.2);
    expect(sensitivities).toEqual([1, 4.2]);
  });
});
