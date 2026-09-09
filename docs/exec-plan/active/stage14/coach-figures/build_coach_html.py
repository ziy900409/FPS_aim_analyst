"""Assemble the spider-shot-v3 coach proposal HTML from the generated figures."""
from __future__ import annotations
import json, pathlib, sys

SP = pathlib.Path(__file__).parent
data = json.loads((SP / "figs.json").read_text(encoding="utf-8"))
F, T = data["figs"], data["tables"]


def figure(key, title, why, how, skip):
    return f"""
      <figure class="viz">
        <figcaption>
          <h3>{title}</h3>
        </figcaption>
        <div class="viz-root">{F[key]}</div>
        <div class="viz-notes">
          <div><span class="nk">為什麼是這個圖形</span>{why}</div>
          <div><span class="nk">怎麼讀</span>{how}</div>
          <div><span class="nk">何時不畫</span>{skip}</div>
        </div>
        <details class="viz-table">
          <summary>表格檢視（每個值都可讀,不靠顏色或 hover）</summary>
          <div class="table-wrap">{T[key]}</div>
        </details>
      </figure>"""


CSS = """
    :root {
      --bg: #f5f7fb; --surface: #ffffff; --surface-soft: #f0f5ff;
      --text: #182033; --muted: #5e687d; --line: #d9e0ec;
      --blue: #1d5fd1; --blue-soft: #e8f0ff;
      --green: #087f5b; --green-soft: #e6f7f0;
      --amber: #a15c00; --amber-soft: #fff3da;
      --red: #b42318; --red-soft: #ffebe9;
      --purple: #6f42c1; --purple-soft: #f1eaff;
      --shadow: 0 12px 34px rgba(24, 32, 51, 0.08);
      --radius: 16px;
      --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      --sans: Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #101521; --surface: #171e2d; --surface-soft: #1c2942;
        --text: #edf2ff; --muted: #aeb9ce; --line: #344057;
        --blue: #79a8ff; --blue-soft: #1a315a;
        --green: #72d6b0; --green-soft: #173a32;
        --amber: #ffc66d; --amber-soft: #45331c;
        --red: #ff938a; --red-soft: #4a2526;
        --purple: #c5a4ff; --purple-soft: #33264a;
        --shadow: none;
      }
    }

    /* ---- chart palette: validated against this document's own surfaces ----
       node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light
         --surface "#ffffff" --pairs all   -> ALL CHECKS PASS
         (WARN: aqua 2.82:1 on white -> relief = every segment direct-labelled)
       node scripts/validate_palette.js "#3987e5,#d95926,#199e70" --mode dark
         --surface "#171e2d" --pairs all   -> ALL CHECKS PASS                */
    .viz-root {
      --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a;
      --series-1-dim: #86b6ef;
      --ink: #0b0b0b; --ink-2: #52514e; --ink-muted: #898781;
      --gridline: #e1e0d9; --baseline: #c3c2b7; --band-fill: #f0efec;
    }
    @media (prefers-color-scheme: dark) {
      :root:where(:not([data-theme="light"])) .viz-root {
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
    .viz-root .ref { stroke: var(--ink-muted); stroke-width: 1.5; }
    .viz-root .band { fill: var(--band-fill); }
    .viz-root .tick { fill: var(--ink-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    .viz-root .lbl { fill: var(--ink-2); font-size: 12px; }
    .viz-root .lbl-strong { fill: var(--ink); font-size: 12px; font-weight: 700; }
    .viz-root .val { fill: var(--ink); font-size: 12.5px; font-weight: 700; }
    .viz-root .seg-val { fill: #ffffff; font-size: 12px; font-weight: 700; }
    .viz-root .mk-weak { fill: var(--series-1); }
    .viz-root .mk-ok { fill: var(--series-1-dim); }
    .viz-root .mk-neutral { fill: var(--series-1); }
    .viz-root .seg1 { fill: var(--series-1); }
    .viz-root .seg2 { fill: var(--series-2); }
    .viz-root .seg3 { fill: var(--series-3); }
    .viz-root .iso { fill: none; stroke: var(--gridline); stroke-width: 1.5; }
    .viz-root .iso-lbl { fill: var(--ink-muted); font-size: 10.5px; }
    .viz-root .dot-hist { fill: var(--ink-muted); opacity: 0.55; stroke: var(--surface); stroke-width: 2; }
    .viz-root .dot-base { fill: var(--series-3); stroke: var(--surface); stroke-width: 2; }
    .viz-root .dot-cur { fill: var(--series-1); stroke: var(--surface); stroke-width: 2; }
    .viz-root .dot-line { fill: var(--series-1); stroke: var(--surface); stroke-width: 2; }
    .viz-root .shift { stroke: var(--ink-muted); stroke-width: 1.5; }
    .viz-root .line1 { fill: none; stroke: var(--series-1); stroke-width: 2; stroke-linejoin: round; }
    .viz-root .fit-cur { stroke: var(--series-1); stroke-width: 2; }
    .viz-root .fit-base { stroke: var(--series-3); stroke-width: 2; }
    .viz-root .readout { fill: var(--band-fill); }
    .viz-root circle, .viz-root path, .viz-root line { }
    .viz-root [role="img"] :is(circle, path, rect, line):hover { filter: brightness(1.08); }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0; color: var(--text);
      background: radial-gradient(circle at 90% 0%, color-mix(in srgb, var(--blue) 11%, transparent), transparent 34rem), var(--bg);
      font-family: var(--sans); line-height: 1.7;
    }
    a { color: var(--blue); text-underline-offset: 3px; }
    code { padding: 0.12rem 0.35rem; border-radius: 5px; background: var(--surface-soft); font-family: var(--mono); font-size: 0.9em; }
    .shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 62px 0 34px; }
    .eyebrow { margin: 0 0 10px; color: var(--blue); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    h1 { margin: 0; max-width: 900px; font-size: clamp(2rem, 5vw, 4.2rem); line-height: 1.08; }
    .lede { max-width: 850px; margin: 20px 0 0; color: var(--muted); font-size: 1.12rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .pill { display: inline-flex; align-items: center; min-height: 30px; padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--muted); font-size: 0.8rem; font-weight: 700; }
    .pill.draft { border-color: color-mix(in srgb, var(--amber) 40%, var(--line)); background: var(--amber-soft); color: var(--amber); }
    .pill.demo { border-color: color-mix(in srgb, var(--red) 40%, var(--line)); background: var(--red-soft); color: var(--red); }
    nav { position: sticky; top: 0; z-index: 10; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(12px); }
    nav .shell { display: flex; gap: 22px; overflow-x: auto; padding-top: 11px; padding-bottom: 11px; }
    nav a { flex: 0 0 auto; color: var(--muted); font-size: 0.86rem; font-weight: 750; text-decoration: none; }
    nav a:hover { color: var(--blue); }
    main { padding: 34px 0 72px; }
    section { scroll-margin-top: 68px; margin-top: 54px; }
    h2 { margin: 0 0 10px; font-size: clamp(1.45rem, 2.5vw, 2.15rem); line-height: 1.25; }
    h3 { margin: 28px 0 10px; font-size: 1.12rem; }
    p { margin: 10px 0; }
    .section-intro { max-width: 880px; color: var(--muted); }
    .callout { margin: 20px 0; padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--blue) 30%, var(--line)); border-left: 5px solid var(--blue); border-radius: 12px; background: var(--blue-soft); }
    .callout.warning { border-color: color-mix(in srgb, var(--amber) 35%, var(--line)); border-left-color: var(--amber); background: var(--amber-soft); }
    .callout.danger { border-color: color-mix(in srgb, var(--red) 35%, var(--line)); border-left-color: var(--red); background: var(--red-soft); }
    .callout.good { border-color: color-mix(in srgb, var(--green) 35%, var(--line)); border-left-color: var(--green); background: var(--green-soft); }
    .callout strong { display: block; margin-bottom: 3px; }
    .table-wrap { margin: 16px 0; overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: var(--surface-soft); color: var(--muted); font-size: 0.76rem; letter-spacing: 0.04em; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    td:first-child { font-weight: 700; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 800; white-space: nowrap; }
    .tag.new { background: var(--green-soft); color: var(--green); }
    .tag.keep { background: var(--blue-soft); color: var(--blue); }
    .tag.gap { background: var(--amber-soft); color: var(--amber); }
    .tag.no { background: var(--red-soft); color: var(--red); }
    figure.viz { margin: 28px 0; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
    figure.viz figcaption { margin: 0 0 6px; }
    figure.viz figcaption h3 { margin: 0 0 14px; font-size: 1.06rem; }
    .viz-notes { display: grid; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 0.88rem; color: var(--muted); }
    .viz-notes .nk { display: inline-block; min-width: 118px; color: var(--text); font-weight: 800; }
    .viz-table { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
    .viz-table > summary { cursor: pointer; padding: 11px 14px; font-size: 0.86rem; font-weight: 750; }
    .viz-table > div { padding: 0 12px 8px; }
    .viz-table .table-wrap { margin: 0 0 8px; }
    ol.steps { counter-reset: s; list-style: none; padding-left: 0; }
    ol.steps > li { position: relative; margin: 12px 0; padding-left: 46px; }
    ol.steps > li::before { counter-increment: s; content: counter(s); position: absolute; left: 0; top: 2px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--blue-soft); color: var(--blue); font-family: var(--mono); font-size: 0.82rem; font-weight: 800; }
    details.plain { margin: 14px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
    details.plain > summary { cursor: pointer; padding: 14px 16px; font-weight: 800; }
    details.plain > div { padding: 0 16px 16px; color: var(--muted); }
    ul, ol { padding-left: 1.3rem; }
    li + li { margin-top: 6px; }
    .source-list { padding-left: 1.2rem; color: var(--muted); font-size: 0.9rem; }
    footer { padding: 26px 0 52px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.84rem; }
    @media (max-width: 820px) { .viz-notes .nk { min-width: 0; display: block; } }
    @media print {
      :root { color-scheme: light; }
      body { background: #fff; color: #111; }
      nav { display: none; }
      header { padding-top: 24px; }
      figure.viz, .table-wrap, details { box-shadow: none; break-inside: avoid; }
      a { color: #111; text-decoration: none; }
      section { margin-top: 30px; }
      .viz-table[open] > div { display: block; }
    }
"""

