import { describe, expect, it } from 'vitest';
import type { DataRecorderSnapshot } from './DataRecorder.ts';
import { buildExportPayload, serializeCSV, serializeJSON, type ExportPayload } from './export.ts';
import type { Meta } from './metadata.ts';

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'counterstrafe_ad_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 1,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-07-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  weapon: {
    id: 'ak47',
    ads: { fovDeg: 40, sensitivityRatio: 1 },
  },
};

const snapshot: DataRecorderSnapshot = {
  ticks: [
    { t: 10, vx: 250, vz: 0, px: 1, pz: 2, tx: 3, ty: 1.6, tz: -4, aim: { yaw: 0.5, pitch: -0.25 }, keys: ['D'], ads: false },
    { t: 17.8125, vx: 0, vz: 0, px: 1.5, pz: 2.5, tx: null, ty: null, tz: null, aim: { yaw: 0.25, pitch: 0 }, keys: ['A', 'D'], ads: true },
  ],
  events: [
    { type: 'visible', targetId: 'target-1', side: 'R', t: 10, targetX: 3, targetY: 1.6, targetZ: -4 },
    { type: 'counter', key: 'A', t: 14 },
    { type: 'ads', down: true, t: 15 },
    {
      type: 'fire',
      t: 18,
      hit: true,
      firstShot: true,
      residualSpeed: 0,
      viewYaw: 0.25,
      viewPitch: -0.1,
      aimPunchPitch: -1.2,
      aimPunchYaw: 0.8,
      spreadX: 0.01,
      spreadY: -0.02,
      recoilIndex: 2,
      ammo: 28,
      targetId: 'target-1',
      offsetDeg: 0.5,
      part: 'head',
    },
    { type: 'hit', t: 30, timeOfFlightMs: 12, shotSeq: 1, targetId: 'target-1', part: 'head' },
  ],
  recorderOverflow: false,
};

