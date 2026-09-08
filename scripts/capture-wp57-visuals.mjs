/**
 * WP-57 T6 — reproducible browser capture runner for the wide-flick arena.
 *
 * Two deliverables in one pass, both from the real researcher entry point and the live scene:
 *
 * 1. **Visual evidence for D-57.T3-3 / OQ-57.3** — per FOV level (60 / 75 / 120) three frames: the
 *    centre target, and one near-edge peripheral on each side. The peripheral frames are taken while
 *    the crosshair still sits where the centre target was, i.e. exactly the composition a player sees
 *    at the moment of detection — that is the frame that answers "does it feel edge-hugging, and was
 *    the target ever clipped?". T3 delivered no in-browser visual evidence at all (its geometry gate
 *    is analytic), so this is the first time the arena is seen by a human eye.
 *
 * 2. **Sample-budget evidence for OQ-57.4** — per FOV level, a full 90 s run through the dev-only
 *    `__fpsTest` harness at several per-trial paces, reporting peripheral arrivals and per-cell
 *    (side x pitch band) counts. The harness auto-aims, so its *timeout rate is 0 by construction*
 *    and is reported as such: the censoring boundary itself (a peripheral is withdrawn exactly at
 *    `peekTimeoutMs`) is asserted in tests/e2e/spider-shot-wide.spec.ts, but mapping it to a human
 *    timeout rate needs a real play session and is deliberately NOT synthesised here.
 *
 * The dev server is spawned with its own temp history root and killed as a process *tree* on exit —
 * an orphaned Vite on 5173 silently hijacks Playwright's `reuseExistingServer` and its history root
 * (KI-028).
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'docs/exec-plan/active/stage12/wp-57-spider-shot-wide-flick/captures');
const appUrl = 'http://127.0.0.1:5174/';
const DRILL_ID = 'spider-shot-wide-v1';
const SCENE_ID = 'wide-flick-arena';
const FOV_LEVELS = [60, 75, 120];
/** Per-trial paces (ms between taps) for the OQ-57.4 sample-budget sweep. */
const PACE_LEVELS_MS = [600, 800, 1000, 1200, 1500];
/**
 * The planning doc's reliability yardstick (README §1.5 chose 90 s to reach ~14 samples per cell).
 * The shipped limit is now 60 s (D-57.T6-2, practice-only and explicitly claiming no reliability),
 * so this stays here as the *reference* threshold the sweep is reported against, not as a gate.
 */
const PER_CELL_TARGET = 14;
/** Shipped `SPIDER_SHOT_WIDE_TIME_LIMIT_MS`, plus slack so the time limit ends the run, not the taps. */
const DRILL_TIME_LIMIT_MS = 60_000;

function startDevServer() {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort']
      : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5174', '--strictPort'];
  return spawn(command, args, {
    cwd: root,
    env: { ...process.env, FPS_HISTORY_ROOT: '.wp57-capture-tmp/history' },
    stdio: 'ignore',
    windowsHide: true,
  });
}

/**
 * KI-028: killing the shell leaves Vite itself listening, and an orphaned Vite silently hijacks both
 * the next capture run and Playwright's `reuseExistingServer` (WP-56 T-exit lost a whole NFR
 * measurement to exactly this). So: kill the tree, *wait* for the kill to finish, then confirm the
 * port actually went quiet — and say so loudly if it did not, rather than leaving one behind.
 */
