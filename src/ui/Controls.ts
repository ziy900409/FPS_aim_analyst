export interface DrillControlOption {
  id: string;
  label: string;
}

export interface SceneControlOption {
  id: string;
  label: string;
}

export interface ControlsOptions {
  drills: DrillControlOption[];
  scenes: SceneControlOption[];
  selectedDrillId: string;
  selectedSceneId: string;
  onRestart: () => void | Promise<void>;
  onLoadDrill: (drillId: string) => void | Promise<void>;
  onLoadScene: (sceneId: string) => void | Promise<void>;
  parent?: HTMLElement;
}

export interface ControlsHandle {
  setVisible(visible: boolean): void;
  setSelectedDrill(drillId: string): void;
  setSelectedScene(sceneId: string): void;
  dispose(): void;
}

export function createControls(options: ControlsOptions): ControlsHandle {
  const parent = options.parent ?? document.body;
  let visible = true;

  const root = document.createElement('aside');
  root.id = 'drill-controls';
  root.setAttribute('aria-label', 'Drill controls');
  root.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:16px',
    'transform:translateX(-50%)',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:8px',
    'font:650 12px/1 system-ui,sans-serif',
    'color:#edf2f7',
    'background:rgba(24,27,30,0.94)',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'box-shadow:0 12px 36px rgba(0,0,0,0.28)',
    'pointer-events:auto',
    'user-select:none',
    'z-index:32',
  ].join(';');

  const restartButton = makeButton('Restart', 'Restart current drill');
  const select = makeSelect('drill-select', 'Select drill');

  for (const drill of options.drills) {
    const option = document.createElement('option');
    option.value = drill.id;
    option.textContent = drill.label;
    select.appendChild(option);
  }
  select.value = options.selectedDrillId;

  const loadButton = makeButton('Load', 'Load selected drill');
  const sceneSelect = makeSelect('scene-select', 'Select scene');
  for (const scene of options.scenes) {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.label;
    sceneSelect.appendChild(option);
  }
  sceneSelect.value = options.selectedSceneId;
  const loadSceneButton = makeButton('Scene', 'Load selected scene');
  const allControls = [restartButton, select, loadButton, sceneSelect, loadSceneButton];

  root.append(restartButton, select, loadButton, sceneSelect, loadSceneButton);
  parent.appendChild(root);

  restartButton.addEventListener('click', () => void runControl(allControls, options.onRestart));
  loadButton.addEventListener('click', () =>
    void runControl(allControls, () => options.onLoadDrill(select.value)),
  );
  loadSceneButton.addEventListener('click', () =>
    void runControl(allControls, () => options.onLoadScene(sceneSelect.value)),
  );

  return {
    setVisible(next: boolean): void {
      if (next === visible) return;
      visible = next;
      root.style.display = next ? 'flex' : 'none';
    },
    setSelectedDrill(drillId: string): void {
      select.value = drillId;
    },
    setSelectedScene(sceneId: string): void {
      sceneSelect.value = sceneId;
    },
    dispose(): void {
      root.remove();
    },
  };
}

function makeSelect(id: string, title: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = id;
  select.title = title;
  select.style.cssText = [
    'height:34px',
    'max-width:min(52vw,260px)',
    'padding:0 10px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:650 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return select;
}

function makeButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    'height:34px',
    'min-width:74px',
    'padding:0 12px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return button;
}

async function runControl(controls: Array<HTMLButtonElement | HTMLSelectElement>, action: () => void | Promise<void>): Promise<void> {
  for (const control of controls) control.disabled = true;
  try {
    await action();
  } catch (error) {
    console.error('[controls]', error);
    window.alert(error instanceof Error ? error.message : 'Control action failed');
  } finally {
    for (const control of controls) control.disabled = false;
  }
}
