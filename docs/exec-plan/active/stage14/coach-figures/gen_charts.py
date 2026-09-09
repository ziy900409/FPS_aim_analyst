"""Emit the SVG figures for the spider-shot-v3 coach proposal.

Geometry is computed, never eyeballed. Each figure returns an SVG string sized to
include its axis band (so no nested scrollbars), with native <title> hover, direct
labels, and a matching table emitted separately.
"""
from __future__ import annotations

# ---------------------------------------------------------------- helpers

def sc(v, d0, d1, r0, r1):
    """Linear scale."""
    if d1 == d0:
        return r0
    return r0 + (v - d0) * (r1 - r0) / (d1 - d0)


def fmt(x, nd=1):
    s = f"{x:.{nd}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def hbar(x0, y, w, h, r=4):
    """Horizontal bar path: square at the baseline (x0), rounded at the value end."""
    if w <= 0.5:
        return f'M{x0:.1f},{y:.1f} h0.5 v{h:.1f} h-0.5 Z'
    r = min(r, w, h / 2)
    x1 = x0 + w
    return (f'M{x0:.1f},{y:.1f} H{x1 - r:.1f} A{r:.1f},{r:.1f} 0 0 1 {x1:.1f},{y + r:.1f} '
            f'V{y + h - r:.1f} A{r:.1f},{r:.1f} 0 0 1 {x1 - r:.1f},{y + h:.1f} H{x0:.1f} Z')


def hbar_left(x_base, y, w, h, r=4):
    """Leftward horizontal bar: square at the baseline (x_base), rounded at the value end."""
    if w <= 0.5:
        return f'M{x_base:.1f},{y:.1f} h-0.5 v{h:.1f} h0.5 Z'
    r = min(r, w, h / 2)
    x1 = x_base - w
    return (f'M{x_base:.1f},{y:.1f} H{x1 + r:.1f} A{r:.1f},{r:.1f} 0 0 0 {x1:.1f},{y + r:.1f} '
            f'V{y + h - r:.1f} A{r:.1f},{r:.1f} 0 0 0 {x1 + r:.1f},{y + h:.1f} H{x_base:.1f} Z')


def vbar(x, y0, w, h, r=4):
    """Vertical bar path: square at the baseline (y0), rounded at the top."""
    if h <= 0.5:
        return f'M{x:.1f},{y0:.1f} v-0.5 h{w:.1f} v0.5 Z'
    r = min(r, h, w / 2)
    y1 = y0 - h
    return (f'M{x:.1f},{y0:.1f} V{y1 + r:.1f} A{r:.1f},{r:.1f} 0 0 1 {x + r:.1f},{y1:.1f} '
            f'H{x + w - r:.1f} A{r:.1f},{r:.1f} 0 0 1 {x + w:.1f},{y1 + r:.1f} '
            f'V{y0:.1f} Z')


def svg_open(w, h, label):
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" '
            f'style="width:100%;height:auto;display:block">')


def txt(x, y, s, cls="lbl", anchor="start", extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{cls}" text-anchor="{anchor}"{extra}>{s}</text>'


def grid_v(x, y0, y1):
    return f'<line x1="{x:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y1:.1f}" class="grid"/>'


def grid_h(y, x0, x1):
    return f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}" class="grid"/>'


FIGS: dict[str, str] = {}
TABLES: dict[str, str] = {}

