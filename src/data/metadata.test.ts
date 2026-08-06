import { describe, expect, it } from 'vitest';
import { collectMeta, measureDisplayHz, measureDisplayRefresh, type CollectMetaArgs } from './metadata.ts';

describe('collectMeta', () => {
  it('collects complete drill metadata and computes suspect from overflow flags', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        simHz: 128,
        browser: 'TestBrowser/1.0',
        sensitivity: 1.2,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        vStrafe: 250,
        maxDrillSeconds: 300,
        lateEventCount: 2,
        bufferOverflow: 1,
        recorderOverflow: false,
      }),
    ).toEqual({
      schemaVersion: 2,
      drillId: 'counterstrafe_ad_v1',
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'TestBrowser/1.0',
      sensitivity: 1.2,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 2,
      bufferOverflow: true,
      recorderOverflow: false,
      suspect: true,
      simToWorld: 0.01,
    });
  });

  it('applies phase-A defaults for sim rate, source units, and overflow metadata', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgl2',
      displayHz: 60,
      browser: 'TestBrowser/1.0',
      sensitivity: 1,
      crossOriginIsolated: false,
      startedAt: new Date('2026-07-02T10:00:00.000Z'),
    });

    expect(meta).toMatchObject({
      simHz: 128,
      schemaVersion: 2,
      unit: 'source',
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
    });
  });

  it('rejects missing required backend, sensitivity, or crossOriginIsolated fields', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 60,
      browser: 'TestBrowser/1.0',
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() => collectMeta({ ...valid, backend: undefined } as unknown as CollectMetaArgs)).toThrow(
      'backend must be webgpu or webgl2',
    );
    expect(() => collectMeta({ ...valid, sensitivity: undefined } as unknown as CollectMetaArgs)).toThrow(
      'sensitivity must be a positive finite number',
    );
    expect(() =>
      collectMeta({ ...valid, crossOriginIsolated: undefined } as unknown as CollectMetaArgs),
    ).toThrow('crossOriginIsolated must be a boolean');
  });

  it('accepts explicit v2 weapon and spawn metadata', () => {
    expect(
      collectMeta({
        drillId: 'spray_v1',
        weaponId: 'm4a4',
        weaponSeed: 38965,
        rngSeed: 2026,
        weapon: {
          id: 'm4a4',
          ads: { fovDeg: 40, sensitivityRatio: 1 },
          bullet: { model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 },
          projectileOverflow: true,
        },
        backend: 'webgl2',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        spawn: {
          seed: 2026,
          spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
          spawnDelayMsRange: [800, 2400],
          motion: { type: 'static' },
        },
      }),
    ).toMatchObject({
      schemaVersion: 2,
      drillId: 'spray_v1',
      weaponId: 'm4a4',
      weaponSeed: 38965,
      rngSeed: 2026,
      weapon: {
        id: 'm4a4',
        ads: { fovDeg: 40, sensitivityRatio: 1 },
        bullet: { model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 },
        projectileOverflow: true,
      },
      movementModel: 'cs2-source',
      spawn: {
        seed: 2026,
        spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
        spawnDelayMsRange: [800, 2400],
        motion: { type: 'static' },
      },
    });
  });

  it('rejects malformed weapon ads metadata', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgl2',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        weapon: { id: 'ak47', ads: { fovDeg: 0, sensitivityRatio: 1 } },
      }),
    ).toThrow('weapon.ads.fovDeg');
  });

  it('accepts resolved target hitbox metadata for offline geometry replay', () => {
    expect(
      collectMeta({
        drillId: 'tracking_longrange_v1',
        backend: 'webgl2',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        targets: { hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } },
      }),
    ).toMatchObject({
      targets: { hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } },
    });
  });

  it('rejects malformed target hitbox metadata', () => {
    expect(() =>
      collectMeta({
        drillId: 'tracking_longrange_v1',
        backend: 'webgl2',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        targets: { hitbox: { widthU: 0.5, heightU: -1, depthU: 0.5 } },
      }),
    ).toThrow('targets.hitbox.heightU');
  });

  it('accepts stage3 scene metadata including fallback state', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        scene: {
          sceneId: 'field-low',
          assetPackVersion: 'field-low-v1',
          clutterTier: 'low',
          fallback: true,
        },
      }),
    ).toMatchObject({
      scene: {
        sceneId: 'field-low',
        assetPackVersion: 'field-low-v1',
        clutterTier: 'low',
        fallback: true,
      },
    });
  });

  it('accepts scene.eye world base including zero and negative components (KI-004 / S1 T2)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      scene: {
        sceneId: 'br-field',
        assetPackVersion: 'br-field-v1',
        clutterTier: 'high',
        fallback: false,
        eye: { x: 0, y: 1.6, z: 0 },
      },
    });

    expect(meta.scene?.eye).toEqual({ x: 0, y: 1.6, z: 0 });
  });

  it('rejects non-finite scene.eye components', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        scene: {
          sceneId: 'field-low',
          assetPackVersion: 'field-low-v1',
          clutterTier: 'low',
          fallback: false,
          eye: { x: 0, y: Number.NaN, z: 4 },
        },
      }),
    ).toThrow('scene.eye.y');
  });

  it('defaults meta.simToWorld to the engine SIM_TO_WORLD constant (KI-004 / S1 T2, FR-S1-13)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    });

    expect(meta.simToWorld).toBe(0.01);
  });

  it('rejects a non-positive meta.simToWorld override', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        simToWorld: 0,
      }),
    ).toThrow('simToWorld must be a positive finite number');
  });

  it('accepts meta.validity as a runtime observation block distinct from suspect (FR-S1-15)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      validity: {
        corridorExceeded: true,
        perfFloor: false,
        recorderOverflow: false,
        bufferOverflow: false,
      },
    });

    expect(meta.validity).toEqual({
      corridorExceeded: true,
      perfFloor: false,
      recorderOverflow: false,
      bufferOverflow: false,
    });
    // NFR-S1-2b:validity.corridorExceeded 為 true 不得單獨把 suspect 拉成 true。
    expect(meta.suspect).toBe(false);
  });

  it('rejects malformed meta.validity fields', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        validity: {
          corridorExceeded: true,
          perfFloor: false,
          recorderOverflow: false,
          bufferOverflow: 1 as unknown as boolean,
        },
      }),
    ).toThrow('validity.bufferOverflow must be a boolean');
  });

  it('leaves meta.suspect bit-for-bit unchanged when simToWorld/scene.eye/validity are added (NFR-S1-2b)', () => {
    const before = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      bufferOverflow: true,
      suspect: true,
    });
    const after = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      bufferOverflow: true,
      suspect: true,
      scene: {
        sceneId: 'field-low',
        assetPackVersion: 'field-low-v1',
        clutterTier: 'low',
        fallback: false,
        eye: { x: 0, y: 1.6, z: 4 },
      },
      validity: {
        corridorExceeded: false,
        perfFloor: false,
        recorderOverflow: false,
        bufferOverflow: true,
      },
    });

    expect(after.suspect).toBe(before.suspect);
    expect(after.suspect).toBe(true);
  });

  it('accepts WP-20 display metadata with explicit buffer and refresh estimate', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      display: {
        mode: 'fhd-1080',
        bufferW: 1920,
        bufferH: 1080,
        cssW: 2560,
        cssH: 1440,
        dpr: 1.25,
        screenW: 3200,
        screenH: 1800,
        fullscreen: true,
        refreshEstimateHz: 120,
        refreshMedianDeltaMs: 8.333,
      },
    });

    expect(meta.display).toEqual({
      mode: 'fhd-1080',
      bufferW: 1920,
      bufferH: 1080,
      cssW: 2560,
      cssH: 1440,
      dpr: 1.25,
      screenW: 3200,
      screenH: 1800,
      fullscreen: true,
      refreshEstimateHz: 120,
      refreshMedianDeltaMs: 8.333,
    });
  });

  it('carries the eligibility gate report through meta.display.gate (GD-10 audit)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
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
        gate: { pass: true, native: true, fullscreen: true, perf: true, details: 'all pass' },
      },
    });

    expect(meta.display?.gate).toEqual({
      pass: true,
      native: true,
      fullscreen: true,
      perf: true,
      details: 'all pass',
    });
  });

  it('accepts WP-20 display self-report fields and native mismatch flags', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
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
        monitorModel: ' BenQ XL2546K ',
        nativeW: 1920,
        nativeH: 1080,
        panelInches: 24.5,
        viewingDistanceCm: 60,
        selfReportUncertain: true,
        nativeMismatch: true,
      },
    });

    expect(meta.display).toMatchObject({
      monitorModel: 'BenQ XL2546K',
      nativeW: 1920,
      nativeH: 1080,
      panelInches: 24.5,
      viewingDistanceCm: 60,
      selfReportUncertain: true,
      nativeMismatch: true,
    });
  });

  it('accepts required participantId and optional sessionLabel metadata', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      session: { participantId: ' P001 ', sessionLabel: ' pre ' },
    });

    expect(meta.session).toEqual({ participantId: 'P001', sessionLabel: 'pre' });
  });

  it('accepts WP-22 protocol condition metadata', () => {
    const meta = collectMeta({
      drillId: 'detection_popin_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      protocol: {
        protocolId: ' resolution_detection_v1 ',
        conditionIndex: 0,
        conditionLabel: ' fhd-1080-field-low-detection ',
      },
    });

    expect(meta.protocol).toEqual({
      protocolId: 'resolution_detection_v1',
      conditionIndex: 0,
      conditionLabel: 'fhd-1080-field-low-detection',
    });
  });

  it('rejects malformed protocol metadata', () => {
    const valid: CollectMetaArgs = {
      drillId: 'detection_popin_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() => collectMeta({ ...valid, protocol: { protocolId: ' ', conditionIndex: 0, conditionLabel: 'fhd' } })).toThrow(
      'protocol.protocolId',
    );
    expect(() =>
      collectMeta({ ...valid, protocol: { protocolId: 'p', conditionIndex: -1, conditionLabel: 'fhd' } }),
    ).toThrow('protocol.conditionIndex');
    expect(() => collectMeta({ ...valid, protocol: { protocolId: 'p', conditionIndex: 0, conditionLabel: ' ' } })).toThrow(
      'protocol.conditionLabel',
    );
  });

  it('rejects a malformed gate report on display metadata', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 120,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
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
          gate: { pass: 'yes' },
        },
      } as unknown as CollectMetaArgs),
    ).toThrow('display.gate.pass');
  });

  it('rejects malformed display self-report fields and missing participant IDs', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() =>
      collectMeta({
        ...valid,
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
          panelInches: -1,
        },
      } as unknown as CollectMetaArgs),
    ).toThrow('display.panelInches');
    expect(() => collectMeta({ ...valid, session: { participantId: ' ' } })).toThrow('session.participantId');
  });

  it('rejects malformed display metadata', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() =>
      collectMeta({
        ...valid,
        display: { mode: 'bogus' },
      } as unknown as CollectMetaArgs),
    ).toThrow('display.mode must be native, fhd-1080, or qhd-1440');
  });

  it('allows runtime validity observers to mark metadata suspect', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        suspect: true,
      }).suspect,
    ).toBe(true);
  });

  it('accepts frame log metadata and marks p95 over the performance floor suspect', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      frames: {
        series: [8, 9, 10],
        summary: { count: 3, p50: 9, p95: 10, p99: 10, overBudgetWindows: 2, overflow: false },
      },
    });

    expect(meta.frames).toEqual({
      series: [8, 9, 10],
      summary: { count: 3, p50: 9, p95: 10, p99: 10, overBudgetWindows: 2, overflow: false },
    });
    expect(meta.suspect).toBe(true);
  });

  it('does not mark frame logs suspect at the performance floor boundary', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      frames: {
        series: [8.33],
        summary: { count: 1, p50: 8.33, p95: 8.33, p99: 8.33, overBudgetWindows: 0, overflow: false },
      },
    });

    expect(meta.suspect).toBe(false);
  });

  it('accepts meta.fovDeg as the hip-baseline FOV for offline ADS gain reconstruction (KI-005 / A, FR-A-5)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      fovDeg: 75,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    });

    expect(meta.fovDeg).toBe(75);
  });

  it('omits meta.fovDeg for pre-KI-005 exports without a default', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    });

    expect(meta.fovDeg).toBeUndefined();
    expect('fovDeg' in meta).toBe(false);
  });

  it('rejects a non-positive meta.fovDeg', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        fovDeg: 0,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
      }),
    ).toThrow('fovDeg must be a positive finite number');
  });

  it('accepts meta.mouseIntegration self-describing the tick-window-integral model (KI-005 / A, FR-A-6)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      mouseIntegration: {
        model: 'tick-window-integral',
        radPerCount: 0.022,
        hipStep: 0.022,
        adsStep: 0.0088,
      },
    });

    expect(meta.mouseIntegration).toEqual({
      model: 'tick-window-integral',
      radPerCount: 0.022,
      hipStep: 0.022,
      adsStep: 0.0088,
    });
  });

  it('rejects a meta.mouseIntegration.model other than tick-window-integral', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        mouseIntegration: {
          model: 'aim-diff-legacy' as unknown as 'tick-window-integral',
          radPerCount: 0.022,
          hipStep: 0.022,
          adsStep: 0.0088,
        },
      }),
    ).toThrow('mouseIntegration.model must be tick-window-integral');
  });

  it('rejects non-positive meta.mouseIntegration step fields', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() =>
      collectMeta({
        ...valid,
        mouseIntegration: { model: 'tick-window-integral', radPerCount: 0, hipStep: 0.022, adsStep: 0.0088 },
      }),
    ).toThrow('mouseIntegration.radPerCount');
    expect(() =>
      collectMeta({
        ...valid,
        mouseIntegration: { model: 'tick-window-integral', radPerCount: 0.022, hipStep: -1, adsStep: 0.0088 },
      }),
    ).toThrow('mouseIntegration.hipStep');
    expect(() =>
      collectMeta({
        ...valid,
        mouseIntegration: { model: 'tick-window-integral', radPerCount: 0.022, hipStep: 0.022, adsStep: Number.NaN },
      }),
    ).toThrow('mouseIntegration.adsStep');
  });

  it('leaves meta.suspect bit-for-bit unchanged when fovDeg/mouseIntegration are added (KI-005 / A T2)', () => {
    const before = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      bufferOverflow: true,
      suspect: true,
    });
    const after = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      bufferOverflow: true,
      suspect: true,
      fovDeg: 75,
      mouseIntegration: {
        model: 'tick-window-integral',
        radPerCount: 0.022,
        hipStep: 0.022,
        adsStep: 0.022,
      },
    });

    expect(after.suspect).toBe(before.suspect);
    expect(after.suspect).toBe(true);
  });

  it('rejects malformed frame log metadata', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 120,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        frames: {
          series: [8],
          summary: { count: 2, p50: 8, p95: 8, p99: 8, overBudgetWindows: 0, overflow: false },
        },
      } as unknown as CollectMetaArgs),
    ).toThrow('frames.summary.count must match frames.series length');
  });
});

describe('measureDisplayHz', () => {
  it('estimates refresh rate from the median requestAnimationFrame interval', async () => {
    const timestamps = [0, 16.67, 33.34, 50.01, 66.68, 83.35];
    let i = 0;

    const hz = await measureDisplayHz({
      samples: 5,
      warmupSamples: 0,
      requestAnimationFrame: (callback) => {
        callback(timestamps[i++]);
        return i;
      },
    });

    expect(hz).toBeCloseTo(60, 1);
  });

  it('drops warmup deltas and reports rounded Hz plus median delta', async () => {
    const timestamps = [0, 100, 200, 208.34, 216.67, 225, 233.33, 241.66];
    let i = 0;

    const estimate = await measureDisplayRefresh({
      samples: 5,
      warmupSamples: 2,
      requestAnimationFrame: (callback) => {
        callback(timestamps[i++]);
        return i;
      },
    });

    expect(estimate.refreshEstimateHz).toBe(120);
    expect(estimate.medianDeltaMs).toBeCloseTo(8.33, 2);
  });

  it('requires requestAnimationFrame to measure displayHz', async () => {
    await expect(measureDisplayHz({ requestAnimationFrame: null })).rejects.toThrow(
      'requestAnimationFrame is not available',
    );
  });
});
