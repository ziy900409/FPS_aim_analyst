import { runEligibilityGate, type EligibilityRequirement, type GateReport } from '../display/eligibilityGate.ts';

export interface ConditionRecoveryScreenOptions {
  required: EligibilityRequirement | (() => EligibilityRequirement);
  requestFullscreen: () => Promise<void>;
  probeWarmupP95Ms: () => Promise<number>;
  runGate?: (warmupP95Ms: number) => GateReport;
  parent?: HTMLElement;
}

export interface ConditionRecoveryScreenOpenOptions {
  onRecovered: (report: GateReport) => void;
}

export interface ConditionRecoveryScreenHandle {
  open(options: ConditionRecoveryScreenOpenOptions): void;
  close(): void;
  dispose(): void;
}

export function createConditionRecoveryScreen(
  options: ConditionRecoveryScreenOptions,
): ConditionRecoveryScreenHandle {
  const parent = options.parent ?? document.body;
  const resolveRequired = (): EligibilityRequirement =>
    typeof options.required === 'function' ? options.required() : options.required;
  const runGate = options.runGate ?? ((p95: number) => runEligibilityGate(resolveRequired(), p95));

  const root = document.createElement('section');
  root.id = 'condition-recovery-screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('aria-label', 'Condition recovery');
  root.style.cssText = overlayCss;
  root.style.display = 'none';

  const panel = document.createElement('div');
  panel.style.cssText = panelCss;

  const title = document.createElement('h2');
  title.textContent = '恢復實驗條件';
  title.style.cssText = 'margin:0;font:750 18px/1.3 system-ui,sans-serif;color:#edf2f7';

  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0;font:500 13px/1.5 system-ui,sans-serif;color:#dbe4ee';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin:0;min-height:18px;font:700 13px/1.4 system-ui,sans-serif;color:#f0c674';

  const report = document.createElement('pre');
  report.style.cssText =
    'margin:0;padding:10px;font:500 12px/1.5 ui-monospace,monospace;color:#e6e9ec;background:rgba(0,0,0,0.35);border-radius:6px;white-space:pre-wrap;display:none';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end';
  const recoverButton = makeButton('重新進入 fullscreen', 'Retry fullscreen and condition gate');
  const closeButton = makeButton('取消', 'Close condition recovery');
  actions.append(recoverButton, closeButton);

  panel.append(title, desc, status, report, actions);
  root.appendChild(panel);
  parent.appendChild(root);

  let running = false;
  let onRecovered: ((report: GateReport) => void) | undefined;

  async function recover(): Promise<void> {
    if (running) return;
    running = true;
    recoverButton.disabled = true;
    closeButton.disabled = true;
    report.style.display = 'none';
    status.textContent = '正在恢復 fullscreen 並重驗條件...';

    try {
      const fullscreenRequest = options.requestFullscreen();
      await fullscreenRequest;
    } catch {
      status.textContent = '無法進入 fullscreen，請再按一次重試。';
      recoverButton.textContent = '重試 fullscreen';
      recoverButton.disabled = false;
      closeButton.disabled = false;
      running = false;
      return;
    }

    try {
      const p95 = await options.probeWarmupP95Ms();
      const result = runGate(p95);
      renderReport(result);
      if (!result.pass) {
        status.textContent = '條件仍未通過，請修正後重試。';
        recoverButton.textContent = '重試條件檢查';
        return;
      }
      const callback = onRecovered;
      close();
      callback?.(result);
    } catch (error) {
      status.textContent = `恢復檢查失敗：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      recoverButton.disabled = false;
      closeButton.disabled = false;
      running = false;
    }
  }

  function renderReport(result: GateReport): void {
    report.textContent = [
      `native:     ${mark(result.native)}`,
      `fullscreen: ${mark(result.fullscreen)}`,
      `perf:       ${mark(result.perf)}`,
      '',
      result.details,
    ].join('\n');
    report.style.display = 'block';
  }

  function open(openOptions: ConditionRecoveryScreenOpenOptions): void {
    onRecovered = openOptions.onRecovered;
    const required = resolveRequired();
    desc.textContent = `重新取得 fullscreen 後會重跑三項條件：原生解析度 ${required.minW}x${required.minH}、fullscreen、warmup p95。`;
    status.textContent = '';
    report.style.display = 'none';
    recoverButton.textContent = '重新進入 fullscreen';
    recoverButton.disabled = false;
    closeButton.disabled = false;
    root.style.display = 'flex';
    root.setAttribute('aria-hidden', 'false');
  }

  function close(): void {
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    onRecovered = undefined;
  }

  recoverButton.addEventListener('click', () => void recover());
  closeButton.addEventListener('click', close);

  return {
    open,
    close,
    dispose(): void {
      root.remove();
    },
  };
}

function mark(pass: boolean): string {
  return pass ? 'PASS' : 'FAIL';
}

function makeButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    'height:38px',
    'padding:0 16px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 13px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return button;
}

const overlayCss = [
  'position:fixed',
  'inset:0',
  'box-sizing:border-box',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'padding:24px',
  'background:rgba(10,12,14,0.86)',
  'pointer-events:auto',
  'z-index:58',
].join(';');

const panelCss = [
  'display:flex',
  'flex-direction:column',
  'gap:12px',
  'width:min(88vw,520px)',
  'padding:20px',
  'background:rgba(24,27,30,0.98)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:8px',
  'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
].join(';');