# ---------------------------------------------------------------- C1  delta vs MDC band
# 首發有效速度: 本場 25.1, 個人基準中位數 25.7, MDC ±2.0
def c1():
    W, H = 680, 132
    x0, x1 = 96, 640
    band = 2.0
    dom = (-4.5, 4.5)
    axis_y = 62
    parts = [svg_open(W, H, "首發有效速度相對個人基準的變化量，與最小可偵測變化帶")]
    # noise band
    bx0 = sc(-band, *dom, x0, x1)
    bx1 = sc(band, *dom, x0, x1)
    parts.append(f'<rect x="{bx0:.1f}" y="{axis_y - 26:.1f}" width="{bx1 - bx0:.1f}" height="52" '
                 f'class="band"><title>雜訊帶 ±2.0（MDC）：帶內的差異不足以宣告變化</title></rect>')
    # zero rule
    zx = sc(0, *dom, x0, x1)
    parts.append(f'<line x1="{zx:.1f}" y1="{axis_y - 30:.1f}" x2="{zx:.1f}" y2="{axis_y + 30:.1f}" class="axis"/>')
    # the delta mark
    d = -0.6
    dx = sc(d, *dom, x0, x1)
    w = abs(dx - zx)
    left = min(dx, zx)
    bar = hbar(zx, axis_y - 9, dx - zx, 18) if dx > zx else hbar_left(zx, axis_y - 9, zx - dx, 18)
    parts.append(f'<path d="{bar}" class="mk-neutral">'
                 f'<title>本場 −0.6 首發有效命中/min（雜訊帶 ±2.0 之內）</title></path>')
    parts.append(txt(x0 - 12, axis_y + 5, "本場 vs 基準", "lbl-strong", "end"))
    parts.append(txt(dx - 8 if d < 0 else dx + 8, axis_y + 5, "−0.6", "val", "end" if d < 0 else "start"))
    # band edge labels + ticks
    for v in (-4, -2, 0, 2, 4):
        tx = sc(v, *dom, x0, x1)
        parts.append(f'<line x1="{tx:.1f}" y1="{axis_y + 30:.1f}" x2="{tx:.1f}" y2="{axis_y + 35:.1f}" class="grid"/>')
        parts.append(txt(tx, axis_y + 48, f"{v:+g}" if v else "0", "tick", "middle"))
    parts.append(txt((bx0 + bx1) / 2, axis_y - 34, "雜訊帶 ±2.0（MDC）", "tick", "middle"))
    parts.append(txt(x1, H - 6, "首發有效命中/min 的差異", "tick", "end"))
    parts.append('</svg>')
    FIGS['c1'] = "\n".join(parts)
    TABLES['c1'] = """<table><thead><tr><th>量</th><th>值</th></tr></thead><tbody>
<tr><td>本場首發有效速度</td><td>25.1 首發有效命中/min</td></tr>
<tr><td>個人基準（近 6 場相容 run 中位數）</td><td>25.7</td></tr>
<tr><td>差異</td><td>−0.6</td></tr>
<tr><td>MDC（最小可偵測變化）</td><td>±2.0</td></tr>
<tr><td>判定</td><td>未偵測到真實變化</td></tr>
</tbody></table>"""


