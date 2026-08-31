/**
 * ReplayTransport — WP-50 / T5（README §2.8/FR-50.7～9）
 *
 * Bottom transport bar（previous event / play-pause / next event / time+duration / seek slider /
 * rate segmented control）＋ seek-track event markers ＋ scrollable event list（cue/visible/counter/
 * fire/hit — FR-50.8, `ads`/`target_stop`/`key` excluded）＋ a compact keys/ADS/speed/timestamp HUD
 * meant to sit over the viewport (`hudElement`, positioned by `ReplayScreen`).
 *
 * Pure DOM component: owns no clock, no `ReplayPlayer`, no Three.js. The caller drives `update()`
 * once per app frame with the very `ReplaySample`/`ReplayPlaybackState` that also drove the scene
 * render (README §2.9 "同一 sample 更新"), and this component never reads live state on its own —
 * every value shown comes from that single `update()` call. `controls` is the narrow subset of
 * `ReplayPlayer` this UI needs to invoke (a full `ReplayPlayer` satisfies it structurally).
 */

import type { NormalizedReplayEvent, ReplayPlaybackState, ReplayRate, ReplayRecording, ReplaySample } from '../../replay/contracts.ts';

const RATES: readonly ReplayRate[] = [0.25, 0.5, 1, 2];

/** FR-50.8: the timeline/event list surfaces cue/visible/counter/fire/hit only — `ads`/`target_stop`/
 * `key` are per-tick input state, not standalone "events" a user would jump between. */
const TIMELINE_EVENT_KINDS = new Set(['cue', 'visible', 'counter', 'fire', 'hit']);

const KEY_ORDER: readonly ('W' | 'A' | 'S' | 'D')[] = ['W', 'A', 'S', 'D'];

export interface ReplayTransportControls {
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setRate(rate: ReplayRate): void;
  previousEvent(): void;
  nextEvent(): void;
}

export interface ReplayTransportOptions {
  readonly recording: ReplayRecording;
  readonly controls: ReplayTransportControls;
}

export interface ReplayTransportHandle {
  /** Bottom bar: seek track + markers, play controls, rate group, event list. */
  readonly element: HTMLElement;
  /** Compact top-left HUD (keys/ADS/speed/timestamp) — caller positions this over the viewport. */
  readonly hudElement: HTMLElement;
  /** Called once per app frame with the sample/playback state driving the current render frame. */
  update(sample: ReplaySample, playback: ReplayPlaybackState): void;
  /** Space-bar shortcut entry point (README §2.8) — `ReplayScreen` owns the keydown listener and
   * calls this rather than duplicating play/pause status tracking. */
  togglePlayPause(): void;
  dispose(): void;
}

interface TimelineEntry {
  readonly event: NormalizedReplayEvent;
  readonly label: string;
  readonly button: HTMLButtonElement;
}

