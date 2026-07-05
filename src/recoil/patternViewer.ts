import { createRecoilState, recoilOnFire, recoilTick, type WeaponRecoilLike } from './punch.ts';
import { createRan1, type Rng } from './rng.ts';
import { generateRecoilTable, type WeaponRecoilParams } from './recoilTable.ts';
import { sampleSpread, type WeaponInaccuracyLike } from './spread.ts';

const RECOIL_DT_SEC = 1 / 64;
const SHOT_COUNT = 30;
const CLOUD_SAMPLES_PER_SHOT = 12;

interface PatternParams extends WeaponRecoilParams {
  cycletimeSec: number;
}

interface PatternShot {
  shot: number;
  timeSec: number;
  xDeg: number;
  yDeg: number;
  spreadRadiusDeg: number;
  rawPunchPitchDeg: number;
  rawPunchYawDeg: number;
  cloud: Array<{ xDeg: number; yDeg: number }>;
}

interface PatternResult {
  params: PatternParams;
  shots: PatternShot[];
}

type PatternInputKey = keyof PatternParams;

const AK_INACCURACY = {
  stand: 0.00641,
  crouch: 0.00481,
  fire: 0.0078,
  move: 0.02,
  recoveryTimeStand: 0.4,
};

const PRESETS: Record<string, PatternParams> = {
  'AK-47': {
    seed: 223,
    magnitude: 30,
    magnitudeVariance: 0,
    angleVariance: 70,
    cycletimeSec: 0.1,
  },
  M4A4: {
    seed: 38965,
    magnitude: 23,
    magnitudeVariance: 0,
    angleVariance: 70,
    cycletimeSec: 0.09,
  },
  'M4A1-S': {
    seed: 38965,
    magnitude: 25,
    magnitudeVariance: 3,
    angleVariance: 65,
    cycletimeSec: 0.1,
  },
};

const FIELDS: Array<{
  key: PatternInputKey;
  label: string;
  step: string;
  min?: string;
}> = [
  { key: 'seed', label: 'Seed', step: '1' },
  { key: 'magnitude', label: 'Magnitude', step: '0.1', min: '0' },
  { key: 'magnitudeVariance', label: 'Variance', step: '0.1', min: '0' },
  { key: 'angleVariance', label: 'Angle variance', step: '0.1', min: '0' },
  { key: 'cycletimeSec', label: 'Cycletime', step: '0.01', min: '0.001' },
];

