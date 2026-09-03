export type AppMode = 'launch' | 'session' | 'researcher';

export interface ResearcherMenuOptions {
  readonly onSelectDrillControls: () => void;
  readonly onSelectResolutionProtocol: () => void;
  readonly onSelectBrProtocol: () => void;
  /** WP-54 / T6: opens the tracking pilot operator screen (researcher-only manifest run). */
  readonly onSelectTrackingPilot: () => void;
  readonly parent?: HTMLElement;
}

export interface ResearcherMenuHandle {
  open(): void;
  close(): void;
  dispose(): void;
}

export function shouldShowResearcherControls(appMode: AppMode, visibleForRunState: boolean): boolean {
  return appMode === 'researcher' && visibleForRunState;
}

export function createResearcherMenu(options: ResearcherMenuOptions): ResearcherMenuHandle {
  const parent = options.parent ?? document.body;
  const root = document.createElement('section');
  root.id = 'researcher-menu';
  root.setAttribute('aria-label', '研究員模式');
  root.style.cssText = [
    'display:none',
    'flex-direction:column',
    'gap:8px',
    'padding:10px',
    'color:#edf2f7',
    'background:rgba(24,27,30,0.96)',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'box-shadow:0 12px 36px rgba(0,0,0,0.28)',
    'pointer-events:auto',
    'z-index:41',
  ].join(';');
  root.style.display = 'none';

  const title = document.createElement('h2');
  title.textContent = '研究員模式';
  title.style.cssText = 'margin:0;font:750 15px/1.3 system-ui,sans-serif';

  const drillControlsButton = makeButton('單一 Drill 調整', '顯示單一 drill 與場景控制');
  const resolutionProtocolButton = makeButton('解析度 protocol', '執行受試者內解析度 × 偵測 protocol');
  const brProtocolButton = makeButton('BR protocol', '執行 BR 跟槍 ADS × 彈道 × 角尺寸 protocol');
  // WP-54 / T6：tracking pilot 是 manifest 驅動的 researcher-only session（自帶
  // participant/session/rest 表單與 operator 畫面），語意與上面兩個 protocol 入口同層,
  // 不是「單一 Drill 調整」下拉選單裡的一個 drill。
  const trackingPilotButton = makeButton('Tracking pilot', '執行 WP-54 tracking pilot manifest（researcher-only）');

  drillControlsButton.addEventListener('click', options.onSelectDrillControls);
  resolutionProtocolButton.addEventListener('click', options.onSelectResolutionProtocol);
  brProtocolButton.addEventListener('click', options.onSelectBrProtocol);
  trackingPilotButton.addEventListener('click', options.onSelectTrackingPilot);

  root.append(title, drillControlsButton, resolutionProtocolButton, brProtocolButton, trackingPilotButton);
  parent.appendChild(root);

  return {
    open(): void {
      root.style.display = 'flex';
    },
    close(): void {
      root.style.display = 'none';
    },
    dispose(): void {
      root.remove();
    },
  };
}

function makeButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    'width:100%',
    'height:34px',
    'padding:0 14px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return button;
}
