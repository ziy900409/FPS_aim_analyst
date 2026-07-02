export interface ExportPanelOptions {
  onExportJSON: () => void | Promise<void>;
  onExportCSV: () => void | Promise<void>;
}

export function createExportPanel(opts: ExportPanelOptions): void {
  const root = document.createElement('div');
  root.id = 'export-panel';
  root.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'display:flex',
    'gap:8px',
    'z-index:11',
  ].join(';');

  const jsonButton = makeButton('JSON', 'Download JSON export');
  const csvButton = makeButton('CSV', 'Download CSV export');
  root.append(jsonButton, csvButton);
  document.body.appendChild(root);

  jsonButton.addEventListener('click', () => void runExport(jsonButton, opts.onExportJSON));
  csvButton.addEventListener('click', () => void runExport(csvButton, opts.onExportCSV));
}

function makeButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    'min-width:58px',
    'height:34px',
    'padding:0 12px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:700 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(24,27,30,0.92)',
    'cursor:pointer',
  ].join(';');
  return button;
}

async function runExport(button: HTMLButtonElement, action: () => void | Promise<void>): Promise<void> {
  button.disabled = true;
  try {
    await action();
  } catch (error) {
    console.error('[export]', error);
    window.alert(error instanceof Error ? error.message : 'Export failed');
  } finally {
    button.disabled = false;
  }
}
