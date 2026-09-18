#!/usr/bin/env python3
"""props.json 草案體檢 (P3)。

用途:在寫任何場景程式碼之前,先確認 prop 佈局不會在 T3 淨空驗證時炸掉。
本腳本是 `src/scene/clearance.ts` 的**近似前哨**,不是它的替代品——
真正的判準永遠是 `validateClearance()` 與 T3 的對抗性 fixture。

用法:
    python check_props.py <props.json> [--eye-z 0] [--eye-height 1.6]
                          [--corridor-half-width 1] [--floor-y 0]
                          [--sightline 20] [--strict]

離開碼:0 = 綠燈(可能有 WARN);1 = 有 ERROR;2 = 用法錯誤。
--strict 讓 WARN 也算失敗。
"""
from __future__ import annotations

import argparse
import io
import json
import math
import re
import sys

# 與 src/scene/clearance.ts + src/drill/DrillConfig.ts 對齊。
# 若那兩處常數改了,這裡要跟著改(否則前哨會給出過期判定)。
CLEARANCE_MARGIN_U = 0.5
DEFAULT_HITBOX = {"width": 1.0, "height": 2.0, "depth": 1.0}
AXES = ("x", "y", "z")
GENERIC_ID = re.compile(r"^(box|prop|obj|mesh|cube|item)[-_]?\d*$", re.I)
ID_SHAPE = re.compile(r"^[a-z][a-z0-9-]*$")

errors: list[str] = []
warns: list[str] = []
infos: list[str] = []


def hitbox_radius(h: dict) -> float:
    return math.sqrt((h["width"] / 2) ** 2 + (h["height"] / 2) ** 2 + (h["depth"] / 2) ** 2)


def load_props(path: str) -> list[dict]:
    with io.open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if isinstance(doc, dict) and isinstance(doc.get("props"), list):
        return doc["props"]
    if isinstance(doc, list):
        return doc
    print(f"ERROR  無法辨識的格式:期望 {{'props': [...]}} 或頂層陣列 — {path}", file=sys.stderr)
    sys.exit(2)


def check_shape(props: list[dict]) -> list[dict]:
    """結構檢查。回傳通過結構檢查、可進幾何檢查的 prop。"""
    ok: list[dict] = []
    seen: dict[str, int] = {}
    for i, p in enumerate(props):
        where = f"props[{i}]"
        if not isinstance(p, dict):
            errors.append(f"{where} 不是物件")
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not pid:
            errors.append(f"{where}.id 必須是非空字串")
            continue
        where = f"props[{i}] ({pid})"
        if pid in seen:
            errors.append(f"{where} id 重複(已見於 props[{seen[pid]}])——淨空違規訊息會指名 id,必須唯一")
        else:
            seen[pid] = i
        if not ID_SHAPE.match(pid):
            warns.append(f"{where} id 建議 kebab-case(^[a-z][a-z0-9-]*$)")
        if GENERIC_ID.match(pid):
            warns.append(f"{where} id 無語意——違規訊息會變成 'box3 擋住目標',除錯困難")
        if not isinstance(p.get("kind"), str):
            warns.append(f"{where} 缺 kind(既有分類:wall/ground/guide/building/crate/barrel/barrier/rock/tree/shrub/hay/lamp/sign)")

        bad = False
        for corner in ("min", "max"):
            c = p.get(corner)
            if not isinstance(c, dict):
                errors.append(f"{where}.{corner} 必須是 {{x,y,z}} 物件")
                bad = True
                continue
            for a in AXES:
                v = c.get(a)
                if not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v):
                    errors.append(f"{where}.{corner}.{a} 必須是有限數字")
                    bad = True
        if bad:
            continue

        degenerate = []
        for a in AXES:
            lo, hi = p["min"][a], p["max"][a]
            if lo > hi:
                errors.append(f"{where}.min.{a} ({lo}) 必須 ≤ max.{a} ({hi}) — validatePropBounds 會擋")
                bad = True
            elif lo == hi:
                degenerate.append(a)
        if degenerate:
            warns.append(f"{where} 在 {'/'.join(degenerate)} 軸厚度為 0——零體積 prop 的相交判定行為不直觀,建議給最小厚度")
        if not bad:
            ok.append(p)
    return ok


