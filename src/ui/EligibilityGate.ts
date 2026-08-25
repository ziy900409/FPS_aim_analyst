import { runEligibilityGate, type EligibilityRequirement, type GateReport } from '../display/eligibilityGate.ts';

/**
 * 資格閘畫面（純 TS DOM overlay,D1）— WP-20 T2（GD-10 防線①）。
 *
 * 實驗 session 進入流程:使用者按「進入 fullscreen 並開始」→（user gesture 內）請求 fullscreen →
 * warmup 探測 → `runEligibilityGate` 三檢查。全過 → `onEnter(report)`;不合格 → **拒入並逐項明示原因**
 * （native/fullscreen/perf ✓✗ + 全量 details）,提供重試。另提供 session 進行中退出 fullscreen 的警示條。
 */

export interface EligibilityGateScreenOptions {
  /** 原生解析度門檻。不同啟動模式（實驗/protocol vs Session Plan）門檻不同時傳函式,依 open() 當下狀態解析。 */
  required: EligibilityRequirement | (() => EligibilityRequirement);
  /** 請求 fullscreen（須在 user gesture 內呼叫;通常 = `element.requestFullscreen()`）。 */
  requestFullscreen: () => Promise<void>;
  /** warmup 探測 frame-time p95。 */
  probeWarmupP95Ms: () => Promise<number>;
  /** 資格閘判定（預設 `runEligibilityGate(required, p95)`;注入供測試）。 */
  runGate?: (warmupP95Ms: number) => GateReport;
  /** 三檢查全過 → 進入實驗 session。 */
  onEnter: (report: GateReport) => void;
  parent?: HTMLElement;
}

export interface EligibilityGateScreenHandle {
  /** 顯示資格閘啟動畫面。 */
  open(): void;
  /** 隱藏畫面。 */
  close(): void;
  /** session 進行中退出 fullscreen → 顯示警示條（failure mode）。 */
  showSuspectWarning(): void;
  hideSuspectWarning(): void;
  dispose(): void;
}

export function createEligibilityGateScreen(
  options: EligibilityGateScreenOptions,
): EligibilityGateScreenHandle {
  const parent = options.parent ?? document.body;
  const resolveRequired = (): EligibilityRequirement =>
    typeof options.required === 'function' ? options.required() : options.required;
  const runGate = options.runGate ?? ((p95: number) => runEligibilityGate(resolveRequired(), p95));

  const root = document.createElement('section');
  root.id = 'eligibility-gate';
  root.setAttribute('aria-label', 'Experiment eligibility gate');
  root.style.cssText = overlayCss;
  root.style.display = 'none';

  const card = document.createElement('div');
  card.style.cssText = cardCss;

  const title = document.createElement('h2');
  title.textContent = '實驗 session 資格閘';
  title.style.cssText = 'margin:0;font:750 18px/1.3 system-ui,sans-serif;color:#edf2f7';

  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0;font:500 13px/1.5 system-ui,sans-serif;color:#aeb6bf';

  const status = document.createElement('p');
  status.style.cssText = 'margin:0;font:600 13px/1.4 system-ui,sans-serif;color:#f0c674;min-height:18px';

  const report = document.createElement('pre');
  report.style.cssText =
    'margin:0;padding:10px;font:500 12px/1.5 ui-monospace,monospace;color:#e6e9ec;background:rgba(0,0,0,0.35);border-radius:6px;white-space:pre-wrap;display:none';

  const startButton = makeButton('進入 fullscreen 並開始', 'Enter fullscreen and run eligibility gate');
  const cancelButton = makeButton('取消', 'Close eligibility gate');
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px';
  buttonRow.append(startButton, cancelButton);

  card.append(title, desc, status, report, buttonRow);
  root.appendChild(card);

  const suspectBanner = document.createElement('div');
  suspectBanner.setAttribute('role', 'alert');
  suspectBanner.textContent = '⚠ 已離開 fullscreen — 本 session 資料標記為 suspect(條件失效)。';
  suspectBanner.style.cssText = suspectBannerCss;
  suspectBanner.style.display = 'none';

  parent.appendChild(root);
  parent.appendChild(suspectBanner);

  let running = false;

  async function attempt(): Promise<void> {
    if (running) return;
    running = true;
    startButton.disabled = true;
    cancelButton.disabled = true;
    report.style.display = 'none';
    status.textContent = '請求 fullscreen 並量測效能地板…';
    try {
      // fullscreen 須在 user gesture 內請求;拒絕不 throw 出流程,交由 gate 的 fullscreen 檢查判 FAIL。
      await options.requestFullscreen().catch(() => {});
      const p95 = await options.probeWarmupP95Ms();
      const result = runGate(p95);
      renderReport(result);
      if (result.pass) {
        options.onEnter(result);
        close();
        return;
      }
      status.textContent = '不合格 — 拒入實驗 session。修正下列項目後重試。';
      startButton.textContent = '重試';
    } catch (error) {
      status.textContent = `量測失敗:${error instanceof Error ? error.message : String(error)}`;
    } finally {
      startButton.disabled = false;
      cancelButton.disabled = false;
      running = false;
    }
  }

  function renderReport(result: GateReport): void {
    const rows = [
      `原生解析度   ${mark(result.native)}`,
      `Fullscreen   ${mark(result.fullscreen)}`,
      `效能地板     ${mark(result.perf)}`,
      '',
      result.details,
    ];
    report.textContent = rows.join('\n');
    report.style.display = 'block';
  }

  function open(): void {
    const required = resolveRequired();
    desc.textContent = `進入實驗 session 前須通過:原生解析度 ≥ ${required.minW}×${required.minH}、fullscreen 已進入、效能地板。不合格將拒入(一般練習不受限)。`;
    status.textContent = '';
    report.style.display = 'none';
    startButton.textContent = '進入 fullscreen 並開始';
    root.style.display = 'flex';
  }

  function close(): void {
    root.style.display = 'none';
  }

  startButton.addEventListener('click', () => void attempt());
  cancelButton.addEventListener('click', close);

  return {
    open,
    close,
    showSuspectWarning(): void {
      suspectBanner.style.display = 'block';
    },
    hideSuspectWarning(): void {
      suspectBanner.style.display = 'none';
    },
    dispose(): void {
      root.remove();
      suspectBanner.remove();
    },
  };
}

function mark(pass: boolean): string {
  return pass ? '✓ PASS' : '✗ FAIL';
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
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'background:rgba(10,12,14,0.82)',
  'pointer-events:auto',
  'z-index:60',
].join(';');

const cardCss = [
  'display:flex',
  'flex-direction:column',
  'gap:12px',
  'max-width:min(88vw,520px)',
  'padding:20px',
  'background:rgba(24,27,30,0.98)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:10px',
  'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
].join(';');

const suspectBannerCss = [
  'position:fixed',
  'top:12px',
  'left:50%',
  'transform:translateX(-50%)',
  'padding:8px 14px',
  'font:700 13px/1.3 system-ui,sans-serif',
  'color:#1a1206',
  'background:#f0c674',
  'border-radius:6px',
  'box-shadow:0 8px 24px rgba(0,0,0,0.3)',
  'pointer-events:none',
  'z-index:70',
].join(';');
