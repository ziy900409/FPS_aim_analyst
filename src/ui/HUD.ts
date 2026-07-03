import type { DrillPhase } from '../drill/DrillRunner.ts';
import type { SharedState } from '../state/SharedState.ts';

const STOP_EPSILON = 0.001;

export interface HUDStats {
  phase: DrillPhase;
  elapsedMs: number;
  score: number;
  fireCount: number;
  hitCount: number;
  vx: number;
  vz: number;
  stopped: boolean;
}

export interface HUDSummary {
  scoreText: string;
  timeText: string;
  hitRateText: string;
  velocityText: string;
  velocityDetail: string;
  stopped: boolean;
}

export interface HUDHandle {
  update(stats: HUDStats): void;
  dispose(): void;
}

export interface HUDOptions {
  parent?: HTMLElement;
}

export function createHUD(options: HUDOptions = {}): HUDHandle {
  const parent = options.parent ?? document.body;

  const root = document.createElement('aside');
  root.id = 'metrics-hud';
  root.setAttribute('aria-label', 'Drill HUD');
  root.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:12px',
    'display:grid',
    'grid-template-columns:repeat(4,minmax(92px,auto))',
    'gap:8px',
    'font:650 12px/1.25 system-ui,sans-serif',
    'color:#edf2f7',
    'pointer-events:none',
    'user-select:none',
    'z-index:18',
  ].join(';');

  const scoreValue = document.createElement('div');
  const timeValue = document.createElement('div');
  const hitRateValue = document.createElement('div');
  const velocityValue = document.createElement('div');
  const velocityDetail = document.createElement('div');
  const velocityBar = document.createElement('div');
  const summary: HUDSummary = {
    scoreText: '0',
    timeText: '00:00.0',
    hitRateText: 'N/A',
    velocityText: 'STOP',
    velocityDetail: '0 u/s',
    stopped: true,
  };

  const scoreCard = renderMetric('Score', scoreValue);
  const timeCard = renderMetric('Time', timeValue);
  const hitRateCard = renderMetric('Hit rate', hitRateValue);
  const velocityCard = renderMetric('Velocity', velocityValue, velocityDetail, velocityBar);

  root.append(scoreCard, timeCard, hitRateCard, velocityCard);
  parent.appendChild(root);

  function update(stats: HUDStats): void {
    fillHUDSummary(stats, summary);
    scoreValue.textContent = summary.scoreText;
    timeValue.textContent = summary.timeText;
    hitRateValue.textContent = summary.hitRateText;
    velocityValue.textContent = summary.velocityText;
    velocityDetail.textContent = summary.velocityDetail;
    velocityBar.style.background = summary.stopped ? '#7ee787' : '#ffcc66';
    velocityBar.style.transform = summary.stopped ? 'scaleX(0.22)' : 'scaleX(1)';
  }

  return {
    update,
    dispose(): void {
      root.remove();
    },
  };
}

export function createHUDStats(
  state: SharedState,
  phase: DrillPhase,
  elapsedMs: number,
  score: number,
  fireCount: number,
  hitCount: number,
  target: HUDStats,
): HUDStats {
  target.phase = phase;
  target.elapsedMs = elapsedMs;
  target.score = score;
  target.fireCount = fireCount;
  target.hitCount = hitCount;
  target.vx = state.player.vx;
  target.vz = state.player.vz;
  target.stopped = state.player.stopped;
  return target;
}

export function createHUDSummary(stats: HUDStats): HUDSummary {
  return fillHUDSummary(stats, {
    scoreText: '0',
    timeText: '00:00.0',
    hitRateText: 'N/A',
    velocityText: 'STOP',
    velocityDetail: '0 u/s',
    stopped: true,
  });
}

function fillHUDSummary(stats: HUDStats, target: HUDSummary): HUDSummary {
  const speed = Math.hypot(stats.vx, stats.vz);
  const stopped = stats.stopped || speed <= STOP_EPSILON;
  target.scoreText = String(stats.score);
  target.timeText = formatElapsed(stats.elapsedMs);
  target.hitRateText = stats.fireCount > 0 ? `${formatNumber((stats.hitCount / stats.fireCount) * 100, 1)}%` : 'N/A';
  target.velocityText = stopped ? 'STOP' : 'MOVING';
  target.velocityDetail = `${formatNumber(speed, 0)} u/s`;
  target.stopped = stopped;
  return target;
}

function renderMetric(labelText: string, value: HTMLElement, detail?: HTMLElement, bar?: HTMLElement): HTMLElement {
  const card = document.createElement('section');
  card.style.cssText = [
    'min-width:92px',
    'box-sizing:border-box',
    'padding:8px 10px',
    'background:rgba(15,18,21,0.72)',
    'border:1px solid rgba(255,255,255,0.13)',
    'border-radius:6px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.22)',
  ].join(';');

  const label = document.createElement('div');
  label.textContent = labelText;
  label.style.cssText = 'margin-bottom:4px;color:#aeb9c4;font:650 11px/1.2 system-ui,sans-serif';

  value.style.cssText = 'font:760 20px/1.05 system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:0';
  card.append(label, value);

  if (detail !== undefined) {
    detail.style.cssText = 'margin-top:3px;color:#c8d0d8;font:600 11px/1.2 ui-monospace,monospace';
    card.appendChild(detail);
  }

  if (bar !== undefined) {
    const track = document.createElement('div');
    track.style.cssText = [
      'height:4px',
      'margin-top:7px',
      'overflow:hidden',
      'background:rgba(255,255,255,0.16)',
      'border-radius:999px',
    ].join(';');
    bar.style.cssText = [
      'width:100%',
      'height:100%',
      'transform-origin:left center',
      'transition:transform 80ms linear,background 80ms linear',
    ].join(';');
    track.appendChild(bar);
    card.appendChild(track);
  }

  return card;
}

function formatElapsed(ms: number): string {
  const safeMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalTenths = Math.floor(safeMs / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function formatNumber(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : 'N/A';
}