async function stopDevServer(server) {
  if (server.pid === undefined) return;
  await new Promise((done) => {
    if (process.platform !== 'win32') {
      server.kill('SIGTERM');
      done();
      return;
    }
    const killer = spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('exit', done);
    killer.on('error', done);
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(appUrl);
    } catch {
      return;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  process.exitCode = 1;
  console.error(
    `[WP-57 T6] WARNING: a Vite is still listening at ${appUrl} after teardown. Kill it before ` +
      'running Playwright, or it will hijack reuseExistingServer and its history root (KI-028).',
  );
}

async function waitForApp(server) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    try {
      if ((await fetch(appUrl)).ok) return;
    } catch {
      // The next 100 ms retry is the normal Vite start-up path.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for Vite at ${appUrl}`);
}

async function loadWideFlick(page) {
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await page.locator('#drill-select').selectOption(DRILL_ID);
  await page.waitForFunction((sceneId) => document.querySelector('#scene-select')?.value === sceneId, SCENE_ID);
  await page.waitForFunction(
    () => window.__aimDebug?.state.targets.filter((target) => target.alive && target.visible).length === 1,
  );
}

async function setFovAndRearm(page, fovDeg) {
  await page
    .locator('#settings-panel label', { hasText: 'FOV' })
    .locator('input[type="range"]')
    .evaluate((node, value) => {
      node.value = String(value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, fovDeg);
  // Re-selecting the drill re-arms it, which is the only moment the resolver reads the FOV.
  await page.locator('#drill-select').selectOption('detection_popin_v1');
  await page.waitForFunction(() => document.querySelector('#scene-select')?.value === 'field-low');
  await loadWideFlick(page);
}

async function lockGameView(page) {
  await page.locator('canvas').click({ position: { x: 8, y: 8 } });
  try {
    await page.waitForFunction(() => document.pointerLockElement !== null, undefined, { timeout: 5_000 });
  } catch {
    throw new Error(
      'Native Pointer Lock was not granted. Re-run in an interactive desktop browser: ' +
        'set HEADLESS=false before npm run capture:wp57-visuals.',
    );
  }
  await page.evaluate(() => {
    for (const selector of ['#researcher-menu', '#settings-panel', '#drill-controls', '#export-panel']) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) element.style.visibility = 'hidden';
    }
    for (const element of document.querySelectorAll('body > div')) {
      const text = element.textContent ?? '';
      if (text.includes('punch p') || (text.includes('vx') && text.includes('STOP'))) {
        element.style.visibility = 'hidden';
      }
    }
  });
}

/** The single live target, with its eye-frame angles and NDC footprint at the current FOV. */
function readTarget(page) {
  return page.evaluate(() => {
    const state = window.__aimDebug.state;
    const target = state.targets.find((candidate) => candidate.alive && candidate.visible);
    if (target === undefined) throw new Error('No live target');
    const dx = target.pos.x;
    const dy = target.pos.y - 1.6;
    const dz = target.pos.z;
    const distanceU = Math.hypot(dx, dy, dz);
    return {
      id: target.id,
      zone: target.zone,
      side: target.side,
      pos: { ...target.pos },
      yawDeg: (Math.atan2(dx, -dz) * 180) / Math.PI,
      pitchDeg: (Math.asin(dy / distanceU) * 180) / Math.PI,
      distanceU,
      aim: { ...state.aim },
    };
  });
}

/**
 * Points the live camera at the current target through the same Pointer Lock listener a player uses
 * (`pointerLock.onMove` -> `CameraController.applyDelta`, which owns `state.aim`).
 *
 * The counts-per-radian step is *measured* rather than assumed: it depends on the sensitivity slider
 * and the current FOV (`resolveMouseGain`), and this runner changes the FOV between levels. A probe
 * delta plus two corrective iterations converges well inside the 1.0 deg target angular radius.
 */
async function aimAtLiveTarget(page) {
  const residualRad = await page.evaluate(() => {
    const state = window.__aimDebug.state;
    const target = state.targets.find((candidate) => candidate.alive && candidate.visible);
    if (target === undefined) throw new Error('No live target to aim at');
    // Three's positive world-Y rotation turns a -Z-facing camera to the left, so the horizontal
    // target bearing has the opposite sign to the desired camera yaw (same relation as WP-56 T6).
    const desiredYaw = -Math.atan2(target.pos.x, -target.pos.z);
    const desiredPitch = Math.atan2(target.pos.y - 1.6, Math.hypot(target.pos.x, target.pos.z));

    const move = (dx, dy) => {
      const event = new MouseEvent('mousemove');
      Object.defineProperties(event, { movementX: { value: dx }, movementY: { value: dy } });
      document.dispatchEvent(event);
    };

    // `AimIntegrator` does `yaw -= dx * step`, so a known probe yields the step directly.
    const probe = 200;
    const yawBefore = state.aim.yaw;
    move(probe, 0);
    const stepPerCount = (yawBefore - state.aim.yaw) / probe;
    if (!(Math.abs(stepPerCount) > 0)) throw new Error('Pointer Lock movement did not reach CameraController');

    for (let iteration = 0; iteration < 3; iteration++) {
      move((state.aim.yaw - desiredYaw) / stepPerCount, (state.aim.pitch - desiredPitch) / stepPerCount);
    }
    return Math.hypot(state.aim.yaw - desiredYaw, state.aim.pitch - desiredPitch);
  });
  if (residualRad > 1e-6) throw new Error(`Aim did not converge (residual ${residualRad} rad)`);
  await page.waitForTimeout(80);
}

async function fireOnce(page) {
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
  await page.waitForTimeout(30);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
}

/** Kills the live target and resolves once the next one is up. Retries: a miss legitimately keeps
 *  the same target alive (a centre target is exempt from the peek timeout, so it simply waits). */
async function advanceToNextTarget(page) {
  const before = (await readTarget(page)).id;
  for (let attempt = 0; attempt < 6; attempt++) {
    await aimAtLiveTarget(page);
    await fireOnce(page);
    try {
      await page.waitForFunction(
        (previous) =>
          window.__aimDebug.state.targets.some(
            (target) => target.alive && target.visible && target.id !== previous,
          ),
        before,
        { timeout: 1_500 },
      );
      await page.waitForTimeout(320); // let the tracer fade so the frame shows placement, not muzzle FX
      return;
    } catch {
      await page.waitForTimeout(550); // let the recoil punch decay, then retry the same target
    }
  }
  throw new Error(`Could not advance past target ${before}`);
}

async function captureFovLevel(browser, fovDeg) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__aimDebug));
  await loadWideFlick(page);
  if (fovDeg !== 75) await setFovAndRearm(page, fovDeg);
  await lockGameView(page);
  // The drill's own 3 s countdown is protocol: shots before it are not scheduled, so the first
  // capture would otherwise race the phase transition.
  await page.waitForTimeout(3_600);

  const frames = {};
  await aimAtLiveTarget(page);
  await page.waitForTimeout(120);
  frames.center = readTargetFrame(await readTarget(page));
  await page.screenshot({ path: resolve(outputDir, `center-fov${fovDeg}.png`), animations: 'disabled' });

  // Walk the schedule until one near-edge peripheral on each side has been photographed. The frame is
  // taken *before* aiming at it, so the crosshair is still on the centre where the player's eyes were.
  const captured = new Set();
  for (let step = 0; step < 14 && captured.size < 2; step++) {
    await advanceToNextTarget(page);
    const target = await readTarget(page);
    if (target.zone !== 'peripheral' || captured.has(target.side)) continue;
    captured.add(target.side);
    frames[`peripheral${target.side}`] = readTargetFrame(target);
    await page.screenshot({
      path: resolve(outputDir, `peripheral-${target.side}-fov${fovDeg}.png`),
      animations: 'disabled',
    });
  }
  if (captured.size < 2) throw new Error(`FOV ${fovDeg}: captured sides ${[...captured].join(',') || 'none'}`);

  const schedule = await page.evaluate(async (drillId) => {
    const harness = window.__fpsTest;
    harness.startDrill(drillId);
    return harness.forceExportJSON().meta.spawn.spiderShot;
  }, DRILL_ID);

  const sweep = await measureSampleBudget(page);
  const environment = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    dpr: window.devicePixelRatio,
    webgpuApiAvailable: navigator.gpu !== undefined,
    pointerLock: document.pointerLockElement !== null,
  }));
  await context.close();
  return { fovDeg, resolvedFrom: schedule.resolvedFrom, peripheral: schedule.peripheral, frames, sweep, environment };
}

