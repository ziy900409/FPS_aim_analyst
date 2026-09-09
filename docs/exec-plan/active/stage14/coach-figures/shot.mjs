import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const target = path.resolve('docs/algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html');
const file = pathToFileURL(target).href;
const out = process.argv[2];

for (const scheme of ['light', 'dark']) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, colorScheme: scheme });
  await p.goto(file, { waitUntil: 'load' });

  const figs = await p.locator('figure.viz').all();
  for (let i = 0; i < figs.length; i++) {
    await figs[i].screenshot({ path: path.join(out, `${scheme}-c${i + 1}.png`) });
  }

  const ov = await p.evaluate(() => {
    const bad = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('BODY H-SCROLL');
    document.querySelectorAll('figure.viz').forEach((f, i) => {
      const svg = f.querySelector('svg');
      if (!svg) return;
      const vb = svg.viewBox.baseVal;
      const bb = svg.getBBox();
      if (bb.x < -0.5 || bb.y < -0.5 || bb.x + bb.width > vb.width + 0.5 || bb.y + bb.height > vb.height + 0.5) {
        bad.push(`C${i + 1} outside viewBox: bbox ${bb.x.toFixed(1)},${bb.y.toFixed(1)} -> ${(bb.x + bb.width).toFixed(1)},${(bb.y + bb.height).toFixed(1)} vs ${vb.width}x${vb.height}`);
      }
      if (f.scrollWidth > f.clientWidth + 1) bad.push(`C${i + 1} figure h-scroll`);
    });
    return bad;
  });
  console.log(scheme.toUpperCase(), '->', ov.length ? ov : 'no overflow issues');
  await b.close();
}
