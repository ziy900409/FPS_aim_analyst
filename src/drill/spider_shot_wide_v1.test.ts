import { describe, expect, it, vi } from 'vitest';
import { createDrillMetricRegistry } from '../history/DrillMetricRegistry.ts';
import type { HistoryClient } from '../history/HistoryClient.ts';
import { createHistoryPersistence } from '../history/HistoryPersistence.ts';
import { replayProfileForExactDrill } from '../replay/replayCompatibility.ts';
import { KNOWN_SESSION_FAMILY_IDS } from '../session/sessionSchedule.ts';
import { makeAssessmentPayload } from '../../tests/history/payloadFixtures.ts';
import { resolveTargetHitbox, type SpiderShotYawPitchConfig } from './DrillConfig.ts';
import { loadDrill } from './DrillLoader.ts';
import { spiderShotV1 } from './spider_shot_v1.ts';
import { spiderShotV2 } from './spider_shot_v2.ts';
import {
  SPIDER_SHOT_WIDE_DRILL_ID,
  SPIDER_SHOT_WIDE_PITCH_BANDS,
  SPIDER_SHOT_WIDE_SEED,
  WIDE_FLICK_ARENA_SCENE_ID,
  resolveSpiderShotWideV1,
  spiderShotWideV1Binding,
  spiderShotWideV1Template,
} from './spider_shot_wide_v1.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_HITBOX_DIAMETER_U,
  SPIDER_WIDE_SCREEN_MARGIN,
  SPIDER_WIDE_YAW_EDGE_FACTOR,
  SpiderWideResolveError,
} from './spiderShotWide.ts';
import { validateDrill } from './schema.ts';

/** 走一次 JSON 序列化，證明 resolved config 是純資料（無函式、無 render 物件、無 NaN）。 */
function reparse(config: unknown): unknown {
  return validateDrill(JSON.parse(JSON.stringify(config)));
}

describe('WP-57 T1 — spider-shot-wide-v1 template', () => {
  it('綁定 wide-flick-arena，且 drillId 是同輩而非 v3（OQ-57.1／D-57.P13）', () => {
    expect(SPIDER_SHOT_WIDE_DRILL_ID).toBe('spider-shot-wide-v1');
    expect(WIDE_FLICK_ARENA_SCENE_ID).toBe('wide-flick-arena');
    expect(spiderShotWideV1Binding).toEqual({
      id: SPIDER_SHOT_WIDE_DRILL_ID,
      sceneId: WIDE_FLICK_ARENA_SCENE_ID,
    });
  });

  it('是 practice、位移鎖定、60 秒時限的 template（FR-57.8／57.13）', () => {
    expect(spiderShotWideV1Template.mode).toBe('practice');
    expect(spiderShotWideV1Template.playerControl).toEqual({ translation: 'locked' });
    expect(spiderShotWideV1Template.sequence).toEqual({ alternation: 'LR' });
    expect(spiderShotWideV1Template.timing).toEqual({ countdownMs: 3000, peekTimeoutMs: 2500 });
    // OQ-57.4 收斂值（D-57.T6-2）：60 s，取代規劃期的 90 s 候選值。
    expect(spiderShotWideV1Template.endCondition).toEqual({ type: 'timeLimit', value: 60000 });
    expect(spiderShotWideV1Template.targets.count).toBeGreaterThanOrEqual(300);
  });

  it('template 不含 spiderShot——yaw 窗必須等 arm 時的 FOV/aspect（FR-57.3）', () => {
    expect(spiderShotWideV1Template).not.toHaveProperty('spiderShot');
    // template 本身仍是 schema-valid 的 drill（spiderShot 為 optional），只是沒有排程可跑——
    // 所以缺的是 spawn 幾何，不是欄位合法性。
    expect(validateDrill(JSON.parse(JSON.stringify(spiderShotWideV1Template))).spiderShot).toBeUndefined();
  });

  it('hitbox 是 2.0°@8u 的 sphere，命中與 W_deg 同源（GD-7／GD-30）', () => {
    const hitbox = resolveTargetHitbox(resolveSpiderShotWideV1(75, 16 / 9));
    expect(hitbox.shape).toBe('sphere');
    expect(hitbox.width).toBeCloseTo(SPIDER_WIDE_HITBOX_DIAMETER_U, 12);
    expect(hitbox.height).toBe(hitbox.width);
    expect(hitbox.depth).toBe(hitbox.width);
  });
});

