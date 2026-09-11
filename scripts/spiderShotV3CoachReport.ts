/**
 * stage14 —— `spider-shot-v3` 教練報告的渲染層（HTML + SVG + CSV）。
 *
 * 純函式:吃 [`CoachReport`](spiderShotV3CoachRunner.ts),回字串。無 I/O、不讀時鐘、不讀隨機。
 *
 * **座標一律用算的,不目測**（HANDOFF §5）:每個 SVG 的每一個 x/y 都由本檔的比例尺函式產生。
 *
 * **調色盤不自己挑**：沿用教練提案 HTML 已驗過的那一組（light `#2a78d6,#eb6834,#1baf7a` 對白底、
 * dark `#3987e5,#d95926,#199e70` 對 `#171e2d`,all-pairs 六項檢查全 PASS）。
 * 淺色主題的 series-3 對白底只有 2.82:1 ⇒ relief 規則:**所有堆疊段一律直接標值**。
 * 系列上限 3 —— 本報告最多同時畫三份 run,剛好。改任何一個 hex 都必須重跑驗證器。
 *
 * **格線與座標軸不得用虛線**;資料端 4px 圓角、基線端方角;堆疊段之間留 2px surface 間隙;
 * 絕不用雙軸（單位不同就換無單位比值或分兩張圖);每張圖都有表格檢視與 `<title>` hover。
 */
import {
  CEILING_HIT_RATE,
  MIN_BASELINE_RUNS,
  MIN_BIN_N,
  MIN_TAIL_N,
  PROTOCOL_COUNTDOWN_MS,
  PROTOCOL_PEEK_TIMEOUT_MS,
  PROTOCOL_SCORING_WINDOW_MS,
  ROLLING_WINDOW_TRIALS,
  type BinSummary,
  type CoachReport,
  type RunSummary,
  type TailRow,
} from './spiderShotV3CoachRunner.ts';

// ---------------------------------------------------------------------------
// 版面常數
// ---------------------------------------------------------------------------

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'] as const;
const CHART_WIDTH = 680;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function renderPresentationCsv(report: CoachReport): string {
  const header = [
    'run_index',
    'source',
    'trial_index',
    'target_id',
    'quadrant',
    'eye_frame_side',
    'azimuth_bin',
    'tier',
    'd_deg',
    'w_deg',
    'id_bits',
    'first_shot_hit',
    'no_first_shot',
    'fire_count',
    'hit_time_ms',
    'fire_angle_error_deg',
    'overshoot_deg',
    'drop_count',
    'micro_adjust_count',
    'detection_status',
    'reaction_ms',
    'movement_time_ms',
    'peak_omega_deg_per_sec',
    'rec_ms',
    'mr_ms',
    'v_ms',
    'phase_flags',
  ];
  const rows = report.rows.map((row) => [
    row.runIndex,
    row.sourcePath,
    row.trialIndex,
    row.targetId,
    row.quadrant,
    row.side,
    row.azimuthBin,
    row.tierKey,
    num(row.dDeg),
    num(row.wDeg),
    num(row.idBits),
    row.firstShotHit,
    row.noFirstShot,
    row.fireCount,
    num(row.hitTimeMs),
    num(row.fireAngleErrorDeg),
    num(row.overshootDeg),
    num(row.dropCount),
    num(row.microAdjustCount),
    row.detectionStatus,
    num(row.reactionMs),
    num(row.movementTimeMs),
    num(row.peakOmegaDegPerSec),
    num(row.recMs),
    num(row.mrMs),
    num(row.vMs),
    row.phaseFlags.join('|'),
  ]);
  return toCsv([header, ...rows]);
}

export function renderRunCsv(report: CoachReport): string {
  const header = [
    'run_index',
    'source',
    'started_at',
    'display_hz',
    'peripheral_presentations',
    'first_shot_hits',
    'peripheral_hits',
    'first_shot_hit_rate',
    'measured_duration_ms',
    'protocol_duration_ms',
    'm1_first_shot_effective_per_min_protocol',
    'm1_first_shot_effective_per_min_measured',
    'total_hits_per_min_protocol',
    'total_hits_per_min_measured',
    'refire_gap_per_min_protocol',
    'presentations_per_min_protocol',
    'denominator_inflation',
    'detected',
    'detection_total',
    'rec_ms_p50',
    'mr_ms_p50',
    'v_ms_p50',
    'hit_time_p50',
    'hit_time_p95',
    'fire_angle_error_p50',
    'fire_angle_error_p95',
    'overshoot_p50',
    'overshoot_n',
    'fitts_intercept_ms',
    'fitts_slope_ms_per_bit',
    'fitts_r2',
    'registry_status',
    'registry_reason_code',
  ];
  const rows = report.runs.map((run) => {
    const tail = (key: string) => run.tails.find((entry) => entry.key === key);
    return [
      run.runIndex,
      run.sourcePath,
      run.quality.startedAt,
      run.quality.displayHz,
      run.effectiveSpeed.peripheralCount,
      run.effectiveSpeed.firstShotHitCount,
      run.effectiveSpeed.peripheralHitCount,
      num(run.effectiveSpeed.firstShotHitRate),
      num(run.effectiveSpeed.measuredDurationMs),
      num(run.effectiveSpeed.protocolDurationMs),
      num(run.effectiveSpeed.firstShotEffectivePerMinProtocol),
      num(run.effectiveSpeed.firstShotEffectivePerMinMeasured),
      num(run.effectiveSpeed.totalHitsPerMinProtocol),
      num(run.effectiveSpeed.totalHitsPerMinMeasured),
      num(run.effectiveSpeed.refireGapPerMinProtocol),
      num(run.effectiveSpeed.presentationsPerMinProtocol),
      num(run.effectiveSpeed.denominatorInflation),
      run.detection.detected,
      run.detection.total,
      num(run.phase.recMs),
      num(run.phase.mrMs),
      num(run.phase.vMs),
      num(tail('hit-time')?.p50),
      num(tail('hit-time')?.p95),
      num(tail('fire-angle-error')?.p50),
      num(tail('fire-angle-error')?.p95),
      num(tail('overshoot')?.p50),
      tail('overshoot')?.n ?? 0,
      num(run.fitts.interceptMs),
      num(run.fitts.slopeMsPerBit),
      num(run.fitts.r2),
      run.registry.status,
      run.registry.reasonCode ?? '',
    ];
  });
  return toCsv([header, ...rows]);
}

