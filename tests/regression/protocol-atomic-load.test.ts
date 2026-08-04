import { describe, expect, it } from 'vitest';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { detectionPopinV1 } from '../../src/drill/detection_popin_v1.ts';
import { trackingBrVariants } from '../../src/drill/tracking_br_v1.ts';
import { resolutionDetectionProtocol } from '../../src/display/resolutionDetectionProtocol.ts';
import { fieldLow } from '../../src/scene/scenes/field-low.ts';

/**
 * KI-002 / D2 回歸網（FR-4 / FR-5）。
 *
 * D2 根因:`applyCondition` 先 `loadSceneById(condition.sceneId)` → 拿**舊** `activeDrillSource`
 * 重驗目標場景淨空。BR-active(前向 z=−distance)→ 啟動 resolution protocol(field-low)→
 * `loadDrill(舊 BR drill, field-low)` clearance 失敗 throw → protocol 在載入正確 drill 前中止。
 *
 * 修法:`applyCondition` 只走 `loadDrillById(condition.drillId)`——它原子載入該 drill 宣告的正規
 * 場景並驗證**新** drill vs 新 scene;`detection_popin_v1` 補宣告 `sceneId='field-low'`,故無論
 * 先前 active drill 為何,首條件都以「新 drill vs 新 scene」為準,不再由舊 drill 參與淨空驗證。
 *
 * 註:main.ts 的 wiring(registry sceneId + applyCondition)無獨立單元 seam;此檔鎖住修法所依賴的
 * `loadDrill(目標 drill, 目標 scene)` 契約 + protocol 資料模型前提,production 落點另由 e2e protocol
 * 全鏈路(runResolutionDetectionProtocol / runBrTrackingProtocol)覆蓋。
 */
describe('KI-002 / D2 — protocol validates the target drill against the target scene', () => {
  it('validates detection_popin_v1 against field-low without throwing (FR-4/FR-5)', () => {
    // 目標 drill vs 目標 scene:protocol 首條件的正規配對必須通過淨空。
    const config = loadDrill(detectionPopinV1, fieldLow);
    expect(config.drillId).toBe('detection_popin_v1');
  });

  it('reproduces the root cause: reusing a stale forward BR drill against field-low throws', () => {
    // 舊 loadSceneById 行為:拿 active(BR 前向)drill 驗 field-low → clearance 失敗 throw。
    const brForward = trackingBrVariants.find((variant) => variant.axes.angularHeight === '0p5deg');
    if (brForward === undefined) throw new Error('missing forward BR variant');
    expect(() => loadDrill(brForward.drill, fieldLow)).toThrow(/clearance/);
  });

  it('every resolution protocol condition names a scene and drill (data-model precondition)', () => {
    // FR-4 前提:每個 condition 的 drill 都能宣告正規 sceneId,loadDrillById 才能原子載入落點。
    for (const condition of resolutionDetectionProtocol.conditions) {
      expect(typeof condition.sceneId).toBe('string');
      expect((condition.sceneId as string).length).toBeGreaterThan(0);
      expect(typeof condition.drillId).toBe('string');
    }
    // 首條件落點契約 = field-low + detection_popin_v1。
    expect(resolutionDetectionProtocol.conditions[0]).toMatchObject({
      sceneId: 'field-low',
      drillId: 'detection_popin_v1',
    });
  });
});