# ---------------------------------------------------------------- C2  SAT operating point
def c2():
    W, H = 680, 400
    x0, x1, y0, y1 = 66, 596, 40, 316
    dx = (28, 41)
    dy = (60, 84)
    hist = [(32, 74.1), (33, 76.8), (34, 75.0), (33, 78.2), (35, 77.4), (35, 76.0)]
    cur = (38, 66.0)
    parts = [svg_open(W, H, "速度—準確率工作點：周邊呈現速率對首發命中率，背景為等首發有效速度曲線")]
    # iso-product curves
    for p in (22, 24, 26, 28):
        pts = []
        v = dx[0]
        while v <= dx[1] + 0.01:
            acc = p / v * 100
            if dy[0] <= acc <= dy[1]:
                pts.append(f"{sc(v, *dx, x0, x1):.1f},{sc(acc, *dy, y1, y0):.1f}")
            v += 0.25
        if len(pts) > 1:
            parts.append(f'<polyline points="{" ".join(pts)}" class="iso"/>')
            vx, vy = (float(t) for t in pts[-1].split(","))
            if y1 - vy < 30:            # curve exits through the bottom edge
                parts.append(txt(vx - 5, vy - 9, f"{p}", "iso-lbl", "end"))
            else:                        # curve exits through the right edge
                parts.append(txt(vx + 6, vy + 4, f"{p}", "iso-lbl"))
    parts.append(txt(x1 + 6, y0 - 14, "等首發", "iso-lbl"))
    parts.append(txt(x1 + 6, y0 - 3, "有效速度", "iso-lbl"))
    # axes
    parts.append(f'<line x1="{x0:.1f}" y1="{y1:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" class="axis"/>')
    for v in range(28, 42, 2):
        tx = sc(v, *dx, x0, x1)
        parts.append(grid_v(tx, y0, y1))
        parts.append(txt(tx, y1 + 20, str(v), "tick", "middle"))
    for a in range(60, 86, 6):
        ty = sc(a, *dy, y1, y0)
        parts.append(grid_h(ty, x0, x1))
        parts.append(txt(x0 - 10, ty + 4, f"{a}%", "tick", "end"))
    # marks
    for i, (v, a) in enumerate(hist):
        cx, cy = sc(v, *dx, x0, x1), sc(a, *dy, y1, y0)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5.5" class="dot-hist">'
                     f'<title>近 6 場 · 呈現速率 {v}/min · 首發命中率 {a}% · 首發有效速度 {v * a / 100:.1f}</title></circle>')
    cx, cy = sc(cur[0], *dx, x0, x1), sc(cur[1], *dy, y1, y0)
    # connector from baseline centroid to current
    mx = sum(h[0] for h in hist) / len(hist)
    my = sum(h[1] for h in hist) / len(hist)
    parts.append(f'<line x1="{sc(mx, *dx, x0, x1):.1f}" y1="{sc(my, *dy, y1, y0):.1f}" '
                 f'x2="{cx:.1f}" y2="{cy:.1f}" class="shift"/>')
    parts.append(f'<circle cx="{sc(mx, *dx, x0, x1):.1f}" cy="{sc(my, *dy, y1, y0):.1f}" r="7" class="dot-base">'
                 f'<title>個人基準重心 · 呈現速率 {mx:.1f}/min · 首發命中率 {my:.1f}%</title></circle>')
    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="7.5" class="dot-cur">'
                 f'<title>本場 · 呈現速率 38/min · 首發命中率 66.0% · 首發有效速度 25.1</title></circle>')
    parts.append(txt(cx - 12, cy + 5, "本場", "lbl-strong", "end"))
    parts.append(txt(sc(mx, *dx, x0, x1) - 11, sc(my, *dy, y1, y0) + 20, "基準", "lbl-strong", "end"))
    parts.append(txt(x0, y1 + 44, "周邊呈現速率（次/min）→ 快", "tick"))
    parts.append(f'<text transform="translate({x0 - 46:.1f},{(y0 + y1) / 2:.1f}) rotate(-90)" class="tick" text-anchor="middle">首發命中率 → 準</text>')
    # legend
    ly = H - 22
    parts.append(f'<circle cx="{x0 + 6:.1f}" cy="{ly - 4:.1f}" r="5.5" class="dot-hist"/>')
    parts.append(txt(x0 + 18, ly, "近 6 場相容 run", "tick"))
    parts.append(f'<circle cx="{x0 + 150:.1f}" cy="{ly - 4:.1f}" r="7" class="dot-base"/>')
    parts.append(txt(x0 + 162, ly, "基準重心", "tick"))
    parts.append(f'<circle cx="{x0 + 250:.1f}" cy="{ly - 4:.1f}" r="7.5" class="dot-cur"/>')
    parts.append(txt(x0 + 263, ly, "本場", "tick"))
    parts.append('</svg>')
    FIGS['c2'] = "\n".join(parts)
    rows = "".join(f"<tr><td>近 6 場 #{i + 1}</td><td>{v}</td><td>{a}%</td><td>{v * a / 100:.1f}</td></tr>"
                   for i, (v, a) in enumerate(hist))
    TABLES['c2'] = ("<table><thead><tr><th>Run</th><th>周邊呈現速率（次/min）</th><th>首發命中率</th>"
                    "<th>首發有效速度</th></tr></thead><tbody>" + rows +
                    "<tr><td><strong>本場</strong></td><td><strong>38</strong></td><td><strong>66.0%</strong></td>"
                    "<td><strong>25.1</strong></td></tr></tbody></table>")