export function renderBinCsv(report: CoachReport): string {
  const header = ['run_index', 'source', 'axis', 'bin_key', 'bin_label', 'n', 'first_shot_hits', 'first_shot_hit_rate', 'median_hit_time_ms', 'conclusive'];
  const rows = report.runs.flatMap((run) =>
    [
      ...run.azimuthBins.map((bin) => ({ axis: 'azimuth', bin })),
      ...run.tierBins.map((bin) => ({ axis: 'amplitude-tier', bin })),
    ].map(({ axis, bin }) => [
      run.runIndex,
      run.sourcePath,
      axis,
      bin.key,
      bin.label,
      bin.n,
      bin.firstShotHitCount,
      num(bin.firstShotHitRate),
      num(bin.medianHitTimeMs),
      bin.conclusive,
    ]),
  );
  return toCsv([header, ...rows]);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export function renderCoachReportHtml(report: CoachReport): string {
  const runs = report.runs;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Spider Shot v3 教練報告（真人量測 · ${runs.length} 場）</title>
<style>${STYLE}</style>
</head>
<body>
${renderHeader(report)}
${renderNav()}
<main class="shell">
${renderValidity(report)}
${renderGates(report)}
${renderVerdict(report)}
${renderMetrics(report)}
${renderCharts(report)}
${renderRepTrend(report)}
${renderOverturned(report)}
${renderHonesty(report)}
${renderMethod(report)}
</main>
${renderFooter(report)}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 區塊
// ---------------------------------------------------------------------------

function renderHeader(report: CoachReport): string {
  const runs = report.runs;
  const last = runs[runs.length - 1];
  return `<header class="shell">
<p class="eyebrow">Spider Shot v3 · coach report · real capture</p>
<h1>三場真人量測<br>說得出口的與說不出口的</h1>
<p class="lede">
本報告的每一個數字都由 <code>${escapeHtml(runs.map((run) => run.sourcePath).join('、'))}</code>
以既有 canonical derivation 算出。<strong>沒有任何示例值。</strong>
凡是這批資料撐不起的圖與句子,一律降級並在原地說明原因 —— 那些降級本身就是結果。
</p>
<div class="meta">
<span class="pill real">真人量測</span>
<span class="pill">n = 1 位受試者 · ${runs.length} 場</span>
<span class="pill">${escapeHtml(last.quality.startedAt.slice(0, 10))}</span>
<span class="pill">${escapeHtml(last.quality.protocolVersion ?? '—')}</span>
<span class="pill warn">不得作為訓練處方依據（C-D3）</span>
</div>
</header>`;
}

function renderNav(): string {
  const items: readonly [string, string][] = [
    ['#validity', '資料效度'],
    ['#gates', '五道閘'],
    ['#verdict', '本場結論'],
    ['#metrics', '指標值'],
    ['#charts', '七張圖'],
    ['#rep', '三次重複'],
    ['#overturned', '被推翻的假設'],
    ['#honesty', '誠實邊界'],
    ['#method', '方法'],
  ];
  return `<nav aria-label="報告導覽"><div class="shell">${items
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join('')}</div></nav>`;
}

function renderValidity(report: CoachReport): string {
  const rows = report.runs
    .map(
      (run) => `<tr>
<td>rep ${run.runIndex + 1}</td>
<td>${escapeHtml(run.quality.startedAt.slice(11, 19))}</td>
<td>${run.quality.displayHz} / ${run.quality.simHz}</td>
<td>${run.effectiveSpeed.peripheralCount}</td>
<td>${(run.quality.tickSpanMs / 1000).toFixed(2)} s</td>
<td>${run.quality.crossOriginIsolated ? '✅' : '❌'}</td>
<td>${run.quality.suspect ? '❌ suspect' : '✅ ok'}</td>
<td>${run.quality.validityFlags.length === 0 ? '✅ 全 false' : escapeHtml(run.quality.validityFlags.join('、'))}</td>
<td>${run.quality.lateEventCount}</td>
<td>${fmt(run.quality.framesP50Ms, 2)} / ${fmt(run.quality.framesP99Ms, 2)}</td>
<td>${run.quality.blockers.length === 0 ? '✅ 無' : escapeHtml(run.quality.blockers.join('；'))}</td>
</tr>`,
    )
    .join('\n');

  const first = report.runs[0].quality;
  return `<section id="validity">
<h2>0. 資料效度先行</h2>
<p class="section-intro">
不合格就停用所有診斷,這一條不可換位。三份都通過:<code>crossOriginIsolated</code> 為真、
<code>suspect</code> 為偽、四個 <code>validity</code> 旗標全偽、顯示 ${first.displayHz} Hz(遠高於相位診斷要求的 144 Hz)。
</p>
<div class="table-wrap"><table>
<thead><tr><th>Run</th><th>錄製時刻</th><th>display/sim Hz</th><th>周邊呈現</th><th>tick span</th><th>COI</th><th>quality</th><th>validity</th><th>late events</th><th>frame p50/p99 (ms)</th><th>blocker</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
<div class="callout">
<strong>採集面缺兩樣東西,兩樣都改變了報告能說什麼</strong>
<ul>
<li><code>meta.dpi</code> <strong>缺席</strong> ⇒ <code>cm/360</code> 不可算。<code>counts/360</code> = ${first.countsPer360.toFixed(0)}（sens ${first.sensitivity} / FOV ${fmt(first.fovDeg, 0)}）照列,但**不用預設 DPI 猜** cm/360。</li>
<li><code>meta.session.participantId</code> <strong>缺席</strong> ⇒ compatibility key 建不起來,三份都進不了歷史趨勢（見 §3 與 KI-034）。</li>
<li><code>mouseSamples</code> 缺席（未用 <code>?rawMouse=1</code>）⇒ 只有 128 Hz tick 級 <code>aim</code>。<strong>這不是 blocker</strong>,只是少了一維資料。</li>
</ul>
</div>
</section>`;
}

function renderGates(report: CoachReport): string {
  const blocks = report.gates
    .map(
      (gate) => `<article class="gate">
<h3><span class="gid">${gate.id}</span> ${inline(gate.title)}</h3>
<p class="gate-verdict">${escapeHtml(gate.verdict)}</p>
<ul>${gate.lines.map((line) => `<li>${inline(line)}</li>`).join('')}</ul>
${
  gate.degradations.length === 0
    ? '<p class="gate-none">這道閘沒有造成任何降級。</p>'
    : `<div class="degrade"><strong>因此降級</strong><ul>${gate.degradations
        .map((entry) => `<li>${inline(entry)}</li>`)
        .join('')}</ul></div>`
}
</article>`,
    )
    .join('\n');

  return `<section id="gates">
<h2>1. 五道必經閘</h2>
<p class="section-intro">
順序不可換。每一道都有一個帶數字的結論,以及它導致的降級 —— 降級不是省略,是這批資料的邊界。
</p>
${blocks}
</section>`;
}

function renderVerdict(report: CoachReport): string {
  const runs = report.runs;
  const m1 = runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol);
  const rates = runs.map((run) => run.effectiveSpeed.firstShotHitRate);
  const rec = runs.map((run) => run.phase.recMs);
  const mr = runs.map((run) => run.phase.mrMs);
  const v = runs.map((run) => run.phase.vMs);
  const hitTimes = report.repTrend.map((row) => row.medianHitTimeMs);
  const gap = runs.map((run) => run.effectiveSpeed.refireGapPerMinProtocol);

  return `<section id="verdict">
<h2>2. 本三場的結論</h2>
<p class="section-intro">
先給判斷,再給證據 —— 那是教練溝通的順序。以下每一句都只描述<strong>這三場</strong>。
</p>
<div class="callout good">
<strong>${escapeHtml(verdictHeadline(runs))}</strong>
<p style="margin-top:8px">
三場的首發命中率是 ${rates.map((rate) => pct(rate)).join('／')},首發有效速度
${m1.map((value) => value.toFixed(1)).join('／')} 首發有效命中/min（60.0 s 分母）。
補槍依賴很小 —— 總命中速度只比首發有效速度高
${gap.map((value) => value.toFixed(1)).join('／')}/min（C1、C2）。
</p>
<p>
代價在時間預算裡:REC 起手 ${rec.map((value) => fmt(value, 0)).join('／')} ms、
MR 主揮動 ${mr.map((value) => fmt(value, 0)).join('／')} ms、
V 確認 ${v.map((value) => fmt(value, 0)).join('／')} ms（C3）。
${describePhaseShape(runs)}
你的時間主要不是花在「揮過去」,是花在「揮到了之後、扣扳機之前」。
</p>
<p>
三次重複同一組刺激,命中時間中位數
${hitTimes.map((value) => fmt(value, 0)).join(' → ')} ms。
逐相位的 rep 1 → rep ${runs.length} 變化:${describePhaseDeltas(runs)}。
</p>
<p style="margin-bottom:0">
<strong>如果只給一個 cue:把確認期縮短,並接受首發命中率會掉一點。</strong>
準確率那一端只剩 ${pct(1 - Math.max(...rates))} 的空間可換
（三場 ${rates.map((rate) => pct(rate)).join('／')},已貼天花板）,速度那一端才有。
</p>
</div>
<div class="callout warning">
<strong>注意我沒有說的話</strong>
我沒有說「你進步了」——三場是同一序列的三次重複,而且沒有先前基準可比（G4、G5）。
我沒有說「你哪一側弱」——${ceilingBinShare(report)}的達 n 門檻分箱首發命中率 ≥ ${pct(CEILING_HIT_RATE)},那個軸這批資料沒有鑑別力（§6）。
我沒有說任何「及格／優秀」——2.0° 與 10–25° 都沒有經過真人校準。
</div>
</section>`;
}

function renderMetrics(report: CoachReport): string {
  const runs = report.runs;
  const registryRows = runs[0].registry.observations.map((_observation, index) => {
    const cells = runs
      .map((run) => {
        const observation = run.registry.observations[index];
        return `<td>${observation === undefined ? '—' : formatObservation(observation.value, observation.format)}</td>`;
      })
      .join('');
    const first = runs[0].registry.observations[index];
    return `<tr><td><code>${escapeHtml(first.metricId)}</code><br><span class="sub">${escapeHtml(first.label)}</span></td>${cells}<td>${escapeHtml(first.unit)}</td></tr>`;
  });

  const m1Rows = [
    metricRow('M1 · 首發有效速度（60.0 s 分母）', runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol), 1, '首發有效命中/min'),
    metricRow('M1 · 首發有效速度（registry 分母）', runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinMeasured), 1, '首發有效命中/min'),
    metricRow('總命中速度（60.0 s 分母）', runs.map((run) => run.effectiveSpeed.totalHitsPerMinProtocol), 1, 'hits/min'),
    metricRow('總命中速度（registry 分母）', runs.map((run) => run.effectiveSpeed.totalHitsPerMinMeasured), 1, 'hits/min'),
    metricRow('補槍依賴 = 總命中速度 − M1（同 60.0 s 分母）', runs.map((run) => run.effectiveSpeed.refireGapPerMinProtocol), 1, 'hits/min'),
    metricRow('周邊呈現速率（60.0 s 分母）', runs.map((run) => run.effectiveSpeed.presentationsPerMinProtocol), 1, '次/min'),
  ].join('\n');

  return `<section id="metrics">
<h2>3. 指標值</h2>

<h3>3.1 歷史趨勢的五個 registry 指標</h3>
<div class="callout danger">
<strong><code>DrillMetricRegistry.project()</code> 對三份都不是 <code>'ready'</code></strong>
實際回 <code>${escapeHtml(runs[0].registry.status)}</code> /
<code>${escapeHtml(runs[0].registry.reasonCode ?? '—')}</code>。
根因:${inline(runs[0].registry.diagnosis ?? '未知')}。
下表的五個值是直接呼叫該 drill 的 <code>registration.project()</code> 算出來的 —— 指標本身沒問題,
<strong>進不了趨勢的是這三份 run 的 metadata</strong>。已立案為 <strong>KI-034</strong>。
</div>
<div class="table-wrap"><table>
<thead><tr><th>Metric ID</th>${runs.map((run) => `<th>rep ${run.runIndex + 1}</th>`).join('')}<th>單位</th></tr></thead>
<tbody>${registryRows.join('\n')}</tbody>
</table></div>
<p class="footnote">
⚠️ <code>peripheral-hits-per-minute</code> 的分母是 <code>validDurationMs</code>（最後 tick − 第一 tick,含 ${PROTOCOL_COUNTDOWN_MS / 1000} 秒倒數）
⇒ 絕對值低估 ${runs.map((run) => pct(run.effectiveSpeed.denominatorInflation)).join('／')}（G2 / KI-035）。
⚠️ <code>median-overshoot-deg</code> 只有 ${runs.map((run) => run.tails.find((tail) => tail.key === 'overshoot')?.n ?? 0).join('／')} 個有效樣本（§6）。
⚠️ <code>peripheral-first-shot-hit-rate</code> 由 <code>firstFire</code> 自己的命中結果算出（非 <code>window.outcome</code>）—— 不會被補槍灌水。
</p>

<h3>3.2 M1 首發有效速度與補槍依賴</h3>
<div class="table-wrap"><table>
<thead><tr><th>量</th>${runs.map((run) => `<th>rep ${run.runIndex + 1}</th>`).join('')}<th>單位</th></tr></thead>
<tbody>${m1Rows}</tbody>
</table></div>
<p class="footnote">
M1 = <code>60000 × 首發即命中的周邊呈現數 / 分母</code>。它等於「周邊呈現速率 × 首發命中率」,
兩者任一下降它就下降 ⇒ <strong>它不能被補槍灌水</strong>。
本批的補槍依賴極小（${runs.map((run) => run.effectiveSpeed.refireGapPerMinProtocol.toFixed(1)).join('／')}/min）——
受試者幾乎每次都是一發解決。
</p>
</section>`;
}

function metricRow(label: string, values: readonly number[], digits: number, unit: string): string {
  return `<tr><td>${escapeHtml(label)}</td>${values
    .map((value) => `<td>${fmt(value, digits)}</td>`)
    .join('')}<td>${escapeHtml(unit)}</td></tr>`;
}

function renderCharts(report: CoachReport): string {
  return `<section id="charts">
<h2>4. 七張圖</h2>
<p class="section-intro">
一張圖回答一個問題。降級的圖保留在原位並說明原因 —— 拿掉它們會讓人以為那些問題已經有答案。
</p>
${chartC1(report)}
${chartC2(report)}
${chartC3(report)}
${chartC4(report)}
${chartC5(report)}
${chartC6(report)}
${chartC7(report)}
</section>`;
}

function renderRepTrend(report: CoachReport): string {
  const rows = report.repTrend
    .map(
      (row) => `<tr>
<td>rep ${row.runIndex + 1}</td>
<td>${row.n}</td>
<td>${pct(row.firstShotHitRate)}</td>
<td>${fmt(row.medianHitTimeMs, 0)} ms</td>
<td>${fmt(row.medianFireAngleErrorDeg, 3)}°</td>
<td>${row.fireCount}</td>
</tr>`,
    )
    .join('\n');

  return `<section id="rep">
<h2>5. 三次重複（共同前綴 ${report.sequence.commonPeripheralPrefix} 個周邊呈現）</h2>
<p class="section-intro">
三份 run 的前 ${report.sequence.commonVisiblePrefix} 個呈現逐位相同（G4）。跨 run 比較只在這個前綴內做,
否則後段條件會被呈現數最多的那一份主導。<strong>這是練習效應,不是能力變化。</strong>
</p>
<div class="table-wrap"><table>
<thead><tr><th>Rep</th><th>n</th><th>首發命中率</th><th>命中時間 p50</th><th>首發角誤差 p50</th><th>總開火數</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
</section>`;
}

function renderOverturned(report: CoachReport): string {
  if (report.overturned.length === 0) {
    return `<section id="overturned"><h2>6. 被資料推翻的設計假設</h2><p>沒有 —— 設計文件的假設在這批資料上全部成立。</p></section>`;
  }
  return `<section id="overturned">
<h2>6. 被資料推翻的設計假設</h2>
<p class="section-intro">
以下每一條都是「設計文件說會這樣、資料說不是」。它們是本次分析最有價值的產物,
必須回寫進三份設計 HTML 與 stage14 的 <code>progress.md</code>。
</p>
${report.overturned.map((entry) => `<div class="callout danger">${inline(entry)}</div>`).join('\n')}
</section>`;
}

