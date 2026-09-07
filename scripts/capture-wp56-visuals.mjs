/**
 * WP-56 T6 — reproducible browser capture runner for the approved visual-review evidence.
 *
 * It deliberately drives the researcher entry point and the live scene.  The asset-fallback
 * capture aborts only the Micro Flick GLTF request, so it exercises the production fallback
 * path rather than a mocked scene manager.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'docs/exec-plan/active/stage12/wp-56-micro-flick-test-scene/captures');
const appUrl = 'http://127.0.0.1:5173/';
const assetPath = '**/assets/scenes/micro-flick-room/micro-flick-room.gltf';

function startDevServer() {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm.cmd run dev -- --host 127.0.0.1']
      : ['run', 'dev', '--', '--host', '127.0.0.1'];
  return spawn(command, args, {
    cwd: root,
    env: { ...process.env, FPS_HISTORY_ROOT: '.wp56-capture-tmp/history' },
    stdio: 'ignore',
    windowsHide: true,
  });
}

async function waitForApp(server) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    try {
      if ((await fetch(appUrl)).ok) return;
    } catch {
      // The next 100 ms retry is the normal Vite start-up path.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error('Timed out waiting for Vite at http://127.0.0.1:5173/');
}

async function waitForThreeTargets(page) {
  await page.waitForFunction(() => {
    const debug = window.__aimDebug;
    return debug !== undefined && debug.state.targets.filter((target) => target.alive && target.visible).length === 3;
  });
}

async function loadMicroFlick(page) {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await page.locator('#drill-select').selectOption('micro_flick_three_target_test_v1');
  await page.locator('#scene-select').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#scene-select')?.value === 'micro-flick-room');
  await waitForThreeTargets(page);
}

async function lockGameView(page) {
  await page.locator('canvas').click({ position: { x: 8, y: 8 } });
  try {
    await page.waitForFunction(() => document.pointerLockElement !== null, undefined, { timeout: 5_000 });
  } catch {
    throw new Error(
      'Native Pointer Lock was not granted. Re-run in an interactive desktop browser: ' +
        'set HEADLESS=false before npm run capture:wp56-visuals.',
    );
  }
  // Researcher controls are needed only to select the practice drill. They are not part of the reviewed game view.
  await page.evaluate(() => {
    for (const selector of ['#researcher-menu', '#settings-panel', '#drill-controls', '#export-panel', '#recoil-debug']) {
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

async function aimAtOpeningTarget(page) {
  return page.evaluate(() => {
    const target = window.__aimDebug.state.targets.find((candidate) => candidate.id === 't0' && candidate.alive);
    if (target === undefined) throw new Error('Expected opening target t0');
    // Three's positive world-Y rotation turns a -Z-facing camera to the left, so horizontal
    // target bearing has the opposite sign to the desired camera yaw.
    const yaw = -Math.atan2(target.pos.x, -target.pos.z);
    const pitch = Math.atan2(target.pos.y - 1.6, Math.hypot(target.pos.x, target.pos.z));
    const step = (0.022 * Math.PI) / 180;
    const move = new MouseEvent('mousemove');
    Object.defineProperties(move, {
      movementX: { value: -yaw / step },
      movementY: { value: -pitch / step },
    });
    // CameraController is driven by this same Pointer Lock movement listener. The capture input only
    // selects the known opening target; lifecycle behaviour remains covered by the T2/T5 test gates.
    document.dispatchEvent(move);
    return { target: { ...target.pos }, yaw, pitch, aim: { ...window.__aimDebug.state.aim } };
  });
}

async function capture(browser, { name, width, height, fallback = false, replacement = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (fallback) await page.route(assetPath, (route) => route.abort('failed'));
  await loadMicroFlick(page);
  await lockGameView(page);
  await page.waitForTimeout(100);

  if (replacement) {
    console.info('[WP-56 T6] aim', await aimAtOpeningTarget(page));
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
    await page.waitForTimeout(20);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
    try {
      await page.waitForFunction(
        () => window.__aimDebug.state.targets.some((target) => target.id === 't3' && target.alive),
        undefined,
        { timeout: 5_000 },
      );
    } catch {
      const state = await page.evaluate(() => ({
        aim: { ...window.__aimDebug.state.aim },
        targets: window.__aimDebug.state.targets.map((target) => ({ id: target.id, alive: target.alive, visible: target.visible })),
      }));
      throw new Error(`Expected live t0 hit and t3 replacement; observed ${JSON.stringify(state)}`);
    }
    // Let the short-lived tracer fade before reviewing target placement rather than a firing effect.
    await page.waitForTimeout(250);
  }

  await page.screenshot({ path: resolve(outputDir, name), animations: 'disabled' });
  const metadata = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    dpr: window.devicePixelRatio,
    webgpuApiAvailable: navigator.gpu !== undefined,
    pointerLock: document.pointerLockElement !== null,
    targets: window.__aimDebug.state.targets
      .filter((target) => target.alive && target.visible)
      .map((target) => target.id),
  }));
  await context.close();
  return metadata;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const server = startDevServer();
  try {
    await waitForApp(server);
    const browser = await chromium.launch({
      channel: 'msedge',
      headless: process.env.HEADLESS !== 'false',
    });
    try {
      const captures = {
        initial1080p: await capture(browser, { name: 'initial-1920x1080.png', width: 1920, height: 1080 }),
        replacement1080p: await capture(browser, {
          name: 'replacement-1920x1080.png',
          width: 1920,
          height: 1080,
          replacement: true,
        }),
        initial720p: await capture(browser, { name: 'initial-1280x720.png', width: 1280, height: 720 }),
        fallback1080p: await capture(browser, {
          name: 'fallback-1920x1080.png',
          width: 1920,
          height: 1080,
          fallback: true,
        }),
      };
      await writeFile(
        resolve(outputDir, 'metadata.json'),
        `${JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            environment: {
              browser: `Microsoft Edge ${browser.version()}`,
              headless: process.env.HEADLESS !== 'false',
              deviceScaleFactor: 1,
              renderer: 'application Three.js WebGPU path; browser WebGPU availability is recorded per capture',
            },
            drill: {
              id: 'micro_flick_three_target_test_v1',
              seed: 56001,
              sceneId: 'micro-flick-room',
              assetPackVersion: 'micro-flick-room-v1',
            },
            captures,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`Captured WP-56 T6 evidence in ${outputDir}`);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

void main();