export function mountPatternViewer(): void {
  if (document.getElementById('pattern-viewer')) return;

  const root = document.createElement('section');
  root.id = 'pattern-viewer';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:60',
    'display:grid',
    'grid-template-rows:auto 1fr',
    'background:#111318',
    'color:#eef2f6',
    'font:14px/1.4 system-ui,sans-serif',
  ].join(';');

  const toolbar = document.createElement('form');
  toolbar.style.cssText = [
    'display:flex',
    'align-items:end',
    'gap:10px',
    'padding:12px',
    'background:#1b1f27',
    'border-bottom:1px solid #343b46',
    'box-shadow:0 1px 0 rgba(255,255,255,0.04)',
    'flex-wrap:wrap',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Recoil Pattern';
  title.style.cssText = [
    'font:700 18px/1.2 system-ui,sans-serif',
    'margin-right:8px',
    'min-width:140px',
  ].join(';');
  toolbar.appendChild(title);

  const inputs = new Map<PatternInputKey, HTMLInputElement>();
  for (const field of FIELDS) {
    const input = createNumberInput(field, PRESETS['AK-47'][field.key]);
    inputs.set(field.key, input);
    toolbar.appendChild(input.parentElement ?? input);
  }

  const presetGroup = document.createElement('div');
  presetGroup.style.cssText = 'display:flex;gap:6px;align-items:center';
  for (const [name, params] of Object.entries(PRESETS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.style.cssText = buttonCss();
    button.addEventListener('click', () => {
      writeParams(inputs, params);
      render();
    });
    presetGroup.appendChild(button);
  }
  toolbar.appendChild(presetGroup);

  const status = document.createElement('div');
  status.style.cssText = [
    'margin-left:auto',
    'font:600 12px/1.3 ui-monospace,monospace',
    'color:#a8d5ff',
    'white-space:pre',
  ].join(';');
  toolbar.appendChild(status);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = [
    'display:block',
    'width:100%',
    'height:100%',
    'background:#f8fafc',
  ].join(';');

  root.append(toolbar, canvas);
  document.body.appendChild(root);

  for (const input of inputs.values()) input.addEventListener('input', render);
  window.addEventListener('resize', render);
  render();

  function render(): void {
    try {
      const result = simulatePattern(readParams(inputs));
      drawPattern(canvas, result);
      const last = result.shots[result.shots.length - 1];
      const firstNineClimb = isFirstNineVerticalClimb(result.shots);
      status.textContent = [
        `shots ${result.shots.length}`,
        `raw pitch ${last.rawPunchPitchDeg.toFixed(2)} deg`,
        `raw yaw ${last.rawPunchYawDeg.toFixed(2)} deg`,
        `AK climb ${firstNineClimb ? 'PASS' : 'CHECK'}`,
      ].join('\n');
      status.style.color = firstNineClimb ? '#7ee787' : '#ffd166';
    } catch (error) {
      clearCanvas(canvas);
      status.textContent = error instanceof Error ? error.message : String(error);
      status.style.color = '#ff7b72';
    }
  }
}

function simulatePattern(params: PatternParams): PatternResult {
  const table = generateRecoilTable(params);
  const state = createRecoilState();
  const spreadRng = createRan1(params.seed);
  const weapon: WeaponRecoilLike & WeaponInaccuracyLike = {
    cycletimeSec: params.cycletimeSec,
    inaccuracy: AK_INACCURACY,
  };
  const shots: PatternShot[] = [];
  let elapsedSec = 0;

  for (let shot = 1; shot <= SHOT_COUNT; shot++) {
    const fireAtSec = (shot - 1) * params.cycletimeSec;
    while (elapsedSec + 1e-12 < fireAtSec) {
      recoilTick(state, RECOIL_DT_SEC);
      elapsedSec += RECOIL_DT_SEC;
    }

    recoilOnFire(state, weapon, table);
    const xDeg = -state.aimPunchYawDeg * 2;
    const yDeg = -state.aimPunchPitchDeg * 2;
    const spreadRadiusDeg = maxSpreadRadiusDeg(state, weapon);
    const cloud = Array.from({ length: CLOUD_SAMPLES_PER_SHOT }, () => {
      const spread = sampleSpread(state, weapon, 0, spreadRng);
      return { xDeg: xDeg + spread.x, yDeg: yDeg + spread.y };
    });

    shots.push({
      shot,
      timeSec: elapsedSec,
      xDeg,
      yDeg,
      spreadRadiusDeg,
      rawPunchPitchDeg: state.aimPunchPitchDeg * 2,
      rawPunchYawDeg: state.aimPunchYawDeg * 2,
      cloud,
    });
  }

  return { params, shots };
}

function maxSpreadRadiusDeg(
  state: Parameters<typeof sampleSpread>[0],
  weapon: WeaponInaccuracyLike,
): number {
  const sample = sampleSpread(state, weapon, 0, sequenceRng([0, 1]));
  return Math.hypot(sample.x, sample.y);
}

function drawPattern(canvas: HTMLCanvasElement, result: PatternResult): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const bounds = patternBounds(result.shots);
  const margin = 54;
  const plotWidth = Math.max(1, rect.width - margin * 2);
  const plotHeight = Math.max(1, rect.height - margin * 2);
  const scale = Math.min(plotWidth / (bounds.maxX - bounds.minX), plotHeight / (bounds.maxY - bounds.minY));
  const toCanvas = (xDeg: number, yDeg: number) => ({
    x: margin + (xDeg - bounds.minX) * scale,
    y: margin + (yDeg - bounds.minY) * scale,
  });

  drawGrid(ctx, rect.width, rect.height, bounds, toCanvas);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2563eb';
  ctx.beginPath();
  result.shots.forEach((shot, index) => {
    const p = toCanvas(shot.xDeg, shot.yDeg);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  for (const shot of result.shots) {
    const center = toCanvas(shot.xDeg, shot.yDeg);
    const radiusPx = Math.max(2, shot.spreadRadiusDeg * scale);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
    for (const dot of shot.cloud) {
      const p = toCanvas(dot.xDeg, dot.yDeg);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = '600 11px ui-monospace,monospace';
    ctx.fillText(String(shot.shot), center.x + 7, center.y - 7);
  }

  const origin = toCanvas(0, 0);
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: ReturnType<typeof patternBounds>,
  toCanvas: (xDeg: number, yDeg: number) => { x: number; y: number },
): void {
  const xStep = niceStep(bounds.maxX - bounds.minX);
  const yStep = niceStep(bounds.maxY - bounds.minY);

  ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace,monospace';
  ctx.textBaseline = 'top';

  for (let x = Math.ceil(bounds.minX / xStep) * xStep; x <= bounds.maxX; x += xStep) {
    const p = toCanvas(x, 0);
    ctx.strokeStyle = Math.abs(x) < 1e-9 ? '#64748b' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x, height);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${x.toFixed(1)} yaw`, p.x + 4, 8);
  }

  for (let y = Math.ceil(bounds.minY / yStep) * yStep; y <= bounds.maxY; y += yStep) {
    const p = toCanvas(0, y);
    ctx.strokeStyle = Math.abs(y) < 1e-9 ? '#64748b' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(width, p.y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${y.toFixed(1)} pitch`, 8, p.y + 4);
  }
}

function patternBounds(shots: PatternShot[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  for (const shot of shots) {
    minX = Math.min(minX, shot.xDeg - shot.spreadRadiusDeg);
    maxX = Math.max(maxX, shot.xDeg + shot.spreadRadiusDeg);
    minY = Math.min(minY, shot.yDeg - shot.spreadRadiusDeg);
    maxY = Math.max(maxY, shot.yDeg + shot.spreadRadiusDeg);
    for (const dot of shot.cloud) {
      minX = Math.min(minX, dot.xDeg);
      maxX = Math.max(maxX, dot.xDeg);
      minY = Math.min(minY, dot.yDeg);
      maxY = Math.max(maxY, dot.yDeg);
    }
  }

  const rangeX = Math.max(0.1, maxX - minX);
  const rangeY = Math.max(0.1, maxY - minY);
  const pad = Math.max(0.25, Math.max(rangeX, rangeY) * 0.08);
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

function isFirstNineVerticalClimb(shots: PatternShot[]): boolean {
  const firstNine = shots.slice(0, 9);
  return firstNine.every((shot, index) => index === 0 || shot.yDeg >= firstNine[index - 1].yDeg - 1e-9);
}

function createNumberInput(
  field: (typeof FIELDS)[number],
  value: number,
): HTMLInputElement {
  const label = document.createElement('label');
  label.style.cssText = [
    'display:grid',
    'gap:4px',
    'min-width:112px',
    'font:600 12px/1.2 system-ui,sans-serif',
    'color:#cbd5e1',
  ].join(';');
  label.textContent = field.label;

  const input = document.createElement('input');
  input.type = 'number';
  input.name = field.key;
  input.step = field.step;
  if (field.min !== undefined) input.min = field.min;
  input.value = String(value);
  input.style.cssText = [
    'width:112px',
    'box-sizing:border-box',
    'border:1px solid #475569',
    'border-radius:4px',
    'background:#0f172a',
    'color:#f8fafc',
    'padding:6px 8px',
    'font:600 13px/1.2 ui-monospace,monospace',
  ].join(';');

  label.appendChild(input);
  return input;
}

function readParams(inputs: Map<PatternInputKey, HTMLInputElement>): PatternParams {
  return {
    seed: readNumber(inputs, 'seed'),
    magnitude: readNumber(inputs, 'magnitude'),
    magnitudeVariance: readNumber(inputs, 'magnitudeVariance'),
    angleVariance: readNumber(inputs, 'angleVariance'),
    cycletimeSec: readNumber(inputs, 'cycletimeSec'),
  };
}

function writeParams(inputs: Map<PatternInputKey, HTMLInputElement>, params: PatternParams): void {
  for (const key of Object.keys(params) as PatternInputKey[]) {
    const input = inputs.get(key);
    if (input) input.value = String(params[key]);
  }
}

function readNumber(inputs: Map<PatternInputKey, HTMLInputElement>, key: PatternInputKey): number {
  const input = inputs.get(key);
  if (!input) throw new Error(`Missing input: ${key}`);
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new Error(`${key} must be finite`);
  return value;
}

function niceStep(range: number): number {
  const raw = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  if (normalized >= 5) return 5 * magnitude;
  if (normalized >= 2) return 2 * magnitude;
  return magnitude;
}

function sequenceRng(values: number[]): Rng {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) throw new Error('viewer rng exhausted');
    index += 1;
    return value;
  };
}

function buttonCss(): string {
  return [
    'border:1px solid #475569',
    'border-radius:4px',
    'background:#273244',
    'color:#f8fafc',
    'padding:7px 9px',
    'font:700 12px/1 system-ui,sans-serif',
    'cursor:pointer',
  ].join(';');
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
