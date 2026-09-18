import json
import re

from mousegrip.notebooks.render_cohort_report import render_html


def test_report_is_offline_json_backed_and_escapes_script_content() -> None:
    model = {
        "participants": ["S<script>"],
        "summary": {
            "participantCount": 1,
            "runCount": 1,
            "admittedRunCount": 1,
            "blockedRunCount": 0,
            "presentationCount": 1,
            "lateEventRunCount": 0,
            "lateEventTotal": 0,
        },
        "configurations": [],
        "orders": [],
        "cells": [],
        "contrasts": [],
        "coverage": [],
        "blockedRuns": [],
        "sensitivityChanges": [],
        "policy": {"sensitivity": "adaptation", "inference": "participant weighted"},
    }

    html = render_html(model)

    assert '<script src=' not in html
    assert '<link rel="stylesheet"' not in html
    assert "--bg-0:#0f1113" in html
    assert "Sensitivity 視為玩家自適應" in html
    match = re.search(r'<script id="report-data" type="application/json">(.*?)</script>', html)
    assert match is not None
    assert "<script>" not in match.group(1)
    assert json.loads(match.group(1)) == model
