import { test, expect } from '@playwright/test';

/**
 * WP-47 T-exit — weapon-select-ui 端到端補證。
 *
 * `Controls.ts` 的 `weaponSelect`/`Weapon` 按鈕與 `main.ts` 的 `activeWeaponOverride`/
 * `loadWeaponById()` 接線走真實 rAF 單例（非 `__fpsTest` 的隔離合成管線，見
 * fpsTestHarness.ts 檔頭），且換武器/換 ADS 的正向路徑需 Pointer Lock 才能實際開火——
 * Pointer Lock 需真實使用者手勢、無法在自動化中穩定取得（同 input-sampler.spec.ts 慣例）。
 * 故本檔只覆蓋**不需 Pointer Lock**、可穩定自動化的部分：UI 驅動換武器 → `__aimDebug.state`/
 * `recorder.mouseIntegration` 證 simLoop 確實以新武器重建（README §3 失效模式①）、
 * reset-per-drill 換 drill/scene 後下拉值與內部 override 正確歸零（README §3 失效模式②）、
 * 以及真實 Export JSON 按鈕匯出的 `meta.weapon.id` 正確。真實開火下的射速/ADS 縮放視覺
 * 效果留給人工驗（同 WP-3/WP-9 慣例）。
 */

const URL = 'http://localhost:5173/';

type AimDebug = {
  state: { weapon: { ammo: number; magSize: number } };
  recorder: { mouseIntegration?: { gain: { hipStep: number; adsStep: number } } };
};

async function gotoAppReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function enterResearcherDrillControls(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await expect(page.locator('#drill-controls')).toBeVisible();
}

function aimDebug(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
    return { weapon: { ...dbg.state.weapon }, gain: dbg.recorder.mouseIntegration?.gain };
  });
}

/** 點真實 Export JSON 按鈕並回傳解析後的 payload——`activeWeaponConfig()` 在匯出當下即時讀取
 * （非快照），是唯一能觀測到 `activeWeaponOverride` 被靜默清空、但 `simLoop`/下拉未同步重建的
 * 探針（見第三個 test 的說明）。 */
async function exportJSON(page: import('@playwright/test').Page): Promise<{ meta: { weapon?: { id?: unknown } } }> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-panel').getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