describe('data export', () => {
  it('builds the appendix C payload from metadata and recorder snapshot', () => {
    const payload = buildExportPayload(meta, snapshot);

    expect(payload).toEqual({
      meta,
      ticks: snapshot.ticks,
      events: snapshot.events,
    });
  });

  it('marks the payload suspect when the recorder snapshot overflowed', () => {
    const payload = buildExportPayload(meta, { ...snapshot, recorderOverflow: true });

    expect(payload.meta.recorderOverflow).toBe(true);
    expect(payload.meta.suspect).toBe(true);
  });

  it('serializes JSON as meta, ticks, and events', () => {
    const json = serializeJSON(buildExportPayload(meta, snapshot));
    const parsed = JSON.parse(json) as ExportPayload;

    expect(parsed.meta.drillId).toBe('counterstrafe_ad_v1');
    expect(parsed.meta.schemaVersion).toBe(2);
    expect(parsed.meta.sensitivityModel).toBe('cs2-0.022deg');
    expect(parsed.ticks).toHaveLength(2);
    expect(parsed.meta.weapon?.ads).toEqual({ fovDeg: 40, sensitivityRatio: 1 });
    expect(parsed.ticks[1].ads).toBe(true);
    expect(parsed.events).toHaveLength(5);
    expect(parsed.events[2]).toEqual({ type: 'ads', down: true, t: 15 });
    expect(parsed.events[4]).toEqual({
      type: 'hit',
      t: 30,
      timeOfFlightMs: 12,
      shotSeq: 1,
      targetId: 'target-1',
      part: 'head',
    });
  });

  it('serializes frame deltas in JSON and only the frame summary in CSV', () => {
    const frameMeta: Meta = {
      ...meta,
      frames: {
        series: [8, 9, 10],
        summary: { count: 3, p50: 9, p95: 10, p99: 10, overBudgetWindows: 2, overflow: false },
      },
      suspect: true,
    };
    const payload = buildExportPayload(frameMeta, snapshot);
    const parsed = JSON.parse(serializeJSON(payload)) as ExportPayload;
    const files = serializeCSV(payload, { basename: 'pilot run/01' });

    expect(parsed.meta.frames?.series).toEqual([8, 9, 10]);
    expect(files[2]).toEqual({
      filename: 'pilot_run_01-frames.csv',
      content: [
        'count,p50,p95,p99,overBudgetWindows,overflow',
        '3,9,10,10,2,false',
        '',
      ].join('\n'),
    });
  });

  it('serializes session setup metadata in JSON', () => {
    const setupMeta: Meta = {
      ...meta,
      display: {
        mode: 'qhd-1440',
        bufferW: 2560,
        bufferH: 1440,
        cssW: 2560,
        cssH: 1440,
        dpr: 1,
        screenW: 2560,
        screenH: 1440,
        fullscreen: true,
        refreshEstimateHz: 120,
        monitorModel: 'BenQ XL2546K',
        nativeW: 1920,
        nativeH: 1080,
        panelInches: 24.5,
        viewingDistanceCm: 60,
        selfReportUncertain: true,
        nativeMismatch: true,
      },
      session: { participantId: 'P001', sessionLabel: 'pre' },
    };
    const parsed = JSON.parse(serializeJSON(buildExportPayload(setupMeta, snapshot))) as ExportPayload;

    expect(parsed.meta.display).toMatchObject({
      monitorModel: 'BenQ XL2546K',
      nativeW: 1920,
      nativeH: 1080,
      panelInches: 24.5,
      viewingDistanceCm: 60,
      selfReportUncertain: true,
      nativeMismatch: true,
    });
    expect(parsed.meta.session).toEqual({ participantId: 'P001', sessionLabel: 'pre' });
  });

  it('serializes ticks and sparse event tables as CSV files', () => {
    const files = serializeCSV(buildExportPayload(meta, snapshot), { basename: 'pilot run/01' });

    expect(files).toEqual([
      {
        filename: 'pilot_run_01-ticks.csv',
        content: [
          't,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys,ads',
          '10,250,0,1,2,3,1.6,-4,0.5,-0.25,D,false',
          '17.8125,0,0,1.5,2.5,,,,0.25,0,A|D,true',
          '',
        ].join('\n'),
      },
      {
        filename: 'pilot_run_01-events.csv',
        content: [
          'type,t,targetId,side,key,down,hit,firstShot,residualSpeed,shotSeq,timeOfFlightMs,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part,targetX,targetY,targetZ',
          'visible,10,target-1,R,,,,,,,,,,,,,,,,,,3,1.6,-4',
          'counter,14,,,A,,,,,,,,,,,,,,,,,,,',
          'ads,15,,,,true,,,,,,,,,,,,,,,,,,',
          'fire,18,target-1,,,,true,true,0,,,0.25,-0.1,-1.2,0.8,0.01,-0.02,2,28,0.5,head,,,',
          'hit,30,target-1,,,,,,,1,12,,,,,,,,,,head,,,',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('escapes CSV cells and rejects non-finite numbers', () => {
    const payload = buildExportPayload(meta, {
      ticks: [{ t: 1, vx: 2, vz: 3, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 4, pitch: 5 }, keys: ['A'], ads: false }],
      events: [{ type: 'visible', targetId: 'target, "quoted"', side: 'L', t: 6 }],
      recorderOverflow: false,
    });

    const [ticks, events] = serializeCSV(payload);
    expect(ticks.content).toContain('1,2,3,0,0,,,,4,5,A,false');
    expect(events.content).toContain('"target, ""quoted"""');

    expect(() =>
      serializeJSON({
        ...payload,
        ticks: [{ t: Number.NaN, vx: 0, vz: 0, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 0, pitch: 0 }, keys: [], ads: false }],
      }),
    ).toThrow('export payload contains a non-finite number');
    expect(() =>
      serializeCSV({
        ...payload,
        ticks: [{ t: Number.NaN, vx: 0, vz: 0, px: 0, pz: 0, tx: null, ty: null, tz: null, aim: { yaw: 0, pitch: 0 }, keys: [], ads: false }],
      }),
    ).toThrow('export payload contains a non-finite number');
  });
});

describe('data export — WP-29 / T3 additive key 事件', () => {
  const keySnapshot: DataRecorderSnapshot = {
    ticks: [],
    events: [
      { type: 'key', code: 'A', down: true, t: 12 },
      { type: 'key', code: 'A', down: false, t: 40 },
    ],
    recorderOverflow: false,
  };

  it('round-trips key events verbatim in JSON (code/down/t)', () => {
    const parsed = JSON.parse(serializeJSON(buildExportPayload(meta, keySnapshot))) as ExportPayload;

    expect(parsed.events).toEqual([
      { type: 'key', code: 'A', down: true, t: 12 },
      { type: 'key', code: 'A', down: false, t: 40 },
    ]);
  });

  it('writes key events into the existing key/down CSV columns without adding a column', () => {
    const files = serializeCSV(buildExportPayload(meta, keySnapshot));
    const eventsCsv = files.find((file) => file.filename.endsWith('-events.csv'))!.content;
    const lines = eventsCsv.trimEnd().split('\n');

    // header unchanged (24 columns, no new `code` column)
    expect(lines[0]).toBe(
      'type,t,targetId,side,key,down,hit,firstShot,residualSpeed,shotSeq,timeOfFlightMs,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part,targetX,targetY,targetZ',
    );

    const down = lines[1].split(',');
    expect(down).toHaveLength(24);
    expect(down[0]).toBe('key');
    expect(down[1]).toBe('12');
    expect(down[2]).toBe('');
    expect(down[3]).toBe('');
    expect(down[4]).toBe('A'); // canonical code reuses the existing `key` column
    expect(down[5]).toBe('true'); // reuses the existing `down` column
    expect(down.slice(6).every((cell) => cell === '')).toBe(true);

    const up = lines[2].split(',');
    expect(up[0]).toBe('key');
    expect(up[4]).toBe('A');
    expect(up[5]).toBe('false');
  });
});
