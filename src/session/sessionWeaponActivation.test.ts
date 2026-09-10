import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DECLARED_WEAPON_BY_DRILL_ID } from './drillFamily.ts';
import { DEFAULT_WEAPON_ID, resolveActiveWeapon, WEAPONS } from '../weapon/weapons.ts';

/**
 * WP-62 / T3 — 「這一步實際會用哪把武器」的單一定義，以及 `main.ts` `activateDrill()` 對該定義
 * 的**使用順序**。
 *
 * 為什麼順序要用 source 掃描而不是行為測試：`main.ts` 是 WebGPU + DOM 的 top-level 腳本，vitest
 * 起不動；而「賦值早於 `buildSimLoop()`」是 `activateDrill()` **函式體內的敘述順序**，不是任何
 * 可注入的介面。順序一旦被搬動，`wp62-session-weapon-determinism.test.ts` 的 magSize 斷言仍會
 * 綠（它建構 loop 時武器已定），所以那條擋不住這個失敗模式——本檔補的正是這一格。
 * 掃描的是既有 repo 慣例（`sessionProgram.test.ts` 的純度掃描同樣讀 source）。
 */

const MAIN_SOURCE = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');

/** 取出 `main.ts` 中某個 top-level 函式的**函式體**（到下一個第 0 欄的 `}` 為止）。 */
function functionBody(name: string): string {
  const start = MAIN_SOURCE.indexOf(`function ${name}(`);
  expect(start, `main.ts should still declare ${name}()`).toBeGreaterThan(-1);
  const end = MAIN_SOURCE.indexOf('\n}', start);
  expect(end, `${name}() should be a top-level function`).toBeGreaterThan(start);
  return MAIN_SOURCE.slice(start, end);
}

describe('WP-62 T3 — resolveActiveWeapon() 是武器 precedence 的唯一定義', () => {
  it('override 勝過 drill 自宣告，drill 自宣告勝過 app 預設', () => {
    // 逐列指定：Session Plan 的 item 說了算。
    expect(resolveActiveWeapon('m4a1s', undefined).id).toBe('m4a1s');
    // 即使 drill 自己宣告了武器，明確的 override 仍優先——編譯器（T2 `requireWeapon`）保證只有
    // 「與宣告值相同」的指定能走到這裡，所以這裡不是覆蓋實驗格的漏洞。
    expect(resolveActiveWeapon('ak47_br_hip_hitscan', 'ak47_br_hip_hitscan').id).toBe('ak47_br_hip_hitscan');
    // override 與 drill 宣告**不同**時仍是 override 勝出。這一格不是理論：Controls 的武器下拉
    // （`loadWeaponById`）不經編譯器，可在 BR drill 上直接設 override——precedence 若反過來，
    // 那個下拉在 BR 八格會無聲失效（WP-47 的既有語意就沒了）。
    expect(resolveActiveWeapon('usp_s_laser', 'ak47_br_hip_hitscan').id).toBe('usp_s_laser');
    // 沒指定 ⇒ drill 自宣告。
    expect(resolveActiveWeapon(undefined, 'usp_s_laser').id).toBe('usp_s_laser');
    // 兩者皆無 ⇒ app 預設。
    expect(resolveActiveWeapon(undefined, undefined).id).toBe(DEFAULT_WEAPON_ID);
  });

  it('回傳的是 WEAPONS 裡那個既有物件，不是複製品（單一 allowlist，KI-016）', () => {
    expect(resolveActiveWeapon('m4a4', undefined)).toBe(WEAPONS.m4a4);
    expect(resolveActiveWeapon(undefined, undefined)).toBe(WEAPONS[DEFAULT_WEAPON_ID]);
  });

  it('未知 id 仍然拋錯（allowlist 沒有因為多一層 resolver 而變寬）', () => {
    expect(() => resolveActiveWeapon(undefined, 'not_a_weapon')).toThrow(/Unknown weapon id/);
    // Object 原型鍵不是武器——`isWeaponId` 是 own-property 判定（D-62.T2-3 同一格）。
    expect(() => resolveActiveWeapon(undefined, 'toString')).toThrow(/Unknown weapon id/);
  });

  it('每個自宣告武器的 drill 逐一經 resolver 解析回自己宣告的武器（Controls 面板顯示值的來源）', () => {
    // `controls.setSelectedWeapon()` 現在讀 `activeWeaponConfig().id`，也就是本 resolver 的輸出。
    for (const [drillId, declared] of DECLARED_WEAPON_BY_DRILL_ID) {
      expect(resolveActiveWeapon(undefined, declared).id, drillId).toBe(declared);
    }
    // BR 八格（WP-62）+ WP-64 curated 的兩個 tracking-pilot block。數字寫死，讓「又多一個 drill
    // 把武器固定成實驗因子」這件事無法悄悄通過 review。
    expect(DECLARED_WEAPON_BY_DRILL_ID.size).toBe(10);
  });
});