function renderHonesty(report: CoachReport): string {
  return `<section id="honesty">
<h2>7. 誠實邊界</h2>
<p class="section-intro">
依 C-D3 / GD-20:未通過構念驗證的指標不得進教練報告。以下八條是這批資料的硬邊界,
<strong>寧可少一個指標,不能有一個會說錯話的指標</strong>。
</p>
<ol class="honesty">${report.honesty.map((entry) => `<li>${inline(entry)}</li>`).join('')}</ol>
</section>`;
}

function renderMethod(report: CoachReport): string {
  const runs = report.runs;
  return `<section id="method">
<h2>8. 方法</h2>
<div class="table-wrap"><table>
<thead><tr><th>量</th><th>來源（canonical,不重算）</th></tr></thead>
<tbody>
<tr><td><code>D_deg</code> / <code>W_deg</code> / <code>quadrant</code> / eye-frame <code>side</code></td><td><code>deriveSpiderShotTransitions()</code></td></tr>
<tr><td><code>ε(t)</code> / on-target / <code>overshootDeg</code> / <code>dropCount</code> / <code>microAdjustCount</code></td><td><code>deriveSpiderShotMetrics()</code> → <code>deriveTrackingSamples()</code>（含 sphere 幾何,KI-021 已於 2026-09-03 修復,本批在修後）</td></tr>
<tr><td><code>t_detect</code> / <code>reactionMs</code></td><td><code>deriveDetectionMetrics()</code>,<strong>canonical 預設參數</strong>（未用 KI-031 繞道）</td></tr>
<tr><td>REC / MR / V</td><td><code>computePhaseMetrics()</code>(<code>phase-v1</code>);只取 <code>flags</code> 為空的樣本</td></tr>
<tr><td>命中時間 / 首發 / 開火數</td><td><code>buildPeekWindows()</code>;<strong>首發一律驗 <code>firstFire</code> 自己的命中結果</strong>,不用 <code>window.outcome</code></td></tr>
<tr><td><code>counts/360</code></td><td><code>deriveMouseThrow()</code>;<code>meta.dpi</code> 缺席 ⇒ <code>cm/360</code> 為 <code>undefined</code>,不填 0</td></tr>
<tr><td>五個趨勢指標</td><td><code>DrillMetricRegistry</code> 的 <code>spider-shot-v3</code> registration</td></tr>
<tr><td>ID</td><td><code>log₂(1 + D/W)</code>,D/W 皆取上列 canonical 值</td></tr>
</tbody>
</table></div>
<h3>刻意沒算的東西</h3>
<ul>
<li><code>sync-v1</code>（<code>computeSyncMetrics</code>）—— v3 是 <code>translation: 'locked'</code>、無 <code>counter</code> 事件,
<code>releaseToFireMs</code>／<code>counterHoldMs</code> 沒有可錨定的對象（設計文件 D4:結構性不適用）。</li>
<li><code>curve-v1</code> 的左右分群 —— <code>PeekWindowTs.side</code> 對 v3 是佔位值,左右分群會整組塌到單邊（KI-036）。</li>
<li>12 格交叉矩陣 —— 單場每格 n ≈ 3（G3）。</li>
<li>throughput —— Fitts 斜率在三次重複之間不穩定（§6）。</li>
</ul>
<h3>閘值</h3>
<ul>
<li>分箱可下結論:n ≥ ${MIN_BIN_N}（教練紀律 #3）。</li>
<li>畫 p95:有效樣本 ≥ ${MIN_TAIL_N}。</li>
<li>滾動窗:呈現數 ≥ 24,窗寬 ${ROLLING_WINDOW_TRIALS} trial。</li>
<li>基準:相容 run ≥ ${MIN_BASELINE_RUNS} 場（本批 ${runs.length} 場全部用於建立基準,故無基準可比）。</li>
<li>天花板:分箱首發命中率 ≥ ${pct(CEILING_HIT_RATE)} 視為無鑑別力。</li>
<li>周邊逾時上界 ${PROTOCOL_PEEK_TIMEOUT_MS} ms、協定計分窗 ${(PROTOCOL_SCORING_WINDOW_MS / 1000).toFixed(1)} s、倒數 ${PROTOCOL_COUNTDOWN_MS / 1000} s —— 皆自 <code>spider_shot_v3.ts</code> 讀出,未寫死。</li>
</ul>
</section>`;
}

function renderFooter(report: CoachReport): string {
  return `<footer class="shell">
<p>
產生器 <code>scripts/analyze-spider-shot-v3.ts</code> + <code>scripts/spiderShotV3CoachRunner.ts</code>
（報告版本 <code>${escapeHtml(report.version)}</code>）。
原始匯出與本報告皆為參與者資料的衍生物,<strong>一律留在 gitignored 的 <code>.spider-v3-analysis/</code></strong>。
</p>
<p>
依 C-D3,本報告所列指標在通過構念驗證前<strong>不得作為訓練處方依據</strong>。
</p>
</footer>`;
}

// ---------------------------------------------------------------------------
// C1 —— 首發有效速度（G5 降級：無基準、無雜訊帶）
// ---------------------------------------------------------------------------