# ---------------------------------------------------------------- C3  REC / MR / V budget
def c3():
    W, H = 680, 250
    x0, x1 = 92, 616
    rows = [("本場", [168, 214, 96], "cur"), ("個人基準", [172, 236, 74], "base")]
    names = ["REC 起手", "MR 主揮動", "V 確認"]
    cls = ["seg1", "seg2", "seg3"]
    total_max = 500
    top = 74
    parts = [svg_open(W, H, "一次周邊 flick 的時間預算：起手、主揮動、確認三段")]
    for v in (0, 100, 200, 300, 400, 500):
        tx = sc(v, 0, total_max, x0, x1)
        parts.append(grid_v(tx, top - 14, 194))
        parts.append(txt(tx, 212, str(v), "tick", "middle"))
    for ri, (label, vals, kind) in enumerate(rows):
        cur = kind == "cur"
        bh = 30 if cur else 14
        y = top if cur else top + 74
        parts.append(txt(x0 - 12, y + bh / 2 + 5, label, "lbl-strong" if cur else "lbl", "end"))
        acc = 0.0
        for si, v in enumerate(vals):
            sx = sc(acc, 0, total_max, x0, x1)
            ex = sc(acc + v, 0, total_max, x0, x1)
            last = si == len(vals) - 1
            w = ex - sx - (0 if last else 2)
            op = '' if cur else ' opacity="0.5"'
            parts.append(f'<path d="{hbar(sx, y, w, bh, 4 if last else 0.01)}" class="{cls[si]}"{op}>'
                         f'<title>{label} · {names[si]} {v} ms</title></path>')
            # value label: inside the thick current bar, below the slim reference bar
            if cur and w > 46:
                parts.append(txt(sx + w / 2, y + bh / 2 + 5, f"{v}", "seg-val", "middle"))
            elif not cur:
                parts.append(txt(sx + w / 2, y + bh + 15, f"{v}", "tick", "middle"))
            acc += v
        tot = sum(vals)
        parts.append(txt(sc(tot, 0, total_max, x0, x1) + 10, y + bh / 2 + 5,
                         f"合計 {tot} ms", "val" if cur else "tick"))
    for i, n in enumerate(names):
        lx = x0 + i * 150
        parts.append(f'<rect x="{lx:.1f}" y="30" width="11" height="11" rx="3" class="{cls[i]}"/>')
        parts.append(txt(lx + 17, 40, n, "tick"))
    parts.append(txt(x1, 240, "毫秒（ms）", "tick", "end"))
    parts.append('</svg>')
    FIGS['c3'] = "\n".join(parts)
    TABLES['c3'] = """<table><thead><tr><th>相位</th><th>本場</th><th>基準</th><th>差異</th><th>教練讀法</th></tr></thead><tbody>
<tr><td>REC 起手</td><td>168 ms</td><td>172 ms</td><td>−4</td><td>沒有變化</td></tr>
<tr><td>MR 主揮動</td><td>214 ms</td><td>236 ms</td><td><strong>−22</strong></td><td>揮動確實變快了</td></tr>
<tr><td>V 確認</td><td>96 ms</td><td>74 ms</td><td><strong>+22</strong></td><td>開火前猶豫變久 —— 把 MR 省下的時間全部還回去</td></tr>
<tr><td>合計</td><td>478 ms</td><td>482 ms</td><td>−4</td><td>總時間幾乎沒動</td></tr>
</tbody></table>"""


