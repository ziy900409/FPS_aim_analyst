import type { DrillEvent, DataRecorderSnapshot } from './DataRecorder.ts';
import type { Meta } from './metadata.ts';
import type { TickRecord } from './RingBuffer.ts';

export interface ExportPayload {
  meta: Meta;
  ticks: TickRecord[];
  events: DrillEvent[];
}

export interface CsvFile {
  filename: string;
  content: string;
}

export interface DownloadOptions {
  basename?: string;
}

export function buildExportPayload(meta: Meta, snapshot: DataRecorderSnapshot): ExportPayload {
  const recorderOverflow = meta.recorderOverflow || snapshot.recorderOverflow;
  return {
    meta: {
      ...meta,
      recorderOverflow,
      suspect: meta.suspect || recorderOverflow,
      // meta.validity 與 suspect 是不同集合(KI-004 / S1 T2),但兩者的 recorderOverflow
      // 來源相同 —— 同步 OR 上 snapshot.recorderOverflow,否則兩者會對不上。
      ...(meta.validity !== undefined
        ? { validity: { ...meta.validity, recorderOverflow } }
        : {}),
    },
    ticks: snapshot.ticks,
    events: snapshot.events,
  };
}

export function serializeJSON(payload: ExportPayload): string {
  assertFinitePayload(payload);
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function serializeCSV(payload: ExportPayload, options: DownloadOptions = {}): CsvFile[] {
  const basename = exportBasename(payload, options);
  const files = [
    { filename: `${basename}-ticks.csv`, content: serializeTicksCSV(payload.ticks) },
    { filename: `${basename}-events.csv`, content: serializeEventsCSV(payload.events) },
  ];
  if (payload.meta.frames !== undefined) {
    files.push({ filename: `${basename}-frames.csv`, content: serializeFramesCSV(payload.meta.frames.summary) });
  }
  return files;
}

export function downloadJSON(payload: ExportPayload, options: DownloadOptions = {}): void {
  const basename = exportBasename(payload, options);
  downloadTextFile(`${basename}.json`, serializeJSON(payload), 'application/json;charset=utf-8');
}

export function downloadCSV(payload: ExportPayload, options: DownloadOptions = {}): void {
  for (const file of serializeCSV(payload, options)) {
    downloadTextFile(file.filename, file.content, 'text/csv;charset=utf-8');
  }
}

function serializeTicksCSV(ticks: TickRecord[]): string {
  // KI-005 / A（FM-7）：依 payload 是否含 dYaw 決定表頭——缺席時與既有格式逐位相同（NFR-A-2）；
  // 啟用時所有 tick 皆有此欄（非 some），故只需檢查首列。
  const hasMouseIntegration = ticks.length > 0 && ticks[0].dYaw !== undefined;
  const header = ['t', 'vx', 'vz', 'px', 'pz', 'tx', 'ty', 'tz', 'yaw', 'pitch', 'keys', 'ads'];
  if (hasMouseIntegration) header.push('dYaw', 'dPitch');
  const rows = [header];
  for (const tick of ticks) {
    const row = [
      formatNumber(tick.t),
      formatNumber(tick.vx),
      formatNumber(tick.vz),
      formatNumber(tick.px),
      formatNumber(tick.pz),
      formatOptionalNumber(tick.tx),
      formatOptionalNumber(tick.ty),
      formatOptionalNumber(tick.tz),
      formatNumber(tick.aim.yaw),
      formatNumber(tick.aim.pitch),
      tick.keys.join('|'),
      formatBoolean(tick.ads),
    ];
    if (hasMouseIntegration) {
      row.push(formatNumber(tick.dYaw ?? 0), formatNumber(tick.dPitch ?? 0));
    }
    rows.push(row);
  }
  return rowsToCSV(rows);
}

function serializeEventsCSV(events: DrillEvent[]): string {
  const rows = [
    [
      'type',
      't',
      'targetId',
      'side',
      'key',
      'down',
      'hit',
      'firstShot',
      'residualSpeed',
      'shotSeq',
      'timeOfFlightMs',
      'viewYaw',
      'viewPitch',
      'aimPunchPitch',
      'aimPunchYaw',
      'spreadX',
      'spreadY',
      'recoilIndex',
      'ammo',
      'offsetDeg',
      'part',
      'targetX',
      'targetY',
      'targetZ',
    ],
  ];
  for (const event of events) {
    if (event.type === 'visible') {
      rows.push([
        event.type,
        formatNumber(event.t),
        event.targetId,
        event.side,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        formatOptionalNumber(event.targetX),
        formatOptionalNumber(event.targetY),
        formatOptionalNumber(event.targetZ),
      ]);
    } else if (event.type === 'counter') {
      rows.push([event.type, formatNumber(event.t), '', '', event.key, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    } else if (event.type === 'ads') {
      rows.push([
        event.type,
        formatNumber(event.t),
        '',
        '',
        '',
        formatBoolean(event.down),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else if (event.type === 'key') {
      // WP-29 / T3（additive）：沿用既有 `key` 欄承載 canonical `code`（A/D）、`down` 欄承載 down，不新增欄。
      rows.push([
        event.type,
        formatNumber(event.t),
        '',
        '',
        event.code,
        formatBoolean(event.down),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else if (event.type === 'target_stop') {
      rows.push([
        event.type,
        formatNumber(event.t),
        event.targetId,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        formatNumber(event.targetX),
        formatNumber(event.targetY),
        formatNumber(event.targetZ),
      ]);
    } else if (event.type === 'fire') {
      rows.push([
        event.type,
        formatNumber(event.t),
        event.targetId ?? '',
        '',
        '',
        '',
        formatBoolean(event.hit),
        formatBoolean(event.firstShot),
        formatNumber(event.residualSpeed),
        formatOptionalNumber(event.shotSeq),
        '',
        formatOptionalNumber(event.viewYaw),
        formatOptionalNumber(event.viewPitch),
        formatOptionalNumber(event.aimPunchPitch),
        formatOptionalNumber(event.aimPunchYaw),
        formatOptionalNumber(event.spreadX),
        formatOptionalNumber(event.spreadY),
        formatOptionalNumber(event.recoilIndex),
        formatOptionalNumber(event.ammo),
        event.offsetDeg !== undefined ? formatNumber(event.offsetDeg) : '',
        event.part ?? '',
        '',
        '',
        '',
      ]);
    } else if (event.type === 'hit') {
      rows.push([
        event.type,
        formatNumber(event.t),
        event.targetId ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        formatNumber(event.shotSeq),
        formatNumber(event.timeOfFlightMs),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        event.part ?? '',
        '',
        '',
        '',
      ]);
    }
  }
  return rowsToCSV(rows);
}

function serializeFramesCSV(summary: NonNullable<Meta['frames']>['summary']): string {
  return rowsToCSV([
    ['count', 'p50', 'p95', 'p99', 'overBudgetWindows', 'overflow'],
    [
      formatNumber(summary.count),
      formatNumber(summary.p50),
      formatNumber(summary.p95),
      formatNumber(summary.p99),
      formatNumber(summary.overBudgetWindows),
      formatBoolean(summary.overflow),
    ],
  ]);
}

function rowsToCSV(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCSVCell).join(',')).join('\n')}\n`;
}

function escapeCSVCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error('export payload contains a non-finite number');
  return String(value);
}

function formatOptionalNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : formatNumber(value);
}

function assertFinitePayload(payload: ExportPayload): void {
  for (const tick of payload.ticks) {
    formatNumber(tick.t);
    formatNumber(tick.vx);
    formatNumber(tick.vz);
    formatNumber(tick.px);
    formatNumber(tick.pz);
    formatOptionalNumber(tick.tx);
    formatOptionalNumber(tick.ty);
    formatOptionalNumber(tick.tz);
    formatNumber(tick.aim.yaw);
    formatNumber(tick.aim.pitch);
    if (tick.dYaw !== undefined) formatNumber(tick.dYaw);
    if (tick.dPitch !== undefined) formatNumber(tick.dPitch);
  }
  for (const event of payload.events) {
    formatNumber(event.t);
    if (event.type === 'visible') {
      formatOptionalNumber(event.targetX);
      formatOptionalNumber(event.targetY);
      formatOptionalNumber(event.targetZ);
    } else if (event.type === 'fire') {
      formatNumber(event.residualSpeed);
      formatOptionalNumber(event.shotSeq);
      formatOptionalNumber(event.viewYaw);
      formatOptionalNumber(event.viewPitch);
      formatOptionalNumber(event.aimPunchPitch);
      formatOptionalNumber(event.aimPunchYaw);
      formatOptionalNumber(event.spreadX);
      formatOptionalNumber(event.spreadY);
      formatOptionalNumber(event.recoilIndex);
      formatOptionalNumber(event.ammo);
      if (event.offsetDeg !== undefined) formatNumber(event.offsetDeg);
    } else if (event.type === 'hit') {
      formatNumber(event.shotSeq);
      formatNumber(event.timeOfFlightMs);
    }
  }
  if (payload.meta.frames !== undefined) {
    for (const delta of payload.meta.frames.series) formatNumber(delta);
    const summary = payload.meta.frames.summary;
    formatNumber(summary.count);
    formatNumber(summary.p50);
    formatNumber(summary.p95);
    formatNumber(summary.p99);
    formatNumber(summary.overBudgetWindows);
  }
}

function formatBoolean(value: boolean): string {
  return value ? 'true' : 'false';
}

function exportBasename(payload: ExportPayload, options: DownloadOptions): string {
  return sanitizeFilename(options.basename ?? `drill-${payload.meta.drillId}`);
}

function sanitizeFilename(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'drill-export';
}

function downloadTextFile(filename: string, content: string, type: string): void {
  if (typeof document === 'undefined') throw new Error('download requires a browser document');

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