export function createReplayTransport(options: ReplayTransportOptions): ReplayTransportHandle {
  const { recording, controls } = options;
  const duration = Math.max(recording.durationMs, 0);
  let lastStatus: ReplayPlaybackState['status'] = 'paused';

  // ---- HUD ------------------------------------------------------------------------------------
  const hud = document.createElement('div');
  hud.dataset.section = 'replay-hud';
  // Decorative telemetry read-out only — the accessible current-time equivalent lives on the seek
  // slider's `aria-valuetext` below; a 60fps-updating live region would spam screen readers.
  hud.setAttribute('aria-hidden', 'true');
  hud.style.cssText = [
    'position:absolute',
    'left:10px',
    'top:10px',
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'padding:8px 10px',
    'background:rgba(15,18,21,0.72)',
    'border:1px solid rgba(255,255,255,0.13)',
    'border-radius:6px',
    'font:650 11px/1.3 system-ui,sans-serif',
    'color:#edf2f7',
    'pointer-events:none',
    'user-select:none',
  ].join(';');

  const keysRow = document.createElement('div');
  keysRow.style.cssText = 'display:flex;gap:4px';
  const keyEls = new Map<string, HTMLElement>();
  for (const key of KEY_ORDER) {
    const el = document.createElement('span');
    el.textContent = key;
    el.style.cssText = keyChipCss(false);
    keysRow.appendChild(el);
    keyEls.set(key, el);
  }

  const adsEl = document.createElement('div');
  adsEl.textContent = 'ADS';
  adsEl.style.cssText = 'opacity:0.4';

  const speedEl = document.createElement('div');
  speedEl.style.cssText = 'font-variant-numeric:tabular-nums';

  const hudTimeEl = document.createElement('div');
  hudTimeEl.style.cssText = 'font-variant-numeric:tabular-nums;color:#9fd0ff';

  hud.append(keysRow, adsEl, speedEl, hudTimeEl);

  // ---- Seek track + markers ---------------------------------------------------------------------
  const root = document.createElement('div');
  root.dataset.section = 'replay-transport';
  root.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'padding:10px 12px',
    'box-sizing:border-box',
    'background:rgba(24,27,30,0.96)',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'font:600 12px/1.3 system-ui,sans-serif',
    'color:#edf2f7',
  ].join(';');

  const trackWrap = document.createElement('div');
  trackWrap.style.cssText = 'position:relative;padding:6px 0';

  const markersLayer = document.createElement('div');
  markersLayer.dataset.section = 'replay-event-markers';
  markersLayer.style.cssText = 'position:absolute;left:0;right:0;top:9px;height:6px;pointer-events:none';

  const seek = document.createElement('input');
  seek.type = 'range';
  seek.min = '0';
  seek.max = String(duration);
  seek.step = '1';
  seek.value = '0';
  seek.dataset.replayAction = 'seek';
  seek.setAttribute('aria-label', '播放進度');
  seek.style.cssText = 'width:100%;cursor:pointer;position:relative;z-index:1;margin:0';

  trackWrap.append(markersLayer, seek);

  const timeline: TimelineEntry[] = recording.events
    .filter((event) => TIMELINE_EVENT_KINDS.has(event.raw.type))
    .map((event) => {
      const marker = document.createElement('div');
      marker.dataset.eventKind = event.raw.type;
      marker.style.cssText = [
        'position:absolute',
        'top:0',
        'width:2px',
        'height:6px',
        'background:rgba(255,204,85,0.85)',
        `left:${pct(event.timeMs, duration)}%`,
      ].join(';');
      markersLayer.appendChild(marker);
      return { event, label: describeEvent(event), button: document.createElement('button') };
    });

  // ---- Controls row ----------------------------------------------------------------------------
  const controlsRow = document.createElement('div');
  controlsRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';

  const prevBtn = makeIconButton('⏮', '上一個事件');
  prevBtn.dataset.replayAction = 'previous-event';
  const playBtn = makeIconButton('▶', '播放');
  playBtn.dataset.replayAction = 'play-pause';
  const nextBtn = makeIconButton('⏭', '下一個事件');
  nextBtn.dataset.replayAction = 'next-event';

  const timeText = document.createElement('span');
  timeText.dataset.section = 'replay-time';
  timeText.style.cssText = 'font-variant-numeric:tabular-nums;min-width:112px';

  const rateGroup = document.createElement('div');
  rateGroup.dataset.section = 'replay-rate-group';
  rateGroup.setAttribute('role', 'group');
  rateGroup.setAttribute('aria-label', '播放速度');
  rateGroup.style.cssText = 'display:flex;gap:4px;margin-left:auto';

  const rateButtons = new Map<ReplayRate, HTMLButtonElement>();
  for (const rate of RATES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${rate}×`;
    button.dataset.replayAction = 'set-rate';
    button.dataset.rate = String(rate);
    button.setAttribute('aria-pressed', 'false');
    button.style.cssText = rateButtonCss(false);
    button.addEventListener('click', () => controls.setRate(rate));
    rateGroup.appendChild(button);
    rateButtons.set(rate, button);
  }

  prevBtn.addEventListener('click', () => controls.previousEvent());
  nextBtn.addEventListener('click', () => controls.nextEvent());
  playBtn.addEventListener('click', () => togglePlayPause());
  seek.addEventListener('input', () => controls.seek(seek.valueAsNumber));

  controlsRow.append(prevBtn, playBtn, nextBtn, timeText, rateGroup);

  // ---- Event list --------------------------------------------------------------------------------
  const eventList = document.createElement('ul');
  eventList.dataset.section = 'replay-event-list';
  eventList.setAttribute('aria-label', '事件列表');
  eventList.style.cssText = [
    'list-style:none',
    'margin:0',
    'padding:0',
    'max-height:140px',
    'overflow:auto',
    'display:flex',
    'flex-direction:column',
    'gap:2px',
  ].join(';');

  for (const entry of timeline) {
    const li = document.createElement('li');
    entry.button.type = 'button';
    entry.button.textContent = `${formatTimeMs(entry.event.timeMs)} · ${entry.label}`;
    entry.button.dataset.replayAction = 'seek-to-event';
    entry.button.dataset.eventKind = entry.event.raw.type;
    entry.button.setAttribute('aria-current', 'false');
    entry.button.style.cssText = eventItemCss(false);
    entry.button.addEventListener('click', () => controls.seek(entry.event.timeMs));
    li.appendChild(entry.button);
    eventList.appendChild(li);
  }

  root.append(trackWrap, controlsRow, eventList);

  function togglePlayPause(): void {
    if (lastStatus === 'playing') controls.pause();
    else controls.play();
  }

  function update(sample: ReplaySample, playback: ReplayPlaybackState): void {
    lastStatus = playback.status;

    if (document.activeElement !== seek) seek.value = String(sample.timeMs);
    seek.setAttribute('aria-valuetext', `${formatTimeMs(sample.timeMs)} / ${formatTimeMs(duration)}`);

    timeText.textContent = `${formatTimeMs(sample.timeMs)} / ${formatTimeMs(duration)}`;

    const playLabel = playback.status === 'playing' ? '暫停' : playback.status === 'ended' ? '重新播放' : '播放';
    playBtn.textContent = playback.status === 'playing' ? '⏸' : playback.status === 'ended' ? '⟳' : '▶';
    playBtn.setAttribute('aria-label', playLabel);
    playBtn.title = playLabel;

    for (const [rate, button] of rateButtons) {
      const active = rate === playback.rate;
      button.setAttribute('aria-pressed', String(active));
      button.style.cssText = rateButtonCss(active);
    }

    const hasEvents = timeline.length > 0;
    prevBtn.disabled = !hasEvents || sample.timeMs <= timeline[0].event.timeMs;
    nextBtn.disabled = !hasEvents || sample.timeMs >= timeline[timeline.length - 1].event.timeMs;

    let currentIndex = -1;
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].event.timeMs <= sample.timeMs) currentIndex = i;
      else break;
    }
    timeline.forEach((entry, index) => {
      const active = index === currentIndex;
      entry.button.setAttribute('aria-current', String(active));
      entry.button.style.cssText = eventItemCss(active);
    });

    // HUD
    for (const key of KEY_ORDER) {
      const active = sample.input.keys.includes(key);
      keyEls.get(key)!.style.cssText = keyChipCss(active);
    }
    adsEl.style.opacity = sample.input.ads ? '1' : '0.4';
    speedEl.textContent = `${Math.round(sample.player.speed)} u/s`;
    hudTimeEl.textContent = formatTimeMs(sample.timeMs);
  }

  return {
    element: root,
    hudElement: hud,
    update,
    togglePlayPause,
    dispose(): void {
      root.remove();
      hud.remove();
    },
  };
}

function describeEvent(event: NormalizedReplayEvent): string {
  const raw = event.raw;
  switch (raw.type) {
    case 'cue':
      return `方向提示${typeof raw.direction === 'string' ? ` ${raw.direction}` : ''}`;
    case 'visible':
      return `目標出現${typeof raw.targetId === 'string' ? ` ${raw.targetId}` : ''}`;
    case 'counter':
      return `反向鍵${typeof raw.key === 'string' ? ` ${raw.key}` : ''}`;
    case 'fire':
      return raw.hit === true ? '射擊（命中）' : '射擊';
    case 'hit':
      return `命中${typeof raw.part === 'string' ? ` ${raw.part}` : ''}`;
    default:
      return raw.type;
  }
}

function pct(timeMs: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, (timeMs / duration) * 100));
}

function formatTimeMs(ms: number): string {
  const safeMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalTenths = Math.floor(safeMs / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function makeIconButton(glyph: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = glyph;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.style.cssText = [
    'height:30px',
    'min-width:34px',
    'padding:0 8px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:650 13px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return button;
}

function rateButtonCss(active: boolean): string {
  return [
    'height:26px',
    'padding:0 8px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:5px',
    'font:700 11px/1 system-ui,sans-serif',
    `color:${active ? '#0a0c0e' : '#e6e9ec'}`,
    `background:${active ? '#9fd0ff' : 'rgba(15,18,21,0.96)'}`,
    'cursor:pointer',
  ].join(';');
}

function eventItemCss(active: boolean): string {
  return [
    'display:block',
    'width:100%',
    'text-align:left',
    'padding:4px 8px',
    'border:1px solid transparent',
    'border-radius:4px',
    `font-weight:${active ? '750' : '500'}`,
    `background:${active ? 'rgba(125,211,252,0.24)' : 'transparent'}`,
    `border-color:${active ? 'rgba(125,211,252,0.5)' : 'transparent'}`,
    'color:#e6e9ec',
    'cursor:pointer',
  ].join(';');
}

function keyChipCss(active: boolean): string {
  return [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:16px',
    'height:16px',
    'border-radius:3px',
    `background:${active ? '#9fd0ff' : 'rgba(255,255,255,0.14)'}`,
    `color:${active ? '#0a0c0e' : '#aeb9c4'}`,
    'font:750 10px/1 system-ui,sans-serif',
  ].join(';');
}