# ---------------------------------------------------------------- C4  marginal axes
def c4():
    W, H = 680, 326
    groups = [
        ("依方位（4 分箱）", [("右", 55.6, 9), ("上", 70.0, 10), ("左", 72.7, 11), ("下", 62.5, 8)]),
        ("依角位移幅度（3 tier）", [("10–15°", 78.3, 12), ("15–20°", 66.7, 12), ("20–25°", 50.0, 14)]),
    ]
    parts = [svg_open(W, H, "首發命中率的兩條邊際軸：依方位與依角位移幅度")]
    xa, xb = 300, 640
    dom = (0, 100)
    y = 44
    for gi, (gname, items) in enumerate(groups):
        parts.append(txt(58, y - 14, gname, "lbl-strong"))
        for name, val, n in items:
            bw = sc(val, *dom, xa, xb) - xa
            weak = val == min(i[1] for i in items)
            parts.append(txt(xa - 12, y + 15, name, "lbl", "end"))
            parts.append(f'<path d="{hbar(xa, y, bw, 20)}" class="{"mk-weak" if weak else "mk-ok"}">'
                         f'<title>{name} · 首發命中率 {val}% · n={n}</title></path>')
            parts.append(txt(xa + bw + 10, y + 15, f"{val:.1f}%", "val"))
            parts.append(txt(xa + bw + 62, y + 15, f"n={n}", "tick"))
            y += 30
        y += 26
    for v in (0, 25, 50, 75, 100):
        tx = sc(v, *dom, xa, xb)
        parts.append(grid_v(tx, 30, y - 40))
        parts.append(txt(tx, y - 24, f"{v}%", "tick", "middle"))
    parts.append(txt(58, H - 10, "實色 = 該軸最弱的分箱（訓練標的）。任一箱 n &lt; 8 時不上色、不下結論。", "tick"))
    parts.append('</svg>')
    FIGS['c4'] = "\n".join(parts)
    TABLES['c4'] = """<table><thead><tr><th>分箱</th><th>首發命中率</th><th>n</th><th>是否可下結論</th></tr></thead><tbody>
<tr><td>方位 · 右</td><td>55.6%</td><td>9</td><td>可（n ≥ 8）</td></tr>
<tr><td>方位 · 上</td><td>70.0%</td><td>10</td><td>可</td></tr>
<tr><td>方位 · 左</td><td>72.7%</td><td>11</td><td>可</td></tr>
<tr><td>方位 · 下</td><td>62.5%</td><td>8</td><td>可（剛達門檻）</td></tr>
<tr><td>幅度 · 10–15°</td><td>78.3%</td><td>12</td><td>可</td></tr>
<tr><td>幅度 · 15–20°</td><td>66.7%</td><td>12</td><td>可</td></tr>
<tr><td>幅度 · 20–25°</td><td>50.0%</td><td>14</td><td>可</td></tr>
</tbody></table>"""


# ---------------------------------------------------------------- C5  tail ratio
def c5():
    W, H = 680, 214
    items = [
        ("命中時間", 478, 892, "ms", 0),
        ("首發角誤差", 0.58, 1.94, "°", 2),
        ("進靶後逸出", 0.31, 1.42, "°", 2),
    ]
    xa, xb = 214, 596
    dom = (1, 5)
    parts = [svg_open(W, H, "尾端倍率：各指標的 p95 是 p50 的幾倍")]
    for v in (1, 2, 3, 4, 5):
        tx = sc(v, *dom, xa, xb)
        parts.append(grid_v(tx, 40, 154))
        parts.append(txt(tx, 174, f"{v}×", "tick", "middle"))
    y = 50
    for name, p50, p95, unit, nd in items:
        ratio = p95 / p50
        bw = sc(ratio, *dom, xa, xb) - xa
        worst = ratio == max(i[2] / i[1] for i in items)
        parts.append(txt(xa - 12, y + 16, name, "lbl-strong", "end"))
        parts.append(txt(xa - 12, y + 30, f"p50 {fmt(p50, nd)}{unit} → p95 {fmt(p95, nd)}{unit}", "tick", "end"))
        parts.append(f'<path d="{hbar(xa, y, bw, 22)}" class="{"mk-weak" if worst else "mk-ok"}">'
                     f'<title>{name} · p50 {fmt(p50, nd)}{unit} · p95 {fmt(p95, nd)}{unit} · 尾端倍率 {ratio:.2f}×</title></path>')
        parts.append(txt(xa + bw + 10, y + 16, f"{ratio:.2f}×", "val"))
        y += 38
    parts.append(txt(58, H - 6, "尾端倍率 = p95 ÷ p50。越接近 1 越穩;比賽輸的是尾巴,不是中位數。", "tick"))
    parts.append('</svg>')
    FIGS['c5'] = "\n".join(parts)
    TABLES['c5'] = """<table><thead><tr><th>指標</th><th>p50</th><th>p95</th><th>尾端倍率</th></tr></thead><tbody>
<tr><td>命中時間</td><td>478 ms</td><td>892 ms</td><td>1.87×</td></tr>
<tr><td>首發角誤差</td><td>0.58°</td><td>1.94°</td><td>3.34×</td></tr>
<tr><td>進靶後逸出</td><td>0.31°</td><td>1.42°</td><td>4.58×</td></tr>
</tbody></table>"""


