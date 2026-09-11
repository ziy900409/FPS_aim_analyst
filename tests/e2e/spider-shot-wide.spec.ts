import { expect, test, type Page } from '@playwright/test';
import { armAndWaitRunning } from './support/arm.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { SpiderShotYawPitchConfig } from '../../src/drill/DrillConfig.ts';
import { buildCompatibilityKey } from '../../src/metrics/compatibilityKey.ts';
import {
  SPIDER_SHOT_WIDE_DRILL_ID,
  SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS,
  SPIDER_SHOT_WIDE_PITCH_BANDS,
  SPIDER_SHOT_WIDE_SEED,
  WIDE_FLICK_ARENA_SCENE_ID,
  resolveSpiderShotWideV1,
} from '../../src/drill/spider_shot_wide_v1.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_PITCH_MAG_DEG,
  SPIDER_WIDE_SCREEN_MARGIN,
  SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  SPIDER_WIDE_YAW_EDGE_FACTOR,
} from '../../src/drill/spiderShotWide.ts';
import { ndcForEyeAngles, spiderWideEyeAngles } from '../../src/sim/spiderEyeFrame.ts';
import { PLAYER_EYE_HEIGHT_U } from '../../src/sim/playerEye.ts';

/**
 * WP-57 / T6 — `spider-shot-wide-v1` 的實機閘。
 *
 * 三件只有真瀏覽器能證的事：**arm 時真的讀了當下的顯示狀態**（FOV × aspect 落進 resolved config
 * 的 `resolvedFrom`，而非模組載入期常數）、**run 中 resize 不改 sim**（NFR-57.5 的實機版：aspect
 * 只在 arm 時被讀一次）、以及 **practice-only 零污染**（FR-57.13）。
 *
 * 幾何斷言一律 import `spiderEyeFrame.ts` 與 `spiderShotWide.ts` 的同一份純函式／常數，不在測試裡
 * 重寫第二套公式（C-D4）；本檔要證的是「瀏覽器裡跑出來的落點」也滿足 T1／T2 已在 Node 掃過的
 * 不等式，而非重跑那些掃描。
 *
 * 驅動方式沿用 WP-56 T5 的先例：researcher 入口載入真實 live scene，精準的 lifecycle 驅動交給既有
 * dev-only `FpsTestHarness`（與 live 單例隔離、合成 clock、零競態）。**harness 的 `startDrill()` 就是
 * 一次 arm**——它經 `resolveSource` 讀 live `settingsPanel.fov` 與 `sceneManager.camera.aspect`，故
 * resize 不變性測到的是生產的解析時點，不是測試自造的時點。
 */

const APP_URL = 'http://localhost:5173/';

/** FR-57.4 的 `ndc_x` 上界 tight-by-construction（D-57.T0-2），故判定必須 `≤` 且帶容差。 */
const NDC_EPSILON = 1e-9;

/**
 * 一發 tap 每 500 ms。與 WP-56 T5 同一個 load-bearing 理由，而且本 drill 更吃緊：harness 的合成瞄準
 * 只補償**開火前一 tick 取樣**的 punch、完全不補償每發隨機 spread，而 wide 目標在 8 u 僅
 * `1.0°` 角半徑（比 Micro Flick 的 1.44° 更小）。500 ms = ak47 cycletime 的 5 倍，punch 已在 tap 之間
 * 衰減完。脫靶本身是合法行為（不消耗 budget），但會讓中心目標卡住（`centerExemptFromTimeout`），
 * 使交替序列退化。
 */
const TAP_INTERVAL_MS = 500;

type HarnessInputEvent =
  | { type: 'fire'; down: boolean; t: number }
  | { type: 'mouse'; dx: number; dy: number; t: number };

type FpsTestHarness = {
  startDrill(id: string): void;
  feedInput(seq: HarnessInputEvent[]): void;
  forceExportJSON(): ExportPayload;
  phase(): string;
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<{ kind: string; reason?: string }>;
};

type DebugTarget = {
  id: string;
  alive: boolean;
  visible: boolean;
  zone?: 'center' | 'peripheral';
  pos: { x: number; y: number; z: number };
};