describe('WP-57 T1 — resolveSpiderShotWideV1（arm-time resolved config）', () => {
  it('resolved config 通過 loadDrill，且 spiderShot 為 yawpitch 排程', () => {
    const config = loadDrill(resolveSpiderShotWideV1(75, 16 / 9));
    expect(config.drillId).toBe(SPIDER_SHOT_WIDE_DRILL_ID);
    expect(config.mode).toBe('practice');
    expect(config.sequence.seed).toBeUndefined();

    const spiderShot = config.spiderShot as SpiderShotYawPitchConfig;
    expect(spiderShot.kind).toBe('center-peripheral-yawpitch');
    expect(spiderShot.seed).toBe(SPIDER_SHOT_WIDE_SEED);
    expect(spiderShot.distanceU).toBe(SPIDER_WIDE_DISTANCE_U);
    expect(spiderShot.grid).toEqual({ pitchBands: SPIDER_SHOT_WIDE_PITCH_BANDS });
    expect(spiderShot.centerExemptFromTimeout).toBe(true);
    expect(spiderShot.peripheral.yawMagDegRange[1]).toBeCloseTo(51.6343, 4);
    expect(spiderShot.peripheral.pitchDegRange).toEqual([-6.5, 6.5]);
  });

  it('provenance 完整落在 config 內，離線可零假設重建刺激幾何（FR-57.10）', () => {
    const spiderShot = resolveSpiderShotWideV1(90, 21 / 9).spiderShot as SpiderShotYawPitchConfig;
    expect(spiderShot.resolvedFrom).toEqual({
      fovDegVertical: 90,
      aspect: 21 / 9,
      screenMargin: SPIDER_WIDE_SCREEN_MARGIN,
      kLo: SPIDER_WIDE_YAW_EDGE_FACTOR,
      targetAngularDiameterDeg: 2.0,
    });
  });

  it('不同 FOV/aspect 產生不同 yaw 窗，但 seed/距離/pitch 窗不變（條件變因只有 yaw）', () => {
    const a = resolveSpiderShotWideV1(60, 4 / 3).spiderShot as SpiderShotYawPitchConfig;
    const b = resolveSpiderShotWideV1(120, 21 / 9).spiderShot as SpiderShotYawPitchConfig;
    expect(a.peripheral.yawMagDegRange[1]).not.toBe(b.peripheral.yawMagDegRange[1]);
    expect(a.peripheral.pitchDegRange).toEqual(b.peripheral.pitchDegRange);
    expect(a.seed).toBe(b.seed);
    expect(a.distanceU).toBe(b.distanceU);
  });

  it('是純資料：JSON round-trip 後仍逐位相等', () => {
    const config = resolveSpiderShotWideV1(75, 16 / 9);
    expect(reparse(config)).toEqual(config);
  });

  it('非法顯示狀態 fail fast，不產出半成品 config（FR-57.14）', () => {
    expect(() => resolveSpiderShotWideV1(Number.NaN, 16 / 9)).toThrow(SpiderWideResolveError);
    expect(() => resolveSpiderShotWideV1(75, 0)).toThrow(SpiderWideResolveError);
  });

  it('與 spider-shot-v1/v2 是獨立的 RNG 串流，且不動它們的凍結參數', () => {
    expect(SPIDER_SHOT_WIDE_SEED).not.toBe(spiderShotV1.spiderShot?.seed);
    expect(SPIDER_SHOT_WIDE_SEED).not.toBe(spiderShotV2.spiderShot?.seed);
    expect(spiderShotV1.spiderShot?.kind).toBe('center-peripheral');
    expect(spiderShotV2.spiderShot?.kind).toBe('center-peripheral-stratified');
  });
});

describe('WP-57 T1 — practice-only 負向閘（FR-57.13）', () => {
  it('不在 Participant/Assessment session 或指標 registry 內（含 near-miss id）', () => {
    expect([...KNOWN_SESSION_FAMILY_IDS]).not.toContain(SPIDER_SHOT_WIDE_DRILL_ID);
    const registry = createDrillMetricRegistry();
    for (const id of [
      SPIDER_SHOT_WIDE_DRILL_ID,
      `${SPIDER_SHOT_WIDE_DRILL_ID}-alt`,
      'spider-shot-wide',
      'spider-shot-v3-wide',
    ]) {
      expect(registry.registrationForExactDrill(id)).toBeUndefined();
    }
    // v2 的 5 個指標不因新增同家族 drill 而改變。
    expect(registry.registrationForExactDrill('spider-shot-v2')?.descriptors).toHaveLength(5);
  });

  it('沒有 exact／prefix／near-miss 的 WP-50 full replay profile', () => {
    for (const id of [SPIDER_SHOT_WIDE_DRILL_ID, `${SPIDER_SHOT_WIDE_DRILL_ID}-alt`, 'spider-shot-wide']) {
      expect(replayProfileForExactDrill(id)).toBeUndefined();
    }
  });

  it('history persistence 以 Practice short-circuit，不呼叫 client', async () => {
    const saveRun = vi.fn();
    const client = { saveRun } as unknown as HistoryClient;
    const persistence = createHistoryPersistence(client);
    const payload = makeAssessmentPayload({ drillId: SPIDER_SHOT_WIDE_DRILL_ID, assessment: false });

    await expect(persistence.save(payload)).resolves.toEqual({ kind: 'excluded', reason: 'practice' });
    expect(saveRun).not.toHaveBeenCalled();
  });
});
