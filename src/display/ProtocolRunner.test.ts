import { describe, expect, it, vi } from 'vitest';
import {
  createProtocolRunner,
  validateProtocol,
  type ProtocolConfig,
  type ProtocolReadyState,
} from './ProtocolRunner.ts';
import { resolutionDetectionProtocol } from './resolutionDetectionProtocol.ts';

const PROTOCOL: ProtocolConfig = {
  protocolId: 'resolution_detection_v1',
  requiredDisplay: { minW: 2560, minH: 1440 },
  conditions: [
    { label: 'fhd', mode: 'fhd-1080', sceneId: 'field-low', drillId: 'detection_popin_v1' },
    { label: 'qhd', mode: 'qhd-1440', sceneId: 'field-low', drillId: 'detection_popin_v1' },
  ],
};

describe('validateProtocol', () => {
  it('accepts a data-driven resolution x detection protocol', () => {
    expect(validateProtocol(PROTOCOL)).toEqual(PROTOCOL);
    expect(resolutionDetectionProtocol.conditions.map((condition) => condition.mode)).toEqual([
      'fhd-1080',
      'qhd-1440',
    ]);
  });

  it('rejects malformed configs before a protocol session can start', () => {
    expect(() => validateProtocol({ ...PROTOCOL, protocolId: ' ' })).toThrow('protocol.protocolId');
    expect(() =>
      validateProtocol({ ...PROTOCOL, conditions: [{ ...PROTOCOL.conditions[0], mode: '720p' }] }),
    ).toThrow('protocol.conditions[0].mode');
    expect(() => validateProtocol({ ...PROTOCOL, conditions: [] })).toThrow('protocol.conditions');
  });
});

describe('createProtocolRunner', () => {
  it('starts each condition by applying and asserting mode, scene, and drill state', async () => {
    const applied: ProtocolReadyState[] = [];
    const runner = createProtocolRunner({
      config: PROTOCOL,
      applyCondition: (condition) => {
        const ready = { mode: condition.mode, sceneId: condition.sceneId, drillId: condition.drillId };
        applied.push(ready);
        return ready;
      },
      exportCondition: (context) => ({ condition: context.conditionLabel, suspect: context.suspect }),
    });

    await expect(runner.start()).resolves.toMatchObject({ conditionIndex: 0, conditionLabel: 'fhd' });
    await expect(runner.completeCurrentCondition()).resolves.toMatchObject({
      payload: { condition: 'fhd', suspect: false },
    });
    await expect(runner.beginNextCondition()).resolves.toMatchObject({ conditionIndex: 1, conditionLabel: 'qhd' });
    expect(applied).toEqual([
      { mode: 'fhd-1080', sceneId: 'field-low', drillId: 'detection_popin_v1' },
      { mode: 'qhd-1440', sceneId: 'field-low', drillId: 'detection_popin_v1' },
    ]);
  });

  it('keeps fullscreen/perf failure as condition-level suspect instead of aborting the session', async () => {
    const runner = createProtocolRunner({
      config: PROTOCOL,
      applyCondition: (condition) => ({ mode: condition.mode, sceneId: condition.sceneId, drillId: condition.drillId }),
      exportCondition: (context) => ({ label: context.conditionLabel, suspect: context.suspect, reason: context.suspectReason }),
    });

    await runner.start();
    runner.markCurrentConditionSuspect('fullscreen-exit');
    const first = await runner.completeCurrentCondition();
    await runner.beginNextCondition();
    const second = await runner.completeCurrentCondition();

    expect(first.payload).toEqual({ label: 'fhd', suspect: true, reason: 'fullscreen-exit' });
    expect(second.payload).toEqual({ label: 'qhd', suspect: false, reason: undefined });
    expect(runner.exports.map((result) => result.context.suspect)).toEqual([true, false]);
  });

  it('throws when the applied environment does not match the condition declaration', async () => {
    const runner = createProtocolRunner({
      config: PROTOCOL,
      applyCondition: () => ({ mode: 'native', sceneId: 'field-low', drillId: 'detection_popin_v1' }),
      exportCondition: vi.fn(),
    });

    await expect(runner.start()).rejects.toThrow('expected display mode fhd-1080');
  });

  it('clears active condition after the final export and reports completion', async () => {
    const onProtocolComplete = vi.fn();
    const runner = createProtocolRunner({
      config: PROTOCOL,
      applyCondition: (condition) => ({ mode: condition.mode, sceneId: condition.sceneId, drillId: condition.drillId }),
      exportCondition: (context) => context.conditionIndex,
      onProtocolComplete,
    });

    await runner.start();
    await runner.completeCurrentCondition();
    await runner.beginNextCondition();
    await runner.completeCurrentCondition();

    expect(runner.current).toBeUndefined();
    expect(onProtocolComplete).toHaveBeenCalledTimes(1);
    expect(runner.exports.map((result) => result.payload)).toEqual([0, 1]);
  });
});