def seg_hits_aabb(p0, p1, lo, hi) -> bool:
    """線段 vs AABB(slab method)。"""
    t0, t1 = 0.0, 1.0
    for i in range(3):
        d = p1[i] - p0[i]
        if abs(d) < 1e-12:
            if p0[i] < lo[i] or p0[i] > hi[i]:
                return False
            continue
        inv = 1.0 / d
        a = (lo[i] - p0[i]) * inv
        b = (hi[i] - p0[i]) * inv
        if a > b:
            a, b = b, a
        t0 = max(t0, a)
        t1 = min(t1, b)
        if t0 > t1:
            return False
    return True


def inflated(p: dict, r: float):
    lo = [p["min"][a] - r for a in AXES]
    hi = [p["max"][a] + r for a in AXES]
    return lo, hi


def main() -> int:
    ap = argparse.ArgumentParser(description="props.json 草案體檢")
    ap.add_argument("props_json")
    ap.add_argument("--eye-z", type=float, default=0.0, help="SceneConfig.proceduralRoom.eyeZ(radial-spawn 前向目標為 0)")
    ap.add_argument("--eye-height", type=float, default=1.6)
    ap.add_argument("--corridor-half-width", type=float, default=1.0)
    ap.add_argument("--floor-y", type=float, default=0.0)
    ap.add_argument("--sightline", type=float, default=0.0, help="正前方交戰距離(u);>0 才做視線遮蔽回報")
    ap.add_argument("--strict", action="store_true", help="WARN 也算失敗")
    args = ap.parse_args()

    raw = load_props(args.props_json)
    props = check_shape(raw)
    r = hitbox_radius(DEFAULT_HITBOX) + CLEARANCE_MARGIN_U

    eye = (0.0, args.eye_height, args.eye_z)
    cl = -args.corridor_half_width
    cr = args.corridor_half_width

    for p in props:
        pid = p["id"]
        lo_raw = [p["min"][a] for a in AXES]
        hi_raw = [p["max"][a] for a in AXES]

        # 眼位落在 prop 內 = 玩家卡在幾何裡
        if all(lo_raw[i] <= eye[i] <= hi_raw[i] for i in range(3)):
            errors.append(f"{pid} 包住眼位 {eye} — 玩家會卡在幾何裡")

        # 玩家走廊(眼高橫移線段)撞到 prop
        if seg_hits_aabb((cl, args.eye_height, args.eye_z), (cr, args.eye_height, args.eye_z), lo_raw, hi_raw):
            errors.append(f"{pid} 與玩家走廊相交(x∈[{cl},{cr}], y={args.eye_height}, z={args.eye_z})")

        # 膨脹後仍撞走廊 = 淨空驗證幾乎必拒
        lo_i, hi_i = inflated(p, r)
        if not seg_hits_aabb((cl, args.eye_height, args.eye_z), (cr, args.eye_height, args.eye_z), lo_raw, hi_raw) \
           and seg_hits_aabb((cl, args.eye_height, args.eye_z), (cr, args.eye_height, args.eye_z), lo_i, hi_i):
            warns.append(f"{pid} 膨脹 {r:.3f}u(hitbox 半徑 + margin)後與走廊相交 — validateClearance 很可能拒載")

        if p["min"]["y"] < args.floor_y - 1e-9:
            warns.append(f"{pid} min.y ({p['min']['y']}) 低於 floorY ({args.floor_y}) — 沉入地板")

        if args.sightline > 0:
            tgt = (0.0, args.eye_height, args.eye_z - args.sightline)
            if seg_hits_aabb(eye, tgt, lo_raw, hi_raw):
                infos.append(f"{pid} 擋住正前方 {args.sightline}u 視線 — peek 場景屬預期,請列入 allowedOcclusionPropIds;否則是 bug")

    print(f"props: {len(props)}/{len(raw)} 個通過結構檢查")
    print(f"膨脹半徑(預設 hitbox {DEFAULT_HITBOX['width']}x{DEFAULT_HITBOX['height']}x{DEFAULT_HITBOX['depth']} + margin {CLEARANCE_MARGIN_U}): {r:.4f}u")
    for m in infos:
        print(f"INFO   {m}")
    for m in warns:
        print(f"WARN   {m}")
    for m in errors:
        print(f"ERROR  {m}")

    if errors:
        print(f"\n❌ {len(errors)} 個 ERROR — 草案不成立,修好再進 P3 報告。")
        return 1
    if warns and args.strict:
        print(f"\n❌ --strict:{len(warns)} 個 WARN 視為失敗。")
        return 1
    print(f"\n✅ 綠燈({len(warns)} WARN / {len(infos)} INFO)。真正的判準仍是 T3 的 validateClearance 對抗性 fixture。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
