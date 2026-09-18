from mousegrip.algorithms.cohort_report import build_report_model


def _run(participant: str, condition: str, mouse: str, grip: str, sensitivity: str) -> dict[str, str]:
    return {
        "participant": participant,
        "run_id": f"{participant}/{condition}.json",
        "condition_id": condition,
        "mouse": mouse,
        "grip": grip,
        "rep": "1",
        "admitted": "True",
        "started_at": f"2026-09-18T0{condition == 'C'}:00:00Z",
        "sensitivity": sensitivity,
        "hits_per_min": "40",
        "first_shot_rate": "0.8",
        "km_median_ms": "500",
    }


def _trial(run: dict[str, str], target: str) -> dict[str, str]:
    return {
        **{key: run[key] for key in ("participant", "run_id", "condition_id", "mouse", "grip", "rep", "admitted")},
        "target_id": target,
        "observed_ms": "500",
        "event_observed": "1",
        "first_fire_hit": "True",
        "peak_omega_deg_per_sec": "400",
        "entry_omega_deg_per_sec": "30",
        "brake_retention": "0.075",
        "trigger_margin_ms": "70",
        "overshoot_deg": "0",
        "drop_count": "0",
        "micro_adjust_count": "0",
        "fire_angle_error_deg": "0.5",
    }


def _pair(participant: str, contrast: str) -> dict[str, str]:
    return {
        "participant": participant,
        "contrast": contrast,
        "first_shot_delta": "1",
        "time_delta_ms": "25",
    }


def test_report_model_stratifies_gpw1_by_recorded_grip() -> None:
    s01a = _run("S01", "A", "GPW1", "1-2-2", "1.0")
    s01b = _run("S01", "B", "DK", "1-2-2", "1.1")
    s01c = _run("S01", "C", "DK", "1-3-1", "1.1")
    s06a = _run("S06", "A", "GPW1", "1-3-1", "1.0")
    s06c = _run("S06", "C", "DK", "1-3-1", "1.1")
    runs = [s01a, s01b, s01c, s06a, s06c]
    trials = [_trial(run, f"t{index}") for index, run in enumerate(runs, start=1)]
    coverage = [
        {"column": column, "tier": "0", "coverage": "1", "verdict": "admissible"}
        for column in (
            "peak_omega_deg_per_sec",
            "entry_omega_deg_per_sec",
            "brake_retention",
            "trigger_margin_ms",
            "overshoot_deg",
            "drop_count",
            "micro_adjust_count",
            "fire_angle_error_deg",
        )
    ]
    pairs = [
        _pair("S01", "A->B"),
        _pair("S01", "B->C"),
        _pair("S01", "A->C"),
        _pair("S06", "A->C"),
    ]

    model = build_report_model([], trials, runs, pairs, coverage)

    configs = {row["label"] for row in model["configurations"]}
    assert configs == {"GPW1/1-2-2", "GPW1/1-3-1", "DK/1-2-2", "DK/1-3-1"}
    contrasts = {row["key"]: row for row in model["contrasts"]}
    assert [row["participant"] for row in contrasts["mouse_122"]["rows"]] == ["S01"]
    assert [row["participant"] for row in contrasts["mouse_131"]["rows"]] == ["S06"]
    assert [row["participant"] for row in contrasts["configuration"]["rows"]] == ["S01"]


def test_sensitivity_is_reported_without_removing_contrast_rows() -> None:
    left1 = _run("S08", "A", "GPW1", "1-2-2", "1.1")
    right1 = _run("S08", "C", "DK", "1-3-1", "1.0")
    right2 = {**right1, "run_id": "S08/C2.json", "rep": "2", "sensitivity": "1.1"}
    runs = [left1, right1, right2]
    trials = [_trial(run, f"t{index}") for index, run in enumerate(runs, start=1)]

    model = build_report_model([], trials, runs, [_pair("S08", "A->C")], [])

    assert model["sensitivityChanges"] == [
        {"participant": "S08", "conditionId": "C", "values": [1.0, 1.1]}
    ]
    configuration = next(row for row in model["contrasts"] if row["key"] == "configuration")
    assert [row["participant"] for row in configuration["rows"]] == ["S08"]