function readTargetFrame(target) {
  return {
    targetId: target.id,
    zone: target.zone,
    side: target.side,
    pos: target.pos,
    yawDeg: Number(target.yawDeg.toFixed(4)),
    pitchDeg: Number(target.pitchDeg.toFixed(4)),
    distanceU: Number(target.distanceU.toFixed(6)),
  };
}

/**
 * OQ-57.4: how many peripheral arrivals (and per-cell samples) the frozen 90 s limit actually yields
 * at a range of per-trial paces. Each pace is a full run of the shipping config through the harness.
 */
async function measureSampleBudget(page) {
  return page.evaluate(
    async ({ drillId, paces, perCellTarget, timeLimitMs }) => {
      const harness = window.__fpsTest;
      const rows = [];
      for (const paceMs of paces) {
        const taps = Math.ceil(((timeLimitMs + 5_000) / paceMs) * 1.1);
        const sequence = [];
        for (let index = 0; index < taps; index++) {
          const t = index * paceMs;
          sequence.push({ type: 'fire', down: true, t }, { type: 'fire', down: false, t: t + 8 });
        }
        harness.startDrill(drillId);
        harness.feedInput(sequence);
        const payload = harness.forceExportJSON();
        const visible = payload.events.filter((event) => event.type === 'visible');
        const peripheral = visible.filter((event) => event.zone === 'peripheral');
        const fires = payload.events.filter((event) => event.type === 'fire');
        const cells = {};
        for (const event of peripheral) {
          const pitchDeg = (Math.asin((event.targetY - 1.6) / 8) * 180) / Math.PI;
          const key = `${event.side}${pitchDeg >= 0 ? 'upper' : 'lower'}`;
          cells[key] = (cells[key] ?? 0) + 1;
        }
        const perCell = Object.values(cells);
        rows.push({
          paceMs,
          phase: harness.phase(),
          spawns: visible.length,
          peripheralArrivals: peripheral.length,
          cells,
          minPerCell: perCell.length === 0 ? 0 : Math.min(...perCell),
          meetsPerCellTarget: perCell.length === 4 && Math.min(...perCell) >= perCellTarget,
          shots: fires.length,
          hits: fires.filter((event) => event.hit).length,
          // 0 by construction: the harness aims analytically, so no trial can exceed peekTimeoutMs.
          // The censoring boundary itself is gated in tests/e2e/spider-shot-wide.spec.ts.
          syntheticTimeouts: visible.length - 1 - fires.filter((event) => event.hit).length,
        });
      }
      return rows;
    },
    { drillId: DRILL_ID, paces: PACE_LEVELS_MS, perCellTarget: PER_CELL_TARGET, timeLimitMs: DRILL_TIME_LIMIT_MS },
  );
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const server = startDevServer();
  try {
    await waitForApp(server);
    const browser = await chromium.launch({ channel: 'msedge', headless: process.env.HEADLESS !== 'false' });
    try {
      const levels = [];
      for (const fovDeg of FOV_LEVELS) levels.push(await captureFovLevel(browser, fovDeg));
      await writeFile(
        resolve(outputDir, 'metadata.json'),
        `${JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            environment: {
              browser: `Microsoft Edge ${browser.version()}`,
              headless: process.env.HEADLESS !== 'false',
              viewport: { width: 1920, height: 1080 },
              deviceScaleFactor: 1,
            },
            drill: { id: DRILL_ID, sceneId: SCENE_ID, seed: 57001, mode: 'practice' },
            note:
              'syntheticTimeouts is 0 by construction (the harness auto-aims). The human timeout rate ' +
              'for OQ-57.4 requires a real play session and is not synthesised here.',
            levels,
          },
          null,
          2,
        )}\n`,
      );
      for (const level of levels) {
        console.log(
          `[WP-57 T6] FOV ${level.fovDeg}: yaw window [${level.peripheral.yawMagDegRange
            .map((v) => v.toFixed(3))
            .join(', ')}]  centre ndc-aim ok  sides captured`,
        );
        for (const row of level.sweep) {
          console.log(
            `             pace ${row.paceMs} ms -> ${row.peripheralArrivals} peripheral arrivals, ` +
              `min/cell ${row.minPerCell} (target ${PER_CELL_TARGET}: ${row.meetsPerCellTarget ? 'met' : 'MISSED'}), phase ${row.phase}`,
          );
        }
      }
      console.log(`Captured WP-57 T6 evidence in ${outputDir}`);
    } finally {
      await browser.close();
    }
  } finally {
    await stopDevServer(server);
  }
}

void main();
