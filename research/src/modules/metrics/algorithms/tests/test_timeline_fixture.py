from __future__ import annotations

import json

from modules.ingest.algorithms import load_export
from modules.metrics.algorithms import timeline_metrics, timeline_parity_payload
from modules.metrics.notebooks.t1.generate_timeline_artifacts import FIXTURES, SYNTHETIC_EXPORT


def test_anti_vacuous_fixture_covers_all_timeline_paths() -> None:
    metrics = timeline_metrics(load_export(SYNTHETIC_EXPORT))

    assert metrics.counter_reaction_ms.n >= 2
    assert metrics.fire_timing_alignment_ms.n >= 2
    assert len(metrics.peeks) >= 2
    assert {peek.outcome for peek in metrics.peeks} >= {"hit", "timeout"}
    assert any("hit_outside_window" in peek.flags for peek in metrics.peeks)
    assert any("release_inferred_no_counter" in peek.flags for peek in metrics.peeks)
    assert any("no_key_transition" in peek.flags for peek in metrics.peeks)


def test_all_three_committed_parity_payloads_match_python_generator() -> None:
    for source in FIXTURES:
        parity = source.parents[1] / "parity" / f"timeline-{source.stem}.json"
        expected = json.loads(parity.read_text(encoding="utf-8"))
        assert timeline_parity_payload(load_export(source)) == expected
