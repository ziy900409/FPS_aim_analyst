/**
 * stage14 —— 產出後的渲染檢查（HANDOFF §5「產出後必須做的兩件事」的第二件）。
 *
 * Usage:
 *   node scripts/check-coach-report-render.mjs <report.html> [screenshot-dir]
 *
 * 對 light／dark 兩種 `colorScheme` 各開一次,檢查四件事:
 *   (a) 每個 `figure.viz` 內 SVG 的 `getBBox()` 有沒有超出 `viewBox`
 *   (b) 圖卡自己有沒有出現水平捲軸
 *   (c) 頁面 body 有沒有水平捲軸
 *   (d) 圖內文字標記有沒有互相碰撞（同一張圖內兩個 `<text>` 的 bbox 重疊）
 *
 * 檢查**只讀**目標 HTML,不改它;有 screenshot 目錄時順便逐圖截圖供人眼複驗
 * （(d) 的自動檢查抓得到碰撞,抓不到「文字說明與視覺不一致」——那一項只能人看）。
 *
 * 任一模式有問題即以非零 exit 結束。
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const target = process.argv[2];
const shotDir = process.argv[3];

if (target === undefined) {
  console.error('usage: node scripts/check-coach-report-render.mjs <report.html> [screenshot-dir]');
  process.exit(2);
}
if (shotDir !== undefined) mkdirSync(path.resolve(shotDir), { recursive: true });

const fileUrl = pathToFileURL(path.resolve(target)).href;
let failures = 0;

for (const scheme of ['light', 'dark']) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, colorScheme: scheme });
  await page.goto(fileUrl, { waitUntil: 'load' });

  if (shotDir !== undefined) {
    const figures = await page.locator('figure.viz').all();
    for (let index = 0; index < figures.length; index++) {
      await figures[index].screenshot({ path: path.join(path.resolve(shotDir), `${scheme}-fig${index + 1}.png`) });
    }
  }

  const problems = await page.evaluate(() => {
    const bad = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('BODY H-SCROLL');

    document.querySelectorAll('figure.viz').forEach((figure, index) => {
      const name = figure.querySelector('figcaption h3')?.textContent?.trim().slice(0, 24) ?? `fig${index + 1}`;
      const svg = figure.querySelector('svg');
      if (svg === null) return;

      const viewBox = svg.viewBox.baseVal;
      const box = svg.getBBox();
      if (
        box.x < -0.5 ||
        box.y < -0.5 ||
        box.x + box.width > viewBox.width + 0.5 ||
        box.y + box.height > viewBox.height + 0.5
      ) {
        bad.push(
          `${name}: bbox ${box.x.toFixed(1)},${box.y.toFixed(1)} → ${(box.x + box.width).toFixed(1)},${(box.y + box.height).toFixed(1)} vs viewBox ${viewBox.width}x${viewBox.height}`,
        );
      }
      if (figure.scrollWidth > figure.clientWidth + 1) bad.push(`${name}: figure h-scroll`);

      // 文字碰撞：同一張圖內的 <text> 兩兩比 bbox。座標系一致（同一個 SVG）,故可直接比。
      //
      // ⚠️ 門檻不能取「重疊 > 1px」。CJK 字形的 bbox 含相當寬的 ascender/descender 留白,兩行
      // 間距 14px 的 12px/11px 標籤 bbox 會重疊 1–3px,但**字形完全沒有碰到**（已以教練提案 HTML
      // 的 C5 逐圖目視確認）。用 1px 門檻會把所有兩行式標籤都報成碰撞,雜訊淹掉真訊號。
      // 取「兩軸都重疊超過較小那個 box 的一半」——真正壓在一起的文字必然滿足,相鄰行不會。
      const texts = [...svg.querySelectorAll('text')].map((node) => ({
        text: node.textContent ?? '',
        box: node.getBBox(),
      }));
      for (let a = 0; a < texts.length; a++) {
        for (let b = a + 1; b < texts.length; b++) {
          const first = texts[a].box;
          const second = texts[b].box;
          if (first.width === 0 || second.width === 0 || first.height === 0 || second.height === 0) continue;
          const overlapX = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
          const overlapY = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
          if (
            overlapX > 0.5 * Math.min(first.width, second.width) &&
            overlapY > 0.5 * Math.min(first.height, second.height)
          ) {
            bad.push(`${name}: text collision "${texts[a].text}" ↔ "${texts[b].text}"`);
          }
        }
      }
    });
    return bad;
  });

  if (problems.length === 0) {
    console.log(`${scheme.toUpperCase()} -> no layout issues`);
  } else {
    failures += problems.length;
    console.log(`${scheme.toUpperCase()} -> ${problems.length} issue(s)`);
    for (const problem of problems) console.log(`  ${problem}`);
  }

  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