type AimDebug = {
  state: {
    player: { x: number; z: number; vx: number; vz: number; stopped: boolean };
    aim: { yaw: number; pitch: number };
    targets: DebugTarget[];
  };
};

interface VisibleSpawn {
  readonly targetId: string;
  readonly zone: 'center' | 'peripheral';
  readonly side: 'L' | 'R';
  readonly t: number;
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
}

async function gotoAppReady(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function waitForHarness(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function enterResearcherDrillControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await expect(page.locator('#drill-controls')).toBeVisible();
}

function debugState(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state;
    return {
      player: { ...state.player },
      aim: { ...state.aim },
      targets: state.targets.map((target) => ({
        id: target.id,
        alive: target.alive,
        visible: target.visible,
        zone: target.zone,
        pos: { ...target.pos },
      })),
    };
  });
}

/** 載入 wide drill：`#drill-select` 的 change 就會載入（Load 按鈕非必要，見 WP-56 T-exit 揭露）。 */
async function loadWideFlick(page: Page): Promise<void> {
  await enterResearcherDrillControls(page);
  await page.locator('#drill-select').selectOption(SPIDER_SHOT_WIDE_DRILL_ID);
  await expect(page.locator('#scene-select')).toHaveValue(WIDE_FLICK_ARENA_SCENE_ID, { timeout: 20_000 });
  // WP-65 T6：待命閘 —— spawn 表要等受試者取鎖並走完倒數才會開始跑。放在 helper 內，所有
  // 呼叫端（spawn trace / resize invariance / translation lock）自動一致。
  await armAndWaitRunning(page);
}