test.describe('WP-47 T-exit — weapon-select-ui', () => {
  test('weaponSelect + Weapon 按鈕換武器：simLoop 以新武器重建（magSize/ammo/ADS gain 皆變）', async ({
    page,
  }) => {
    await gotoAppReady(page);
    await enterResearcherDrillControls(page);

    const weaponSelect = page.locator('#weapon-select');
    await expect(weaponSelect).toHaveValue('ak47'); // 預設 drill 無 weaponId → 'ak47'
    const baseline = await aimDebug(page);
    expect(baseline.weapon).toMatchObject({ ammo: 30, magSize: 30 }); // ak47.magSize=30
    expect(baseline.gain?.adsStep).not.toBe(baseline.gain?.hipStep); // ak47 有 ads（fovDeg 40）

    // 換到 m4a1s（magSize=20，無 ads）——與 ak47 在兩個維度上都可區分,證明不是巧合。
    await weaponSelect.selectOption('m4a1s');
    await page.locator('#drill-controls').getByRole('button', { name: 'Weapon', exact: true }).click();

    await expect(weaponSelect).toHaveValue('m4a1s');
    const afterSwitch = await aimDebug(page);
    expect(afterSwitch.weapon).toMatchObject({ ammo: 20, magSize: 20 }); // m4a1s.magSize=20，彈匣滿載重置
    expect(afterSwitch.gain?.adsStep).toBe(afterSwitch.gain?.hipStep); // m4a1s 無 ads → adsStep===hipStep
  });

  test('reset-per-drill：換 drill 後 override 歸零、下拉值回到該 drill 自帶 weaponId', async ({ page }) => {
    await gotoAppReady(page);
    await enterResearcherDrillControls(page);

    const weaponSelect = page.locator('#weapon-select');
    await weaponSelect.selectOption('m4a1s');
    await page.locator('#drill-controls').getByRole('button', { name: 'Weapon', exact: true }).click();
    await expect(weaponSelect).toHaveValue('m4a1s');

    // drill-select 的 change 事件本身即觸發 onLoadDrill（Controls.ts：「選了就載入」，不必按
    // Load）；tracking_br_v1 = trackingBrVariants[3]（ads_on/projectile/0p5deg）weaponId
    // 固定為 'ak47_br_ads_projectile'（見 src/drill/tracking_br_v1.ts）——換這個 drill 應覆蓋
    // 手動選擇。loadDrillById 為 async（可能連帶換場景），故用 expect.poll 等其完成。
    await page.locator('#drill-select').selectOption('tracking_br_v1');
    await expect(weaponSelect).toHaveValue('ak47_br_ads_projectile', { timeout: 20_000 });
    const afterDrillSwitch = await aimDebug(page);
    expect(afterDrillSwitch.weapon.magSize).toBe(30); // AK47_BR_BASE 沿用 ak47.magSize
    expect(afterDrillSwitch.gain?.adsStep).not.toBe(afterDrillSwitch.gain?.hipStep); // ads_on 變體有 ads

    // 換回預設 drill，override 應再次歸零回 'ak47'（不 sticky 在 BR 武器上）。
    await page.locator('#drill-select').selectOption('counterstrafe_ad_v1');
    await expect(weaponSelect).toHaveValue('ak47');
  });

  test('reset-per-drill：重選同一場景不靜默清空 override（WP-47 T-exit 修正的 early-return 順序 bug）', async ({
    page,
  }) => {
    await gotoAppReady(page);
    await enterResearcherDrillControls(page);

    const weaponSelect = page.locator('#weapon-select');
    await weaponSelect.selectOption('m4a1s');
    await page.locator('#drill-controls').getByRole('button', { name: 'Weapon', exact: true }).click();
    await expect(weaponSelect).toHaveValue('m4a1s');

    // sceneSelect 預設值已是目前場景（field-low）——直接按 Scene 按鈕觸發「重選同一場景」路徑。
    // 這條路徑不會呼叫 buildSimLoop()/setSelectedWeapon()（即使修 bug 前後皆然，因為
    // loadSceneById 在此提早 return），所以下拉值與 state.weapon（magSize/ammo 快照）
    // 兩者在修 bug 前後都「看起來」沒變——不能拿來當這個 bug 的探針。
    // 唯一能觀測到「activeWeaponOverride 被靜默清空」的是 activeWeaponConfig() 的即時讀取，
    // 即 Export 當下才現讀的 meta.weapon.id：修 bug 前這裡會悄悄變回 'ak47'，儘管下拉仍顯示
    // 'm4a1s'、UI 看起來毫無異狀。
    await page.locator('#drill-controls').getByRole('button', { name: 'Scene', exact: true }).click();
    await expect(weaponSelect).toHaveValue('m4a1s');
    const afterReselect = await exportJSON(page);
    expect(afterReselect.meta.weapon?.id).toBe('m4a1s');

    // 真的換場景（urban-high）才應該讓 override 歸零、下拉回到 drill 自帶的 'ak47'。
    await page.locator('#scene-select').selectOption('urban-high');
    await page.locator('#drill-controls').getByRole('button', { name: 'Scene', exact: true }).click();
    await expect(weaponSelect).toHaveValue('ak47', { timeout: 20_000 });
    const afterRealSceneSwitch = await exportJSON(page);
    expect(afterRealSceneSwitch.meta.weapon?.id).toBe('ak47');
  });

  test('Export JSON：meta.weapon.id 反映當前選定武器（含 ADS + projectile 欄位）', async ({ page }) => {
    await gotoAppReady(page);
    await enterResearcherDrillControls(page);

    await page.locator('#weapon-select').selectOption('ak47_br_ads_projectile');
    await page.locator('#drill-controls').getByRole('button', { name: 'Weapon', exact: true }).click();
    await expect(page.locator('#weapon-select')).toHaveValue('ak47_br_ads_projectile');

    const payload = (await exportJSON(page)) as {
      meta: { weapon?: { id?: unknown; ads?: unknown; bullet?: unknown } };
    };

    expect(payload.meta.weapon?.id).toBe('ak47_br_ads_projectile');
    expect(payload.meta.weapon?.ads).toMatchObject({ fovDeg: 40, sensitivityRatio: 1 });
    expect(payload.meta.weapon?.bullet).toBeDefined(); // projectile 變體
  });
});
