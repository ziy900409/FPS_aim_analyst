"""Load the JSON form of the schema v2 export documented in docs/operational/schema.md.

Ticks are flattened to the canonical analysis columns
``t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys,ads``. Events use the schema's sparse CSV column surface.
Stage 3/5 additive metadata and event fields are preserved when present and may be absent without
error. Validation failures expose the exact JSON field path through :class:`SchemaError`.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any

import pandas as pd


TICK_COLUMNS = (
    "t",
    "vx",
    "vz",
    "px",
    "pz",
    "tx",
    "ty",
    "tz",
    "yaw",
    "pitch",
    "d_yaw",
    "d_pitch",
    "keys",
    "ads",
)

EVENT_COLUMNS = (
    "type",
    "t",
    "targetId",
    "side",
    "key",
    "down",
    "hit",
    "firstShot",
    "residualSpeed",
    "shotSeq",
    "timeOfFlightMs",
    "viewYaw",
    "viewPitch",
    "aimPunchPitch",
    "aimPunchYaw",
    "spreadX",
    "spreadY",
    "recoilIndex",
    "ammo",
    "offsetDeg",
    "part",
    "targetX",
    "targetY",
    "targetZ",
)

_META_REQUIRED_TYPES: dict[str, type | tuple[type, ...]] = {
    "drillId": str,
    "schemaVersion": (int, float),
    "weaponId": str,
    "weaponSeed": (int, float),
    "rngSeed": (int, float),
    "backend": str,
    "displayHz": (int, float),
    "simHz": (int, float),
    "browser": str,
    "sensitivity": (int, float),
    "sensitivityModel": str,
    "movementModel": str,
    "crossOriginIsolated": bool,
    "startedAt": str,
    "unit": str,
    "vStrafe": (int, float),
    "maxDrillSeconds": (int, float),
    "lateEventCount": (int, float),
    "bufferOverflow": bool,
    "recorderOverflow": bool,
    "suspect": bool,
}

_EVENT_REQUIRED: dict[str, tuple[str, ...]] = {
    "visible": ("targetId", "side"),
    "counter": ("key",),
    "ads": ("down",),
    "fire": ("hit", "firstShot", "residualSpeed"),
    "hit": ("timeOfFlightMs", "shotSeq"),
    # WP-29 / T3 (additive, opt-in engine emission): raw key down/up at input timeStamp. The JSON field is
    # ``code`` (canonical A/D/W/S); it is mapped into the existing ``key`` column below so EVENT_COLUMNS and
    # the sparse CSV surface stay unchanged. Absence in older/opt-out exports is normal, not an error.
    "key": ("code", "down"),
}

_EVENT_NUMBERS = (
    "t",
    "residualSpeed",
    "shotSeq",
    "timeOfFlightMs",
    "viewYaw",
    "viewPitch",
    "aimPunchPitch",
    "aimPunchYaw",
    "spreadX",
    "spreadY",
    "recoilIndex",
    "ammo",
    "offsetDeg",
    "targetX",
    "targetY",
    "targetZ",
)

_EVENT_STRINGS = ("targetId", "side", "key", "part")
_EVENT_BOOLEANS = ("down", "hit", "firstShot")


class SchemaError(ValueError):
    """A schema v2 validation error with a machine-readable JSON field path."""

    def __init__(self, field_path: str, message: str) -> None:
        self.field_path = field_path
        super().__init__(f"{field_path}: {message}")


@dataclass(frozen=True)
class Export:
    """Validated export data prepared for offline analysis."""

    meta: dict[str, Any]
    ticks: pd.DataFrame
    events: pd.DataFrame
    source_path: Path


def load_export(path: Path) -> Export:
    """Read and validate one schema v2 JSON export."""

    source_path = Path(path)
    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SchemaError("$", f"invalid JSON: {error.msg}") from error

    root = _mapping(payload, "$")
    _reject_non_finite(root, "$")
    meta = _mapping(_required(root, "meta", "meta"), "meta")
    ticks = _list(_required(root, "ticks", "ticks"), "ticks")
    events = _list(_required(root, "events", "events"), "events")

    _validate_meta(meta)
    tick_rows = [_validate_tick(value, index) for index, value in enumerate(ticks)]
    event_rows = [_validate_event(value, index) for index, value in enumerate(events)]

    return Export(
        meta=dict(meta),
        ticks=pd.DataFrame(tick_rows, columns=TICK_COLUMNS),
        events=pd.DataFrame(event_rows, columns=EVENT_COLUMNS),
        source_path=source_path,
    )


def _validate_meta(meta: dict[str, Any]) -> None:
    for field, expected_type in _META_REQUIRED_TYPES.items():
        path = f"meta.{field}"
        value = _required(meta, field, path)
        _type(value, expected_type, path)

    version = meta["schemaVersion"]
    if isinstance(version, bool) or version != 2:
        raise SchemaError("meta.schemaVersion", "must equal 2")

    for field in ("drillId", "weaponId", "backend", "browser", "startedAt", "unit"):
        if not meta[field]:
            raise SchemaError(f"meta.{field}", "must be non-empty")

    for block in ("weapon", "targets", "spawn", "scene", "display", "frames", "session"):
        if block in meta:
            _mapping(meta[block], f"meta.{block}")


def _validate_tick(value: Any, index: int) -> dict[str, Any]:
    base = f"ticks[{index}]"
    tick = _mapping(value, base)
    row: dict[str, Any] = {}

    for field in ("t", "vx", "vz", "px", "pz"):
        path = f"{base}.{field}"
        row[field] = _number(_required(tick, field, path), path)

    for field in ("tx", "ty", "tz"):
        path = f"{base}.{field}"
        target_value = _required(tick, field, path)
        row[field] = None if target_value is None else _number(target_value, path)

    aim = _mapping(_required(tick, "aim", f"{base}.aim"), f"{base}.aim")
    row["yaw"] = _number(_required(aim, "yaw", f"{base}.aim.yaw"), f"{base}.aim.yaw")
    row["pitch"] = _number(_required(aim, "pitch", f"{base}.aim.pitch"), f"{base}.aim.pitch")

    # KI-005 / A (FR-A-12): additive tick-window mouse integral. Absent on pre-KI-005
    # exports -- filled with nan rather than erroring; present values must be finite.
    row["d_yaw"] = _optional_number(tick.get("dYaw"), f"{base}.dYaw")
    row["d_pitch"] = _optional_number(tick.get("dPitch"), f"{base}.dPitch")

    keys = _list(_required(tick, "keys", f"{base}.keys"), f"{base}.keys")
    for key_index, key in enumerate(keys):
        _type(key, str, f"{base}.keys[{key_index}]")
    row["keys"] = list(keys)

    ads = _required(tick, "ads", f"{base}.ads")
    _type(ads, bool, f"{base}.ads")
    row["ads"] = ads
    return row


def _validate_event(value: Any, index: int) -> dict[str, Any]:
    base = f"events[{index}]"
    event = _mapping(value, base)
    event_type = _required(event, "type", f"{base}.type")
    _type(event_type, str, f"{base}.type")
    if event_type not in _EVENT_REQUIRED:
        raise SchemaError(f"{base}.type", f"unsupported event type {event_type!r}")

    _number(_required(event, "t", f"{base}.t"), f"{base}.t")
    for field in _EVENT_REQUIRED[event_type]:
        _required(event, field, f"{base}.{field}")

    for field in _EVENT_NUMBERS:
        if field in event:
            _number(event[field], f"{base}.{field}")
    for field in _EVENT_STRINGS:
        if field in event:
            _type(event[field], str, f"{base}.{field}")
    for field in _EVENT_BOOLEANS:
        if field in event:
            _type(event[field], bool, f"{base}.{field}")

    if event_type == "visible":
        _non_empty_string(event["targetId"], f"{base}.targetId")
        if event["side"] not in ("L", "R"):
            raise SchemaError(f"{base}.side", "must be 'L' or 'R'")
    elif event_type == "counter":
        _non_empty_string(event["key"], f"{base}.key")
    elif event_type == "ads":
        _type(event["down"], bool, f"{base}.down")
    elif event_type == "fire":
        _type(event["hit"], bool, f"{base}.hit")
        _type(event["firstShot"], bool, f"{base}.firstShot")
        _number(event["residualSpeed"], f"{base}.residualSpeed")
    elif event_type == "hit":
        _number(event["timeOfFlightMs"], f"{base}.timeOfFlightMs")
        _number(event["shotSeq"], f"{base}.shotSeq")
    elif event_type == "key":
        _non_empty_string(event["code"], f"{base}.code")
        _type(event["down"], bool, f"{base}.down")

    row = {column: event.get(column) for column in EVENT_COLUMNS}
    if event_type == "key":
        # Canonical key name lives under the shared ``key`` column (same values as counter.key); consumers
        # disambiguate by ``type``. Keeps EVENT_COLUMNS and the CSV column surface additive-stable.
        row["key"] = event["code"]
    return row


def _required(container: dict[str, Any], field: str, field_path: str) -> Any:
    if field not in container:
        raise SchemaError(field_path, "is required")
    return container[field]


def _mapping(value: Any, field_path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SchemaError(field_path, "must be an object")
    return value


def _list(value: Any, field_path: str) -> list[Any]:
    if not isinstance(value, list):
        raise SchemaError(field_path, "must be an array")
    return value


def _type(value: Any, expected: type | tuple[type, ...], field_path: str) -> None:
    if isinstance(value, bool) and expected != bool:
        raise SchemaError(field_path, f"must be {_type_name(expected)}")
    if not isinstance(value, expected):
        raise SchemaError(field_path, f"must be {_type_name(expected)}")


def _number(value: Any, field_path: str) -> int | float:
    _type(value, (int, float), field_path)
    if not math.isfinite(value):
        raise SchemaError(field_path, "must be finite")
    return value


def _optional_number(value: Any, field_path: str) -> float:
    if value is None:
        return math.nan
    return _number(value, field_path)


def _non_empty_string(value: Any, field_path: str) -> None:
    _type(value, str, field_path)
    if not value:
        raise SchemaError(field_path, "must be non-empty")


def _type_name(expected: type | tuple[type, ...]) -> str:
    if isinstance(expected, tuple):
        return " or ".join(item.__name__ for item in expected)
    return expected.__name__


def _reject_non_finite(value: Any, field_path: str) -> None:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise SchemaError(field_path, "must be finite")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _reject_non_finite(item, f"{field_path}[{index}]")
        return
    if isinstance(value, dict):
        for field, item in value.items():
            child_path = field if field_path == "$" else f"{field_path}.{field}"
            _reject_non_finite(item, child_path)