/** FOV 滑桿沒有 id；以 settings-panel 內帶「FOV」文字的那一列取，並回讀確認值真的套用。 */
async function setFov(page: Page, fovDeg: number): Promise<void> {
  const slider = page.locator('#settings-panel label', { hasText: 'FOV' }).locator('input[type="range"]');
  await slider.evaluate((node, value) => {
    const input = node as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, fovDeg);
  await expect(slider).toHaveValue(String(fovDeg));
}

/** 等到 live camera 真的吃到新視窗尺寸（`resize()` → `SceneManager.resize`）才算 resize 完成。 */
async function waitForViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(
    ([w, h]) => window.innerWidth === w && window.innerHeight === h,
    [width, height] as const,
  );
  // 讓 resize listener 與其後的一幀 render 跑完，避免下一次 arm 讀到上一個 aspect。
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

function tapSequence(taps: number): HarnessInputEvent[] {
  return Array.from({ length: taps }, (_, index) => {
    const t = index * TAP_INTERVAL_MS;
    return [
      { type: 'fire' as const, down: true, t },
      { type: 'fire' as const, down: false, t: t + 8 },
    ];
  }).flat();
}

function scheduleOf(payload: ExportPayload): SpiderShotYawPitchConfig {
  const schedule = payload.meta.spawn?.spiderShot as SpiderShotYawPitchConfig | undefined;
  if (schedule === undefined) throw new Error('Expected meta.spawn.spiderShot in the wide-flick export');
  return schedule;
}

function visibleSpawns(payload: ExportPayload): VisibleSpawn[] {
  return payload.events
    .filter((event): event is Extract<DrillEvent, { type: 'visible' }> => event.type === 'visible')
    .map((event) => {
      if (event.zone === undefined) throw new Error(`visible ${event.targetId} carries no zone stamp`);
      if (event.targetX === undefined || event.targetY === undefined || event.targetZ === undefined) {
        throw new Error(`visible ${event.targetId} carries no target coordinates`);
      }
      return {
        targetId: event.targetId,
        zone: event.zone,
        side: event.side,
        t: event.t,
        pos: { x: event.targetX, y: event.targetY, z: event.targetZ },
      };
    });
}

/**
 * 匯出的 yaw 窗 vs 同一個 resolver 在 **Node** 端重算的值。
 *
 * 這裡刻意**不用** `toEqual`：`Math.tan`／`Math.atan` 的精度是 implementation-defined，Edge 的 V8 與
 * 跑測試的 Node V8 會給出差 1 ULP 的結果（實測 `47.50358800572262` vs `…263`）。T2／T4 的逐位斷言
 * 全在單一 process 內，仍然成立；**跨 browser↔Node 邊界時 1e-12 是可宣稱的上限**（與 T4 由匯出欄位
 * 重算 yaw 窗所用的容差一致）。
 */
function expectYawWindowMatchesResolver(
  schedule: SpiderShotYawPitchConfig,
  fovDegVertical: number,
  aspect: number,
): void {
  const expected = (resolveSpiderShotWideV1(fovDegVertical, aspect).spiderShot as SpiderShotYawPitchConfig).peripheral
    .yawMagDegRange;
  expect(schedule.peripheral.yawMagDegRange[0]).toBeCloseTo(expected[0], 12);
  expect(schedule.peripheral.yawMagDegRange[1]).toBeCloseTo(expected[1], 12);
}

/** 由 harness 跑一段 run 並回傳（排程 provenance, 逐個 spawn, 相位）。 */
async function runWideFlick(page: Page, taps: number) {
  return page.evaluate(
    async ({ drillId, sequence }) => {
      const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
      harness.startDrill(drillId);
      harness.feedInput(sequence);
      return { payload: harness.forceExportJSON(), phase: harness.phase() };
    },
    { drillId: SPIDER_SHOT_WIDE_DRILL_ID, sequence: tapSequence(taps) },
  );
}

test('WP-57 T6: the researcher control list arms the wide drill on its own arena and freezes the display state it resolved from', async ({
  page,
}) => {
  await waitForViewport(page, 1280, 720);
  await gotoAppReady(page);
  await loadWideFlick(page);

  // Live sim side: the yaw/pitch branch puts the centre target on the eye sightline (y = eye height,
  // z = -distance).  The legacy cone branch would have used TARGET_Y = 1.5 instead, so this single
  // assertion also rules out the wrong spawn branch being armed.
  await expect
    .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
      timeout: 15_000,
    })
    .toBe(1);
  const live = await debugState(page);
  const centre = live.targets.find((target) => target.alive && target.visible)!;
  expect(centre.zone).toBe('center');
  expect(centre.pos.x).toBeCloseTo(0, 12);
  expect(centre.pos.y).toBeCloseTo(PLAYER_EYE_HEIGHT_U, 12);
  expect(centre.pos.z).toBeCloseTo(-SPIDER_WIDE_DISTANCE_U, 12);

  // Arm-time provenance (FR-57.3 / FR-57.10): every number the resolver consumed is in the export,
  // and the aspect is the *browser's* aspect — a value that exists in no other export field.
  await waitForHarness(page);
  const armed = await runWideFlick(page, 0);
  const schedule = scheduleOf(armed.payload);
  expect(schedule.kind).toBe('center-peripheral-yawpitch');
  expect(schedule.seed).toBe(SPIDER_SHOT_WIDE_SEED);
  expect(schedule.distanceU).toBe(SPIDER_WIDE_DISTANCE_U);
  expect(schedule.grid.pitchBands).toBe(SPIDER_SHOT_WIDE_PITCH_BANDS);
  expect(schedule.centerExemptFromTimeout).toBe(true);
  expect(schedule.resolvedFrom).toEqual({
    fovDegVertical: 75,
    aspect: 1280 / 720,
    screenMargin: SPIDER_WIDE_SCREEN_MARGIN,
    kLo: SPIDER_WIDE_YAW_EDGE_FACTOR,
    targetAngularDiameterDeg: SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  });
  expectYawWindowMatchesResolver(schedule, 75, 1280 / 720);
  expect(schedule.peripheral.pitchDegRange).toEqual([-SPIDER_WIDE_PITCH_MAG_DEG, SPIDER_WIDE_PITCH_MAG_DEG]);

  // The resolver runs per arm, not per module load: re-arming after moving the FOV slider must
  // produce a strictly narrower yaw window at the same aspect.
  await setFov(page, 60);
  const rearmed = scheduleOf((await runWideFlick(page, 0)).payload);
  expect(rearmed.resolvedFrom.fovDegVertical).toBe(60);
  expect(rearmed.resolvedFrom.aspect).toBe(1280 / 720);
  expect(rearmed.peripheral.yawMagDegRange[1]).toBeLessThan(schedule.peripheral.yawMagDegRange[1]);
  expectYawWindowMatchesResolver(rearmed, 60, 1280 / 720);
  console.info(
    `[WP-57 T6] arm-time yaw windows @1280x720: FOV 75 -> [${schedule.peripheral.yawMagDegRange.map((v) => v.toFixed(4)).join(', ')}], ` +
      `FOV 60 -> [${rearmed.peripheral.yawMagDegRange.map((v) => v.toFixed(4)).join(', ')}]`,
  );
});

