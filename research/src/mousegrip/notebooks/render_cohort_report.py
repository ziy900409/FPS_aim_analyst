"""Render the S01-S08 Spider Shot mouse x grip cohort as one offline HTML report.

Usage from ``research/``::

    uv run python src/mousegrip/notebooks/render_cohort_report.py \
      --input out/mousegrip-cohort-s01-s08 \
      --out ../docs/algorithm/spider_shot/spider-shot-wide/cohort-s01-s08-result-2026-09-18.html
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys
from typing import Any

RESEARCH_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from mousegrip.algorithms.cohort_report import build_report_model  # noqa: E402


CSV_INPUTS = {
    "quality_rows": "quality_ledger.csv",
    "trial_rows": "trial_metrics.csv",
    "run_rows": "run_metrics.csv",
    "pair_rows": "matched_pairs.csv",
    "coverage_rows": "mechanism_coverage.csv",
}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def render_html(model: dict[str, Any]) -> str:
    embedded = json.dumps(model, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spider Shot Wide｜DK × GPW1 × 握姿｜S01–S08</title>
<style>{REPORT_CSS}</style>
</head>
<body>
<header class="hero">
  <div class="shell">
    <p class="eyebrow">SPIDER SHOT WIDE · S01–S08 · COHORT INSTRUMENT</p>
    <h1>滑鼠不是單一答案，<br><span>配置要在玩家身上成立。</span></h1>
    <p class="lede">DK 與 GPW1 的玩家內比較，拆開 1-2-2／1-3-1 握姿、命中結果與拉槍控制。Sensitivity 視為玩家自適應：完整揭露，但不作排除或歸因因子。</p>
    <div class="hero-stats" id="heroStats"></div>
  </div>
</header>
<div class="shell layout">
  <nav class="toc" aria-label="報告目錄">
    <b>REPORT MAP</b>
    <a href="#verdict">00 判讀契約</a><a href="#quality">01 資料品質</a>
    <a href="#design">02 設計診斷</a><a href="#profile">03 玩家輪廓</a>
    <a href="#contrasts">04 玩家內對比</a><a href="#mechanism">05 動作機制</a>
    <a href="#coach">06 教練解讀</a><a href="#provenance">07 稽核與來源</a>
  </nav>
  <main>
    <section id="verdict">
      <p class="section-no">00 / DECISION CONTRACT</p><h2>先回答「能比較什麼」</h2>
      <div class="decision-grid">
        <article class="panel accent"><span class="label">PRIMARY DEVICE CONTRAST</span><h3>固定 1-2-2：GPW1 → DK</h3><p>只納入同一玩家同時擁有 GPW1/1-2-2 與 DK/1-2-2 的資料。Sensitivity 可隨配置自適應。</p></article>
        <article class="panel"><span class="label">PRIMARY GRIP CONTRAST</span><h3>固定 DK：1-2-2 → 1-3-1</h3><p>握姿順序仍未反平衡，結果只能描述「後測配置差」，不能宣稱純握姿因果。</p></article>
        <article class="panel"><span class="label">CASE STUDY</span><h3>固定 1-3-1：GPW1 → DK</h3><p>只有 S06，保留個案 coaching，不提升成群體結論。</p></article>
      </div>
      <div class="callout warn" id="policy"></div>
    </section>

    <section id="quality">
      <p class="section-no">01 / QUALITY FIRST</p><h2>配置、資格與排除</h2>
      <div class="table-wrap"><table id="configTable"><caption>實際觀測到四種 mouse / grip 配置；GPW1 不再被當作同質條件。</caption></table></div>
      <div class="quality-grid"><div class="panel"><h3>硬閘</h3><div id="blockedRuns"></div></div><div class="panel"><h3>Sensitivity 自適應紀錄</h3><div id="sensitivityChanges"></div></div></div>
    </section>

    <section id="design">
      <p class="section-no">02 / DESIGN DIAGNOSIS</p><h2>條件順序與設定軌跡</h2>
      <div class="table-wrap"><table id="orderTable"><caption>由 startedAt 排序；感度是描述性 provenance，不是 comparability gate。</caption></table></div>
      <div class="callout bad"><strong>握姿順序限制：</strong>具有兩種 DK 握姿的玩家仍全部先做 1-2-2、再做 1-3-1。任何 DK 握姿差異都與場內順序共線。</div>
    </section>

    <section id="profile">
      <p class="section-no">03 / PLAYER PROFILES</p><h2>每位玩家自己的三條線索</h2>
      <p class="intro">每格先合併該玩家、該條件的合格 runs；不把 3153 次呈現當成 3153 位玩家。</p>
      <div class="table-wrap tall"><table id="profileTable"></table></div>
    </section>

    <section id="contrasts">
      <p class="section-no">04 / WITHIN-PLAYER CONTRASTS</p><h2>玩家內差值與自身波動</h2>
      <div class="tabs" id="contrastTabs" role="tablist"></div>
      <article class="panel chart-panel"><div class="chart-head"><div><h3 id="contrastTitle"></h3><p>點＝玩家內配對差；灰帶＝兩側條件中較大的三-run 全距。正值代表右側條件較高／較慢。</p></div><div class="metric-switch"><button data-metric="first" aria-pressed="true">首發率 Δ</button><button data-metric="time" aria-pressed="false">命中時間 Δ</button></div></div><div id="forestChart" class="svg-host"></div></article>
      <div class="table-wrap"><table id="contrastTable"></table></div>
    </section>

    <section id="mechanism">
      <p class="section-no">05 / CONTROL MECHANISM</p><h2>進靶前卸速，進靶後何時擊發</h2>
      <div class="coverage" id="coverage"></div>
      <div class="mechanism-grid"><article class="panel"><h3>Peak ω × Entry ω</h3><p class="muted">每點是一位玩家 × 一個配置的中位數；越靠下代表進靶前卸速越完整。</p><div id="scatter" class="svg-host"></div></article><article class="panel"><h3>機制輪廓</h3><div class="table-wrap mechanism-table"><table id="mechanismTable"></table></div></article></div>
      <div class="callout warn"><strong>Tier 1 withholding：</strong>reaction 與 movement time 未達 90% 可算率，不進教練結論；空白不以 0 代替。</div>
    </section>

    <section id="coach">
      <p class="section-no">06 / COACHING READ</p><h2>這份報告可以怎麼用</h2>
      <div class="coach-grid"><article class="panel"><span class="label">RESULT</span><h3>先看命中，再看速度</h3><p>首發率與命中時間若指向不同方向，視為 speed–accuracy trade-off，不用單一總分硬選冠軍。</p></article><article class="panel"><span class="label">CONTROL</span><h3>峰速不是目的</h3><p>Peak ω 必須搭配 entry ω、煞停保留率與擊發邊際，才能分辨「快而可控」與「快但失去時序」。</p></article><article class="panel"><span class="label">RETEST</span><h3>握姿結論需反平衡複測</h3><p>下一輪至少交換 DK 兩握姿順序；在此之前，1-3-1 的差異只作個人化訓練假設。</p></article></div>
    </section>

    <section id="provenance">
      <p class="section-no">07 / AUDIT</p><h2>定義、來源與不可說的話</h2>
      <ul class="audit-list"><li>資料母體：只讀取 <code>spider-shot-wide-v1</code>；Micro Flick 與 Tracking 不進本頁。</li><li>機制構念：TypeScript canonical derivation；Python 只做 join、玩家內彙整與呈現。</li><li>品質：suspect、validity、overflow、lateEventCount 明示；硬閘失敗 run 不進比較。</li><li>禁止：不得把 trial 當獨立玩家、不得宣稱完整 mouse × grip interaction、不得用本 cohort 建常模。</li></ul>
    </section>
  </main>
</div>
<footer><div class="shell">Spider Shot Wide · S01–S08 · descriptive cohort coaching report · sensitivity = player adaptation</div></footer>
<script id="report-data" type="application/json">{embedded}</script>
<script>{REPORT_SCRIPT}</script>
</body></html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default=str(RESEARCH_ROOT / "out/mousegrip-cohort-s01-s08"))
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    input_dir = Path(args.input)
    tables = {name: read_rows(input_dir / filename) for name, filename in CSV_INPUTS.items()}
    model = build_report_model(**tables)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_html(model), encoding="utf-8")
    print(f"wrote {output} ({model['summary']['participantCount']} participants)")
    return 0


REPORT_CSS = r"""
:root{--bg-0:#0f1113;--bg-1:#16191d;--bg-2:#1e2227;--line:rgba(255,255,255,.08);--line-strong:rgba(255,255,255,.16);--text-hi:#edeff2;--text-mid:#aeb4bc;--text-lo:#6e757e;--accent:#e8285a;--accent-hi:#ff3d6e;--accent-dim:rgba(232,40,90,.14);--ok:#2ecc71;--warn:#f5a623;--bad:#ff5470;--cat-1:#e83a6a;--cat-2:#f5a623;--cat-3:#3fa9f5;--cat-4:#9b6dff;--font-ui:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:"IBM Plex Mono","Cascadia Code",Consolas,monospace;--r-card:12px;--r-control:8px;--r-pill:999px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg-0);color:var(--text-hi);font:14px/1.6 var(--font-ui)}a{color:inherit}code,.num,.metric-value{font-family:var(--font-mono);font-variant-numeric:tabular-nums}.shell{width:min(1260px,calc(100% - 40px));margin:auto}.hero{border-bottom:1px solid var(--line);background:radial-gradient(circle at 82% 12%,rgba(232,40,90,.14),transparent 34%),var(--bg-0);padding:64px 0 42px}.eyebrow,.section-no,.label{color:var(--text-lo);font:700 11px/1.2 var(--font-mono);letter-spacing:.1em;text-transform:uppercase}.hero h1{max-width:880px;margin:12px 0 18px;font-size:clamp(38px,6vw,76px);line-height:.95;letter-spacing:-.055em}.hero h1 span{color:var(--accent)}.lede{max-width:850px;color:var(--text-mid);font-size:16px}.hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:28px;background:var(--line)}.stat{background:var(--bg-1);padding:16px}.stat b{display:block;font:700 25px/1 var(--font-mono)}.stat span{display:block;margin-top:7px;color:var(--text-lo);font-size:11px;letter-spacing:.05em;text-transform:uppercase}.layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:34px;padding:30px 0 70px}.toc{position:sticky;top:20px;height:max-content;display:grid;gap:5px}.toc b{padding:8px 10px;color:var(--accent);font:700 11px var(--font-mono);letter-spacing:.08em}.toc a{text-decoration:none;color:var(--text-mid);padding:7px 10px;border-left:2px solid transparent}.toc a:hover,.toc a:focus-visible{color:var(--text-hi);border-left-color:var(--accent);outline:none}main{min-width:0}section{padding:30px 0;border-bottom:1px solid var(--line)}h2{margin:5px 0 17px;font-size:24px;letter-spacing:-.025em}h3{margin:6px 0 7px;font-size:15px}p{margin:0 0 10px}.intro,.muted{color:var(--text-mid)}.panel{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-card);padding:18px}.panel.accent{border-top:3px solid var(--accent)}.decision-grid,.coach-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.panel p{color:var(--text-mid)}.callout{margin-top:14px;padding:13px 15px;border:1px solid var(--line-strong);border-left:3px solid var(--warn);background:var(--bg-1);border-radius:var(--r-control);color:var(--text-mid)}.callout.bad{border-left-color:var(--bad)}.callout.warn{border-left-color:var(--warn)}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:var(--r-card)}.table-wrap.tall{max-height:560px}table{width:100%;border-collapse:collapse;font-size:12px}caption{text-align:left;padding:11px 13px;color:var(--text-lo)}th,td{padding:9px 11px;border-top:1px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--text-lo);font:700 10px var(--font-mono);letter-spacing:.05em;text-transform:uppercase;background:var(--bg-2);position:sticky;top:0;z-index:1}th:first-child,td:first-child{text-align:left}tbody tr:hover{background:var(--bg-2)}.quality-grid,.mechanism-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.pill{display:inline-flex;border:1px solid var(--line-strong);border-radius:var(--r-pill);padding:3px 8px;margin:3px;color:var(--text-mid);font:700 11px var(--font-mono)}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.tabs button,.metric-switch button{border:1px solid var(--line-strong);border-radius:var(--r-pill);padding:8px 12px;background:transparent;color:var(--text-mid);font:700 12px var(--font-ui);cursor:pointer}.tabs button[aria-selected=true],.metric-switch button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:white}.tabs button:focus-visible,.metric-switch button:focus-visible{outline:2px solid var(--accent-hi);outline-offset:2px}.chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.metric-switch{display:flex;gap:6px}.svg-host{min-height:260px;overflow:auto}.svg-host svg{display:block;min-width:680px;width:100%;height:auto}.coverage{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}.coverage .panel{padding:11px}.coverage b{display:block;font:700 16px var(--font-mono)}.coverage small{color:var(--text-lo)}.mechanism-table{max-height:420px}.audit-list{color:var(--text-mid)}footer{padding:24px 0;border-top:1px solid var(--line);color:var(--text-lo);font:11px var(--font-mono)}
@media(max-width:900px){.layout{grid-template-columns:1fr}.toc{position:static;grid-template-columns:repeat(2,1fr)}.decision-grid,.coach-grid,.quality-grid,.mechanism-grid{grid-template-columns:1fr}.hero-stats{grid-template-columns:repeat(2,1fr)}.coverage{grid-template-columns:repeat(2,1fr)}.chart-head{display:block}.metric-switch{margin:8px 0}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
@media print{.toc,.tabs,.metric-switch{display:none}.layout{display:block}.panel,section{break-inside:avoid}body{background:#fff;color:#111}.panel,.stat{background:#fff;color:#111}}
"""


REPORT_SCRIPT = r"""
(function(){'use strict';
const D=JSON.parse(document.getElementById('report-data').textContent);const $=id=>document.getElementById(id);const NS='http://www.w3.org/2000/svg';
const colors={'GPW1/1-2-2':'#e83a6a','GPW1/1-3-1':'#f5a623','DK/1-2-2':'#3fa9f5','DK/1-3-1':'#9b6dff'};
function fmt(v,d=1){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d)}
function node(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x}
function pill(text,cls){return node('span',text,'pill '+(cls||''))}
function table(root,heads,rows){root.textContent='';const thead=node('thead'),tr=node('tr');heads.forEach(h=>tr.appendChild(node('th',h)));thead.appendChild(tr);const body=node('tbody');rows.forEach(r=>{const row=node('tr');r.forEach((v,i)=>row.appendChild(node('td',v,i?'num':'')));body.appendChild(row)});root.append(thead,body)}
const S=D.summary;[['玩家',S.participantCount],['Spider runs',S.admittedRunCount+'/'+S.runCount],['可分析呈現',S.presentationCount],['late events',S.lateEventTotal]].forEach(([l,v])=>{const x=node('div',undefined,'stat');x.append(node('b',String(v)),node('span',l));$('heroStats').appendChild(x)});
$('policy').append(node('strong','Sensitivity policy：'),document.createTextNode(D.policy.sensitivity+' '+D.policy.inference));
table($('configTable'),['配置','玩家','runs','合格','呈現'],D.configurations.map(c=>[c.label,c.participants.join(' · '),String(c.runCount),String(c.admittedRunCount),String(c.presentationCount)]));
if(D.blockedRuns.length){D.blockedRuns.forEach(r=>$('blockedRuns').append(pill(r.participant+' · '+r.blockers,'warn')))}else $('blockedRuns').append(pill('全部通過','ok'));
if(D.sensitivityChanges.length){D.sensitivityChanges.forEach(r=>$('sensitivityChanges').append(pill(r.participant+' '+r.conditionId+' · '+r.values.join(' → '),'warn')))}else $('sensitivityChanges').append(pill('無場中變動','ok'));
table($('orderTable'),['玩家','第一','第二','第三'],D.orders.map(o=>[o.participant,...[0,1,2].map(i=>o.cells[i]?o.cells[i].label+' · sens '+o.cells[i].sensitivities.join('→'):'—')]));
table($('profileTable'),['玩家／配置','n','hits/min','首發率','KM 中位 ms','KM p90 ms','sensitivity'],D.cells.map(c=>[c.participant+' · '+c.label,String(c.presentationCount),fmt(c.hitsPerMin),fmt(c.firstShotRate*100,1)+'%',fmt(c.kmMedianMs,0),fmt(c.kmP90Ms,0),c.sensitivities.join('→')]));
let activeContrast=D.contrasts[0],metric='first';
D.contrasts.forEach((c,i)=>{const b=node('button',c.title);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===0));b.onclick=()=>{activeContrast=c;[...$('contrastTabs').children].forEach(x=>x.setAttribute('aria-selected','false'));b.setAttribute('aria-selected','true');renderContrast()};$('contrastTabs').appendChild(b)});
document.querySelectorAll('.metric-switch button').forEach(b=>b.onclick=()=>{metric=b.dataset.metric;document.querySelectorAll('.metric-switch button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderContrast()});
function svgEl(tag,attrs,text){const x=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>x.setAttribute(k,String(v)));if(text!==undefined)x.textContent=text;return x}
function renderContrast(){const rows=activeContrast.rows;$('contrastTitle').textContent=activeContrast.title+' · n='+rows.length;const key=metric==='first'?'firstShotDeltaPp':'hitTimeDeltaMs',noise=metric==='first'?'firstShotNoisePp':'hitTimeNoiseMs',unit=metric==='first'?'pp':'ms';const vals=rows.flatMap(r=>[Math.abs(r[key]||0),Math.abs(r[noise]||0)]);const max=Math.max(1,...vals)*1.2,w=820,h=Math.max(220,70+rows.length*42),x=v=>100+(v+max)/(2*max)*650;const s=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,'aria-label':'玩家內差值圖'});s.append(svgEl('line',{x1:x(0),y1:25,x2:x(0),y2:h-35,stroke:'#aeb4bc','stroke-width':1}));[-max,-max/2,0,max/2,max].forEach(v=>{s.append(svgEl('text',{x:x(v),y:h-12,fill:'#6e757e','font-size':11,'text-anchor':'middle'},fmt(v,0)+' '+unit))});rows.forEach((r,i)=>{const y=45+i*42,n=r[noise]||0,v=r[key];s.append(svgEl('text',{x:8,y:y+4,fill:'#edeff2','font-size':12},r.participant));s.append(svgEl('line',{x1:x(-n),y1:y,x2:x(n),y2:y,stroke:'#6e757e','stroke-width':8,opacity:.35}));if(v!==null)s.append(svgEl('circle',{cx:x(v),cy:y,r:6,fill:Math.abs(v)>n?'#e8285a':'#aeb4bc',stroke:'#0f1113','stroke-width':2}))});$('forestChart').replaceChildren(s);table($('contrastTable'),['玩家','配對 n','Δ 首發率 pp','自身波動 pp','Δ 命中時間 ms','自身波動 ms'],rows.map(r=>[r.participant,String(r.pairCount),fmt(r.firstShotDeltaPp),fmt(r.firstShotNoisePp),fmt(r.hitTimeDeltaMs),fmt(r.hitTimeNoiseMs)]))}
renderContrast();
D.coverage.forEach(c=>{const x=node('div',undefined,'panel');x.append(node('small',c.column),node('b',fmt(c.coverage*100,1)+'%'),pill(c.verdict,c.verdict==='admissible'?'ok':'warn'));$('coverage').appendChild(x)});
table($('mechanismTable'),['玩家／配置','Brake %','Trigger ms','Peak ω','Entry ω','Fire error °'],D.cells.map(c=>{const m=c.mechanisms;return[c.participant+' · '+c.label,fmt(m.brake_retention*100,1),fmt(m.trigger_margin_ms,0),fmt(m.peak_omega_deg_per_sec,0),fmt(m.entry_omega_deg_per_sec,0),fmt(m.fire_angle_error_deg,2)]}));
function scatter(){const pts=D.cells.filter(c=>Number.isFinite(c.mechanisms.peak_omega_deg_per_sec)&&Number.isFinite(c.mechanisms.entry_omega_deg_per_sec));const max=Math.ceil(Math.max(100,...pts.flatMap(c=>[c.mechanisms.peak_omega_deg_per_sec,c.mechanisms.entry_omega_deg_per_sec]))/100)*100,w=720,h=430,x=v=>65+v/max*620,y=v=>365-v/max*320,s=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,'aria-label':'峰值與進靶角速度散佈圖'});[0,.25,.5,.75,1].forEach(q=>{s.append(svgEl('line',{x1:x(q*max),y1:45,x2:x(q*max),y2:365,stroke:'rgba(255,255,255,.08)'}));s.append(svgEl('line',{x1:65,y1:y(q*max),x2:685,y2:y(q*max),stroke:'rgba(255,255,255,.08)'}));s.append(svgEl('text',{x:x(q*max),y:388,fill:'#6e757e','font-size':10,'text-anchor':'middle'},fmt(q*max,0)));s.append(svgEl('text',{x:55,y:y(q*max)+4,fill:'#6e757e','font-size':10,'text-anchor':'end'},fmt(q*max,0)))});s.append(svgEl('line',{x1:x(0),y1:y(0),x2:x(max),y2:y(max),stroke:'#6e757e','stroke-dasharray':'5 5'}));pts.forEach(c=>{const p=svgEl('circle',{cx:x(c.mechanisms.peak_omega_deg_per_sec),cy:y(c.mechanisms.entry_omega_deg_per_sec),r:5,fill:colors[c.label]||'#aeb4bc'});p.appendChild(svgEl('title',{},c.participant+' · '+c.label));s.appendChild(p)});s.append(svgEl('text',{x:375,y:418,fill:'#aeb4bc','font-size':11,'text-anchor':'middle'},'Peak angular speed (deg/s)'));s.append(svgEl('text',{x:14,y:205,fill:'#aeb4bc','font-size':11,transform:'rotate(-90 14 205)','text-anchor':'middle'},'Entry angular speed (deg/s)'));$('scatter').appendChild(s)}scatter();
})();
"""


if __name__ == "__main__":
    raise SystemExit(main())
