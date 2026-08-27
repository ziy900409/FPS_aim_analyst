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
  readonly selects: FakeElement[] = [];
  readonly buttons: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement();
    if (tag === 'input') this.inputs.push(element);
    if (tag === 'select') this.selects.push(element);
    if (tag === 'button') this.buttons.push(element);
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
      weapons: [{ id: 'ak47', label: 'ak47' }],
      selectedDrillId: 'd1',
      selectedSceneId: 's1',
      selectedWeaponId: 'ak47',
      onRestart: () => {},
      onLoadDrill: () => {},
      onLoadScene: () => {},
      onLoadWeapon: () => {},
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

  it('loads the selected weapon only on button click, not on select change', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const values: string[] = [];

    const controls = createControls({
      drills: [{ id: 'd1', label: 'd1' }],
      scenes: [{ id: 's1', label: 's1' }],
      weapons: [
        { id: 'ak47', label: 'ak47' },
        { id: 'm4a4', label: 'm4a4' },
      ],
      selectedDrillId: 'd1',
      selectedSceneId: 's1',
      selectedWeaponId: 'ak47',
      onRestart: () => {},
      onLoadDrill: () => {},
      onLoadScene: () => {},
      onLoadWeapon: (id) => {
        values.push(id);
      },
    });

    const weaponSelect = document.selects[2];
    const loadWeaponButton = document.buttons[3];
    expect(weaponSelect.id).toBe('weapon-select');
    expect(loadWeaponButton.textContent).toBe('Weapon');
    expect(weaponSelect.value).toBe('ak47');

    weaponSelect.value = 'm4a4';
    weaponSelect.dispatch('change');
    expect(values).toEqual([]);

    loadWeaponButton.dispatch('click');
    expect(values).toEqual(['m4a4']);

    controls.setSelectedWeapon('ak47');
    expect(weaponSelect.value).toBe('ak47');
  });
});