describe('WP-62 T3 — activateDrill() 的賦值順序與呼叫端契約（main.ts source）', () => {
  const activateDrill = functionBody('activateDrill');

  it('套用本步武器，而不再無條件清空 override', () => {
    expect(activateDrill).toMatch(/activeWeaponOverride = weaponId;/);
    // WP-47/T2 的無條件清空已被參數取代；留著它等於逐列武器永遠不生效。
    expect(activateDrill).not.toMatch(/activeWeaponOverride = undefined/);
  });

  it.each([
    ['simLoop = buildSimLoop()', 'simLoop = buildSimLoop();'],
    ['cameraController.setAdsConfig', 'cameraController.setAdsConfig('],
    ['recorder.configureMouseIntegration', 'recorder.configureMouseIntegration('],
  ])('賦值早於 %s（否則該步取到上一世代的武器）', (_label, consumer) => {
    const assignedAt = activateDrill.indexOf('activeWeaponOverride = weaponId;');
    const consumedAt = activateDrill.indexOf(consumer);
    expect(assignedAt).toBeGreaterThan(-1);
    expect(consumedAt).toBeGreaterThan(-1);
    expect(assignedAt).toBeLessThan(consumedAt);
  });

  it('Controls 顯示的是實際生效武器，不是只讀 drill 自宣告', () => {
    expect(activateDrill).toMatch(/controls\?\.setSelectedWeapon\(activeWeaponConfig\(\)\.id\)/);
    // 舊寫法在 Session Plan 指定武器時會顯示錯的值（研究者面板與實跑武器不一致）。
    expect(activateDrill).not.toMatch(/setSelectedWeapon\(nextConfig\.weaponId/);
  });

  it('loadSceneById() 的 WP-47/T2 reset 語意未被本 task 改動', () => {
    // `tests/e2e/weapon-select.spec.ts` 斷言「換到不同場景 ⇒ override 歸零」。§T0.5 的選項 ① 會
    // 讓那條既有契約轉紅，故本 task 不碰它（OQ #4 → 選項 ②/③，見 progress.md §T3）。
    expect(functionBody('loadSceneById')).toMatch(/activeWeaponOverride = undefined;/);
  });

  it('非 Session Plan 的呼叫端明確傳 undefined（逐位等同本 task 前的 reset-per-drill）', () => {
    // tracking pilot 走自己的 DrillConfig.weaponId，不接受逐列指定。
    expect(functionBody('loadDrillConfigDirect')).toMatch(
      /activateDrill\(config, fieldLow\.sceneId, undefined, undefined, undefined\)/,
    );
    // Controls 下拉與 protocol 條件都呼叫 loadDrillById(drillId) —— 第二參數 optional 且省略。
    expect(functionBody('loadDrillById')).toMatch(/^function loadDrillById\(drillId: string, weaponId\?: WeaponId\)/);
    expect(functionBody('loadDrillById')).toMatch(/option\.loadOptions, option\.id, weaponId\)/);
    expect(MAIN_SOURCE).toMatch(/await loadDrillById\(condition\.drillId\);/); // protocol：省略 ⇒ undefined
  });

  it('沒有第二條換武器路徑：loadWeaponById() 仍是 Controls 專用且未被接進 Session Plan', () => {
    expect(functionBody('loadWeaponById')).toMatch(/activeWeaponOverride = weaponId;/);
    expect(MAIN_SOURCE).toMatch(/onLoadWeapon: \(weaponId\) => loadWeaponById\(weaponId as WeaponId\)/);
  });
});