test('WP-57 T6: every live spawn stays fully on screen while zone alternates and the centre target ignores the peek timeout', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await waitForViewport(page, 1280, 720);
  await gotoAppReady(page);
  await waitForHarness(page);

  const run = await runWideFlick(page, 60);
  const schedule = scheduleOf(run.payload);
  const spawns = visibleSpawns(run.payload);
  const { fovDegVertical, aspect, screenMargin, targetAngularDiameterDeg } = schedule.resolvedFrom;
  const radiusDeg = targetAngularDiameterDeg / 2;
  const bound = 1 - screenMargin;

  // FR-57.7: strict centre <-> peripheral alternation, starting at the centre.
  expect(spawns.length).toBeGreaterThanOrEqual(40);
  expect(spawns.map((spawn) => spawn.zone)).toEqual(
    spawns.map((_, index) => (index % 2 === 0 ? 'center' : 'peripheral')),
  );

  // FR-57.4 on-screen, on the coordinates the browser actually recorded. Same outer-edge estimate
  // and same tolerance as the Node sweeps (T1 pure-function space, T2 TargetManager output).
  let worstX = 0;
  let worstY = 0;
  const peripheral = spawns.filter((spawn) => spawn.zone === 'peripheral');
  const sides = { L: 0, R: 0 };
  for (const spawn of spawns) {
    const { yawDeg, pitchDeg, distanceU } = spiderWideEyeAngles(spawn.pos);
    expect(distanceU).toBeCloseTo(SPIDER_WIDE_DISTANCE_U, 12);
    const outer = ndcForEyeAngles(Math.abs(yawDeg) + radiusDeg, Math.abs(pitchDeg) + radiusDeg, fovDegVertical, aspect);
    worstX = Math.max(worstX, Math.abs(outer.x));
    worstY = Math.max(worstY, Math.abs(outer.y));
    expect(Math.abs(outer.x)).toBeLessThanOrEqual(bound + NDC_EPSILON);
    expect(Math.abs(outer.y)).toBeLessThanOrEqual(bound + NDC_EPSILON);

    if (spawn.zone === 'peripheral') {
      expect(Math.abs(yawDeg)).toBeGreaterThanOrEqual(schedule.peripheral.yawMagDegRange[0] - 1e-9);
      expect(Math.abs(yawDeg)).toBeLessThanOrEqual(schedule.peripheral.yawMagDegRange[1] + 1e-9);
      expect(pitchDeg).toBeGreaterThanOrEqual(schedule.peripheral.pitchDegRange[0] - 1e-9);
      expect(pitchDeg).toBeLessThanOrEqual(schedule.peripheral.pitchDegRange[1] + 1e-9);
      // FR-57.7: unlike v1/v2's `'R'` placeholder, `side` carries the real left/right.
      expect(spawn.side).toBe(yawDeg > 0 ? 'R' : 'L');
      sides[spawn.side]++;
    }
  }
  expect(sides.L).toBeGreaterThan(0);
  expect(sides.R).toBeGreaterThan(0);
  console.info(
    `[WP-57 T6] on-screen: spawns=${spawns.length} peripheral=${peripheral.length} L/R=${sides.L}/${sides.R} ` +
      `worst|ndc_x|=${worstX.toFixed(5)} worst|ndc_y|=${worstY.toFixed(5)} bound=${bound}`,
  );

  // `centerExemptFromTimeout` (FR-57.7): idling far past peekTimeoutMs leaves the centre target
  // standing, while a peripheral target is withdrawn exactly at the timeout.
  const idle = await page.evaluate(
    async ({ drillId, idleMs }) => {
      const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
      harness.startDrill(drillId);
      harness.feedInput([{ type: 'mouse', dx: 0, dy: 0, t: idleMs }]);
      return { payload: harness.forceExportJSON(), phase: harness.phase() };
    },
    { drillId: SPIDER_SHOT_WIDE_DRILL_ID, idleMs: SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS * 3 },
  );
  const idleSpawns = visibleSpawns(idle.payload);
  expect(idleSpawns).toHaveLength(1);
  expect(idleSpawns[0].zone).toBe('center');
  expect(idle.phase).toBe('running');

  const timedOut = await page.evaluate(
    async ({ drillId, idleMs }) => {
      const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
      harness.startDrill(drillId);
      // One tap kills the centre target -> a peripheral spawns; then idle past its peek timeout.
      harness.feedInput([
        { type: 'fire', down: true, t: 0 },
        { type: 'fire', down: false, t: 8 },
        { type: 'mouse', dx: 0, dy: 0, t: idleMs },
      ]);
      return harness.forceExportJSON();
    },
    { drillId: SPIDER_SHOT_WIDE_DRILL_ID, idleMs: SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS + 200 },
  );
  const timedOutSpawns = visibleSpawns(timedOut);
  expect(timedOutSpawns.map((spawn) => spawn.zone)).toEqual(['center', 'peripheral', 'center']);
  expect(timedOutSpawns[2].t - timedOutSpawns[1].t).toBeGreaterThanOrEqual(SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS);
  expect(timedOutSpawns[2].t - timedOutSpawns[1].t).toBeLessThan(SPIDER_SHOT_WIDE_PEEK_TIMEOUT_MS + 2 * (1000 / 128));
});