BODY = f"""
  <header class="shell">
    <p class="eyebrow">Coach proposal · metrics &amp; visualisation</p>
    <h1>Spider Shot v3<br>教練視角的指標與圖示提案</h1>
    <p class="lede">
      我作為表現教練要的不是十二個指標,是<strong>五個問題的答案</strong>。這份提案把 v3 已經在算的東西
      重新組織成教練能當場用的判斷,補三個現在沒有但必須有的量,並把它們畫成七張圖 —— 每張圖只回答一個問題。
    </p>
    <div class="meta">
      <span class="pill draft">教練提案</span>
      <span class="pill">版本 0.1</span>
      <span class="pill">2026-09-09</span>
      <span class="pill">適用：spider-shot-v3</span>
      <span class="pill demo">圖表數字為示例，非真人量測</span>
    </div>
  </header>

  <nav aria-label="文件導覽">
    <div class="shell">
      <a href="#questions">五個問題</a>
      <a href="#metrics">指標設計</a>
      <a href="#charts">七張圖</a>
      <a href="#story">一場的完整判讀</a>
      <a href="#layout">版面</a>
      <a href="#discipline">教練紀律</a>
      <a href="#gaps">工程缺口</a>
      <a href="#refs">參考</a>
    </div>
  </nav>

  <main class="shell">
    <div class="callout danger">
      <strong>先講清楚:本文件所有數字都是示例</strong>
      七張圖裡的每一個值都是為了說明「圖該長什麼樣、該怎麼讀」而編的,<strong>不是真人量測結果</strong>。
      而且依專案的 C-D3 紅線,這些指標<strong>目前一個都沒有信度證據</strong>,所以本提案是「等資料到了要怎麼看」的設計,
      不是可以拿去給選手下處方的報告。
    </div>

    <section id="questions">
      <h2>1. 教練的五個問題</h2>
      <p class="section-intro">
        測驗跑完,選手站在旁邊等我說話。我腦子裡跑的不是指標清單,是這五個問題 —— 而且有先後順序:
        <strong>前一個沒答完,後一個沒有意義</strong>。
      </p>

      <div class="table-wrap">
        <table>
          <thead><tr><th>順位</th><th>問題</th><th>不答會怎樣</th><th>現有指標夠嗎</th></tr></thead>
          <tbody>
            <tr>
              <td>Q1</td>
              <td>這場<strong>有沒有真的</strong>比上一場好?</td>
              <td>把雜訊當進步,或把策略改變當能力衰退 —— 這是量化訓練最常見、也最貴的錯誤</td>
              <td><span class="tag no">不夠</span>hits/min 與首發率是兩個數字,教練無法判斷是「同時變好」還是「拿準確率換速度」</td>
            </tr>
            <tr>
              <td>Q2</td>
              <td>時間<strong>花在哪</strong>?</td>
              <td>只知道「慢了 40 ms」卻不知道慢在起手、揮動還是開火猶豫,處方會亂開</td>
              <td><span class="tag gap">素材有,沒組裝</span><code>phase-v1</code> 的 REC／MR／V 已在 TS 落地,但沒有教練面呈現</td>
            </tr>
            <tr>
              <td>Q3</td>
              <td><strong>哪裡</strong>弱?</td>
              <td>練錯方向。全場平均掩蓋了「只有大幅度右側崩」這種集中型弱點</td>
              <td><span class="tag no">不夠</span>12 格矩陣單場每格 n≈3,那個數字不能下結論</td>
            </tr>
            <tr>
              <td>Q4</td>
              <td><strong>穩不穩</strong>?</td>
              <td>比賽輸的是尾巴,不是中位數。中位數漂亮但偶發大失誤的選手,教練必須看得到</td>
              <td><span class="tag no">不夠</span>五個趨勢指標全部是中位數,分布尾端完全不呈現</td>
            </tr>
            <tr>
              <td>Q5</td>
              <td>難度上去<strong>會不會崩</strong>?</td>
              <td>不知道選手是「起手慢」還是「幅度一大就失控」,而這兩件事的訓練完全不同</td>
              <td><span class="tag gap">素材有,沒組裝</span>v3 的 10–25° × 12 格剛好給乾淨的難度變異,但沒有迴歸層</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="callout">
        <strong>為什麼 Q1 一定要排第一</strong>
        如果 Q1 的答案是「沒有偵測到真實變化」,那 Q2–Q5 就只是<strong>描述這一場</strong>,不能用來宣告趨勢。
        教練最容易犯的錯就是跳過 Q1 直接講 Q3:「你右側變弱了」—— 而那個差異其實在雜訊裡。
      </div>
    </section>

    <section id="metrics">
      <h2>2. 指標設計</h2>
      <p class="section-intro">
        我不新增任何幾何、不改協定。三個新提案全部可以由<strong>既有匯出欄位</strong>算出來;
        另外三個是把既有研究量搬到教練面。
      </p>

      <h3>M1 · 首發有效速度<span class="tag new" style="margin-left:10px">新複合主指標</span></h3>
      <p>
        現行主指標 <code>peripheral-hits-per-minute</code> 有一個教練層面的漏洞:
        <strong>它接受補槍</strong>。首發打歪、第二第三發修回來命中,一樣計一次 hit。
        於是一個把節奏推快、靠補槍收尾的選手,主指標會上升 —— 而他的實際交戰能力可能下降了。
      </p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>量</th><th>定義</th><th>能不能被補槍灌水</th></tr></thead>
          <tbody>
            <tr><td>總命中速度（現行主指標）</td><td><code>60000 × 全部周邊命中數 / 有效時長</code></td><td><span class="tag no">會</span></td></tr>
            <tr><td><strong>首發有效速度（M1）</strong></td><td><code>60000 × 首發即命中的周邊呈現數 / 有效時長</code></td><td><span class="tag new">不會</span></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        M1 把速度與準確率<strong>合成一個數</strong>:它等於「周邊呈現速率 × 首發命中率」。
        兩者任一下降它就下降,所以<strong>它上升時是無爭議的進步</strong>。
        而「總命中速度上升、M1 沒動」正是補槍依賴上升的指紋 —— 這是現行五個指標看不出來的事。
      </p>
      <p>
        <strong>實作成本極低</strong>:首發即命中的計數已經在歷史 projector 裡算過（它就是首發命中率的分子）,
        分母也已經有。M1 只是換一個分母,不需要任何新推導。
      </p>

      <h3>M2 · 最小可偵測變化帶（MDC band）<span class="tag new" style="margin-left:10px">新呈現規則</span></h3>
      <p>
        任何「↑ +2.1」都必須畫在<strong>個人雜訊帶</strong>上,否則教練會對雜訊下處方。
        帶寬來自 test–retest 的 SEM:<code>MDC = 1.96 × √2 × SEM</code>。
      </p>
      <div class="callout warning">
        <strong>在 pilot 完成前的臨時做法(必須標註)</strong>
        真正的 MDC 需要多日重測才有。在那之前,用<strong>個人近 n 場相容 run 的 IQR</strong> 當臨時帶,
        並在圖上明寫「臨時雜訊帶,非 MDC」。這比不畫帶好,但<strong>不可以叫它 MDC</strong>。
      </div>

      <h3>M3 · 邊際軸取代 12 格矩陣（單場）<span class="tag new" style="margin-left:10px">新分析規則</span></h3>
      <p>
        v3 的 4 方位 × 3 幅度 = 12 格是<strong>spawn 平衡</strong>的設計,不是為了分析而切的。
        一場 60 秒約 34–40 個周邊呈現,平均下去<strong>每格 n≈3</strong>。n=3 的首發命中率只有 0%／33%／67%／100% 四個可能值 —— 那不是量測,是骰子。
      </p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>檢視</th><th>每箱 n（單場 ~36 呈現）</th><th>可否下教練結論</th></tr></thead>
          <tbody>
            <tr><td>12 格交叉</td><td>≈ 3</td><td><span class="tag no">不可</span>單場只能列數字,不上色、不做判斷</td></tr>
            <tr><td><strong>方位邊際軸（4 箱）</strong></td><td>≈ 9</td><td><span class="tag new">可</span>達 n ≥ 8 門檻</td></tr>
            <tr><td><strong>幅度邊際軸（3 tier）</strong></td><td>≈ 12</td><td><span class="tag new">可</span></td></tr>
            <tr><td>12 格交叉（跨 3–5 場 pooled）</td><td>≈ 10–15</td><td><span class="tag keep">可</span>這才是 12 格該出場的時機</td></tr>
          </tbody>
        </table>
      </div>

      <h3>沿用既有研究量,搬到教練面</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>量</th><th>來源</th><th>教練翻譯</th></tr></thead>
          <tbody>
            <tr><td>REC／MR／V 時間預算</td><td><code>phase-v1</code>（TS 已有）</td><td>REC 長 = 起手慢;MR 長 = 揮得慢;<strong>V 長 = 不敢開槍</strong></td></tr>
            <tr><td>尾端倍率 p95 ÷ p50</td><td>既有分布,只是沒呈現</td><td>越接近 1 越穩。倍率 &gt; 3 = 偶發大失誤,比中位數更該練</td></tr>
            <tr><td>Fitts 截距與斜率</td><td>命中時間 vs ID 迴歸</td><td><strong>截距 = 固定開銷</strong>（起手＋確認）;<strong>斜率 = 每 bit 難度代價</strong>（大幅度控制）</td></tr>
          </tbody>
        </table>
      </div>
      <div class="callout danger">
        <strong>相位診斷有硬前提</strong>
        REC／MR／V 只能在 <code>meta.displayHz ≥ 144</code> 的 run 上做。60 Hz 顯示會讓逐 tick 角速度呈高／零交替,
        而 <code>t_detect</code> 這條路徑在那種資料上是 <strong>0/113 全滅</strong>（KI-031）。
        <code>phase-v1</code> 的 REC 走的是 <code>seg-v2</code> 而非 <code>t_detect</code>,所以<strong>不共用同一個失效機制</strong> ——
        但它對低取樣率的免疫性<strong>沒有人量過</strong>,不可假設。
      </div>
    </section>

    <section id="charts">
      <h2>3. 七張圖</h2>
      <p class="section-intro">
        一張圖回答一個問題。每張都附「為什麼是這個圖形／怎麼讀／何時不畫」,
        以及一份表格檢視 —— 因為顏色不可以是唯一的資訊通道。
      </p>
{figure('c1',
        'C1 · 這場有沒有真的變好?（首發有效速度 vs 雜訊帶）',
        '主結論是<strong>一個數</strong>,所以它不該是圖表,而是一支帶雜訊帶的量尺。單一序列因此不需要圖例。',
        '橫棒是本場相對個人基準的差異。<strong>只要棒子沒有伸出灰帶,答案就是「未偵測到真實變化」</strong> —— 不是「微幅下降」。',
        '相容 run 少於 3 場（沒有基準）、或本場未通過 quality gate 時整張不畫,改顯示「建立基準中 n/3」。')}
{figure('c2',
        'C2 · 是策略改變還是能力改變?（速度—準確率工作點）',
        '兩個量的<strong>關係</strong>要用散布圖。背景灰線是等首發有效速度曲線 —— 沿著線移動 = 策略位移,跨過線 = 真實變化。',
        '本場（藍）相對基準（綠）往右下移動:呈現速率推快了,首發命中率掉了,<strong>但幾乎停在同一條等值線上</strong>。'
        '這是拿準確率換速度,不是能力變化。連線的<strong>方向</strong>比位置更重要。',
        '同樣需要至少 3 場相容 run。低於 3 場只畫本場一點,不畫基準重心與位移連線。')}
{figure('c3',
        'C3 · 時間花在哪?（REC / MR / V 時間預算）',
        '一段時間的組成 = 堆疊橫棒,三段遠低於 6 段上限。每段直接標值(淺色主題下 aqua 對白底 2.82:1,直接標籤是必要的補償)。',
        '本場 MR 比基準<strong>快 22 ms</strong>,但 V <strong>慢 22 ms</strong> —— 揮動省下的時間全部還回給開火前的猶豫,'
        '合計只差 4 ms。這正好解釋 C2 的策略位移是<strong>怎麼</strong>發生的。',
        '<code>meta.displayHz &lt; 144</code>、或該場 <code>seg-v2</code> 的 <code>no_peak</code>／<code>below_floor</code> 旗標比例過高時不畫。')}
{figure('c4',
        'C4 · 哪裡弱?（兩條邊際軸,不是 12 格）',
        '類別對量值 = 橫條。<strong>用強調而非顏色分級</strong>:最弱的一箱上實色,其餘退為淡色,並一律直接標值與 n。',
        '弱點<strong>同時</strong>集中在方位「右」（55.6%）與幅度「20–25°」（50.0%),而且幅度呈單調下降 —— '
        '這兩條軸交會的地方就是訓練標的。',
        '任一箱 n &lt; 8 時該箱只顯示數字、不上色、不進結論句。12 格交叉必須 pooled 後才畫。')}
{figure('c5',
        'C5 · 穩不穩?（尾端倍率）',
        '三個指標單位不同,<strong>絕不可以放在同一條軸上</strong>。改用無單位的 p95 ÷ p50 倍率,一條軸解決;原始值放在標籤與表格。',
        '進靶後逸出的尾端是中位數的 <strong>4.58 倍</strong> —— 中位數 0.31° 看起來很穩,但偶發會衝到 1.42°。'
        '這種選手在賽場上會突然「打歪一發」,而中位數完全看不出來。',
        '有效樣本 &lt; 10 時不畫 p95（一個極端值就會主導）。')}
{figure('c6',
        'C6 · 這場是怎麼跑完的?（場內時間歷程）',
        '隨時間變化 = 折線。滾動窗讓趨勢可讀而不需要在每個點上標數字。',
        '<strong>U 形是兩件不同的事</strong>:起段慢 67 ms = 暖身不足（改暖身流程）;末段慢 50 ms = 60 秒內衰退（改組間休息或場次長度）。'
        '把它們平均成一個中位數 478 ms,兩個處方都會消失。',
        '呈現數 &lt; 24 時滾動窗沒有意義,改畫前／後半兩個箱。')}
{figure('c7',
        'C7 · 難度上去會不會崩?（Fitts 難度縮放）',
        '關係 + 擬合 = 散布圖加迴歸線。兩條線都直接標名,不靠顏色分辨。',
        '本場斜率幾乎沒變（102 vs 98 ms/bit）,但<strong>截距高了 30 ms</strong>。'
        '意思是:大幅度控制沒有退步,退的是<strong>固定開銷</strong> —— 和 C3 的 V 相位 +22 ms 完全對上。',
        '少於 3 個幅度 tier 有效樣本、或 D 的變異範圍過窄時不擬合（斜率會不穩定）。')}
    </section>

    <section id="story">
      <h2>4. 一場的完整判讀</h2>
      <p class="section-intro">
        七張圖不是七個結論,是<strong>一個</strong>結論的七個證據。這是我會對選手說的話。
      </p>

      <div class="callout good">
        <strong>本場結論:你把節奏推快了,但那不是進步,是換算</strong>
        <p style="margin-top:8px">
          首發有效速度 25.1,和你近 6 場的 25.7 差 0.6 —— <strong>在雜訊帶內,沒有真實變化</strong>（C1）。
          總命中速度確實上升了,但那是靠補槍收尾:你的呈現速率從 32 推到 38,首發命中率從 76% 掉到 66%,
          幾乎正好沿著同一條等值線移動（C2）。
        </p>
        <p>
          時間預算說明了機制:你的主揮動<strong>真的變快了 22 ms</strong>,但開火前的確認<strong>變慢了 22 ms</strong>（C3）。
          Fitts 線交叉驗證同一件事 —— 斜率沒動,截距 +30 ms（C7）。所以問題不在「揮不到」,在「到了不敢開」。
        </p>
        <p>
          弱點位置很集中:右側 55.6%、20–25° 大幅度 50.0%,幅度呈單調下降（C4）。
          而且你的進靶後逸出尾端是中位數的 4.58 倍（C5）—— 偶發會衝過頭很多。
          場內歷程是 U 形:起段慢 67 ms、末段慢 50 ms（C6）。
        </p>
        <p style="margin-bottom:0">
          <strong>下一輪只做一件事:大幅度右側,準星第一次進靶就停手,不要用第二次加速去補。</strong>
          維持你現在的揮動速度 —— 那部分是真的進步了。
        </p>
      </div>

      <div class="callout warning">
        <strong>注意我沒有說的話</strong>
        我沒有說「你退步了」（C1 說沒有真實變化）、沒有說「你右側能力差」（單場 n=9,只夠說這一場的觀察）、
        也沒有把暖身與疲勞混成「專注力不足」。<strong>沒有絕對門檻,所以我全程只跟他自己比。</strong>
      </div>
    </section>

    <section id="layout">
      <h2>5. 一頁式版面</h2>
      <p class="section-intro">
        既有的 <a href="spider-shot-v2-result-layout-mockup-2026-08-31.html">v2 result layout mockup</a>
        已經確立了 coach-first、analyst-expandable 的版面原則,本提案<strong>不重做版面</strong>,只改順序與內容。
      </p>
      <ol class="steps">
        <li><strong>資料效度先行</strong> —— quality gate、<code>displayHz</code>、有效呈現數。不合格就停用所有診斷,這一條不可換位。</li>
        <li><strong>C1 有沒有真的變好</strong> —— 一個數 + 雜訊帶。這是選手唯一會記住的東西。</li>
        <li><strong>C2 策略還是能力</strong> —— 緊接 C1,因為它決定 C1 的「沒變化」要怎麼解釋。</li>
        <li><strong>本場結論（文字）</strong> —— 一句話 + 三個證據標籤。不放在最後,放在圖之前。</li>
        <li><strong>C3 時間預算 → C7 難度縮放</strong> —— 機制層。兩張互為交叉驗證,應相鄰。</li>
        <li><strong>C4 弱點軸 → C5 尾端 → C6 場內歷程</strong> —— 定位層。</li>
        <li><strong>一個訓練 cue</strong> —— 預設只給一個。完整分析可展開。</li>
        <li><strong>研究指標與方法限制</strong> —— 摺疊。SPARC／LDJ-V 只在 Python 側,不進教練面板。</li>
      </ol>
      <div class="callout">
        <strong>為什麼把結論放在圖之前</strong>
        選手不是分析師。把七張圖攤在前面再下結論,他會在第三張圖就停止閱讀,然後自己編一個結論。
        先給判斷、再給證據,是教練溝通的順序,不是分析的順序。
      </div>
    </section>

    <section id="discipline">
      <h2>6. 教練紀律</h2>
      <p class="section-intro">這八條是我自己的紀律,不是工程約束。違反任何一條,量化訓練會比不量化更糟。</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>紀律</th><th>違反的後果</th></tr></thead>
          <tbody>
            <tr><td>1</td><td><strong>只跟自己比。</strong>沒有絕對門檻</td><td>v3 的 2.0° 與 10–25° 都未經真人校準,任何「及格線」都是編的</td></tr>
            <tr><td>2</td><td><strong>雜訊帶內 = 未偵測到變化</strong>,不是「微幅下降」</td><td>對雜訊開處方,選手會為了追一個隨機數字改掉正確的動作</td></tr>
            <tr><td>3</td><td><strong>n &lt; 8 不下結論。</strong>只列數字,不上色</td><td>n=3 的命中率只有四個可能值,那是骰子不是量測</td></tr>
            <tr><td>4</td><td><strong>一次只給一個 cue</strong></td><td>feedback overload;給三個等於沒給</td></tr>
            <tr><td>5</td><td><strong>資料可疑 → 診斷全停</strong></td><td>保留畫面是為了排查,不是為了照樣講話</td></tr>
            <tr><td>6</td><td><strong>同一 drill 的多輪不是獨立取樣</strong></td><td>同 <code>drillId</code> 的 spawn 序列逐位相同,重複會混入序列熟悉效應</td></tr>
            <tr><td>7</td><td><strong>不把研究指標翻譯成「手感」</strong></td><td>SPARC／LDJ-V 受處理流程影響極大,絕對值不可跨版本比較</td></tr>
            <tr><td>8</td><td><strong>&lt; 144 Hz 的 run 不做相位診斷</strong></td><td>KI-031:低取樣率會讓相位量靜默消失或失真</td></tr>
          </tbody>
        </table>
      </div>
      <div class="callout danger">
        <strong>最後一道閘</strong>
        依 C-D3,未通過構念驗證的指標不得進教練報告。本提案的每一個量<strong>目前都還沒有信度證據</strong>。
        所以這份文件的正確用法是:<strong>先照它去收資料與跑 pilot,不是先照它去指導選手。</strong>
      </div>
    </section>

    <section id="gaps">
      <h2>7. 工程缺口</h2>
      <p class="section-intro">要畫出這七張圖,需要補的東西。我刻意讓每一項都不碰協定、不新增幾何。</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>缺口</th><th>要做什麼</th><th>成本</th></tr></thead>
          <tbody>
            <tr><td>M1 首發有效速度</td><td>新增一個 registry descriptor;分子分母都已在 projector 內算過,只換分母</td><td><span class="tag new">低</span></td></tr>
            <tr><td>MDC 帶</td><td>需要 test–retest pilot 才有真數字。之前用個人 IQR 當臨時帶並明確標註</td><td><span class="tag gap">卡資料,不卡工程</span></td></tr>
            <tr><td>REC／MR／V 教練面呈現</td><td><code>computePhaseMetrics()</code> 已回傳逐呈現樣本;要做的是聚合成中位數並與基準對差</td><td><span class="tag new">低</span></td></tr>
            <tr><td>邊際軸 + n-gate</td><td>分析層規則:依 <code>quadrant</code>／radius tier 分組,n &lt; 8 降級顯示。無新幾何</td><td><span class="tag new">低</span></td></tr>
            <tr><td>尾端倍率</td><td>把既有 p50 之外的 p95 一起輸出。<code>trackingDerivation</code> 已有 <code>p95EpsilonDeg</code> 的先例</td><td><span class="tag new">低</span></td></tr>
            <tr><td>場內滾動中位數</td><td>逐呈現的命中時間已有;只需滾動窗聚合</td><td><span class="tag new">低</span></td></tr>
            <tr><td>Fitts 迴歸（截距／斜率）</td><td><code>D_deg</code> 與命中時間都已有;需要一個最小平方擬合與 CI</td><td><span class="tag keep">中</span></td></tr>
            <tr><td>相位量的取樣率免疫性</td><td><strong>必須先驗證</strong>:同一份 60 Hz 資料上 <code>phase-v1</code> 是否仍有值</td><td><span class="tag gap">阻塞 C3</span></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        八項裡有六項是「聚合與呈現」,不是新演算法。真正的阻塞只有兩個:<strong>MDC 需要真人重測資料</strong>,
        以及 <strong>相位量在低刷新率下的行為必須先量過</strong>。
      </p>
    </section>

    <section id="refs">
      <h2>8. 參考</h2>
      <h3>同一系列文件</h3>
      <ul class="source-list">
        <li><a href="spider-shot-v3-measurement-parameters-2026-09-09.html">Spider Shot v3 量測參數與意涵</a> —— 每個參數的精確運算定義</li>
        <li><a href="spider-shot-v3-performance-metrics-design-2026-09-09.html">Spider Shot v3 選手表現量化設計</a> —— 研究設計、機制指標裁決、驗證計畫</li>
        <li><a href="spider-shot-v2-result-layout-mockup-2026-08-31.html">Spider Shot v2 Coach-first Result（互動 mockup）</a> —— 本提案沿用其版面原則</li>
        <li><a href="spider-shot-v2-performance-metrics-design-2026-08-27.html">Spider Shot v2 選手表現量化設計</a> —— 三層模型與教練矩陣的起點</li>
      </ul>
      <h3>契約與已知問題</h3>
      <ul class="source-list">
        <li><code>docs/operational/analysis-spider-shot.md</code> · <code>analysis-phase-curves.md</code> · <code>analysis-segments.md</code></li>
        <li><code>docs/known_issue/KI-031-*.md</code> —— 紀律 #8 與 C3 前提的來源</li>
        <li><code>docs/exec-plan/active/stage14/README.md</code> —— 三層契約暫時方案</li>
      </ul>
      <h3>圖表設計</h3>
      <ul class="source-list">
        <li>類別調色盤取自已驗證的預設盤,並以<strong>本文件實際的 surface</strong>（淺 <code>#ffffff</code>／深 <code>#171e2d</code>）重跑六項檢查,
          light／dark 兩模式在 all-pairs pairlist 下全數 PASS。淺色主題的 aqua 對比 2.82:1 觸發 relief 規則 ⇒ 所有堆疊段一律直接標值。</li>
        <li>每張圖都有表格檢視與原生 hover 提示,顏色從不是唯一的資訊通道。</li>
      </ul>
      <h3>外部理論</h3>
      <ul class="source-list">
        <li>Fitts, P. M. (1954). The information capacity of the human motor system in controlling the amplitude of movement.</li>
        <li>Meyer, D. E., Abrams, R. A., Kornblum, S., Wright, C. E., &amp; Smith, J. E. K. (1988). Optimality in human motor performance.</li>
        <li>Weir, J. P. (2005). Quantifying test-retest reliability using the intraclass correlation coefficient and the SEM.（MDC 的來源公式）</li>
      </ul>
    </section>
  </main>

  <footer class="shell">
    <p>
      文件狀態:<strong>教練提案草案</strong>。七張圖的數字全為示例,不是真人量測結果。
      依 C-D3,本提案所列指標在通過構念驗證前不得作為訓練處方依據。
    </p>
    <p>最後更新:2026-09-09 · 適用協定:<code>spider-shot-v3@1.0.0</code></p>
  </footer>
"""

HTML = f"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Spider Shot v3 教練視角的指標與圖示提案</title>
  <style>{CSS}  </style>
</head>
<body>
{BODY}
</body>
</html>
"""

out = pathlib.Path(sys.argv[1])
out.write_text(HTML, encoding="utf-8")
print("wrote", out, len(HTML), "chars")
