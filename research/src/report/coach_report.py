"""Coach report v0: per-peek timeline + Release-to-Click Sync, optionally stratified.

One command turns a schema v2 export into a single self-contained static HTML file a
coach can open or forward without a server::

    uv run python src/report/coach_report.py --export <path> [--group-by side|ads|weapon_mode] [--out <dir>]

This module belongs to the report tier, so file writes and console output are allowed
here; every ``algorithms/`` package it calls stays pure (C-D2).

Red line (C-D3 / GD-20): only constructs that passed a validity gate reach the main
table. The three timeline aggregates are parity-tested against the engine's frozen
``compute-v1`` implementation at relative error ``<= 1e-9``; the three Sync metrics are
new constructs governed by pre-registered ``sync-v1``, and the two tick-quantized ones
carry their precision verdict inline. Pipeline diagnostics that have not passed a construct
gate -- epsilon(t), REC/MR/V phase, SPARC, key-velocity xcorr, Fitts -- are deliberately
absent.

The rendered page is deterministic: no clock reads, no random identifiers, and every
collection is emitted in a stable order, so a committed example report only changes when
the underlying data or contract changes.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict
from html import escape
import math
from pathlib import Path
import sys
from typing import Any, Iterable, Sequence


RESEARCH_ROOT = Path(__file__).resolve().parents[2]
_SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SOURCE_ROOT))

from modules.ingest.algorithms import Export, load_export  # noqa: E402
from modules.metrics.algorithms.peek import PeekWindow, build_peek_windows  # noqa: E402
from modules.metrics.algorithms.sync import (  # noqa: E402
    DEFAULT_SYNC_PARAMS,
    SYNC_METRICS,
    SyncParams,
    evaluate_release_precision,
    sync_metrics,
)
from modules.metrics.algorithms.timeline import (  # noqa: E402
    COMPUTE_VERSION,
    TIMELINE_VERSION,
    Stat,
    first_shot_hits,
    stat,
    timeline_metrics,
)
from modules.segments.algorithms import DEFAULT_SEGMENT_PARAMS  # noqa: E402


REPORT_VERSION = "coach-report-v0"
DEFAULT_EXPORT = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_timeline.json"
DEFAULT_OUT_DIR = RESEARCH_ROOT / "out"
GROUP_BY_CHOICES = ("side", "ads", "weapon_mode")
SIM_HZ = 128
OUTCOMES = ("hit", "timeout", "no_shot")
SYNC_COLUMNS = ("release_to_fire_ms", "counter_hold_ms", "counter_to_fire_ms")

# Validity tier strings are the C-D3 red line made visible: every number in the main
# table states how it earned its place.
VALIDITY_PARITY = "已驗證：與結果頁 compute-v1 逐量 parity 通過(相對誤差 ≤1e-9)"
VALIDITY_NEW_JUDGED = "新構念(sync-v1);tick-derived 端點,附 pre-registered 精度判定"
VALIDITY_NEW_SUBTICK = "新構念(sync-v1);兩端皆 sub-tick input timestamp,本版不作精度判定"

_TIMELINE_METRICS = (
    ("counterReactionMs", "急停反應 counterReactionMs", "t_counter − t_visible"),
    ("fireTimingAlignmentMs", "停火對齊 fireTimingAlignmentMs", "t_first_shot − t_counter"),
    ("firstShotHitRate", "首發命中率 firstShotHitRate", "相容首發命中數 / visible 數 × 100"),
)

_SYNC_LABELS = {
    "release_to_fire_ms": ("放鍵→開火 release_to_fire_ms", "t_first_shot − t_release"),
    "counter_hold_ms": ("反向鍵持壓 counter_hold_ms", "t_counter → 最後一個仍持壓的窗內 tick"),
    "counter_to_fire_ms": ("反向鍵→開火 counter_to_fire_ms", "t_first_shot − t_counter"),
}


# --------------------------------------------------------------------------------------
# Report model
# --------------------------------------------------------------------------------------


def build_report(
    export_path: Path,
    group_by: str | None = None,
    params: SyncParams = DEFAULT_SYNC_PARAMS,
    sim_hz: int = SIM_HZ,
) -> dict[str, Any]:
    """Assemble the JSON-shaped report model that :func:`render_html` renders.

    Grouping only *partitions* rows that the pure algorithms already produced; no
    parameter, threshold, or version is a function of ``group_by`` (DoD 2).
    """

    if group_by is not None and group_by not in GROUP_BY_CHOICES:
        raise ValueError(f"group_by must be one of {GROUP_BY_CHOICES} or None")

    export = load_export(export_path)
    peeks = tuple(build_peek_windows(export))
    metrics = timeline_metrics(export)
    weapon_mode = _weapon_mode(export)
    sync = sync_metrics(peeks, export.ticks, weapon_mode=weapon_mode)
    sync_rows = [_sync_row(row) for _, row in sync.iterrows()]
    verdicts = evaluate_release_precision(sync, params, sim_hz=sim_hz)
    hits = first_shot_hits(export, peeks)

    return {
        "reportVersion": REPORT_VERSION,
        "source": {
            "fixture": export.source_path.name,
            "drillId": _text(export.meta.get("drillId")),
            "participantId": _text(export.meta.get("session", {}).get("participantId"))
            if isinstance(export.meta.get("session"), dict)
            else None,
            "weaponMode": weapon_mode,
            "simHz": export.meta.get("simHz"),
            "schemaVersion": export.meta.get("schemaVersion"),
            "suspect": bool(export.meta.get("suspect")),
        },
        # Frozen contract block. Byte-identical for every --group-by value.
        "parameters": _parameters(params, sim_hz),
        "drillSummary": _drill_summary(peeks, metrics, hits),
        "timelineMetrics": _timeline_entries(metrics, peeks),
        "syncMetrics": _sync_entries(sync_rows, verdicts),
        "precisionVerdicts": [asdict(verdict) for verdict in verdicts],
        # Sync rows start from ``peek.flags`` and only append, so they already carry the
        # complete closed vocabulary for the drill; counting them twice would inflate it.
        "flagCounts": _flag_counts(row["flags"] for row in sync_rows),
        "releaseSources": _counts(peek.release_source for peek in peeks),
        "peeks": [_peek_row(peek, sync_rows[index], hits[index]) for index, peek in enumerate(peeks)],
        "groupBy": group_by,
        "groups": _groups(export, peeks, sync_rows, hits, weapon_mode, group_by),
    }


def _parameters(params: SyncParams, sim_hz: int) -> dict[str, Any]:
    tick_ms = 1000.0 / sim_hz
    return {
        "computeVersion": COMPUTE_VERSION,
        "timelineVersion": TIMELINE_VERSION,
        "syncVersion": params.version,
        "segmentVersion": DEFAULT_SEGMENT_PARAMS.version,
        "syncParams": asdict(params),
        "simHz": sim_hz,
        "tickMs": tick_ms,
        "quantizationSdMs": tick_ms / math.sqrt(12.0),
        "windowRule": "[t_visible, next_visible.t),邊界容差 1e-9 ms",
        "aggregateRule": "數值有限且整列 flags 為空才進 n 與 sample SD",
    }


def _drill_summary(
    peeks: Sequence[PeekWindow],
    metrics: Any,
    hits: Sequence[bool],
) -> dict[str, Any]:
    return {
        "peekCount": len(peeks),
        "outcomes": {outcome: sum(peek.outcome == outcome for peek in peeks) for outcome in OUTCOMES},
        "firstShotHitRate": metrics.first_shot_hit_rate,
        "firstShotHits": sum(hits),
        "sides": _counts(peek.side for peek in peeks),
        "adsCells": _counts(_ads_label(peek.ads) for peek in peeks),
    }


def _timeline_entries(metrics: Any, peeks: Sequence[PeekWindow]) -> list[dict[str, Any]]:
    """The three frozen ``compute-v1`` aggregates, each with n, flags and its tier."""

    without_counter = [peek for peek in peeks if peek.t_counter is None]
    without_alignment = [
        peek for peek in peeks if peek.t_counter is None or peek.t_first_shot is None
    ]
    return [
        _timeline_entry(_TIMELINE_METRICS[0], metrics.counter_reaction_ms, without_counter),
        _timeline_entry(_TIMELINE_METRICS[1], metrics.fire_timing_alignment_ms, without_alignment),
        {
            "key": _TIMELINE_METRICS[2][0],
            "label": _TIMELINE_METRICS[2][1],
            "definition": _TIMELINE_METRICS[2][2],
            "version": COMPUTE_VERSION,
            "validity": VALIDITY_PARITY,
            "unit": "%",
            "value": metrics.first_shot_hit_rate,
            "n": len(peeks),
            "excludedCount": 0,
            "flagCounts": _flag_counts(peek.flags for peek in peeks if "no_first_shot" in peek.flags),
            "note": "分母 = 全部 visible 事件,無排除;flags 欄列出無相容首發的 peek",
        },
    ]


def _timeline_entry(
    spec: tuple[str, str, str], value: Stat, excluded: Sequence[PeekWindow]
) -> dict[str, Any]:
    key, label, definition = spec
    return {
        "key": key,
        "label": label,
        "definition": definition,
        "version": COMPUTE_VERSION,
        "validity": VALIDITY_PARITY,
        "unit": "ms",
        "mean": value.mean,
        "p50": value.p50,
        "sd": value.sd,
        "n": value.n,
        "excludedCount": len(excluded),
        "flagCounts": _flag_counts(peek.flags for peek in excluded),
        "note": "缺錨點的 peek 依 compute-v1 不進聚合,不補 0、不吞成 NaN",
    }


def _sync_entries(
    sync_rows: Sequence[dict[str, Any]], verdicts: Sequence[Any]
) -> list[dict[str, Any]]:
    by_metric = {verdict.metric: verdict for verdict in verdicts}
    entries = []
    for column in SYNC_COLUMNS:
        label, definition = _SYNC_LABELS[column]
        verdict = by_metric.get(column)
        entries.append(
            {
                "key": column,
                "label": label,
                "definition": definition,
                "version": DEFAULT_SYNC_PARAMS.version,
                "validity": VALIDITY_NEW_JUDGED if column in SYNC_METRICS else VALIDITY_NEW_SUBTICK,
                "unit": "ms",
                **_sync_stats(sync_rows, column),
                "verdict": None if verdict is None else asdict(verdict),
            }
        )
    return entries


def _sync_stats(sync_rows: Sequence[dict[str, Any]], column: str) -> dict[str, Any]:
    values = [
        row[column]
        for row in sync_rows
        if not row["flags"] and _finite(row[column])
    ]
    excluded = [row for row in sync_rows if row["flags"] or not _finite(row[column])]
    return {
        "mean": (sum(values) / len(values)) if values else None,
        "sampleSdMs": _sample_sd(values),
        "n": len(values),
        "excludedCount": len(excluded),
        "flagCounts": _flag_counts(row["flags"] for row in excluded),
        "note": "帶任何 flag 的整列一律不進聚合(含 release_inferred_no_counter 與 counter_hold_truncated)",
    }


def _groups(
    export: Export,
    peeks: Sequence[PeekWindow],
    sync_rows: Sequence[dict[str, Any]],
    hits: Sequence[bool],
    weapon_mode: str,
    group_by: str | None,
) -> list[dict[str, Any]]:
    """Partition the already-computed rows; never recompute with different parameters."""

    if group_by is None:
        return []

    keys = [_group_key(peek, weapon_mode, group_by) for peek in peeks]
    groups = []
    for key in sorted(set(keys)):
        indices = [index for index, value in enumerate(keys) if value == key]
        member_peeks = [peeks[index] for index in indices]
        member_rows = [sync_rows[index] for index in indices]
        member_hits = [hits[index] for index in indices]
        counter_reactions = [
            peek.t_counter - peek.t_visible for peek in member_peeks if peek.t_counter is not None
        ]
        alignments = [
            peek.t_first_shot - peek.t_counter
            for peek in member_peeks
            if peek.t_counter is not None and peek.t_first_shot is not None
        ]
        groups.append(
            {
                "key": key,
                "label": f"{group_by} = {key}",
                "peekCount": len(member_peeks),
                "outcomes": {
                    outcome: sum(peek.outcome == outcome for peek in member_peeks)
                    for outcome in OUTCOMES
                },
                "timelineMetrics": [
                    _timeline_entry(
                        _TIMELINE_METRICS[0],
                        stat(counter_reactions),
                        [peek for peek in member_peeks if peek.t_counter is None],
                    ),
                    _timeline_entry(
                        _TIMELINE_METRICS[1],
                        stat(alignments),
                        [
                            peek
                            for peek in member_peeks
                            if peek.t_counter is None or peek.t_first_shot is None
                        ],
                    ),
                    {
                        "key": _TIMELINE_METRICS[2][0],
                        "label": _TIMELINE_METRICS[2][1],
                        "definition": _TIMELINE_METRICS[2][2],
                        "version": COMPUTE_VERSION,
                        "validity": VALIDITY_PARITY,
                        "unit": "%",
                        "value": (sum(member_hits) / len(member_hits) * 100.0)
                        if member_hits
                        else 0.0,
                        "n": len(member_hits),
                        "excludedCount": 0,
                        "flagCounts": {},
                        "note": "分層子集:同一 compute-v1 公式,分母 = 該組 peek 數",
                    },
                ],
                "syncMetrics": [
                    {
                        "key": column,
                        "label": _SYNC_LABELS[column][0],
                        "version": DEFAULT_SYNC_PARAMS.version,
                        "unit": "ms",
                        **_sync_stats(member_rows, column),
                    }
                    for column in SYNC_COLUMNS
                ],
                "flagCounts": _flag_counts(row["flags"] for row in member_rows),
            }
        )
    return groups


def _group_key(peek: PeekWindow, weapon_mode: str, group_by: str) -> str:
    if group_by == "side":
        return peek.side
    if group_by == "ads":
        return _ads_label(peek.ads)
    return weapon_mode


def _peek_row(peek: PeekWindow, sync_row: dict[str, Any], first_shot_hit: bool) -> dict[str, Any]:
    return {
        "index": peek.index,
        "side": peek.side,
        "targetId": peek.target_id,
        "outcome": peek.outcome,
        "tVisibleMs": peek.t_visible,
        "visibleToCounterMs": _delta(peek.t_counter, peek.t_visible),
        "counterToFirstShotMs": sync_row["counter_to_fire_ms"],
        "releaseToFirstShotMs": sync_row["release_to_fire_ms"],
        "counterHoldMs": sync_row["counter_hold_ms"],
        "firstShotHit": first_shot_hit,
        "shotCount": len(peek.fires),
        "ads": _ads_label(peek.ads),
        "releaseSource": peek.release_source,
        "flags": list(sync_row["flags"]),
    }


# --------------------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------------------


def render_html(model: dict[str, Any]) -> str:
    """Render the model to one self-contained HTML document (no external resources)."""

    source = model["source"]
    title = f"教練報告 v0 — {source['drillId']}"
    parts = [
        "<!doctype html>",
        '<html lang="zh-Hant">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{escape(title)}</title>",
        f"<style>{_STYLE}</style>",
        "</head>",
        "<body>",
        f"<h1>{escape(title)}</h1>",
        f'<p class="sub">{escape(model["reportVersion"])} · 來源 fixture '
        f'<code>{escape(source["fixture"])}</code></p>',
        _render_summary(model),
        _render_metric_table("① 時間軸三量(已通過 compute-v1 對表)", model["timelineMetrics"]),
        _render_sync_table("② Release-to-Click Sync 三量(新構念,sync-v1)", model["syncMetrics"]),
        _render_verdicts(model),
        _render_timeline_svg(model),
        _render_peek_table(model),
        _render_flags(model),
        _render_groups(model),
        _render_parameters(model),
        _render_limitations(model),
        "</body>",
        "</html>",
        "",
    ]
    return "\n".join(parts)


def _render_summary(model: dict[str, Any]) -> str:
    summary = model["drillSummary"]
    source = model["source"]
    outcomes = " · ".join(
        f"{escape(name)} {summary['outcomes'][name]}" for name in OUTCOMES
    )
    suspect = (
        '<p class="warn">meta.suspect = true —— 成因為 KI-004 的 sim/world 單位域缺陷'
        "(corridor gate),與本報告使用的 events / ticks[].keys 無關;本報告完全不消費 px/pz。</p>"
        if source["suspect"]
        else ""
    )
    return (
        '<section id="summary"><h2>drill 摘要</h2>'
        f"<dl>"
        f"<dt>peek 數</dt><dd>{summary['peekCount']}</dd>"
        f"<dt>outcome 分布</dt><dd>{outcomes}</dd>"
        f"<dt>firstShotHitRate</dt><dd>{_num(summary['firstShotHitRate'])} %"
        f" ({summary['firstShotHits']}/{summary['peekCount']})</dd>"
        f"<dt>side 分布</dt><dd>{escape(_counts_text(summary['sides']))}</dd>"
        f"<dt>ADS cell</dt><dd>{escape(_counts_text(summary['adsCells']))}</dd>"
        f"<dt>weapon mode</dt><dd>{escape(source['weaponMode'])}</dd>"
        f"<dt>release 來源</dt><dd>{escape(_counts_text(model['releaseSources']))}</dd>"
        f"</dl>{suspect}</section>"
    )


def _timeline_stats_text(entry: dict[str, Any]) -> str:
    """Render one timeline aggregate.

    Frozen ``compute-v1`` ``stat()`` returns ``{mean:0,p50:0,sd:0,n:0}`` for an empty set.
    The model keeps those zeros verbatim for parity, but a coach must never read a
    fabricated ``mean 0`` next to ``n 0`` — so an empty aggregate renders as an em dash.
    """

    if entry["key"] == "firstShotHitRate":
        return f"{_num(entry['value'])} %"
    if entry["n"] == 0:
        return "—"
    return f"mean {_num(entry['mean'])} · p50 {_num(entry['p50'])} · sd {_num(entry['sd'])}"


def _render_metric_table(heading: str, entries: Sequence[dict[str, Any]]) -> str:
    rows = []
    for entry in entries:
        stats = _timeline_stats_text(entry)
        rows.append(
            "<tr>"
            f"<td>{escape(entry['label'])}<div class=\"def\">{escape(entry['definition'])}</div></td>"
            f"<td>{stats}</td>"
            f"<td class=\"n\">{entry['n']}</td>"
            f"<td>{escape(_counts_text(entry['flagCounts']))}</td>"
            f"<td><code>{escape(entry['version'])}</code></td>"
            f"<td class=\"tier\">{escape(entry['validity'])}<div class=\"def\">"
            f"{escape(entry['note'])}</div></td>"
            "</tr>"
        )
    return (
        f'<section><h2>{escape(heading)}</h2><table>'
        "<thead><tr><th>指標</th><th>統計</th><th>n</th><th>flags 計數(未入聚合者)</th>"
        "<th>版本</th><th>效度層級</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></section>"
    )


def _render_sync_table(heading: str, entries: Sequence[dict[str, Any]]) -> str:
    rows = []
    for entry in entries:
        verdict = entry["verdict"]
        verdict_cell = (
            f'<span class="v-{escape(verdict["verdict"])}">{escape(verdict["verdict"])}</span>'
            f'<div class="def">sample SD {_num(verdict["sample_sd_ms"], 12)} ms · '
            f'quantization SD {_num(verdict["quantization_sd_ms"], 12)} ms<br>'
            f'{escape(verdict["reason"])}</div>'
            if verdict is not None
            else '<span class="v-none">不適用(兩端皆 sub-tick)</span>'
        )
        rows.append(
            "<tr>"
            f"<td>{escape(entry['label'])}<div class=\"def\">{escape(entry['definition'])}</div></td>"
            f"<td>mean {_num(entry['mean'])} · sample SD {_num(entry['sampleSdMs'])}</td>"
            f"<td class=\"n\">{entry['n']}</td>"
            f"<td>{escape(_counts_text(entry['flagCounts']))}</td>"
            f"<td><code>{escape(entry['version'])}</code></td>"
            f"<td class=\"tier\">{escape(entry['validity'])}</td>"
            f"<td>{verdict_cell}</td>"
            "</tr>"
        )
    return (
        f'<section><h2>{escape(heading)}</h2><table>'
        "<thead><tr><th>指標</th><th>統計</th><th>n</th><th>flags 計數(未入聚合者)</th>"
        "<th>版本</th><th>效度層級</th><th>精度判定</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></section>"
    )


def _render_verdicts(model: dict[str, Any]) -> str:
    rows = "".join(
        "<tr>"
        f"<td><code>{escape(verdict['metric'])}</code></td>"
        f"<td class=\"n\">{verdict['n']}</td>"
        f"<td>{_num(verdict['sample_sd_ms'], 12)}</td>"
        f"<td>{_num(verdict['quantization_sd_ms'], 12)}</td>"
        f"<td><span class=\"v-{escape(verdict['verdict'])}\">{escape(verdict['verdict'])}</span></td>"
        f"<td>{escape(verdict['reason'])}</td>"
        "</tr>"
        for verdict in model["precisionVerdicts"]
    )
    return (
        '<section id="precision"><h2>③ 量化精度判定(pre-registered,不得事後調參)</h2><table>'
        "<thead><tr><th>指標</th><th>n</th><th>sample SD (ms)</th><th>quantization SD (ms)</th>"
        "<th>判定</th><th>理由</th></tr></thead>"
        f"<tbody>{rows}</tbody></table></section>"
    )


def _render_timeline_svg(model: dict[str, Any]) -> str:
    peeks = model["peeks"]
    width = 1180
    left = 210
    row_height = 26
    height = 74 + row_height * max(len(peeks), 1)
    spans = [
        value
        for peek in peeks
        for value in (
            peek["visibleToCounterMs"],
            peek["counterToFirstShotMs"],
            _sum_or_none(peek["visibleToCounterMs"], peek["counterToFirstShotMs"]),
        )
        if value is not None and math.isfinite(value)
    ]
    horizon = max([value for value in spans if value > 0] + [1.0])

    def x(value: float) -> float:
        return left + max(0.0, value) / horizon * (width - left - 30)

    colors = {"visible": "#64748b", "counter": "#2563eb", "release": "#16a34a", "fire": "#ea580c"}
    parts = [
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"></rect>',
        '<text x="10" y="20" font-size="12" fill="#334155">'
        "每列 = 一個 [visible, nextVisible) peek;橫軸 = 相對 t_visible 的毫秒(依本 drill 最大跨距縮放)"
        "</text>",
    ]
    legend_x = 10
    for name, color in colors.items():
        parts.append(f'<circle cx="{legend_x}" cy="40" r="4" fill="{color}"></circle>')
        parts.append(
            f'<text x="{legend_x + 9}" y="44" font-size="11" fill="#334155">{escape(name)}</text>'
        )
        legend_x += 92
    for row, peek in enumerate(peeks):
        y = 66 + row * row_height
        parts.append(
            f'<text x="10" y="{y + 4}" font-size="11" fill="#0f172a">'
            f'{peek["index"]:02d} {escape(peek["side"])} {escape(peek["outcome"])} '
            f'{escape(_truncate(peek["targetId"], 14))}</text>'
        )
        parts.append(
            f'<line x1="{left}" y1="{y}" x2="{width - 30}" y2="{y}" stroke="#e2e8f0"></line>'
        )
        markers: list[tuple[str, float]] = [("visible", 0.0)]
        counter = peek["visibleToCounterMs"]
        if counter is not None:
            markers.append(("counter", counter))
            release = _sum_or_none(counter, peek["counterHoldMs"])
            if release is not None:
                markers.append(("release", release))
        fire = _sum_or_none(counter, peek["counterToFirstShotMs"])
        if fire is not None:
            markers.append(("fire", fire))
        for name, value in markers:
            parts.append(
                f'<circle cx="{x(value):.2f}" cy="{y}" r="3.5" fill="{colors[name]}">'
                f"<title>{escape(name)} +{value:.3f} ms</title></circle>"
            )
    parts.append("</svg>")
    return (
        '<section id="timeline"><h2>④ 逐 peek 時間軸</h2>'
        f'<div class="scroll">{"".join(parts)}</div>'
        '<p class="def">缺席的錨點就是不畫 —— 缺事件是合法語意,不以 0 佔位。'
        "release 標記由 t_counter + counter_hold_ms 還原,故僅在有 counter 的 peek 出現。</p></section>"
    )


def _render_peek_table(model: dict[str, Any]) -> str:
    rows = "".join(
        "<tr>"
        f"<td class=\"n\">{peek['index']}</td>"
        f"<td>{escape(peek['side'])}</td>"
        f"<td>{escape(_truncate(peek['targetId'], 24))}</td>"
        f"<td>{escape(peek['outcome'])}</td>"
        f"<td>{_num(peek['visibleToCounterMs'])}</td>"
        f"<td>{_num(peek['counterToFirstShotMs'])}</td>"
        f"<td>{_num(peek['releaseToFirstShotMs'])}</td>"
        f"<td>{_num(peek['counterHoldMs'])}</td>"
        f"<td>{'✔' if peek['firstShotHit'] else '✘'}</td>"
        f"<td class=\"n\">{peek['shotCount']}</td>"
        f"<td>{escape(peek['ads'])}</td>"
        f"<td><code>{escape(peek['releaseSource'])}</code></td>"
        f"<td class=\"flags\">{escape(' '.join(peek['flags']) or '—')}</td>"
        "</tr>"
        for peek in model["peeks"]
    )
    return (
        '<section id="peeks"><h2>⑤ 逐 peek 明細</h2><div class="scroll"><table>'
        "<thead><tr><th>#</th><th>side</th><th>target</th><th>outcome</th>"
        "<th>visible→counter</th><th>counter→首發</th><th>release→首發</th><th>counter 持壓</th>"
        "<th>首發命中</th><th>發數</th><th>ADS</th><th>release 來源</th><th>flags</th></tr></thead>"
        f"<tbody>{rows}</tbody></table></div></section>"
    )


def _render_flags(model: dict[str, Any]) -> str:
    counts = model["flagCounts"]
    if not counts:
        body = '<p class="def">本 drill 無任何 flag。</p>'
    else:
        body = "<table><thead><tr><th>flag</th><th>次數</th></tr></thead><tbody>" + "".join(
            f"<tr><td><code>{escape(flag)}</code></td><td class=\"n\">{count}</td></tr>"
            for flag, count in counts.items()
        ) + "</tbody></table>"
    return f'<section id="flags"><h2>⑥ flags 計數(drill 全域)</h2>{body}</section>'


def _render_groups(model: dict[str, Any]) -> str:
    group_by = model["groupBy"]
    if group_by is None:
        return (
            '<section id="groups"><h2>⑦ 條件分層</h2>'
            '<p class="def">本報告未分層。以 <code>--group-by side|ads|weapon_mode</code> '
            "重跑可得逐組的 n / 統計 / flags;分層只切分列,不改任何參數或版本。</p></section>"
        )
    blocks = []
    for group in model["groups"]:
        timeline_rows = "".join(
            "<tr>"
            f"<td>{escape(entry['label'])}</td>"
            f"<td>{_timeline_stats_text(entry)}</td>"
            f"<td class=\"n\">{entry['n']}</td>"
            f"<td>{escape(_counts_text(entry['flagCounts']))}</td>"
            f"<td><code>{escape(entry['version'])}</code></td>"
            "</tr>"
            for entry in group["timelineMetrics"]
        )
        sync_rows = "".join(
            "<tr>"
            f"<td>{escape(entry['label'])}</td>"
            f"<td>mean {_num(entry['mean'])} · sample SD {_num(entry['sampleSdMs'])}</td>"
            f"<td class=\"n\">{entry['n']}</td>"
            f"<td>{escape(_counts_text(entry['flagCounts']))}</td>"
            f"<td><code>{escape(entry['version'])}</code></td>"
            "</tr>"
            for entry in group["syncMetrics"]
        )
        outcomes = " · ".join(
            f"{escape(name)} {group['outcomes'][name]}" for name in OUTCOMES
        )
        blocks.append(
            f'<div class="group"><h3>{escape(group["label"])}</h3>'
            f'<p class="def">peek {group["peekCount"]} · {outcomes} · '
            f'flags {escape(_counts_text(group["flagCounts"]))}</p>'
            "<table><thead><tr><th>指標</th><th>統計</th><th>n</th><th>flags 計數</th>"
            f"<th>版本</th></tr></thead><tbody>{timeline_rows}{sync_rows}</tbody></table></div>"
        )
    return (
        f'<section id="groups"><h2>⑦ 條件分層(--group-by {escape(group_by)})</h2>'
        '<p class="def">分層只切分已算好的列;SyncParams、版本字串與判定門檻與未分層報告逐位相同。'
        "pre-registered 精度判定維持 drill 層級,不逐組重跑(避免事後多重比較)。</p>"
        f'{"".join(blocks)}</section>'
    )


def _render_parameters(model: dict[str, Any]) -> str:
    """Frozen contract block. Rendered identically for every ``--group-by`` value."""

    params = model["parameters"]
    sync_params = params["syncParams"]
    rows = [
        ("compute-v1", params["computeVersion"], "引擎 src/metrics 的 TS 權威實作(parity ≤1e-9)"),
        ("timeline-v1", params["timelineVersion"], "peek 窗界 / 錨點 / outcome / flags 詞彙表"),
        ("sync-v1", params["syncVersion"], "Release-to-Click Sync 定義與 pre-registered 判準"),
        ("seg-v1", params["segmentVersion"], "submovement 分段參數(本報告未消費,列出以標明凍結面)"),
    ]
    version_rows = "".join(
        f"<tr><td>{escape(name)}</td><td><code>{escape(str(value))}</code></td>"
        f"<td>{escape(note)}</td></tr>"
        for name, value, note in rows
    )
    return (
        '<section id="parameters"><h2>⑧ 凍結參數與版本</h2>'
        "<table><thead><tr><th>契約</th><th>版本字串</th><th>涵蓋範圍</th></tr></thead>"
        f"<tbody>{version_rows}</tbody></table>"
        "<dl>"
        f"<dt>SyncParams</dt><dd><code>min_samples={sync_params['min_samples']} · "
        f"sd_ratio_threshold={sync_params['sd_ratio_threshold']!r} · "
        f"version={escape(str(sync_params['version']))}</code></dd>"
        f"<dt>sim tick</dt><dd>{params['simHz']} Hz · {params['tickMs']!r} ms</dd>"
        f"<dt>quantization SD</dt><dd>{params['quantizationSdMs']!r} ms = (1000/{params['simHz']})/√12</dd>"
        f"<dt>窗界規則</dt><dd>{escape(params['windowRule'])}</dd>"
        f"<dt>聚合規則</dt><dd>{escape(params['aggregateRule'])}</dd>"
        "</dl></section>"
    )


def _render_limitations(model: dict[str, Any]) -> str:
    return (
        '<section id="limits"><h2>⑨ 效度紅線與已知限制</h2><ul>'
        "<li>未通過構念驗證的量一律不進本報告:ε(t)、REC/MR/V phase、SPARC、"
        "key-velocity xcorr、Fitts 皆不在此。</li>"
        "<li>release 端點為 tick-derived,量化上界為一個 128 Hz tick(7.8125 ms);"
        "精度判定為本 fixture 的判定,不是母體推論。</li>"
        "<li>缺錨點是合法語意:不補 0、不吞成 NaN;帶 flag 的整列不進正式聚合,"
        "<code>release_inferred_no_counter</code> 因此預設排除(OQ-S4-10 仍 open)。</li>"
        "<li>真實證據為單一受試者的兩次 run;條件分層在真實資料上只有單一 cell 有樣本"
        "(OQ-S4-11 仍 open)。</li>"
        "<li>本報告完全不消費 px/pz,故不受 KI-004 的 sim/world 單位域缺陷影響。</li>"
        "</ul></section>"
    )


_STYLE = (
    "body{font-family:system-ui,'Segoe UI','Noto Sans TC',sans-serif;margin:0 auto;padding:28px;"
    "max-width:1240px;color:#0f172a;background:#f8fafc;line-height:1.55}"
    "h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 10px}h3{font-size:14px;margin:0 0 6px}"
    "p.sub{margin:0 0 22px;color:#475569;font-size:13px}"
    "section{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin-bottom:16px}"
    "table{border-collapse:collapse;width:100%;font-size:12.5px}"
    "th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}"
    "th{background:#f1f5f9;font-weight:600}"
    "td.n{text-align:right;font-variant-numeric:tabular-nums}"
    "td.tier{max-width:280px}td.flags{font-family:ui-monospace,monospace;font-size:11px}"
    "div.def,p.def{color:#64748b;font-size:11.5px;margin:2px 0 0}"
    "dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0;font-size:13px}"
    "dt{color:#475569}dd{margin:0}"
    "code{font-family:ui-monospace,monospace;font-size:11.5px;background:#f1f5f9;padding:1px 4px;border-radius:3px}"
    "div.scroll{overflow-x:auto}div.group{margin-top:14px}"
    "p.warn{margin:12px 0 0;padding:8px 10px;background:#fef3c7;border-radius:6px;font-size:12px}"
    ".v-sufficient{color:#15803d;font-weight:600}.v-insufficient{color:#b91c1c;font-weight:600}"
    ".v-blocked-by-data{color:#a16207;font-weight:600}.v-none{color:#64748b}"
    "ul{margin:0;padding-left:18px;font-size:13px}li{margin-bottom:4px}"
)


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------


def report_filename(export_path: Path, group_by: str | None) -> str:
    suffix = "" if group_by is None else f"-by-{group_by}"
    return f"coach-report-{Path(export_path).stem}{suffix}.html"


def generate(
    export_path: Path,
    out_dir: Path,
    group_by: str | None = None,
) -> Path:
    """Write exactly one self-contained HTML report and return its path."""

    html = render_html(build_report(export_path, group_by))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / report_filename(export_path, group_by)
    path.write_text(html, encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--group-by", choices=GROUP_BY_CHOICES, default=None)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)

    try:
        path = generate(args.export, args.out, args.group_by)
    except (ValueError, OSError) as error:
        print(f"coach report failed: {error}", file=sys.stderr)
        return 1

    model = build_report(args.export, args.group_by)
    print(f"export           {model['source']['fixture']}")
    print(f"peeks            {model['drillSummary']['peekCount']}")
    for entry in model["syncMetrics"]:
        verdict = entry["verdict"]
        state = "—" if verdict is None else verdict["verdict"]
        print(f"{entry['key']:<20} n={entry['n']:<4} {state}")
    print(f"group-by         {args.group_by or '(none)'}")
    print(path)
    return 0


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------


def _weapon_mode(export: Export) -> str:
    weapon = export.meta.get("weapon")
    return "projectile" if isinstance(weapon, dict) and weapon.get("bullet") is not None else "hitscan"


def _sync_row(row: Any) -> dict[str, Any]:
    return {
        "peek_index": int(row["peek_index"]),
        "release_to_fire_ms": _number(row["release_to_fire_ms"]),
        "counter_hold_ms": _number(row["counter_hold_ms"]),
        "counter_to_fire_ms": _number(row["counter_to_fire_ms"]),
        "flags": tuple(row["flags"]),
    }


def _ads_label(value: bool | None) -> str:
    return "unknown" if value is None else ("on" if value else "off")


def _counts(values: Iterable[str]) -> dict[str, int]:
    return dict(sorted(Counter(values).items()))


def _flag_counts(flag_groups: Iterable[Sequence[str]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for flags in flag_groups:
        counts.update(flags)
    return dict(sorted(counts.items()))


def _counts_text(counts: dict[str, int]) -> str:
    return " · ".join(f"{name} {count}" for name, count in counts.items()) or "—"


def _num(value: Any, digits: int = 4) -> str:
    if value is None or not isinstance(value, (int, float)) or isinstance(value, bool):
        return "—"
    number = float(value)
    return f"{number:.{digits}g}" if math.isfinite(number) else "—"


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _finite(value: Any) -> bool:
    return _number(value) is not None


def _delta(later: float | None, earlier: float | None) -> float | None:
    return None if later is None or earlier is None else float(later - earlier)


def _sum_or_none(first: float | None, second: float | None) -> float | None:
    return None if first is None or second is None else float(first + second)


def _sample_sd(values: Sequence[float]) -> float | None:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    return math.sqrt(sum((value - mean) ** 2 for value in values) / (len(values) - 1))


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1] + "…"


if __name__ == "__main__":
    raise SystemExit(main())