test('WP-57 T6: resizing mid-run leaves the spawn sequence bit-identical while a fresh arm picks up the new aspect', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await waitForViewport(page, 1280, 720);
  await gotoAppReady(page);
  await waitForHarness(page);

  /** `arm: true` 才呼叫 `startDrill()`（= 一次 arm）；否則沿用當前 run 繼續餵輸入。 */
  const feed = (taps: number, { arm }: { arm: boolean }) =>
    page.evaluate(
      async ({ drillId, sequence, armNow }) => {
        const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
        if (armNow) harness.startDrill(drillId);
        if (sequence.length > 0) harness.feedInput(sequence);
        return harness.forceExportJSON();
      },
      { drillId: SPIDER_SHOT_WIDE_DRILL_ID, sequence: tapSequence(taps), armNow: arm },
    );

  // Run A: armed at 16:9, resized to 5:4 half way through.
  await feed(20, { arm: true });
  await waitForViewport(page, 1280, 1024);
  const resized = await feed(20, { arm: false });
  const traceA = visibleSpawns(resized);
  const scheduleA = scheduleOf(resized);
  expect(scheduleA.resolvedFrom.aspect).toBe(1280 / 720);

  // A *fresh* arm at the new viewport must resolve a different (narrower) window — otherwise run A's
  // invariance would only prove that the resize never reached the camera.
  const afterResizeArm = scheduleOf(await feed(0, { arm: true }));
  expect(afterResizeArm.resolvedFrom.aspect).toBe(1280 / 1024);
  expect(afterResizeArm.peripheral.yawMagDegRange[1]).toBeLessThan(scheduleA.peripheral.yawMagDegRange[1]);

  // Run B: the unresized control, armed at the original viewport. It is fed in the *same* two
  // batches as run A so the only difference between the runs is the resize — `feedInput` rebases
  // its relative timestamps on the current synthetic clock, so a single 40-tap batch would shift the
  // whole tap grid by ~476 ms and make the sim timestamps incomparable for a reason unrelated to
  // aspect.
  await waitForViewport(page, 1280, 720);
  await feed(20, { arm: true });
  const control = await feed(20, { arm: false });
  const traceB = visibleSpawns(control);
  const scheduleB = scheduleOf(control);

  expect(scheduleB.resolvedFrom).toEqual(scheduleA.resolvedFrom);
  expect(scheduleB.peripheral).toEqual(scheduleA.peripheral);
  expect(traceA.length).toBeGreaterThanOrEqual(40);
  expect(traceA).toEqual(traceB);
  console.info(
    `[WP-57 T6] resize invariance: spawns=${traceA.length} armed@16:9 yawMax=${scheduleA.peripheral.yawMagDegRange[1].toFixed(4)} ` +
      `re-armed@5:4 yawMax=${afterResizeArm.peripheral.yawMagDegRange[1].toFixed(4)}`,
  );
});