# ---------------------------------------------------------------- C6  within-run course
def c6():
    W, H = 680, 300
    x0, x1, y0, y1 = 74, 618, 44, 216
    pts = [(4, 545), (8, 498), (12, 470), (16, 462), (20, 458), (24, 466), (28, 481), (32, 505), (36, 528)]
    dx, dy = (2, 38), (430, 570)
    parts = [svg_open(W, H, "場內時間歷程：命中時間的滾動中位數對 trial 序號")]
    for v in (450, 480, 510, 540, 570):
        ty = sc(v, *dy, y1, y0)
        parts.append(grid_h(ty, x0, x1))
        parts.append(txt(x0 - 10, ty + 4, str(v), "tick", "end"))
    parts.append(f'<line x1="{x0:.1f}" y1="{y1:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" class="axis"/>')
    for v in (4, 12, 20, 28, 36):
        tx = sc(v, *dx, x0, x1)
        parts.append(f'<line x1="{tx:.1f}" y1="{y1:.1f}" x2="{tx:.1f}" y2="{y1 + 5:.1f}" class="grid"/>')
        parts.append(txt(tx, y1 + 20, str(v), "tick", "middle"))
    # session median reference
    med = 478
    my = sc(med, *dy, y1, y0)
    parts.append(f'<line x1="{x0:.1f}" y1="{my:.1f}" x2="{x1:.1f}" y2="{my:.1f}" class="ref"/>')
    parts.append(txt(x1 - 2, my - 8, "整場中位數 478 ms", "tick", "end"))
    poly = " ".join(f"{sc(a, *dx, x0, x1):.1f},{sc(b, *dy, y1, y0):.1f}" for a, b in pts)
    parts.append(f'<polyline points="{poly}" class="line1"/>')
    for a, b in pts:
        cx, cy = sc(a, *dx, x0, x1), sc(b, *dy, y1, y0)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4.5" class="dot-line">'
                     f'<title>trial {a - 3}–{a + 4} · 滾動中位數 {b} ms</title></circle>')
    # annotate the two ends
    parts.append(txt(sc(4, *dx, x0, x1) + 8, sc(545, *dy, y1, y0) - 10, "起段 +67 ms", "val"))
    parts.append(txt(sc(36, *dx, x0, x1) - 8, sc(528, *dy, y1, y0) - 10, "末段 +50 ms", "val", "end"))
    parts.append(txt(x0, y1 + 44, "周邊 trial 序號（8-trial 滾動窗）", "tick"))
    parts.append(f'<text transform="translate({x0 - 52:.1f},{(y0 + y1) / 2:.1f}) rotate(-90)" class="tick" text-anchor="middle">命中時間中位數（ms）</text>')
    parts.append(txt(x0, H - 8, "U 形 = 兩件不同的事:起段是暖身不足,末段是 60 秒內的衰退。處方不同。", "tick"))
    parts.append('</svg>')
    FIGS['c6'] = "\n".join(parts)
    TABLES['c6'] = ("<table><thead><tr><th>Trial 窗（中心）</th><th>命中時間滾動中位數</th></tr></thead><tbody>" +
                    "".join(f"<tr><td>{a}</td><td>{b} ms</td></tr>" for a, b in pts) +
                    "</tbody></table>")


