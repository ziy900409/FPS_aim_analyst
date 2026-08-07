from __future__ import annotations

import json

import pytest

from modules.ingest.algorithms import load_export
from modules.kinematics.algorithms.angular import resolve_eye_origin
from modules.metrics.algorithms.detect import DEFAULT_DETECT_PARAMS
from modules.metrics.notebooks.t1.generate_detect_parity import FIXTURES, LEGACY_FIXTURES, build_payload


#: T0 §3.1 pre-registration: the REC/t_detect consistency check (T2) needs >=10 `detected`
#: samples or it must report `blocked-by-data` (OQ-S4-15) instead of a vacuous "consistent".
_MIN_DETECTED_SAMPLES = 10


def test_all_committed_detect_parity_payloads_match_python_generator() -> None:
    for source in FIXTURES:
        parity = source.parents[1] / "parity" / f"detect-{source.stem}.json"
        expected = json.loads(parity.read_text(encoding="utf-8"))
        assert build_payload(source) == expected


def test_anti_vacuous_detected_sample_count_meets_t0_threshold() -> None:
    total_detected = 0
    for source in FIXTURES:
        payload = build_payload(source)
        total_detected += sum(
            1 for presentation in payload["presentations"] if presentation["status"] == "detected"
        )

    # Not a vacuous pass: a t_detect consistency check with zero `detected` samples would trivially
    # "agree" with nothing (D-29.3's lesson). This must be an explicit, machine-checked lower bound.
    assert total_detected >= _MIN_DETECTED_SAMPLES


def test_legacy_exports_raise_on_strict_eye_origin_resolution() -> None:
    for source in LEGACY_FIXTURES:
        export = load_export(source)
        with pytest.raises(ValueError, match="legacy-default|meta.scene.eye"):
            resolve_eye_origin(export.meta, strict=True)


def test_default_params_match_ts_authoritative_defaults() -> None:
    # analysis-t-detect.md + detectionDerivation.ts DEFAULT_OPTIONS (progress.md D-30.5 audit).
    assert DEFAULT_DETECT_PARAMS.pre_stimulus_ms == 500.0
    assert DEFAULT_DETECT_PARAMS.theta_sd_k == 3.0
    assert DEFAULT_DETECT_PARAMS.sustain_ticks == 4
    assert DEFAULT_DETECT_PARAMS.anticipation_ms == 100.0