function chartC1(report: CoachReport): string {
  const runs = report.runs;
  const values = runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2, (max - min) * 0.6);
  const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)];

  const left = 96;
  const right = CHART_WIDTH - 60;
  const top = 46;
  const rowHeight = 30;
  const height = top + runs.length * rowHeight + 62;
  const axisY = top + runs.length * rowHeight + 6;
  const x = linearScale(domain, [left, right]);

  const parts: string[] = [];
  parts.push(
    `<rect x="${x(min).toFixed(1)}" y="${(top - 8).toFixed(1)}" width="${(x(max) - x(min)).toFixed(1)}" height="${(runs.length * rowHeight + 10).toFixed(1)}" class="band"><title>三場全距 ${min.toFixed(1)}–${max.toFixed(1)}（不是 MDC）</title></rect>`,
  );
  parts.push(`<text x="${((x(min) + x(max)) / 2).toFixed(1)}" y="${(top - 16).toFixed(1)}" class="tick" text-anchor="middle">三場全距（不是 MDC）</text>`);

  runs.forEach((run, index) => {
    const cy = top + index * rowHeight + rowHeight / 2 - 4;
    const value = values[index];
    parts.push(`<text x="${(left - 12).toFixed(1)}" y="${(cy + 4).toFixed(1)}" class="lbl-strong" text-anchor="end">rep ${index + 1}</text>`);
    parts.push(
      `<line x1="${left}" y1="${cy.toFixed(1)}" x2="${x(value).toFixed(1)}" y2="${cy.toFixed(1)}" class="axis"/>`,
    );
    parts.push(
      `<circle cx="${x(value).toFixed(1)}" cy="${cy.toFixed(1)}" r="6" style="fill:${SERIES[index % 3]};stroke:var(--surface);stroke-width:2"><title>rep ${index + 1} · 首發有效速度 ${value.toFixed(1)} 首發有效命中/min（${run.effectiveSpeed.firstShotHitCount}/${run.effectiveSpeed.peripheralCount} 首發命中,60.0 s 分母）</title></circle>`,
    );
    parts.push(`<text x="${(x(value) + 12).toFixed(1)}" y="${(cy + 4).toFixed(1)}" class="val" text-anchor="start">${value.toFixed(1)}</text>`);
  });

  parts.push(`<line x1="${left}" y1="${axisY.toFixed(1)}" x2="${right}" y2="${axisY.toFixed(1)}" class="axis"/>`);
  for (const tickValue of ticksFor(domain, 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${axisY.toFixed(1)}" x2="${x(tickValue).toFixed(1)}" y2="${(axisY + 5).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(axisY + 19).toFixed(1)}" class="tick" text-anchor="middle">${trim(tickValue)}</text>`);
  }
  parts.push(`<text x="${right}" y="${(height - 8).toFixed(1)}" class="tick" text-anchor="end">首發有效命中/min（60.0 s 分母）</text>`);

  const table = tableView(
    ['Run', '首發即命中 / 周邊呈現', '首發有效速度（60.0 s）', '首發有效速度（registry 分母）', '總命中速度（60.0 s）'],
    runs.map((run) => [
      `rep ${run.runIndex + 1}`,
      `${run.effectiveSpeed.firstShotHitCount} / ${run.effectiveSpeed.peripheralCount}`,
      run.effectiveSpeed.firstShotEffectivePerMinProtocol.toFixed(1),
      run.effectiveSpeed.firstShotEffectivePerMinMeasured.toFixed(1),
      run.effectiveSpeed.totalHitsPerMinProtocol.toFixed(1),
    ]),
    [['三場全距', `${min.toFixed(1)} – ${max.toFixed(1)}`, '這不是 MDC —— 真 MDC 需要多日重測的 test–retest SEM', '', '']],
  );

  return figure(
    'C1 · 這三場的首發有效速度（無基準,不宣告變化）',
    svg(height, parts, '三場的首發有效速度與全距'),
    [
      ['降級原因', `相容 run 總數 ${runs.length},全部都是「建立基準」的一部分 ⇒ 沒有先前基準,<strong>不畫雜訊帶</strong>,改顯示「建立基準中 ${runs.length}/${MIN_BASELINE_RUNS}」。`],
      ['怎麼讀', `三個點是三場的實際值,灰帶是<strong>三場全距</strong>。<strong>不得</strong>把 rep 3 高於 rep 1 讀成「進步」—— 這三場是同一序列的重複,而且沒有雜訊帶可以判斷差異是否真實。`],
      ['為什麼不叫 MDC', '真 MDC = <code>1.96 × √2 × SEM</code>,需要多日 test–retest。同一天連續三場算出來的離散只是當日變異,叫它 MDC 會讓後續每一次比較都建立在一個假的門檻上。'],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// C2 —— 速度—準確率工作點
// ---------------------------------------------------------------------------

function chartC2(report: CoachReport): string {
  const runs = report.runs;
  const rates = runs.map((run) => run.effectiveSpeed.presentationsPerMinProtocol);
  const accuracies = runs.map((run) => run.effectiveSpeed.firstShotHitRate);

  const left = 74;
  const right = CHART_WIDTH - 84;
  const top = 44;
  const bottom = 300;
  const height = 372;

  const xDomain: [number, number] = [Math.floor(Math.min(...rates) - 3), Math.ceil(Math.max(...rates) + 3)];
  const yDomain: [number, number] = [Math.max(0.5, Math.min(...accuracies) - 0.08), Math.min(1, Math.max(...accuracies) + 0.03)];
  const x = linearScale(xDomain, [left, right]);
  const y = linearScale(yDomain, [bottom, top]);

  const parts: string[] = [];

  // 等首發有效速度曲線（幾何,不是基準）
  const isoValues = niceIso(runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol));
  for (const iso of isoValues) {
    const points: string[] = [];
    for (let step = 0; step <= 60; step++) {
      const rate = xDomain[0] + ((xDomain[1] - xDomain[0]) * step) / 60;
      const accuracy = iso / rate;
      if (accuracy < yDomain[0] || accuracy > yDomain[1]) continue;
      points.push(`${x(rate).toFixed(1)},${y(accuracy).toFixed(1)}`);
    }
    if (points.length < 2) continue;
    parts.push(`<polyline points="${points.join(' ')}" class="iso"><title>等首發有效速度 ${iso}</title></polyline>`);
    const [lastX, lastY] = points[points.length - 1].split(',');
    parts.push(`<text x="${(Number(lastX) - 4).toFixed(1)}" y="${(Number(lastY) - 5).toFixed(1)}" class="iso-lbl" text-anchor="end">${iso}</text>`);
  }
  parts.push(`<text x="${(right + 6).toFixed(1)}" y="${(top - 16).toFixed(1)}" class="iso-lbl" text-anchor="end">等首發有效速度</text>`);

  // 軸
  parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="axis"/>`);
  for (const tickValue of ticksFor(xDomain, 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${top}" x2="${x(tickValue).toFixed(1)}" y2="${bottom}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(bottom + 19).toFixed(1)}" class="tick" text-anchor="middle">${trim(tickValue)}</text>`);
  }
  for (const tickValue of ticksFor([yDomain[0] * 100, yDomain[1] * 100], 4)) {
    const yy = y(tickValue / 100);
    if (yy < top - 0.5 || yy > bottom + 0.5) continue;
    parts.push(`<line x1="${left}" y1="${yy.toFixed(1)}" x2="${right}" y2="${yy.toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${(left - 10).toFixed(1)}" y="${(yy + 4).toFixed(1)}" class="tick" text-anchor="end">${trim(tickValue)}%</text>`);
  }

  // rep 路徑（不是基準位移）
  parts.push(
    `<polyline points="${runs.map((_run, index) => `${x(rates[index]).toFixed(1)},${y(accuracies[index]).toFixed(1)}`).join(' ')}" class="shift"><title>rep 1 → rep 3 的路徑（同一刺激序列的三次重複,不是基準位移）</title></polyline>`,
  );
  runs.forEach((run, index) => {
    parts.push(
      `<circle cx="${x(rates[index]).toFixed(1)}" cy="${y(accuracies[index]).toFixed(1)}" r="7.5" style="fill:${SERIES[index % 3]};stroke:var(--surface);stroke-width:2"><title>rep ${index + 1} · 呈現速率 ${rates[index].toFixed(1)}/min · 首發命中率 ${pct(accuracies[index])} · 首發有效速度 ${run.effectiveSpeed.firstShotEffectivePerMinProtocol.toFixed(1)}</title></circle>`,
    );
    parts.push(
      `<text x="${(x(rates[index]) + 11).toFixed(1)}" y="${(y(accuracies[index]) + 4).toFixed(1)}" class="lbl-strong" text-anchor="start">rep ${index + 1}</text>`,
    );
  });

  parts.push(`<text x="${left}" y="${(bottom + 46).toFixed(1)}" class="tick" text-anchor="start">周邊呈現速率（次/min）→ 快</text>`);
  parts.push(`<text transform="translate(22.0,${((top + bottom) / 2).toFixed(1)}) rotate(-90)" class="tick" text-anchor="middle">首發命中率 → 準</text>`);
  runs.forEach((run, index) => {
    const legendX = left + index * 96;
    parts.push(`<circle cx="${(legendX + 6).toFixed(1)}" cy="${(height - 12).toFixed(1)}" r="6" style="fill:${SERIES[index % 3]};stroke:var(--surface);stroke-width:2"/>`);
    parts.push(`<text x="${(legendX + 18).toFixed(1)}" y="${(height - 8).toFixed(1)}" class="tick" text-anchor="start">rep ${index + 1}</text>`);
  });

  const table = tableView(
    ['Run', '周邊呈現速率（次/min）', '首發命中率', '首發有效速度'],
    runs.map((run, index) => [
      `rep ${run.runIndex + 1}`,
      rates[index].toFixed(1),
      pct(accuracies[index]),
      run.effectiveSpeed.firstShotEffectivePerMinProtocol.toFixed(1),
    ]),
  );

  return figure(
    'C2 · 策略還是能力?（速度—準確率工作點）',
    svg(height, parts, '速度—準確率工作點：周邊呈現速率對首發命中率'),
    [
      ['降級原因', '沒有基準重心、沒有位移連線（G5）。背景等值線<strong>保留</strong> —— 它是幾何恆等式（速率 × 命中率 = 首發有效速度）,不是從基準算出來的。'],
      [
        '怎麼讀',
        `三個點沿 rep 順序連起來:${describeSteps(runs, rates, accuracies)}。` +
          `三點的首發有效速度橫跨 ${(Math.max(...runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol)) - Math.min(...runs.map((run) => run.effectiveSpeed.firstShotEffectivePerMinProtocol))).toFixed(1)} 首發有效命中/min,` +
          `但三場的刺激逐位相同 ⇒ <strong>這個離散就是同日重測的雜訊量級</strong>,不是策略選擇。`,
      ],
      [
        '注意',
        `首發命中率的上界是 100%,而三點已經在 ${pct(Math.min(...accuracies))}–${pct(Math.max(...accuracies))} 之間 ⇒ ` +
          `準確率那一端只剩 ${pct(1 - Math.max(...accuracies))} 的空間可換。要提高首發有效速度,主要只能往右（更快）。`,
      ],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// C3 —— REC / MR / V 時間預算
// ---------------------------------------------------------------------------

function chartC3(report: CoachReport): string {
  const runs = report.runs;
  const totals = runs.map((run) => run.phase.totalMs ?? 0);
  const maxTotal = Math.max(...totals);

  const left = 86;
  const right = CHART_WIDTH - 120;
  const top = 56;
  const rowHeight = 46;
  const height = top + runs.length * rowHeight + 46;
  const x = linearScale([0, Math.ceil(maxTotal / 100) * 100], [left, right]);

  const parts: string[] = [];
  for (const tickValue of ticksFor([0, Math.ceil(maxTotal / 100) * 100], 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${(top - 12).toFixed(1)}" x2="${x(tickValue).toFixed(1)}" y2="${(top + runs.length * rowHeight - 8).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(top + runs.length * rowHeight + 8).toFixed(1)}" class="tick" text-anchor="middle">${trim(tickValue)}</text>`);
  }

  const segments: readonly [string, (run: RunSummary) => number | undefined, string][] = [
    ['REC 起手', (run) => run.phase.recMs, 'seg1'],
    ['MR 主揮動', (run) => run.phase.mrMs, 'seg2'],
    ['V 確認', (run) => run.phase.vMs, 'seg3'],
  ];

  runs.forEach((run, index) => {
    const yTop = top + index * rowHeight;
    const barH = 28;
    parts.push(`<text x="${(left - 12).toFixed(1)}" y="${(yTop + barH / 2 + 4).toFixed(1)}" class="lbl-strong" text-anchor="end">rep ${index + 1}</text>`);
    let cursor = 0;
    segments.forEach(([label, get, cls], segIndex) => {
      const value = get(run);
      if (value === undefined) return;
      const x0 = x(cursor);
      const x1 = x(cursor + value);
      const last = segIndex === segments.length - 1;
      parts.push(
        `<path d="${roundedBar(x0 + (segIndex === 0 ? 0 : 2), x1, yTop, barH, last ? 4 : 0)}" class="${cls}"><title>rep ${index + 1} · ${label} ${value.toFixed(0)} ms</title></path>`,
      );
      // relief 規則：淺色主題下 series-3 對白底 2.82:1 ⇒ 每一段直接標值。
      parts.push(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(yTop + barH / 2 + 4).toFixed(1)}" class="seg-val" text-anchor="middle">${value.toFixed(0)}</text>`);
      cursor += value;
    });
    parts.push(`<text x="${(x(cursor) + 10).toFixed(1)}" y="${(yTop + barH / 2 + 4).toFixed(1)}" class="val" text-anchor="start">合計 ${cursor.toFixed(0)}</text>`);
  });

  segments.forEach(([label, , cls], index) => {
    const legendX = left + index * 128;
    parts.push(`<rect x="${legendX}" y="20" width="11" height="11" rx="3" class="${cls}"/>`);
    parts.push(`<text x="${legendX + 17}" y="30" class="tick" text-anchor="start">${label}</text>`);
  });
  parts.push(`<text x="${right}" y="${(height - 8).toFixed(1)}" class="tick" text-anchor="end">毫秒（ms）</text>`);

  const table = tableView(
    ['相位', ...runs.map((run) => `rep ${run.runIndex + 1}`), '教練讀法'],
    [
      ['REC 起手', ...runs.map((run) => `${fmt(run.phase.recMs, 0)} ms`), '刺激出現到主揮動開始'],
      ['MR 主揮動', ...runs.map((run) => `${fmt(run.phase.mrMs, 0)} ms`), '主彈道段本身的時間'],
      ['V 確認', ...runs.map((run) => `${fmt(run.phase.vMs, 0)} ms`), '主揮動結束到扣下第一發'],
      ['合計', ...runs.map((run) => `${fmt(run.phase.totalMs, 0)} ms`), '≈ 命中時間中位數'],
      ['有效樣本 / 被旗標', ...runs.map((run) => `${run.phase.n} / ${run.phase.flagged}`), '只取 seg-v2 旗標為空的呈現'],
    ],
  );

  return figure(
    'C3 · 時間花在哪?（REC / MR / V 時間預算）',
    svg(height, parts, '一次周邊 flick 的時間預算：起手、主揮動、確認三段'),
    [
      ['可以畫的理由', `<code>meta.displayHz</code> = ${runs[0].quality.displayHz} ≥ 144（教練紀律 #8）,且 <code>seg-v2</code> 的旗標極少（三份各 ${runs.map((run) => run.phase.flagged).join('／')} 個被排除）。`],
      ['怎麼讀', `${describePhaseShape(runs)}這位受試者的時間主要花在「揮到位之後、扣扳機之前」—— 而那買到了 ${runs.map((run) => pct(run.effectiveSpeed.firstShotHitRate)).join('／')} 的首發命中率。`],
      ['注意', 'V 的定義是「主揮動段結束 → 第一發」,它<strong>包含</strong>微調與確認,不只是猶豫。單看它不能斷定是心理猶豫還是還在修正 —— 要分開需要看 <code>microAdjustCount</code>（本批 p50 = 0,傾向不是微調）。'],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// C4 —— 兩條邊際軸
// ---------------------------------------------------------------------------

function chartC4(report: CoachReport): string {
  const run = report.runs[report.runs.length - 1];
  const azimuth = run.azimuthBins;
  const tiers = run.tierBins;
  const bins = [...azimuth, ...tiers];
  const maxTime = Math.max(...bins.map((bin) => bin.medianHitTimeMs ?? 0));
  const domain: [number, number] = [0, Math.ceil(maxTime / 100) * 100];

  const left = 116;
  const right = CHART_WIDTH - 168;
  const x = linearScale(domain, [left, right]);
  const rowHeight = 30;
  const headerHeight = 26;
  const top = 30;
  const height = top + headerHeight * 2 + (azimuth.length + tiers.length) * rowHeight + 56;

  const parts: string[] = [];
  const worstAz = weakestBin(azimuth);
  const worstTier = weakestBin(tiers);
  const axisBottom = top + headerHeight * 2 + (azimuth.length + tiers.length) * rowHeight;

  // 格線先畫,資料後畫 —— 否則格線會蓋在條上。實線 hairline,不用虛線。
  for (const tickValue of ticksFor(domain, 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${(top + 12).toFixed(1)}" x2="${x(tickValue).toFixed(1)}" y2="${(axisBottom - 6).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(axisBottom + 10).toFixed(1)}" class="tick" text-anchor="middle">${trim(tickValue)}</text>`);
  }

  let cursorY = top;

  const drawAxis = (title: string, list: readonly BinSummary[], worst: BinSummary | undefined): void => {
    parts.push(`<text x="52" y="${(cursorY + 12).toFixed(1)}" class="lbl-strong" text-anchor="start">${title}</text>`);
    cursorY += headerHeight;
    for (const bin of list) {
      const barY = cursorY;
      const value = bin.medianHitTimeMs;
      parts.push(`<text x="${(left - 12).toFixed(1)}" y="${(barY + 14).toFixed(1)}" class="lbl" text-anchor="end">${escapeHtml(bin.label)}</text>`);
      if (value !== undefined) {
        const emphasised = worst !== undefined && bin.key === worst.key && bin.conclusive;
        parts.push(
          `<path d="${roundedBar(left, x(value), barY, 20, 4)}" class="${emphasised ? 'mk-weak' : 'mk-ok'}"><title>${escapeHtml(bin.label)} · 命中時間 p50 ${value.toFixed(0)} ms · 首發命中率 ${pct(bin.firstShotHitRate)} · n=${bin.n}</title></path>`,
        );
        parts.push(`<text x="${(x(value) + 10).toFixed(1)}" y="${(barY + 14).toFixed(1)}" class="val" text-anchor="start">${value.toFixed(0)} ms</text>`);
        parts.push(`<text x="${(x(value) + 66).toFixed(1)}" y="${(barY + 14).toFixed(1)}" class="tick" text-anchor="start">${pct(bin.firstShotHitRate)} · n=${bin.n}</text>`);
      } else {
        parts.push(`<text x="${(left + 6).toFixed(1)}" y="${(barY + 14).toFixed(1)}" class="tick" text-anchor="start">無有效命中時間 · n=${bin.n}</text>`);
      }
      cursorY += rowHeight;
    }
  };

  drawAxis('依方位（quadrant × eye-frame side,4 箱）', azimuth, worstAz);
  drawAxis('依角位移幅度（3 tier）', tiers, worstTier);

  parts.push(`<text x="52" y="${(height - 22).toFixed(1)}" class="tick" text-anchor="start">實色 = 該軸命中時間最長的分箱。任一箱 n &lt; ${MIN_BIN_N} 時不上色、不下結論。</text>`);
  parts.push(`<text x="52" y="${(height - 6).toFixed(1)}" class="tick" text-anchor="start">條長 = 命中時間 p50（越短越好）;標籤同時給首發命中率與 n。</text>`);

  const table = tableView(
    ['分箱', '命中時間 p50', '首發命中率', 'n', '可否下結論'],
    bins.map((bin) => [
      bin.label,
      bin.medianHitTimeMs === undefined ? '—' : `${bin.medianHitTimeMs.toFixed(0)} ms`,
      pct(bin.firstShotHitRate),
      String(bin.n),
      bin.conclusive ? (bin.firstShotHitRate >= CEILING_HIT_RATE ? `n ≥ ${MIN_BIN_N},但命中率貼天花板 ⇒ 只讀命中時間` : `可（n ≥ ${MIN_BIN_N}）`) : `否（n < ${MIN_BIN_N}）`,
    ]),
  );

  return figure(
    `C4 · 哪裡弱?（兩條邊際軸 · rep ${run.runIndex + 1}）`,
    svg(height, parts, '兩條邊際軸：依方位與依角位移幅度的命中時間'),
    [
      ['與設計不同的兩點', `① 方位軸不是「上／下／左／右」而是 <code>quadrant × side</code> —— canonical derivation 沒有「上 vs 下」構念,在報告腳本裡自己算等於新增第二套幾何（C-D4）。② 條長編碼的是<strong>命中時間</strong>而非首發命中率 —— 後者在這位受試者身上全部貼天花板（見 §6）,那個軸沒有鑑別力。首發命中率仍逐箱直接標出。`],
      [
        '怎麼讀',
        `每箱 n = ${bins.map((bin) => bin.n).join('/')}（最小 ${Math.min(...bins.map((bin) => bin.n))},門檻 ${MIN_BIN_N}）。` +
          `命中時間最長的是<strong>${escapeHtml(worstTier?.label ?? '—')}</strong>（幅度軸）與<strong>${escapeHtml(worstAz?.label ?? '—')}</strong>（方位軸）。` +
          (monotonic(tiers.map((bin) => bin.medianHitTimeMs ?? Number.NaN)) === 'increasing'
            ? '幅度軸的命中時間<strong>呈單調上升</strong> —— 那是 Fitts 的預期,不是弱點。'
            : '幅度軸的命中時間<strong>並非單調</strong>,所以那一軸這一場看不出乾淨的難度縮放。'),
      ],
      ['何時不畫', `任一箱 n &lt; ${MIN_BIN_N} 時該箱只顯示數字、不上色、不進結論句。12 格交叉必須 pooled 後才畫,而本批的 pooled 是同一組 spawn 位置的三次重複（G3/G4）⇒ 不畫。`],
    ],
    table,
  );
}

/**
 * C2 的路徑敘述。**一律由數字產生** —— 手寫「往左下」這種方向詞是本專案在渲染檢查裡抓過的錯誤類型
 * （HANDOFF §5 產出後檢查第 (d) 項:文字說明與視覺不一致）。
 */
function describeSteps(
  runs: readonly RunSummary[],
  rates: readonly number[],
  accuracies: readonly number[],
): string {
  const steps: string[] = [];
  for (let index = 1; index < runs.length; index++) {
    const dx = rates[index] - rates[index - 1];
    const dy = accuracies[index] - accuracies[index - 1];
    const horizontal = dx > 0.05 ? '右（更快）' : dx < -0.05 ? '左（更慢）' : '原地（速率幾乎沒動）';
    const vertical = dy > 0.005 ? '上（更準）' : dy < -0.005 ? '下（較不準）' : '持平';
    steps.push(
      `rep ${index} → rep ${index + 1} 往<strong>${horizontal}、${vertical}</strong>` +
        `（${rates[index - 1].toFixed(1)}→${rates[index].toFixed(1)} 次/min、${pct(accuracies[index - 1])}→${pct(accuracies[index])}）`,
    );
  }
  return steps.join(';');
}

/** C3 的形狀敘述:哪一段最長,以及它是不是長過主揮動。 */
function describePhaseShape(runs: readonly RunSummary[]): string {
  const longestIsV = runs.every(
    (run) => run.phase.vMs !== undefined && run.phase.mrMs !== undefined && run.phase.recMs !== undefined &&
      run.phase.vMs > run.phase.mrMs && run.phase.vMs > run.phase.recMs,
  );
  if (longestIsV) {
    return '<strong>V 確認是三段裡最長的一段,而且三場都長過 MR 主揮動。</strong>這與教練提案的示例（REC 168 / MR 214 / V 96,V 最短）形狀相反。';
  }
  return `三段的長短順序逐場為:${runs
    .map((run) => {
      const entries: readonly [string, number | undefined][] = [
        ['REC', run.phase.recMs],
        ['MR', run.phase.mrMs],
        ['V', run.phase.vMs],
      ];
      const sorted = entries
        .filter((entry): entry is [string, number] => entry[1] !== undefined)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
      return `rep ${run.runIndex + 1} ${sorted.join(' > ')}`;
    })
    .join('、')}。`;
}

/**
 * 結論句的標題由資料選,不寫死。準確率貼天花板 + V 相位最長 = 「準得很貴」;其他組合各有句子。
 * 這是報告裡最容易說錯話的一行,所以它必須是資料的函式。
 */
function verdictHeadline(runs: readonly RunSummary[]): string {
  const meanRate = runs.reduce((sum, run) => sum + run.effectiveSpeed.firstShotHitRate, 0) / runs.length;
  const vLongest = runs.every(
    (run) =>
      run.phase.vMs !== undefined && run.phase.mrMs !== undefined && run.phase.recMs !== undefined &&
      run.phase.vMs > run.phase.mrMs && run.phase.vMs > run.phase.recMs,
  );
  if (meanRate >= CEILING_HIT_RATE && vLongest) return '你打得非常準,而且準得很貴';
  if (meanRate >= CEILING_HIT_RATE) return '你打得非常準 —— 這個協定對你來說已經太容易';
  if (vLongest) return '時間主要花在扣扳機之前,而不是揮過去';
  return '這三場的速度與準確率都沒有貼到邊界';
}

/** 「多少比例的分箱貼天花板」——「所有」這種量詞必須由資料決定。 */
function ceilingBinShare(report: CoachReport): string {
  const bins = report.runs.flatMap((run) => [...run.azimuthBins, ...run.tierBins]).filter((bin) => bin.conclusive);
  if (bins.length === 0) return '沒有任何';
  const ceiling = bins.filter((bin) => bin.firstShotHitRate >= CEILING_HIT_RATE).length;
  if (ceiling === bins.length) return '全部';
  if (ceiling === 0) return '沒有任何';
  return `${ceiling}/${bins.length} 個`;
}

/** rep 1 → 最後一 rep 的逐相位變化。哪一段變動最大由數字決定,不是先講故事再找數字。 */
function describePhaseDeltas(runs: readonly RunSummary[]): string {
  const first = runs[0].phase;
  const last = runs[runs.length - 1].phase;
  const entries: readonly [string, number | undefined, number | undefined][] = [
    ['REC 起手', first.recMs, last.recMs],
    ['MR 主揮動', first.mrMs, last.mrMs],
    ['V 確認', first.vMs, last.vMs],
  ];
  const deltas = entries
    .filter((entry): entry is [string, number, number] => entry[1] !== undefined && entry[2] !== undefined)
    .map(([name, from, to]) => ({ name, delta: to - from }));
  if (deltas.length === 0) return '相位樣本不足,不比較';

  const largest = deltas.reduce((worst, entry) => (Math.abs(entry.delta) > Math.abs(worst.delta) ? entry : worst));
  const body = deltas
    .map((entry) => `${entry.name} ${entry.delta >= 0 ? '+' : '−'}${Math.abs(entry.delta).toFixed(0)} ms`)
    .join('、');
  return `${body} ⇒ 變動最大的是<strong>${largest.name}</strong>（${largest.delta >= 0 ? '變慢' : '變快'} ${Math.abs(largest.delta).toFixed(0)} ms）`;
}

/** C5 的判讀句。角誤差的 p95 是否仍在 W/2 之內由資料決定,不寫死。 */
function describeTails(run: RunSummary): string {
  const hitTime = run.tails.find((tail) => tail.key === 'hit-time');
  const fireError = run.tails.find((tail) => tail.key === 'fire-angle-error');
  const halfWidthDeg = 1.0; // W = 2.0°（v3 距離恆 8 u,見 §8 方法）⇒ 角誤差 < W/2 即應命中。
  const p95 = fireError?.p95;
  const withinHalfWidth = p95 !== undefined && p95 < halfWidthDeg;
  return (
    `命中時間的尾端倍率是 ${fmt(hitTime?.ratio, 2)}×,首發角誤差是 ${fmt(fireError?.ratio, 2)}×。` +
    (p95 === undefined
      ? ''
      : withinHalfWidth
        ? `角誤差的 p95（${fmtSmart(p95)}°）<strong>仍小於 W/2 = ${halfWidthDeg.toFixed(1)}°</strong>,所以那些「差比較多」的一發<strong>仍然命中</strong> —— 倍率大不等於失誤。`
        : `角誤差的 p95（${fmtSmart(p95)}°）<strong>已超過 W/2 = ${halfWidthDeg.toFixed(1)}°</strong> ⇒ 尾端那幾發是真的打歪,不只是偏。`)
  );
}

/** 一組數列是否單調不減／不增。用來把「呈單調上升」這種句子改成由資料決定。 */
function monotonic(values: readonly number[]): 'increasing' | 'decreasing' | 'neither' {
  if (values.length < 2) return 'neither';
  const nonDecreasing = values.every((value, index) => index === 0 || value >= values[index - 1]);
  if (nonDecreasing) return 'increasing';
  const nonIncreasing = values.every((value, index) => index === 0 || value <= values[index - 1]);
  return nonIncreasing ? 'decreasing' : 'neither';
}

/** 三等分的形狀敘述（起段／中段／末段相對整體中位數）。C6 的判讀句由它產生。 */
function describeShape(values: readonly number[]): string {
  if (values.length < 3) return '點數太少,不描述形狀';
  const third = Math.max(1, Math.round(values.length / 3));
  const mean = (list: readonly number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const head = mean(values.slice(0, third));
  const tail = mean(values.slice(-third));
  const middle = mean(values.slice(third, values.length - third).length === 0 ? values : values.slice(third, values.length - third));
  const overall = mean(values);
  const word = (value: number) => {
    const delta = value - overall;
    if (Math.abs(delta) < 10) return '持平';
    return delta > 0 ? `慢 ${delta.toFixed(0)} ms` : `快 ${(-delta).toFixed(0)} ms`;
  };
  return `起段${word(head)}、中段${word(middle)}、末段${word(tail)}`;
}

function weakestBin(bins: readonly BinSummary[]): BinSummary | undefined {
  const usable = bins.filter((bin) => bin.conclusive && bin.medianHitTimeMs !== undefined);
  if (usable.length === 0) return undefined;
  return usable.reduce((worst, bin) => ((bin.medianHitTimeMs ?? 0) > (worst.medianHitTimeMs ?? 0) ? bin : worst));
}

// ---------------------------------------------------------------------------
// C5 —— 尾端倍率
// ---------------------------------------------------------------------------

function chartC5(report: CoachReport): string {
  const run = report.runs[report.runs.length - 1];
  const drawable = run.tails.filter((tail) => tail.drawable && tail.ratio !== undefined);
  const skipped = run.tails.filter((tail) => !tail.drawable);
  const maxRatio = Math.max(2, ...drawable.map((tail) => tail.ratio ?? 0));
  const domain: [number, number] = [1, Math.ceil(maxRatio * 2) / 2];

  const left = 216;
  const right = CHART_WIDTH - 84;
  const x = linearScale(domain, [left, right]);
  const top = 40;
  // 每一列有兩行左側標籤（名稱 + p50/p95/n）,列高必須容得下兩個 bbox 而不相碰 ——
  // 渲染檢查會把 > 1px 的文字重疊當失敗,所以這個數字是量出來的,不是估的。
  const rowHeight = 48;
  const height = top + drawable.length * rowHeight + 74;

  const parts: string[] = [];
  for (const tickValue of ticksFor(domain, 4)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${top.toFixed(1)}" x2="${x(tickValue).toFixed(1)}" y2="${(top + drawable.length * rowHeight - 6).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(top + drawable.length * rowHeight + 12).toFixed(1)}" class="tick" text-anchor="middle">${tickValue.toFixed(1)}×</text>`);
  }

  const worst = drawable.reduce<TailRow | undefined>(
    (acc, tail) => (acc === undefined || (tail.ratio ?? 0) > (acc.ratio ?? 0) ? tail : acc),
    undefined,
  );

  drawable.forEach((tail, index) => {
    const barY = top + index * rowHeight;
    const ratio = tail.ratio ?? 1;
    parts.push(`<text x="${(left - 12).toFixed(1)}" y="${(barY + 10).toFixed(1)}" class="lbl-strong" text-anchor="end">${escapeHtml(tail.label)}</text>`);
    parts.push(
      `<text x="${(left - 12).toFixed(1)}" y="${(barY + 30).toFixed(1)}" class="tick" text-anchor="end">p50 ${fmtSmart(tail.p50)} ${escapeHtml(tail.unit)} → p95 ${fmtSmart(tail.p95)} ${escapeHtml(tail.unit)} · n=${tail.n}</text>`,
    );
    parts.push(
      `<path d="${roundedBar(left, x(ratio), barY + 2, 22, 4)}" class="${worst !== undefined && worst.key === tail.key ? 'mk-weak' : 'mk-ok'}"><title>${escapeHtml(tail.label)} · p50 ${fmtSmart(tail.p50)} · p95 ${fmtSmart(tail.p95)} · 尾端倍率 ${ratio.toFixed(2)}×</title></path>`,
    );
    parts.push(`<text x="${(x(ratio) + 10).toFixed(1)}" y="${(barY + 18).toFixed(1)}" class="val" text-anchor="start">${ratio.toFixed(2)}×</text>`);
  });

  parts.push(`<text x="52" y="${(height - 38).toFixed(1)}" class="tick" text-anchor="start">尾端倍率 = p95 ÷ p50。越接近 1 越穩;比賽輸的是尾巴,不是中位數。</text>`);
  skipped.forEach((tail, index) => {
    parts.push(
      `<text x="52" y="${(height - 20 + index * 14).toFixed(1)}" class="tick" text-anchor="start">${escapeHtml(tail.label)}：有效樣本 n=${tail.n} &lt; ${MIN_TAIL_N} ⇒ 不畫 p95（p50 = ${fmtSmart(tail.p50)} ${escapeHtml(tail.unit)},僅供參考）。</text>`,
    );
  });

  const table = tableView(
    ['指標', 'n', 'p50', 'p95', '尾端倍率', '備註'],
    run.tails.map((tail) => [
      tail.label,
      String(tail.n),
      `${fmtSmart(tail.p50)} ${tail.unit}`,
      tail.drawable ? `${fmtSmart(tail.p95)} ${tail.unit}` : `不畫（n < ${MIN_TAIL_N}）`,
      tail.ratio === undefined ? '—' : `${tail.ratio.toFixed(2)}×`,
      tail.note ?? '',
    ]),
  );

  return figure(
    `C5 · 穩不穩?（尾端倍率 · rep ${run.runIndex + 1}）`,
    svg(height, parts, '尾端倍率：各指標的 p95 是 p50 的幾倍'),
    [
      ['為什麼是這個圖形', '三個指標單位不同,<strong>絕不可以放在同一條軸上</strong>。改用無單位的 p95 ÷ p50 倍率,一條軸解決;原始值放在標籤與表格。'],
      ['怎麼讀', describeTails(run)],
      ['降級的一列', `進靶後逸出只有 n=${run.tails.find((tail) => tail.key === 'overshoot')?.n} 個有效樣本 ⇒ 不畫 p95。這不是缺陷,是打法:一進靶就開槍結束該次呈現,就沒有「首次進靶之後」的離靶樣本可取。`],
      ['注意', `命中時間的分布右端被 ${PROTOCOL_PEEK_TIMEOUT_MS} ms 的周邊逾時上界截斷 ⇒ p95 是被截斷後的 p95,判讀時須併看逾時率（本批周邊未命中 ${run.effectiveSpeed.peripheralCount - run.effectiveSpeed.peripheralHitCount} 次）。`],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// C6 —— 場內時間歷程
// ---------------------------------------------------------------------------

function chartC6(report: CoachReport): string {
  const runs = report.runs.filter((run) => run.rollingDrawable && run.rolling.length > 0);
  if (runs.length === 0) {
    return figure(
      'C6 · 這場是怎麼跑完的?（場內時間歷程）',
      '',
      [['不畫的原因', '所有 run 的周邊呈現數都不足以支撐滾動窗。']],
      '',
    );
  }

  const allPoints = runs.flatMap((run) => run.rolling);
  const yValues = allPoints.map((point) => point.medianHitTimeMs);
  const xValues = allPoints.map((point) => point.centerTrial);
  const yDomain: [number, number] = [Math.floor(Math.min(...yValues) / 20) * 20 - 20, Math.ceil(Math.max(...yValues) / 20) * 20 + 20];
  const xDomain: [number, number] = [0, Math.ceil(Math.max(...xValues))];

  const left = 74;
  const right = CHART_WIDTH - 62;
  const top = 40;
  const bottom = 216;
  const height = 292;
  const x = linearScale(xDomain, [left, right]);
  const y = linearScale(yDomain, [bottom, top]);

  const parts: string[] = [];
  for (const tickValue of ticksFor(yDomain, 5)) {
    parts.push(`<line x1="${left}" y1="${y(tickValue).toFixed(1)}" x2="${right}" y2="${y(tickValue).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${(left - 10).toFixed(1)}" y="${(y(tickValue) + 4).toFixed(1)}" class="tick" text-anchor="end">${trim(tickValue)}</text>`);
  }
  parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="axis"/>`);
  for (const tickValue of ticksFor(xDomain, 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${bottom}" x2="${x(tickValue).toFixed(1)}" y2="${(bottom + 5).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(bottom + 19).toFixed(1)}" class="tick" text-anchor="middle">${trim(tickValue)}</text>`);
  }

  runs.forEach((run, index) => {
    const colour = SERIES[index % 3];
    const points = run.rolling.map((point) => `${x(point.centerTrial).toFixed(1)},${y(point.medianHitTimeMs).toFixed(1)}`);
    parts.push(`<polyline points="${points.join(' ')}" style="fill:none;stroke:${colour};stroke-width:2;stroke-linejoin:round"/>`);
    for (const point of run.rolling) {
      parts.push(
        `<circle cx="${x(point.centerTrial).toFixed(1)}" cy="${y(point.medianHitTimeMs).toFixed(1)}" r="4" style="fill:${colour};stroke:var(--surface);stroke-width:2"><title>rep ${run.runIndex + 1} · trial ${point.centerTrial - ROLLING_WINDOW_TRIALS / 2 + 1}–${point.centerTrial + ROLLING_WINDOW_TRIALS / 2} · 滾動中位數 ${point.medianHitTimeMs.toFixed(0)} ms（n=${point.n}）</title></circle>`,
      );
    }
    const legendX = left + index * 84;
    parts.push(`<line x1="${legendX}" y1="${(height - 16).toFixed(1)}" x2="${legendX + 16}" y2="${(height - 16).toFixed(1)}" style="stroke:${colour};stroke-width:2"/>`);
    parts.push(`<text x="${legendX + 22}" y="${(height - 12).toFixed(1)}" class="tick" text-anchor="start">rep ${run.runIndex + 1}</text>`);
  });

  parts.push(`<text x="${left}" y="${(bottom + 44).toFixed(1)}" class="tick" text-anchor="start">周邊 trial 序號（${ROLLING_WINDOW_TRIALS}-trial 滾動窗中心）</text>`);
  parts.push(`<text transform="translate(22.0,${((top + bottom) / 2).toFixed(1)}) rotate(-90)" class="tick" text-anchor="middle">命中時間中位數（ms）</text>`);

  const table = tableView(
    ['Trial 窗（中心）', ...runs.map((run) => `rep ${run.runIndex + 1}`)],
    uniqueSorted(allPoints.map((point) => point.centerTrial)).map((centre) => [
      String(centre),
      ...runs.map((run) => {
        const point = run.rolling.find((candidate) => candidate.centerTrial === centre);
        return point === undefined ? '—' : `${point.medianHitTimeMs.toFixed(0)} ms`;
      }),
    ]),
  );

  return figure(
    'C6 · 這三場是怎麼跑完的?（場內時間歷程）',
    svg(height, parts, '場內時間歷程：命中時間的滾動中位數對 trial 序號'),
    [
      ['可以畫的理由', `三份的周邊呈現數 ${report.runs.map((run) => run.effectiveSpeed.peripheralCount).join('／')} 均 ≥ 24。`],
      [
        '怎麼讀',
        `三條線的形狀:${runs
          .map((run) => `rep ${run.runIndex + 1} ${describeShape(run.rolling.map((point) => point.medianHitTimeMs))}`)
          .join(';')}。三場的刺激逐位相同,所以這些形狀差異<strong>不能</strong>各自解讀成「暖身不足」或「60 秒內衰退」;` +
          `它們的量級與滾動窗本身的雜訊同級。要談場內趨勢需要更多場。`,
      ],
      ['何時不畫', '呈現數 < 24 時滾動窗沒有意義,改畫前／後半兩個箱。'],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// C7 —— Fitts 難度縮放
// ---------------------------------------------------------------------------

function chartC7(report: CoachReport): string {
  const runs = report.runs.filter((run) => run.fitts.drawable);
  if (runs.length === 0) {
    return figure(
      'C7 · 難度上去會不會崩?（Fitts 難度縮放）',
      '',
      [['不畫的原因', report.runs[0]?.fitts.reason ?? '無有效 tier']],
      '',
    );
  }

  const points = runs.flatMap((run) => run.fitts.points);
  const xDomain: [number, number] = [
    Math.min(...points.map((point) => point.medianIdBits)) - 0.2,
    Math.max(...points.map((point) => point.medianIdBits)) + 0.2,
  ];
  const yDomain: [number, number] = [
    Math.floor((Math.min(...points.map((point) => point.medianHitTimeMs)) - 40) / 20) * 20,
    Math.ceil((Math.max(...points.map((point) => point.medianHitTimeMs)) + 40) / 20) * 20,
  ];

  const left = 78;
  const right = CHART_WIDTH - 76;
  const top = 40;
  const bottom = 244;
  const height = 372;
  const x = linearScale(xDomain, [left, right]);
  const y = linearScale(yDomain, [bottom, top]);

  const parts: string[] = [];
  for (const tickValue of ticksFor(yDomain, 5)) {
    parts.push(`<line x1="${left}" y1="${y(tickValue).toFixed(1)}" x2="${right}" y2="${y(tickValue).toFixed(1)}" class="grid"/>`);
    parts.push(`<text x="${(left - 10).toFixed(1)}" y="${(y(tickValue) + 4).toFixed(1)}" class="tick" text-anchor="end">${trim(tickValue)}</text>`);
  }
  parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="axis"/>`);
  for (const tickValue of ticksFor(xDomain, 5)) {
    parts.push(`<line x1="${x(tickValue).toFixed(1)}" y1="${top}" x2="${x(tickValue).toFixed(1)}" y2="${bottom}" class="grid"/>`);
    parts.push(`<text x="${x(tickValue).toFixed(1)}" y="${(bottom + 19).toFixed(1)}" class="tick" text-anchor="middle">${tickValue.toFixed(2)}</text>`);
  }

  runs.forEach((run, index) => {
    const colour = SERIES[index % 3];
    const slope = run.fitts.slopeMsPerBit ?? 0;
    const intercept = run.fitts.interceptMs ?? 0;
    const yAt = (id: number) => clamp(intercept + slope * id, yDomain[0], yDomain[1]);
    parts.push(
      `<line x1="${x(xDomain[0]).toFixed(1)}" y1="${y(yAt(xDomain[0])).toFixed(1)}" x2="${x(xDomain[1]).toFixed(1)}" y2="${y(yAt(xDomain[1])).toFixed(1)}" style="stroke:${colour};stroke-width:2"><title>rep ${run.runIndex + 1} 擬合 · 截距 ${intercept.toFixed(0)} ms · 斜率 ${slope.toFixed(0)} ms/bit · r² ${fmt(run.fitts.r2, 3)}</title></line>`,
    );
    for (const point of run.fitts.points) {
      parts.push(
        `<circle cx="${x(point.medianIdBits).toFixed(1)}" cy="${y(point.medianHitTimeMs).toFixed(1)}" r="6" style="fill:${colour};stroke:var(--surface);stroke-width:2"><title>rep ${run.runIndex + 1} · ${point.tierKey}° · ID ${point.medianIdBits.toFixed(2)} bits · 命中時間 ${point.medianHitTimeMs.toFixed(0)} ms（n=${point.n}）</title></circle>`,
      );
    }
    const legendX = left + index * 84;
    parts.push(`<line x1="${legendX}" y1="20" x2="${legendX + 16}" y2="20" style="stroke:${colour};stroke-width:2"/>`);
    parts.push(`<text x="${legendX + 22}" y="24" class="tick" text-anchor="start">rep ${run.runIndex + 1}</text>`);
  });

  parts.push(`<text x="${left}" y="${(bottom + 44).toFixed(1)}" class="tick" text-anchor="start">Fitts 難度指數 ID = log₂(1 + D / W)　bits（W 恆為 2.0°）</text>`);
  parts.push(`<text transform="translate(24.0,${((top + bottom) / 2).toFixed(1)}) rotate(-90)" class="tick" text-anchor="middle">命中時間中位數（ms）</text>`);

  const readoutY = bottom + 60;
  parts.push(`<rect x="${left}" y="${readoutY}" width="${(right - left).toFixed(1)}" height="48" rx="8" class="readout"/>`);
  parts.push(`<text x="${(left + 16).toFixed(1)}" y="${(readoutY + 20).toFixed(1)}" class="tick" text-anchor="start">截距（固定開銷） / 斜率（每 bit 代價）</text>`);
  parts.push(
    `<text x="${(left + 16).toFixed(1)}" y="${(readoutY + 38).toFixed(1)}" class="lbl-strong" text-anchor="start">${runs
      .map((run) => `rep ${run.runIndex + 1} ${fmt(run.fitts.interceptMs, 0)} ms / ${fmt(run.fitts.slopeMsPerBit, 0)} ms/bit`)
      .join('　·　')}</text>`,
  );

  const table = tableView(
    ['Run', '幅度 tier', 'ID（bits）', '命中時間中位數', 'n'],
    runs.flatMap((run) =>
      run.fitts.points.map((point) => [
        `rep ${run.runIndex + 1}`,
        `${point.tierKey}°`,
        point.medianIdBits.toFixed(3),
        `${point.medianHitTimeMs.toFixed(0)} ms`,
        String(point.n),
      ]),
    ),
    runs.map((run) => [
      `rep ${run.runIndex + 1} 擬合`,
      `截距 ${fmt(run.fitts.interceptMs, 0)} ms`,
      `斜率 ${fmt(run.fitts.slopeMsPerBit, 0)} ms/bit`,
      `r² ${fmt(run.fitts.r2, 3)}`,
      '',
    ]),
  );

  return figure(
    'C7 · 難度上去會不會崩?（Fitts 難度縮放）',
    svg(height, parts, '難度縮放：命中時間對 Fitts 難度指數,三次重複各一條擬合'),
    [
      [
        '怎麼讀',
        runs.every((run) => monotonic(run.fitts.points.map((point) => point.medianHitTimeMs)) === 'increasing')
          ? '三份 run 的命中時間都<strong>隨 ID 單調上升</strong> —— 難度縮放的方向在三場中一致,這是最穩的一個結論。'
          : `命中時間對 ID 的單調性:${runs
              .map(
                (run) =>
                  `rep ${run.runIndex + 1} ${monotonic(run.fitts.points.map((point) => point.medianHitTimeMs)) === 'increasing' ? '單調上升' : '非單調'}`,
              )
              .join('、')} —— 方向在三場中<strong>不一致</strong>,難度縮放的結論不成立。`,
      ],
      ['不能讀的東西', `三條線的<strong>斜率</strong>是 ${runs.map((run) => fmt(run.fitts.slopeMsPerBit, 0)).join('／')} ms/bit,<strong>截距</strong>是 ${runs.map((run) => fmt(run.fitts.interceptMs, 0)).join('／')} ms。三場的刺激逐位相同,所以這個離散全部是估計誤差。<strong>不報 throughput、不比較截距</strong>（§6）。`],
      ['為什麼 r² 這麼高卻不能信', `擬合輸入只有 3 個 tier 中位數,兩個自由度 ⇒ r²（${runs.map((run) => fmt(run.fitts.r2, 3)).join('／')}）幾乎必然漂亮。r² 高只說明「三個點接近共線」,不說明斜率可重現。`],
      ['何時不畫', '少於 3 個幅度 tier 有效樣本、或 ID 變異範圍過窄時不擬合。'],
    ],
    table,
  );
}

// ---------------------------------------------------------------------------
// SVG / HTML 小工具
// ---------------------------------------------------------------------------

function svg(height: number, parts: readonly string[], label: string): string {
  return `<div class="viz-root"><svg viewBox="0 0 ${CHART_WIDTH} ${height}" role="img" aria-label="${escapeHtml(label)}" style="width:100%;height:auto;display:block">
${parts.join('\n')}
</svg></div>`;
}

function figure(title: string, body: string, notes: readonly (readonly [string, string])[], table: string): string {
  return `<figure class="viz">
<figcaption><h3>${escapeHtml(title)}</h3></figcaption>
${body}
<div class="viz-notes">${notes.map(([key, text]) => `<div><span class="nk">${escapeHtml(key)}</span>${text}</div>`).join('')}</div>
${table}
</figure>`;
}

function tableView(header: readonly string[], rows: readonly (readonly string[])[], extra: readonly (readonly string[])[] = []): string {
  const body = [...rows, ...extra]
    .map((row) => `<tr>${row.map((cell) => `<td>${cell === '' ? '' : escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<details class="viz-table">
<summary>表格檢視（每個值都可讀,不靠顏色或 hover）</summary>
<div class="table-wrap"><table>
<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>
<tbody>${body}</tbody>
</table></div>
</details>`;
}

/** 資料端 4px 圓角、基線端方角（`radius === 0` 時兩端皆方角）。 */
function roundedBar(x0: number, x1: number, y0: number, height: number, radius: number): string {
  const width = Math.max(0, x1 - x0);
  const r = Math.min(radius, width, height / 2);
  if (r <= 0) return `M${x0.toFixed(1)},${y0.toFixed(1)} H${x1.toFixed(1)} V${(y0 + height).toFixed(1)} H${x0.toFixed(1)} Z`;
  return (
    `M${x0.toFixed(1)},${y0.toFixed(1)} H${(x1 - r).toFixed(1)} ` +
    `A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${(y0 + r).toFixed(1)} ` +
    `V${(y0 + height - r).toFixed(1)} ` +
    `A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${(x1 - r).toFixed(1)},${(y0 + height).toFixed(1)} ` +
    `H${x0.toFixed(1)} Z`
  );
}

function linearScale(domain: readonly [number, number], range: readonly [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value: number) => (span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0));
}

function ticksFor(domain: readonly [number, number], count: number): number[] {
  const [d0, d1] = domain;
  if (d1 <= d0) return [d0];
  const raw = (d1 - d0) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude;
  const start = Math.ceil(d0 / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= d1 + 1e-9; value += step) ticks.push(roundTo(value, 6));
  return ticks;
}

/** 等值線取整到人看得懂的間隔,且必須把三個實測點都包進去。 */
function niceIso(values: readonly number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = 4;
  const start = Math.floor((min - step) / step) * step;
  const end = Math.ceil((max + step) / step) * step;
  const result: number[] = [];
  for (let value = start; value <= end; value += step) if (value > 0) result.push(value);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function formatObservation(value: number, format: MetricFormat): string {
  switch (format) {
    case 'integer':
      return value.toFixed(0);
    case 'decimal-1':
      return value.toFixed(1);
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return value.toFixed(2);
  }
}

type MetricFormat = 'integer' | 'decimal-1' | 'decimal-2' | 'percent';

function toCsv(rows: readonly (readonly (string | number | boolean)[])[]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function num(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '' : String(value);
}

function fmt(value: number | undefined, digits: number): string {
  return value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function fmtSmart(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3);
}

function pct(value: number): string {
  return Number.isFinite(value) ? `${(100 * value).toFixed(1)}%` : '—';
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(roundTo(value, 2));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * runner 產生的敘述句帶有 Markdown 風格的 `**粗體**` 與 `` `code` ``。先跳脫 HTML,再把這兩種
 * 標記換成標籤 —— 順序不可反,否則資料裡的 `<` 會變成標籤。
 */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ---------------------------------------------------------------------------
// 樣式 —— 沿用教練提案 HTML 已驗證的調色盤與版面（見檔頭）
// ---------------------------------------------------------------------------

const STYLE = `
:root {
  --bg: #f5f7fb; --surface: #ffffff; --surface-soft: #f0f5ff;
  --text: #182033; --muted: #5e687d; --line: #d9e0ec;
  --blue: #1d5fd1; --blue-soft: #e8f0ff;
  --green: #087f5b; --green-soft: #e6f7f0;
  --amber: #a15c00; --amber-soft: #fff3da;
  --red: #b42318; --red-soft: #ffebe9;
  --shadow: 0 12px 34px rgba(24, 32, 51, 0.08);
  --radius: 16px;
  --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  --sans: Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #101521; --surface: #171e2d; --surface-soft: #1c2942;
    --text: #edf2ff; --muted: #aeb9ce; --line: #344057;
    --blue: #79a8ff; --blue-soft: #1a315a;
    --green: #72d6b0; --green-soft: #173a32;
    --amber: #ffc66d; --amber-soft: #45331c;
    --red: #ff938a; --red-soft: #4a2526;
    --shadow: none;
  }
}
:root[data-theme="dark"] {
  --bg: #101521; --surface: #171e2d; --surface-soft: #1c2942;
  --text: #edf2ff; --muted: #aeb9ce; --line: #344057;
  --blue: #79a8ff; --blue-soft: #1a315a;
  --green: #72d6b0; --green-soft: #173a32;
  --amber: #ffc66d; --amber-soft: #45331c;
  --red: #ff938a; --red-soft: #4a2526;
  --shadow: none;
}

/* chart palette — validated against these exact surfaces (light #ffffff / dark #171e2d),
   all-pairs pairlist, six checks: ALL PASS. Light series-3 is 2.82:1 on white ⇒ relief rule:
   every stacked segment is direct-labelled. Series cap 3. */
.viz-root {
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a;
  --series-1-dim: #86b6ef;
  --ink: #0b0b0b; --ink-2: #52514e; --ink-muted: #898781;
  --gridline: #e1e0d9; --baseline: #c3c2b7; --band-fill: #f0efec;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .viz-root {
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70;
    --series-1-dim: #184f95;
    --ink: #ffffff; --ink-2: #c3c2b7; --ink-muted: #898781;
    --gridline: #2c2c2a; --baseline: #383835; --band-fill: #383835;
  }
}
:root[data-theme="dark"] .viz-root {
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70;
  --series-1-dim: #184f95;
  --ink: #ffffff; --ink-2: #c3c2b7; --ink-muted: #898781;
  --gridline: #2c2c2a; --baseline: #383835; --band-fill: #383835;
}

.viz-root svg text { font-family: var(--sans); }
.viz-root .grid { stroke: var(--gridline); stroke-width: 1; }
.viz-root .axis { stroke: var(--baseline); stroke-width: 1; }
.viz-root .band { fill: var(--band-fill); }
.viz-root .tick { fill: var(--ink-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.viz-root .lbl { fill: var(--ink-2); font-size: 12px; }
.viz-root .lbl-strong { fill: var(--ink); font-size: 12px; font-weight: 700; }
.viz-root .val { fill: var(--ink); font-size: 12.5px; font-weight: 700; }
.viz-root .seg-val { fill: #ffffff; font-size: 12px; font-weight: 700; }
.viz-root .mk-weak { fill: var(--series-1); }
.viz-root .mk-ok { fill: var(--series-1-dim); }
.viz-root .seg1 { fill: var(--series-1); }
.viz-root .seg2 { fill: var(--series-2); }
.viz-root .seg3 { fill: var(--series-3); }
.viz-root .iso { fill: none; stroke: var(--gridline); stroke-width: 1.5; }
.viz-root .iso-lbl { fill: var(--ink-muted); font-size: 10.5px; }
.viz-root .shift { fill: none; stroke: var(--ink-muted); stroke-width: 1.5; }
.viz-root .readout { fill: var(--band-fill); }
.viz-root [role="img"] :is(circle, path, rect, line):hover { filter: brightness(1.08); }

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0; color: var(--text); background: var(--bg);
  font-family: var(--sans); line-height: 1.7;
}
a { color: var(--blue); text-underline-offset: 3px; }
code { padding: 0.12rem 0.35rem; border-radius: 5px; background: var(--surface-soft); font-family: var(--mono); font-size: 0.9em; }
.shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
header { padding: 56px 0 30px; }
.eyebrow { margin: 0 0 10px; color: var(--blue); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
h1 { margin: 0; max-width: 900px; font-size: clamp(1.9rem, 4.4vw, 3.6rem); line-height: 1.1; }
.lede { max-width: 880px; margin: 20px 0 0; color: var(--muted); font-size: 1.06rem; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.pill { display: inline-flex; align-items: center; min-height: 30px; padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--muted); font-size: 0.8rem; font-weight: 700; }
.pill.real { border-color: color-mix(in srgb, var(--green) 40%, var(--line)); background: var(--green-soft); color: var(--green); }
.pill.warn { border-color: color-mix(in srgb, var(--red) 40%, var(--line)); background: var(--red-soft); color: var(--red); }
nav { position: sticky; top: 0; z-index: 10; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(12px); }
nav .shell { display: flex; gap: 22px; overflow-x: auto; padding-top: 11px; padding-bottom: 11px; }
nav a { flex: 0 0 auto; color: var(--muted); font-size: 0.86rem; font-weight: 750; text-decoration: none; }
nav a:hover { color: var(--blue); }
main { padding: 30px 0 64px; }
section { scroll-margin-top: 68px; margin-top: 50px; }
h2 { margin: 0 0 10px; font-size: clamp(1.4rem, 2.4vw, 2rem); line-height: 1.25; }
h3 { margin: 26px 0 10px; font-size: 1.1rem; }
p { margin: 10px 0; }
.section-intro { max-width: 900px; color: var(--muted); }
.footnote { max-width: 900px; color: var(--muted); font-size: 0.86rem; }
.sub { color: var(--muted); font-size: 0.8rem; font-weight: 400; }
.callout { margin: 20px 0; padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--blue) 30%, var(--line)); border-left: 5px solid var(--blue); border-radius: 12px; background: var(--blue-soft); }
.callout.warning { border-color: color-mix(in srgb, var(--amber) 35%, var(--line)); border-left-color: var(--amber); background: var(--amber-soft); }
.callout.danger { border-color: color-mix(in srgb, var(--red) 35%, var(--line)); border-left-color: var(--red); background: var(--red-soft); }
.callout.good { border-color: color-mix(in srgb, var(--green) 35%, var(--line)); border-left-color: var(--green); background: var(--green-soft); }
/* 只有 callout 的**直接**第一個子元素（標題那一行）是 block。不可寫成 \`.callout strong:first-child\`
   —— \`:first-child\` 只看元素、不看文字節點,那樣寫會讓每個 <p> 裡開頭的行內 <strong> 也變成 block。 */
.callout > strong:first-child { display: block; margin-bottom: 3px; }
.callout ul { margin: 8px 0 0; }
.table-wrap { margin: 16px 0; overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th, td { padding: 11px 13px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: var(--surface-soft); color: var(--muted); font-size: 0.74rem; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td:first-child { font-weight: 700; }
figure.viz { margin: 26px 0; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
figure.viz figcaption { margin: 0 0 6px; }
figure.viz figcaption h3 { margin: 0 0 14px; font-size: 1.04rem; }
.viz-notes { display: grid; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 0.87rem; color: var(--muted); }
.viz-notes .nk { display: inline-block; min-width: 120px; color: var(--text); font-weight: 800; }
.viz-table { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.viz-table > summary { cursor: pointer; padding: 11px 14px; font-size: 0.85rem; font-weight: 750; }
.viz-table > div { padding: 0 12px 8px; }
.viz-table .table-wrap { margin: 0 0 8px; }
article.gate { margin: 18px 0; padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
article.gate h3 { margin: 0 0 6px; font-size: 1.02rem; }
article.gate .gid { display: inline-grid; place-items: center; width: 30px; height: 24px; margin-right: 8px; border-radius: 7px; background: var(--blue-soft); color: var(--blue); font-family: var(--mono); font-size: 0.78rem; font-weight: 800; }
.gate-verdict { margin: 0 0 8px; font-weight: 800; }
article.gate ul { margin: 8px 0; padding-left: 1.2rem; color: var(--muted); font-size: 0.9rem; }
article.gate li + li { margin-top: 6px; }
.gate-none { margin: 6px 0 0; color: var(--muted); font-size: 0.86rem; }
.degrade { margin-top: 12px; padding: 12px 14px; border-left: 4px solid var(--amber); border-radius: 8px; background: var(--amber-soft); }
.degrade strong { display: block; margin-bottom: 4px; color: var(--amber); }
.degrade ul { margin: 0; color: var(--text); }
ol.honesty { padding-left: 1.3rem; }
ol.honesty li { margin-top: 8px; }
ul, ol { padding-left: 1.3rem; }
li + li { margin-top: 6px; }
footer { padding: 26px 0 52px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.84rem; }
@media (max-width: 820px) { .viz-notes .nk { min-width: 0; display: block; } }
@media print {
  :root { color-scheme: light; }
  body { background: #fff; color: #111; }
  nav { display: none; }
  header { padding-top: 20px; }
  figure.viz, .table-wrap, details, article.gate { box-shadow: none; break-inside: avoid; }
  a { color: #111; text-decoration: none; }
  section { margin-top: 28px; }
  .viz-table > div { display: block; }
  .viz-table:not([open]) > div { display: block; }
}
`;

export const __testing = { linearScale, niceIso, roundedBar, ticksFor, inline, escapeHtml };