# ---------------------------------------------------------------- C7  Fitts line
def c7():
    W, H = 680, 376
    x0, x1, y0, y1 = 78, 604, 44, 250
    cur = [(2.858, 468, "10–15°"), (3.285, 505, "15–20°"), (3.615, 545, "20–25°")]
    dx, dy = (2.5, 3.9), (380, 580)
    cs, ci = 102, 176
    bs, bi = 98, 146
    parts = [svg_open(W, H, "難度縮放：命中時間對 Fitts 難度指數，含個人基準線")]
    for v in (400, 450, 500, 550):
        ty = sc(v, *dy, y1, y0)
        parts.append(grid_h(ty, x0, x1))
        parts.append(txt(x0 - 10, ty + 4, str(v), "tick", "end"))
    parts.append(f'<line x1="{x0:.1f}" y1="{y1:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" class="axis"/>')
    for v in (2.6, 2.9, 3.2, 3.5, 3.8):
        tx = sc(v, *dx, x0, x1)
        parts.append(grid_v(tx, y0, y1))
        parts.append(txt(tx, y1 + 20, f"{v:.1f}", "tick", "middle"))
    for slope, icept, cls, name in ((bs, bi, "fit-base", "基準"), (cs, ci, "fit-cur", "本場")):
        ax, bx = dx
        parts.append(f'<line x1="{sc(ax, *dx, x0, x1):.1f}" y1="{sc(icept + slope * ax, *dy, y1, y0):.1f}" '
                     f'x2="{sc(bx, *dx, x0, x1):.1f}" y2="{sc(icept + slope * bx, *dy, y1, y0):.1f}" class="{cls}">'
                     f'<title>{name}擬合 · 斜率 {slope} ms/bit · 截距 {icept} ms</title></line>')
    for idv, mt, tier in cur:
        cx, cy = sc(idv, *dx, x0, x1), sc(mt, *dy, y1, y0)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="7" class="dot-cur">'
                     f'<title>{tier} · ID {idv:.2f} bits · 命中時間 {mt} ms</title></circle>')
        parts.append(txt(cx, cy - 15, tier, "lbl", "middle"))
    parts.append(txt(sc(3.82, *dx, x0, x1), sc(ci + cs * 3.82, *dy, y1, y0) - 10, "本場", "lbl-strong", "end"))
    parts.append(txt(sc(3.82, *dx, x0, x1), sc(bi + bs * 3.82, *dy, y1, y0) + 20, "基準", "lbl-strong", "end"))
    parts.append(txt(x0, y1 + 44, "Fitts 難度指數 ID = log₂(1 + D / W)　bits", "tick"))
    parts.append(f'<text transform="translate({x0 - 52:.1f},{(y0 + y1) / 2:.1f}) rotate(-90)" class="tick" text-anchor="middle">命中時間中位數（ms）</text>')
    # readout box
    ry = y1 + 62
    parts.append(f'<rect x="{x0:.1f}" y="{ry:.1f}" width="{x1 - x0:.1f}" height="46" rx="8" class="readout"/>')
    parts.append(txt(x0 + 16, ry + 20, "截距（固定開銷）", "tick"))
    parts.append(txt(x0 + 16, ry + 37, "176 ms　（基準 146 · +30）", "lbl-strong"))
    parts.append(txt(x0 + 268, ry + 20, "斜率（每 bit 代價）", "tick"))
    parts.append(txt(x0 + 268, ry + 37, "102 ms/bit　（基準 98 · +4）", "lbl-strong"))
    parts.append('</svg>')
    FIGS['c7'] = "\n".join(parts)
    TABLES['c7'] = """<table><thead><tr><th>幅度 tier</th><th>ID（bits）</th><th>命中時間中位數</th></tr></thead><tbody>
<tr><td>10–15°</td><td>2.86</td><td>468 ms</td></tr>
<tr><td>15–20°</td><td>3.29</td><td>505 ms</td></tr>
<tr><td>20–25°</td><td>3.62</td><td>545 ms</td></tr>
<tr><td colspan="3">本場擬合：截距 176 ms、斜率 102 ms/bit　·　基準：截距 146 ms、斜率 98 ms/bit</td></tr>
</tbody></table>"""


for f in (c1, c2, c3, c4, c5, c6, c7):
    f()

if __name__ == "__main__":
    import json, pathlib, sys
    out = pathlib.Path(sys.argv[1])
    out.write_text(json.dumps({"figs": FIGS, "tables": TABLES}, ensure_ascii=False), encoding="utf-8")
    print("figures:", len(FIGS), "tables:", len(TABLES))
