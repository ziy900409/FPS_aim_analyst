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
  return [
    { filename: `${basename}-ticks.csv`, content: serializeTicksCSV(payload.ticks) },
    { filename: `${basename}-events.csv`, content: serializeEventsCSV(payload.events) },
  ];
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
  const rows = [['t', 'vx', 'vz', 'cx', 'cy', 'keys']];
  for (const tick of ticks) {
    rows.push([
      formatNumber(tick.t),
      formatNumber(tick.vx),
      formatNumber(tick.vz),
      formatNumber(tick.crosshair[0]),
      formatNumber(tick.crosshair[1]),
      tick.keys.join('|'),
    ]);
  }
  return rowsToCSV(rows);
}

function serializeEventsCSV(events: DrillEvent[]): string {
  const rows = [['type', 't', 'targetId', 'key', 'hit', 'firstShot', 'residualSpeed', 'part']];
  for (const event of events) {
    if (event.type === 'visible') {
      rows.push([event.type, formatNumber(event.t), event.targetId, '', '', '', '', '']);
    } else if (event.type === 'counter') {
      rows.push([event.type, formatNumber(event.t), '', event.key, '', '', '', '']);
    } else {
      rows.push([
        event.type,
        formatNumber(event.t),
        '',
        '',
        formatBoolean(event.hit),
        formatBoolean(event.firstShot),
        formatNumber(event.residualSpeed),
        event.part ?? '',
      ]);
    }
  }
  return rowsToCSV(rows);
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

function assertFinitePayload(payload: ExportPayload): void {
  for (const tick of payload.ticks) {
    formatNumber(tick.t);
    formatNumber(tick.vx);
    formatNumber(tick.vz);
    formatNumber(tick.crosshair[0]);
    formatNumber(tick.crosshair[1]);
  }
  for (const event of payload.events) {
    formatNumber(event.t);
    if (event.type === 'fire') formatNumber(event.residualSpeed);
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