test('WP-57 T6: the wide drill locks player translation, keeps mouse aim live, and writes nothing to participant history', async ({
  page,
}) => {
  await waitForViewport(page, 1280, 720);
  await gotoAppReady(page);
  await loadWideFlick(page);
  await expect
    .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
      timeout: 15_000,
    })
    .toBe(1);

  // FR-57.8: yaw/pitch are defined relative to `eye = sim origin`, so translation is a contract
  // precondition, not a preference. Keys are still consumed (the input trace stays intact).
  const before = await debugState(page);
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    await page.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keydown', { code: key, bubbles: true })), code);
    await page.waitForTimeout(120);
    await page.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true })), code);
    await page.waitForTimeout(60);
  }
  const afterKeys = await debugState(page);
  expect(afterKeys.player).toEqual({ ...before.player, vx: 0, vz: 0, stopped: true });

  // ...while the same run's mouse aim is untouched: Pointer Lock forwards movementX/Y to
  // CameraController exactly as it does for every other drill.
  await page.locator('canvas').click({ position: { x: 8, y: 8 } });
  await page.waitForFunction(() => document.pointerLockElement !== null, undefined, { timeout: 10_000 });
  const aimed = await page.evaluate(() => {
    const move = new MouseEvent('mousemove');
    Object.defineProperties(move, { movementX: { value: 400 }, movementY: { value: -120 } });
    document.dispatchEvent(move);
    const state = (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state;
    return { aim: { ...state.aim }, player: { ...state.player } };
  });
  expect(aimed.aim.yaw).not.toBe(before.aim.yaw);
  expect(aimed.aim.pitch).not.toBe(before.aim.pitch);
  expect({ x: aimed.player.x, z: aimed.player.z }).toEqual({ x: before.player.x, z: before.player.z });
  await page.evaluate(() => document.exitPointerLock());

  // FR-57.13 practice-only: the live persistence seam refuses the run before it reaches the client,
  // and the real browser payload carries no Assessment envelope — so the metric registry cannot
  // build a compatibility cell from it either. (The pure exact-id/near-miss/replay-profile negatives
  // live in T1's `spider_shot_wide_v1.test.ts`; this is the same policy on a real export.)
  await waitForHarness(page);
  const practice = await page.evaluate(async (drillId) => {
    const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
    harness.startDrill(drillId);
    harness.feedInput([
      { type: 'fire', down: true, t: 0 },
      { type: 'fire', down: false, t: 8 },
    ]);
    return { save: await harness.saveToHistory(), payload: harness.forceExportJSON() };
  }, SPIDER_SHOT_WIDE_DRILL_ID);
  expect(practice.payload.meta.drillId).toBe(SPIDER_SHOT_WIDE_DRILL_ID);
  expect(practice.payload.meta.assessment).toBeUndefined();
  expect(practice.payload.meta.session).toBeUndefined();
  expect(practice.save).toEqual({ kind: 'excluded', reason: 'practice' });

  // `DrillMetricRegistry` itself cannot be imported here (its scene-config chain pulls a JSON module
  // that Playwright's loader rejects), but the compatibility key is the thing FR-57.13 forbids and it
  // is reachable: no Assessment envelope in the real export ⇒ no cell can be built from this run.
  expect(() =>
    buildCompatibilityKey(practice.payload.meta, SPIDER_SHOT_WIDE_DRILL_ID, 'spider:d=0;w=0', 'ok'),
  ).toThrow(/meta\.session\.participantId|meta\.assessment/);
});
